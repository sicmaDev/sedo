from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import librosa
import numpy as np
import tempfile
import os
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Stratégie de chargement du modèle
#
#  Priorité 1 : modèle Whisper fine-tuné Fon local (si disponible)
#  Priorité 2 : openai-whisper standard (téléchargement auto)
# ─────────────────────────────────────────────
FON_MODEL_PATH = os.environ.get(
    "FON_MODEL_PATH",
    os.path.join(os.path.dirname(__file__), "whisper-small-fon")
)
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small")

_mode      = None   # "fon" | "openai"
_processor = None   # HuggingFace processor (mode fon)
_hf_model  = None   # HuggingFace model (mode fon)
_ow_model  = None   # openai-whisper model (mode openai)

SEUIL_ENERGIE = 0.01


def get_model():
    global _mode, _processor, _hf_model, _ow_model

    if _mode is not None:
        return _mode

    # ── Tentative 1 : modèle Fon local ──────────────────────────────────────
    if os.path.isdir(FON_MODEL_PATH):
        try:
            from transformers import WhisperProcessor, WhisperForConditionalGeneration
            import torch
            print(f"[STT] Chargement modèle Fon local : {FON_MODEL_PATH}")
            _processor = WhisperProcessor.from_pretrained(FON_MODEL_PATH)
            _hf_model  = WhisperForConditionalGeneration.from_pretrained(FON_MODEL_PATH)
            _hf_model.eval()
            _mode = "fon"
            print("[STT] Modèle Fon prêt")
            return _mode
        except Exception as e:
            print(f"[STT] Modèle Fon indisponible ({e}), fallback openai-whisper")

    # ── Fallback : openai-whisper (téléchargement automatique) ──────────────
    try:
        import whisper
        print(f"[STT] Chargement openai-whisper ({WHISPER_MODEL_SIZE})...")
        _ow_model = whisper.load_model(WHISPER_MODEL_SIZE)
        _mode = "openai"
        print(f"[STT] openai-whisper/{WHISPER_MODEL_SIZE} prêt")
        return _mode
    except Exception as e:
        raise RuntimeError(f"[STT] Impossible de charger un modèle Whisper : {e}")


# ─────────────────────────────────────────────
# Mots-clés pour l'extraction
# ─────────────────────────────────────────────
MOTS_VENTE  = ["so", "sa", "ça", "sɔ", "vend", "vendu", "reçu", "gagné", "recette"]
MOTS_ACHAT  = ["ze", "zé", "blɔ", "acheté", "payé", "dépensé", "achat"]
MOTS_DEVISE = ["fcfa", "franc", "cfa"]

# Nombres en Fon (mots → chiffres)
NOMBRES_FON = {
    "kpɔn ko": 500, "tɔn ko": 500,
    "caki ɖokpo": 1000, "caki ɖokpoo": 1000, "caki ɖokpóo": 1000,
    "a ki ɖokpo": 1000, "kεki ɖokpo": 1000, "cakin ɖokpo": 1000,
    "chaki ɖokpo": 1000, "jaki ɖokpo": 1000,
    "nucaki ɖokpo": 1000, "ciaki ɖokpo": 1000,
    "ca xe ɖokpo": 1000, "caki": 1000,
    "caki wu we": 2000, "caki we": 2000, "caki hwe": 2000, "caki εnε": 2000,
    "ca kya tɔn": 3000,
    "a kya εn mε": 4000,
    "a kya tɔn": 5000,
    "sata yi zε": 6000, "a kya yi zεn": 6000,
    "a ki tε we": 7000, "ki te we": 7000,
    "e tantan": 8000, "caki tɔn kpɔn": 8000,
    "e ta mε": 9000, "a ki tεnε": 9000,
    "caki wo": 10000,
    "ca kya fɔ tɔn": 15000,
    "caki gbɔn": 30000,
}

# Nombres en français parlé (pour openai-whisper en mode fr)
NOMBRES_FR = {
    "cinq cents": 500, "cinq cent": 500,
    "mille": 1000, "un millier": 1000,
    "deux mille": 2000, "trois mille": 3000,
    "quatre mille": 4000, "cinq mille": 5000,
    "six mille": 6000, "sept mille": 7000,
    "huit mille": 8000, "neuf mille": 9000,
    "dix mille": 10000, "quinze mille": 15000,
    "vingt mille": 20000, "vingt-cinq mille": 25000,
    "trente mille": 30000, "cinquante mille": 50000,
    "cent mille": 100000,
}


# ─────────────────────────────────────────────
# Extraction des données structurées
# ─────────────────────────────────────────────
def extraire_donnees(texte: str) -> dict:
    texte_lower = texte.lower()

    # Action
    action = None
    for mot in MOTS_VENTE:
        if mot in texte_lower:
            action = "vente"
            break
    if action is None:
        for mot in MOTS_ACHAT:
            if mot in texte_lower:
                action = "achat"
                break

    # Montant — chiffres arabes en priorité
    montant = None
    nombres = re.findall(r'\d[\d\s]*\d|\d', texte)
    if nombres:
        candidats = [int(re.sub(r'\s', '', n)) for n in nombres]
        montant = max(candidats)

    # Montant — mots Fon
    if montant is None:
        for mot, valeur in sorted(NOMBRES_FON.items(), key=lambda x: len(x[0]), reverse=True):
            if mot in texte_lower:
                montant = valeur
                break

    # Montant — mots français
    if montant is None:
        for mot, valeur in sorted(NOMBRES_FR.items(), key=lambda x: len(x[0]), reverse=True):
            if mot in texte_lower:
                montant = valeur
                break

    # Devise
    devise = "FCFA"
    for mot in MOTS_DEVISE:
        if mot in texte_lower:
            devise = "FCFA"
            break

    return {"action": action, "montant": montant, "devise": devise}


# ─────────────────────────────────────────────
# Transcription audio → texte
# ─────────────────────────────────────────────
def transcrire(audio_path: str, language: str = "fr") -> str | None:
    audio, sr = librosa.load(audio_path, sr=16000)

    rms = float(np.sqrt(np.mean(audio ** 2)))
    print(f"[STT] Energie RMS: {round(rms, 4)}")
    if rms < SEUIL_ENERGIE:
        return None

    mode = get_model()

    if mode == "fon":
        import torch
        inputs = _processor(audio, sampling_rate=16000, return_tensors="pt")
        with torch.no_grad():
            predicted_ids = _hf_model.generate(inputs.input_features)
        text = _processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()
        print(f"[STT] Transcription Fon: {text}")
        return text

    else:  # mode openai
        # Pour le Fon, on laisse Whisper auto-détecter (language=None)
        # Pour le français, on force "fr"
        lang = None if language == "fon" else language
        options = dict(language=lang, task="transcribe")
        result = _ow_model.transcribe(audio_path, **options)
        text = result["text"].strip()
        print(f"[STT] Transcription openai-whisper ({lang or 'auto'}): {text}")
        return text


# ─────────────────────────────────────────────
# Routes API
# ─────────────────────────────────────────────
@app.get("/health")
def health():
    mode = _mode or "non chargé"
    modele = "whisper-fon-local" if mode == "fon" else f"openai-whisper/{WHISPER_MODEL_SIZE}"
    return {
        "status": "ok",
        "service": "SEDO STT",
        "mode": mode,
        "modele": modele,
    }


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form(default="fr")
):
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        text = transcrire(tmp_path, language=language)

        if text is None:
            return {
                "reconnue": False,
                "text": "",
                "donnees": None,
                "confiance": 0,
                "message": "Aucune voix détectée — parlez plus fort"
            }

        donnees = extraire_donnees(text)
        mode    = _mode or "inconnu"
        modele  = "whisper-fon" if mode == "fon" else f"openai-whisper/{WHISPER_MODEL_SIZE}"

        print(f"[STT] Données extraites: {donnees}")
        return {
            "reconnue": True,
            "text": text,
            "donnees": donnees,
            "confiance": 80.0 if mode == "fon" else 70.0,
            "langue": language,
            "moteur": modele,
        }

    except Exception as e:
        print(f"[STT] Erreur: {e}")
        return {
            "reconnue": False,
            "text": "",
            "donnees": None,
            "confiance": 0,
            "message": f"Erreur de traitement: {str(e)}"
        }
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

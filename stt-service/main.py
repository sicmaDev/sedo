from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import librosa
import numpy as np
import tempfile
import os
import re
import torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Chargement Whisper fine-tuné Fon
# ─────────────────────────────────────────────
FON_MODEL_PATH = os.path.join(os.path.dirname(__file__), 'whisper-small-fon')

print("Chargement du modele Whisper Fon...")
whisper_processor = WhisperProcessor.from_pretrained(FON_MODEL_PATH)
whisper_model = WhisperForConditionalGeneration.from_pretrained(FON_MODEL_PATH)
whisper_model.eval()
print("Modele Whisper Fon pret")

SEUIL_ENERGIE = 0.03

# ─────────────────────────────────────────────
# Mots-clés Fon pour l'extraction
# ─────────────────────────────────────────────
MOTS_VENTE  = ["so", "sa", "ça", "sɔ"]      # vendre
MOTS_ACHAT  = ["ze", "zé", "blɔ"]     # acheter
MOTS_DEVISE = ["fcfa", "franc", "cfa"]

# Nombres en Fon (mots → chiffres)
NOMBRES_FON = {
    # 500
    "kpɔn ko": 500, "tɔn ko": 500,
    # 700
    "un xo atɔn nukwɔn tɔn": 700, "un gban e we awi": 700,
    # 800
    "a klo kpo e we kpo un gbantɔn": 800,
    # 900
    "akpo ɖo kpo e xwe kpo e nε": 900,
    # 1000 — toutes variantes
    "caki ɖokpo": 1000, "caki ɖokpoo": 1000, "caki ɖokpóo": 1000,
    "a ki ɖokpo": 1000, "kεki ɖokpo": 1000, "cakin ɖokpo": 1000, "caki ɖokpó": 1000,
    "chaki ɖokpo": 1000, "chaki ɖokpoo": 1000,
    "jaki ɖokpo": 1000, "jaki ɖokpoo": 1000,
    "nucaki ɖokpo": 1000, "nucaki ɖokpoo": 1000,
    "ciaki ɖokpo": 1000, "ciaki ɖokpoo": 1000, "ciaki ɖokpó": 1000,
    "ca xe ɖokpo": 1000, "ca ke ɖokpo": 1000,
    "kpocya kido kpo": 1000, "cya kido kpo": 1000,
    "cea kido kpo": 1000, "cea kyi ɖo ku": 1000,
    "ci aki ɖokpoo": 1000, "ciakido kpo": 1000,
    "ciaki ɖo kpo": 1000, "jaki ɖo kpo": 1000,
    "ja ki do kpo": 1000, "chakidopko": 1000,
    "caki": 1000,
    # 1100
    "a klo kpo kpɔn un nε": 1100,
    # 1150
    "a klo kpo kpo nyi zεn": 1150,
    # 1200
    "a ɖe do kpo kpo un tantɔn": 1200,
    # 1250
    "a ɖe o kpo kpo un wo": 1250,
    # 1300
    "a ɖe do xpo kpɔn wu e we": 1300,
    # 1325
    "kɔn we atɔn jaki ɖokpokpɔn we atɔn": 1325,
    "a klo kpo kpɔn we atɔn": 1325,
    # 1350
    "caki ɖokpokpɔn wε ε nε": 1350,
    # 1375
    "jaki ɖo kpo kpo wu xɔ tɔn": 1375,
    # 1400
    "ki ɖokpo kpo xɔ tɔn wukun ɖokpo": 1400,
    # 1500
    "caki ɖokpo atade": 1500,
    # 2000
    "caki wu we": 2000, "caki we": 2000, "caki hwe": 2000, "caki εnε": 2000,
    # 2500
    "a ki we a ɖa ɖe": 2500,
    # 3000
    "ca kya tɔn": 3000,
    # 3100
    "a kya tɔn kpɔn εnε": 3100,
    # 3150
    "akya ɖokpɔn jizεn": 3150,
    # 3200
    "ya jε atɔ gbɔn tantɔn": 3200,
    # 3500
    "taka to ada ɖe": 3500,
    # 4000
    "a kya εn mε": 4000,
    # 4500
    "kεnε a ɖa ɖe": 4500,
    # 5000
    "a kya tɔn": 5000,
    # 5500
    "caca to ɔ ɖa ɖe": 5500,
    # 6000
    "sata yi zε": 6000, "a kya yi zεn": 6000,
    "caki a yi zεn": 6000, "ki a yi zεn": 6000, "za kε a yi zan": 6000,
    # 7000
    "a ki tε we": 7000, "ki te we": 7000,
    # 8000
    "e tantan": 8000, "caki tɔn kpɔn": 8000,
    # 9000
    "e ta mε": 9000, "a ki tεnε": 9000,
    # 10000
    "caki wo": 10000,
    # 11000
    "jaki wo ɖo gbo": 11000, "e ɖo gbo": 11000, "e ɖo gbe": 11000,
    # 12000
    "e ta ki wewe": 12000, "saki wewe": 12000, "caki wewe": 12000,
    # 13000
    "a ɖe wa tɔn": 13000, "e ta ki wa tɔn": 13000,
    # 14000
    "a ki wε nε": 14000, "a ɖi wε εnε": 14000, "javi wε nε": 14000,
    # 15000
    "ca kya fɔ tɔn": 15000,
    # 16000
    "cakya fɔ tɔn klo kpo": 16000,
    # 17000
    "cakafɔ tɔn kungu we": 17000,
    # 18000
    "jajajafɔ tɔn kwan tɔn": 18000,
    # 19000
    "kaka kpo kpo nukun εnε": 19000, "a xia xo tɔn xwe nε": 19000,
    # 30000
    "caki gbɔn": 30000,
}


# ─────────────────────────────────────────────
# Extraction des données structurées
# ─────────────────────────────────────────────
def extraire_donnees(texte: str) -> dict:
    texte_lower = texte.lower()

    # Détecter l'action
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

    # Extraire le montant (chiffres arabes)
    montant = None
    nombres = re.findall(r'\d+', texte)
    if nombres:
        montant = int(max(nombres, key=lambda x: int(x)))

    # Si pas de chiffres, chercher mots Fon (expressions longues en premier)
    if montant is None:
        for mot, valeur in sorted(NOMBRES_FON.items(), key=lambda x: len(x[0]), reverse=True):
            if mot in texte_lower:
                montant = valeur
                break

    # Détecter la devise
    devise = None
    for mot in MOTS_DEVISE:
        if mot in texte_lower:
            devise = "FCFA"
            break
    if devise is None and montant is not None:
        devise = "FCFA"  # Devise par défaut

    return {
        "action": action,
        "montant": montant,
        "devise": devise,
    }


# ─────────────────────────────────────────────
# Transcription Fon (Whisper)
# ─────────────────────────────────────────────
def transcrire_fon(audio_path: str):
    audio, sr = librosa.load(audio_path, sr=16000)

    rms = float(np.sqrt(np.mean(audio ** 2)))
    print(f"Energie RMS: {round(rms, 4)}")
    if rms < SEUIL_ENERGIE:
        return None

    inputs = whisper_processor(audio, sampling_rate=16000, return_tensors="pt")
    with torch.no_grad():
        predicted_ids = whisper_model.generate(inputs.input_features)

    transcription = whisper_processor.batch_decode(predicted_ids, skip_special_tokens=True)[0].strip()
    print(f"Transcription Fon: {transcription}")
    return transcription


# ─────────────────────────────────────────────
# Routes API
# ─────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "SEDO STT",
        "modele": "whisper-small-fon"
    }


@app.post("/transcribe")
async def transcribe(
    audio: UploadFile = File(...),
    language: str = Form(default="fon")
):
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        # Etape 1 — Transcription Fon
        transcription = transcrire_fon(tmp_path)

        if transcription is None:
            return {
                "reconnue": False,
                "text": "",
                "donnees": None,
                "confiance": 0,
                "message": "Aucune voix detectee — veuillez parler"
            }

        # Etape 2 — Extraction des données structurées
        donnees = extraire_donnees(transcription)
        print(f"Donnees extraites: {donnees}")

        return {
            "reconnue": True,
            "text": transcription,
            "donnees": donnees,
            "confiance": 75.0,
            "langue": "fon",
            "moteur": "whisper-fon"
        }

    except Exception as e:
        print(f"Erreur STT: {e}")
        return {
            "reconnue": False,
            "text": "",
            "donnees": None,
            "confiance": 0,
            "message": f"Erreur de traitement: {str(e)}"
        }
    finally:
        os.unlink(tmp_path)

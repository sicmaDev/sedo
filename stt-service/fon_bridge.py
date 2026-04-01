"""
SEDO — Passerelle STT Fon
=========================
Fichier séparé — ne touche pas à main.py sauf inclusion du router.

Pour intégrer ton modèle Fon entraîné :
  1. Charge ton modèle dans load_fon_model()
  2. Remplis transcribe_with_fon_model() avec ton inférence
  3. C'est tout — la transcription → comptabilité est automatique
"""

from fastapi import APIRouter, UploadFile, File
import tempfile
import os
import re
import random

router = APIRouter()

# ─── Phrases Fon pour l'agent ─────────────────────────────────────────────────
# L'agent les lit à voix haute au téléphone
FON_SCRIPT = {
    "bienvenue": "Mi mɔ wɛ! Un do SEDO dó. Mì na d'akpá nú wɛ e mì wá dó égbé.",
    "ventes":    "Akwɛ étɛ wɛ a sɔ́ ná nùɖé égbé? Ɖɔ xwé ɖé mì.",
    "depenses":  "Akwɛ étɛ wɛ a sɔ́ dó nùɖé égbé? Ɖɔ xwé ɖé mì.",
    "compris":   "Ɛ̀ jɛ wɛ. Un ko yí gbe.",
    "repeter":   "Un mɔ xó ɔ xwé ǎ. Ɖɔ xwé ɖé mì.",
    "merci":     "Àgǎnmɛ! Égbé mì sín nùkún ɖé ko wlí.",
}

# ─── Simulation : réponses Fon typiques attendues ────────────────────────────
# En production ces lignes seront remplacées par ton modèle réel
FON_SIMULATION = [
    {"fon": "ɖokpo gbè",       "french": "mille francs",       "amount": 1000},
    {"fon": "wegó gbè",        "french": "deux mille francs",   "amount": 2000},
    {"fon": "atɔn gbè",        "french": "trois mille francs",  "amount": 3000},
    {"fon": "asun gbè",        "french": "cinq mille francs",   "amount": 5000},
    {"fon": "wǒ gbè",          "french": "dix mille francs",    "amount": 10000},
    {"fon": "wǒ gbè wegó",     "french": "douze mille francs",  "amount": 12000},
    {"fon": "wǒ gbè asun",     "french": "quinze mille francs", "amount": 15000},
    {"fon": "gbè ɖokpo",       "french": "cent francs",         "amount": 100},
    {"fon": "gbè atɔn",        "french": "trois cents francs",  "amount": 300},
    {"fon": "gbè asun",        "french": "cinq cents francs",   "amount": 500},
]

# ─── Modèle Fon ──────────────────────────────────────────────────────────────
FON_MODEL = None

def load_fon_model():
    """
    ═══════════════════════════════════════════════════
    POINT D'INTÉGRATION — charge ton modèle ici
    ═══════════════════════════════════════════════════

    Exemple Whisper fine-tuné :
        import whisper
        global FON_MODEL
        FON_MODEL = whisper.load_model("./models/fon_model.pt")

    Exemple HuggingFace :
        from transformers import pipeline
        global FON_MODEL
        FON_MODEL = pipeline("automatic-speech-recognition", model="./models/fon")

    Exemple Vosk :
        from vosk import Model
        global FON_MODEL
        FON_MODEL = Model("./models/fon_vosk")
    """
    print("⚠️  Modèle Fon : mode SIMULATION — intègre ton modèle dans load_fon_model()")


def transcribe_with_fon_model(audio_path: str) -> dict:
    """
    ═══════════════════════════════════════════════════
    POINT D'INTÉGRATION — appelle ton modèle ici
    ═══════════════════════════════════════════════════

    Remplace le bloc simulation par :

    Whisper :
        result = FON_MODEL.transcribe(audio_path, language="fr")
        return {"text": result["text"], "langue": "fon"}

    HuggingFace :
        result = FON_MODEL(audio_path)
        return {"text": result["text"], "langue": "fon"}

    Vosk :
        # (voir doc Vosk pour streaming)
        return {"text": texte_reconnu, "langue": "fon"}
    """

    if FON_MODEL is not None:
        # ← décommente ton inférence ici quand le modèle est prêt
        pass

    # SIMULATION — réponse réaliste aléatoire
    sample = random.choice(FON_SIMULATION)
    return {
        "text":         sample["french"],
        "fon_original": sample["fon"],
        "amount":       sample["amount"],
        "langue":       "fon",
        "mode":         "simulation",
    }


# ─── Extraction montant depuis texte français ─────────────────────────────────
def extract_amount(text: str):
    if not text:
        return None
    t = text.lower()

    # Chiffres directs
    m = re.search(r'(\d[\d\s]*)', t)
    if m:
        val = float(m.group(1).replace(' ', ''))
        if val > 0:
            return val

    # Mots français
    words = {
        'cent': 100, 'deux cents': 200, 'trois cents': 300,
        'quatre cents': 400, 'cinq cents': 500,
        'mille': 1000, 'deux mille': 2000, 'trois mille': 3000,
        'quatre mille': 4000, 'cinq mille': 5000,
        'dix mille': 10000, 'quinze mille': 15000,
        'vingt mille': 20000, 'cinquante mille': 50000,
        'cent mille': 100000,
    }
    for word, val in words.items():
        if word in t:
            return val
    return None


# ─── Endpoint POST /transcribe-fon ───────────────────────────────────────────
@router.post("/transcribe-fon")
async def transcribe_fon(audio: UploadFile = File(...)):
    """
    Reçoit audio (webm/wav/ogg) → passe par modèle Fon → retourne texte + montant.
    Le montant est utilisé par le simulateur pour sauvegarder la transaction.
    """
    suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        tmp_path = tmp.name

    try:
        result = transcribe_with_fon_model(tmp_path)
        amount = result.get("amount") or extract_amount(result.get("text", ""))

        return {
            "reconnue":     amount is not None,
            "text":         result.get("text", ""),
            "fon_original": result.get("fon_original", ""),
            "amount":       amount,
            "langue":       "fon",
            "mode":         result.get("mode", "production"),
        }
    except Exception as e:
        print(f"❌ Erreur STT Fon: {e}")
        return {"reconnue": False, "text": "", "amount": None, "langue": "fon", "error": str(e)}
    finally:
        os.unlink(tmp_path)


# ─── Endpoint GET /fon-questions ─────────────────────────────────────────────
@router.get("/fon-questions")
def get_fon_questions():
    """Retourne le script Fon de l'agent."""
    return FON_SCRIPT

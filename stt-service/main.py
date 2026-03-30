from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import librosa
import numpy as np
from scipy.spatial.distance import cosine
import tempfile
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Charger la référence au démarrage
REFERENCE_PATH = os.path.join(os.path.dirname(__file__), 'reference_vente_1000.npy')
reference = np.load(REFERENCE_PATH)
print(f"✅ Référence chargée — shape: {reference.shape}")

SEUIL_SIMILARITE = 0.80

def calculer_empreinte(audio_path: str) -> np.ndarray:
    audio, sr = librosa.load(audio_path, sr=16000)
    mfcc = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=13)
    return np.mean(mfcc, axis=1)

def reconnaitre_phrase(audio_path: str) -> dict:
    empreinte = calculer_empreinte(audio_path)
    similarite = 1 - cosine(empreinte, reference)

    print(f"📊 Similarité: {round(similarite * 100, 1)}%")

    confiance = float(round(float(similarite) * 100, 1))

    if similarite >= SEUIL_SIMILARITE:
        return {
            "reconnue": True,
            "text": "J'ai vendu pour 1000 FCFA",
            "type": "vente",
            "montant": 1000,
            "devise": "FCFA",
            "confiance": confiance,
            "langue": "fon"
        }
    else:
        return {
            "reconnue": False,
            "text": "",
            "confiance": confiance,
            "message": "Phrase non reconnue — veuillez répéter"
        }

@app.get("/health")
def health():
    return {"status": "ok", "service": "SEDO STT"}

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
        resultat = reconnaitre_phrase(tmp_path)
        return resultat
    except Exception as e:
        print(f"❌ Erreur STT: {e}")
        return {
            "reconnue": False,
            "text": "",
            "confiance": 0,
            "message": f"Erreur de traitement: {str(e)}"
        }
    finally:
        os.unlink(tmp_path)

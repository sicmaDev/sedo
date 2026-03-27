"""
SEDO STT Service — Speech-to-Text pour langues locales béninoises
FastAPI — Prêt à recevoir ton modèle fine-tuné

Langues supportées : fr (français), fon, yoruba, adja, bariba, dendi, peulh
Endpoint principal : POST /transcribe
"""

import os
import io
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import librosa
import soundfile as sf
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SEDO STT Service",
    description="Speech-to-Text pour langues locales béninoises",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Gestion du modèle
# ─────────────────────────────────────────────

MODELS_DIR = Path("./models")
MODELS_DIR.mkdir(exist_ok=True)

SUPPORTED_LANGUAGES = {
    "fr": "Français",
    "fon": "Fon",
    "yoruba": "Yoruba",
    "adja": "Adja",
    "bariba": "Bariba",
    "dendi": "Dendi",
    "peulh": "Peulh / Fulfulde",
}

# Dictionnaire des modèles chargés (langue -> pipeline)
loaded_models: dict = {}


def load_model(language: str):
    """
    Charge le modèle STT pour une langue donnée.

    Pour brancher ton modèle fine-tuné :
    1. Place le dossier du modèle dans ./models/{language}/
    2. Le dossier doit contenir config.json, pytorch_model.bin, preprocessor_config.json
    3. Cette fonction sera appelée automatiquement au premier appel pour cette langue.

    Exemple avec Whisper fine-tuné :
        from transformers import pipeline
        pipe = pipeline(
            "automatic-speech-recognition",
            model=f"./models/{language}",
            device="cpu",  # ou "cuda" si GPU disponible
        )
        return pipe
    """
    model_path = MODELS_DIR / language
    if not model_path.exists():
        return None

    try:
        from transformers import pipeline
        logger.info(f"Chargement du modèle pour la langue : {language}")
        pipe = pipeline(
            "automatic-speech-recognition",
            model=str(model_path),
            device=-1,  # CPU. Remplacer par 0 si GPU CUDA disponible
        )
        loaded_models[language] = pipe
        logger.info(f"Modèle {language} chargé avec succès")
        return pipe
    except Exception as e:
        logger.error(f"Erreur chargement modèle {language}: {e}")
        return None


def get_model(language: str):
    if language in loaded_models:
        return loaded_models[language]
    return load_model(language)


# ─────────────────────────────────────────────
# Preprocessing audio
# ─────────────────────────────────────────────

def preprocess_audio(audio_bytes: bytes, target_sr: int = 16000) -> np.ndarray:
    """
    Convertit n'importe quel format audio en tableau numpy 16kHz mono.
    Formats supportés : webm, mp3, wav, ogg, m4a, etc.
    """
    try:
        audio_buffer = io.BytesIO(audio_bytes)
        audio, sr = librosa.load(audio_buffer, sr=target_sr, mono=True)
        return audio
    except Exception as e:
        raise ValueError(f"Impossible de décoder l'audio : {e}")


# ─────────────────────────────────────────────
# Modèles de réponse
# ─────────────────────────────────────────────

class TranscriptionResponse(BaseModel):
    text: str
    language: str
    language_name: str
    confidence: Optional[float] = None
    model_used: str
    duration_seconds: Optional[float] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    loaded_models: list[str]
    available_languages: dict


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@app.get("/", response_model=HealthResponse)
async def root():
    return {
        "status": "ok",
        "service": "SEDO STT Service",
        "version": "1.0.0",
        "loaded_models": list(loaded_models.keys()),
        "available_languages": SUPPORTED_LANGUAGES,
    }


@app.get("/health", response_model=HealthResponse)
async def health():
    return {
        "status": "ok",
        "service": "SEDO STT Service",
        "version": "1.0.0",
        "loaded_models": list(loaded_models.keys()),
        "available_languages": SUPPORTED_LANGUAGES,
    }


@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    audio: UploadFile = File(..., description="Fichier audio (webm, mp3, wav, ogg)"),
    language: str = Form(default="fr", description="Code langue : fr, fon, yoruba, adja, bariba, dendi, peulh"),
):
    """
    Transcrit un fichier audio en texte.

    - Si un modèle fine-tuné existe pour la langue demandée, il est utilisé.
    - Sinon, retourne une réponse de simulation pour les tests.

    Pour intégrer ton modèle : place-le dans ./models/{language}/
    """
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Langue non supportée. Choisir parmi : {', '.join(SUPPORTED_LANGUAGES.keys())}",
        )

    # Lire l'audio
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Fichier audio vide")

    try:
        audio_array = preprocess_audio(audio_bytes)
        duration = len(audio_array) / 16000
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Utiliser le modèle si disponible
    model = get_model(language)

    if model is not None:
        try:
            result = model(audio_array)
            text = result.get("text", "").strip()
            return TranscriptionResponse(
                text=text,
                language=language,
                language_name=SUPPORTED_LANGUAGES[language],
                model_used=f"fine-tuned/{language}",
                duration_seconds=round(duration, 2),
            )
        except Exception as e:
            logger.error(f"Erreur inférence modèle {language}: {e}")
            raise HTTPException(status_code=500, detail=f"Erreur du modèle : {e}")

    # ── Mode simulation (aucun modèle chargé) ──
    # Retourne un exemple de transcription pour les tests frontend
    logger.info(f"Mode simulation pour langue={language} (aucun modèle chargé)")
    simulation_texts = {
        "fr": "J'ai reçu quinze mille francs pour une vente de marchandises",
        "fon": "[Transcription Fon - modèle non encore chargé]",
        "yoruba": "[Transcription Yoruba - modèle non encore chargé]",
        "adja": "[Transcription Adja - modèle non encore chargé]",
        "bariba": "[Transcription Bariba - modèle non encore chargé]",
        "dendi": "[Transcription Dendi - modèle non encore chargé]",
        "peulh": "[Transcription Peulh - modèle non encore chargé]",
    }

    return TranscriptionResponse(
        text=simulation_texts.get(language, ""),
        language=language,
        language_name=SUPPORTED_LANGUAGES[language],
        model_used="simulation",
        duration_seconds=round(duration, 2),
    )


@app.get("/models")
async def list_models():
    """Liste les modèles disponibles sur disque"""
    available = []
    for lang in SUPPORTED_LANGUAGES:
        model_path = MODELS_DIR / lang
        available.append({
            "language": lang,
            "language_name": SUPPORTED_LANGUAGES[lang],
            "model_path": str(model_path),
            "exists": model_path.exists(),
            "loaded": lang in loaded_models,
        })
    return available


@app.post("/models/{language}/load")
async def load_model_endpoint(language: str):
    """Charge manuellement un modèle pour une langue"""
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="Langue non supportée")
    model = load_model(language)
    if model is None:
        raise HTTPException(
            status_code=404,
            detail=f"Modèle introuvable dans ./models/{language}/. Placez-y votre modèle fine-tuné.",
        )
    return {"status": "loaded", "language": language}

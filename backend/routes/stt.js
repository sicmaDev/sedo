const express = require('express');
const multer  = require('multer');
const axios   = require('axios');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Extraction texte → données structurées (français + Fon basique) ─────────
const MOTS_VENTE = ['vendu', 'vend', 'reçu', 'recette', 'gagné', 'perçu', 'encaissé', 'so', 'sa', 'sɔ'];
const MOTS_ACHAT = ['acheté', 'achat', 'payé', 'dépensé', 'dépense', 'ze', 'zé', 'blɔ'];
const NOMBRES_FR = {
  'cinq cents': 500, 'cinq cent': 500,
  'un millier': 1000, 'mille': 1000,
  'deux mille': 2000, 'trois mille': 3000, 'quatre mille': 4000,
  'cinq mille': 5000, 'six mille': 6000, 'sept mille': 7000,
  'huit mille': 8000, 'neuf mille': 9000, 'dix mille': 10000,
  'onze mille': 11000, 'douze mille': 12000, 'quinze mille': 15000,
  'vingt mille': 20000, 'vingt-cinq mille': 25000,
  'trente mille': 30000, 'quarante mille': 40000,
  'cinquante mille': 50000, 'cent mille': 100000,
};

function extraireDonnees(texte) {
  const t = texte.toLowerCase();

  // Détecter l'action
  let action = null;
  for (const m of MOTS_VENTE) { if (t.includes(m)) { action = 'vente'; break; } }
  if (!action) for (const m of MOTS_ACHAT) { if (t.includes(m)) { action = 'achat'; break; } }

  // Montant — chiffres arabes (ex: "15000", "15 000")
  let montant = null;
  const nums = texte.match(/\d[\d\u00a0\s]*\d|\d/g);
  if (nums) {
    const candidats = nums.map(n => parseInt(n.replace(/[\u00a0\s]/g, '')));
    montant = Math.max(...candidats);
  }

  // Montant — mots français (ex: "quinze mille")
  if (!montant) {
    const sorted = Object.entries(NOMBRES_FR).sort((a, b) => b[0].length - a[0].length);
    for (const [mot, val] of sorted) {
      if (t.includes(mot)) { montant = val; break; }
    }
  }

  return { action, montant, devise: 'FCFA' };
}

// POST /api/stt/extract — texte → données structurées (Web Speech API)
router.post('/extract', authenticate, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Texte requis' });

  const donnees = extraireDonnees(text);
  res.json({ text, donnees });
});

// POST /api/stt/transcribe — proxy audio vers le service FastAPI (optionnel)
router.post('/transcribe', authenticate, upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier audio requis' });

  const sttUrl = process.env.STT_SERVICE_URL;
  if (!sttUrl) return res.status(503).json({ error: 'Service STT non configuré' });

  const language = req.body.language || 'fr';

  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('audio', req.file.buffer, {
      filename: req.file.originalname || 'audio.webm',
      contentType: req.file.mimetype,
    });
    form.append('language', language);

    const response = await axios.post(`${sttUrl}/transcribe`, form, {
      headers: form.getHeaders(),
      timeout: 120000,
    });

    res.json(response.data);
  } catch (err) {
    console.error('STT service error:', err.message);
    res.status(503).json({ error: 'Service STT indisponible', details: err.message });
  }
});

module.exports = router;

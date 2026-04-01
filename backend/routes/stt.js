const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/stt/transcribe — proxy vers le service FastAPI STT
router.post('/transcribe', authenticate, upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier audio requis' });

  const language = req.body.language || 'fr';

  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('audio', req.file.buffer, {
      filename: req.file.originalname || 'audio.webm',
      contentType: req.file.mimetype,
    });
    form.append('language', language);

    const response = await axios.post(`${process.env.STT_SERVICE_URL}/transcribe`, form, {
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

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const { calculateScore, getLatestScore } = require('../services/scoring');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/score — dernier score
router.get('/', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    let score = await getLatestScore(profile.id);
    if (!score) {
      score = await calculateScore(profile.id);
    }
    res.json(score);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/score/calculate — recalcule le score
router.post('/calculate', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const score = await calculateScore(profile.id);
    res.json(score);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

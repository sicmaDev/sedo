const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { getLatestScore } = require('../services/scoring');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/financement/offers — offres personnalisées selon le score et le profil
router.get('/offers', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const latestScore = await getLatestScore(profile.id);
    const score = latestScore ? latestScore.total : 0;

    const allOffers = await prisma.financingOffer.findMany({
      where: { isActive: true },
      orderBy: { minScore: 'asc' },
    });

    const offers = allOffers.map((offer) => {
      const eligible = score >= offer.minScore &&
        (offer.sector === null || offer.sector === profile.sector);
      return {
        ...offer,
        eligible,
        userScore: score,
        gapToEligibility: eligible ? 0 : Math.ceil(offer.minScore - score),
      };
    });

    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

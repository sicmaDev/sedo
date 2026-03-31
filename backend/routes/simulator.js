const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { calculateScore } = require('../services/scoring');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/simulator/save — sauvegarde les transactions issues de l'appel simulé
router.post('/save', authenticate, requireRole('mpme'), async (req, res) => {
  const { venteAmount, depenseAmount, sector } = req.body;

  if (!venteAmount && !depenseAmount) {
    return res.status(400).json({ error: 'Aucun montant fourni' });
  }

  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const saved = [];

    if (venteAmount && parseFloat(venteAmount) > 0) {
      const tx = await prisma.transaction.create({
        data: {
          mpmeId: profile.id,
          type: 'entree',
          amount: parseFloat(venteAmount),
          category: 'vente',
          description: 'Appel vocal SEDO',
          source: 'ivr',
          sector: sector || null,
          date: new Date(),
        },
      });
      saved.push(tx);
    }

    if (depenseAmount && parseFloat(depenseAmount) > 0) {
      const tx = await prisma.transaction.create({
        data: {
          mpmeId: profile.id,
          type: 'sortie',
          amount: parseFloat(depenseAmount),
          category: 'achat',
          description: 'Appel vocal SEDO',
          source: 'ivr',
          sector: sector || null,
          date: new Date(),
        },
      });
      saved.push(tx);
    }

    // Recalcul du score
    await calculateScore(profile.id).catch(() => {});

    res.json({ success: true, saved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

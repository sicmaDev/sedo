const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/mpme/profile
router.get('/profile', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { id: true, email: true, role: true, fullName: true, phone: true, createdAt: true } } },
    });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/mpme/profile
router.put('/profile', authenticate, requireRole('mpme'), async (req, res) => {
  const { company, sector, location, employees, createdYear, ifuStatus, rccmStatus, npiStatus } = req.body;
  try {
    const profile = await prisma.mPMEProfile.update({
      where: { userId: req.user.id },
      data: {
        ...(company && { company }),
        ...(sector && { sector }),
        ...(location && { location }),
        ...(employees && { employees: parseInt(employees) }),
        ...(createdYear && { createdYear: parseInt(createdYear) }),
        ...(ifuStatus && { ifuStatus }),
        ...(rccmStatus && { rccmStatus }),
        ...(npiStatus && { npiStatus }),
      },
    });
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/mpme/stats  — statistiques du tableau de bord
router.get('/stats', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const txThisMonth = await prisma.transaction.findMany({
      where: { mpmeId: profile.id, date: { gte: startOfMonth } },
    });
    const txLastMonth = await prisma.transaction.findMany({
      where: { mpmeId: profile.id, date: { gte: startOfLastMonth, lte: endOfLastMonth } },
    });

    const sumBy = (arr, type) =>
      arr.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);

    const recettes = sumBy(txThisMonth, 'entree');
    const depenses = sumBy(txThisMonth, 'sortie');
    const recettesLastMonth = sumBy(txLastMonth, 'entree');

    const evolution =
      recettesLastMonth > 0
        ? Math.round(((recettes - recettesLastMonth) / recettesLastMonth) * 100)
        : 0;

    const txSync = txThisMonth.filter((t) => t.source === 'mobile_money').length;

    // Formalisation en %
    const p = profile;
    const formSteps = [p.ifuStatus, p.rccmStatus, p.npiStatus];
    const formPct = Math.round(
      (formSteps.filter((s) => s === 'Complet').length / formSteps.length) * 100
    );
    const formRemaining = formSteps.filter((s) => s !== 'Complet').length;

    res.json({
      recettes,
      depenses,
      evolution,
      txSync,
      formalisation: formPct,
      formRemaining,
      transactionsCount: txThisMonth.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

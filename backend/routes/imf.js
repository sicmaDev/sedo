const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/imf/mpme — liste toutes les MPME avec leur dernier score
router.get('/mpme', authenticate, requireRole('imf', 'admin'), async (req, res) => {
  try {
    const profiles = await prisma.mPMEProfile.findMany({
      include: {
        user: { select: { id: true, email: true, role: true, fullName: true, phone: true, createdAt: true } },
        scores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      fullName: p.user.fullName,
      phone: p.user.phone,
      email: p.user.email,
      company: p.company,
      sector: p.sector,
      location: p.location,
      employees: p.employees,
      createdYear: p.createdYear,
      ifuStatus: p.ifuStatus,
      rccmStatus: p.rccmStatus,
      score: p.scores[0]?.total ?? null,
      scoreDetails: p.scores[0] ?? null,
      createdAt: p.createdAt,
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/imf/mpme/:id — détail d'une MPME
router.get('/mpme/:id', authenticate, requireRole('imf', 'admin'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, email: true, role: true, fullName: true, phone: true, createdAt: true } },
        scores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
        transactions: { orderBy: { date: 'desc' }, take: 200 },
      },
    });

    if (!profile) return res.status(404).json({ error: 'MPME introuvable' });

    // Historique mensuel 6 mois
    const now = new Date();
    const history = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const txs = profile.transactions.filter((t) => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      });
      const recettes = txs.filter((t) => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
      const depenses = txs.filter((t) => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
      const marge = recettes - depenses;
      history.push({
        month: start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        recettes, depenses, marge, count: txs.length,
      });
    }

    res.json({
      id: profile.id,
      fullName: profile.user.fullName,
      phone: profile.user.phone,
      email: profile.user.email,
      company: profile.company,
      sector: profile.sector,
      location: profile.location,
      employees: profile.employees,
      createdYear: profile.createdYear,
      ifuStatus: profile.ifuStatus,
      rccmStatus: profile.rccmStatus,
      score: profile.scores[0] ?? null,
      history,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/imf/stats — indicateurs clés pour le dashboard IMF
router.get('/stats', authenticate, requireRole('imf', 'admin'), async (req, res) => {
  try {
    const allProfiles = await prisma.mPMEProfile.findMany({
      include: { scores: { orderBy: { calculatedAt: 'desc' }, take: 1 } },
    });

    const scores = allProfiles
      .map((p) => p.scores[0]?.total ?? null)
      .filter((s) => s !== null);

    const eligible = scores.filter((s) => s >= 75).length;
    const enProgression = scores.filter((s) => s >= 31 && s < 75).length;

    // Évolution sur 6 mois (nombre de MPME inscrites)
    const now = new Date();
    const evolution = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const count = await prisma.mPMEProfile.count({
        where: { createdAt: { lte: end } },
      });
      evolution.push({
        month: start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        count,
      });
    }

    res.json({
      total: allProfiles.length,
      eligible,
      enProgression,
      nonEligible: allProfiles.length - eligible - enProgression,
      tauxEligibilite: allProfiles.length > 0 ? Math.round((eligible / allProfiles.length) * 100) : 0,
      scoresMoyen: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      evolution,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/imf/alerts — alertes récentes
router.get('/alerts', authenticate, requireRole('imf', 'admin'), async (req, res) => {
  try {
    const recentScores = await prisma.score.findMany({
      where: { calculatedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
      include: { mpme: { include: { user: { select: { id: true, email: true, role: true, fullName: true, phone: true, createdAt: true } } } } },
      orderBy: { calculatedAt: 'desc' },
      take: 20,
    });

    const alerts = recentScores.map((s) => {
      const name = s.mpme.user.fullName;
      const score = s.total;
      const time = timeSince(s.calculatedAt);

      if (score >= 75) {
        return { type: 'success', icon: '🎉', title: `${name} est éligible`, desc: `Score ${score}/100 — Dossier transmissible`, time };
      } else if (score >= 55) {
        return { type: 'warning', icon: '⚠️', title: `${name} est presque éligible`, desc: `Score ${score}/100 — Accompagnement recommandé`, time };
      } else {
        return { type: 'info', icon: '📊', title: `Nouveau score pour ${name}`, desc: `Score ${score}/100`, time };
      }
    });

    res.json(alerts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

function timeSince(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)}h`;
  return `Il y a ${Math.floor(seconds / 86400)}j`;
}

module.exports = router;

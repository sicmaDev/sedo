const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/transactions?page=1&limit=20&type=entree&month=2025-06
router.get('/', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const { page = 1, limit = 20, type, month } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { mpmeId: profile.id };
    if (type) where.type = type;
    if (month) {
      const [year, m] = month.split('-');
      where.date = {
        gte: new Date(parseInt(year), parseInt(m) - 1, 1),
        lt: new Date(parseInt(year), parseInt(m), 1),
      };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ transactions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/transactions
router.post('/', authenticate, requireRole('mpme'), async (req, res) => {
  const { type, amount, category, description, source, date } = req.body;

  if (!type || !amount) return res.status(400).json({ error: 'Type et montant requis' });
  if (!['entree', 'sortie'].includes(type)) return res.status(400).json({ error: 'Type invalide' });
  if (parseFloat(amount) <= 0) return res.status(400).json({ error: 'Montant invalide' });

  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const tx = await prisma.transaction.create({
      data: {
        mpmeId: profile.id,
        type,
        amount: parseFloat(amount),
        category: category || 'autre',
        description: description || null,
        source: source || 'manuel',
        date: date ? new Date(date) : new Date(),
      },
    });

    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });

    if (!tx || tx.mpmeId !== profile.id) {
      return res.status(404).json({ error: 'Transaction introuvable' });
    }

    await prisma.transaction.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/transactions/history — historique mensuel sur 6 mois
router.get('/history', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const now = new Date();
    const history = [];

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const txs = await prisma.transaction.findMany({
        where: { mpmeId: profile.id, date: { gte: start, lte: end } },
      });

      const recettes = txs.filter((t) => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
      const depenses = txs.filter((t) => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);

      const monthLabel = start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      history.push({ month: monthLabel, recettes, depenses, count: txs.length });
    }

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

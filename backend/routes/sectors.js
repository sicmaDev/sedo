const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/sectors — liste tous les secteurs disponibles
router.get('/', authenticate, async (req, res) => {
  try {
    const sheets = await prisma.sectorSheet.findMany({
      select: { sector: true, title: true, updatedAt: true },
      orderBy: { sector: 'asc' },
    });
    res.json(sheets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sectors/:sector/sheet — fiche complète d'un secteur
router.get('/:sector/sheet', authenticate, async (req, res) => {
  try {
    const sheet = await prisma.sectorSheet.findUnique({
      where: { sector: decodeURIComponent(req.params.sector) },
    });
    if (!sheet) return res.status(404).json({ error: 'Fiche introuvable' });

    res.json({
      ...sheet,
      actors: JSON.parse(sheet.actors),
      marketPrices: JSON.parse(sheet.marketPrices),
      tips: JSON.parse(sheet.tips),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sectors/:sector/news — actualités du secteur + actualités globales
router.get('/:sector/news', authenticate, async (req, res) => {
  try {
    const sector = decodeURIComponent(req.params.sector);
    const news = await prisma.sectorNews.findMany({
      where: { OR: [{ sector }, { sector: null }] },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    });
    res.json(news);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/sectors/:sector/news/alerts — nombre d'alertes non lues depuis une date
router.get('/:sector/news/alerts', authenticate, async (req, res) => {
  try {
    const sector = decodeURIComponent(req.params.sector);
    const since = req.query.since ? new Date(req.query.since) : new Date(0);
    const count = await prisma.sectorNews.count({
      where: {
        OR: [{ sector }, { sector: null }],
        type: 'alerte',
        publishedAt: { gt: since },
      },
    });
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, fullName, phone, role, company, sector, location, employees, createdYear, institution } = req.body;

  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }
  if (!['mpme', 'imf'].includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

    const hashed = await bcrypt.hash(password, 10);

    const userData = {
      email, password: hashed, fullName, phone, role,
    };

    if (role === 'mpme') {
      if (!company || !sector) return res.status(400).json({ error: 'Entreprise et secteur requis' });
      userData.mpmeProfile = {
        create: {
          company,
          sector,
          location: location || 'Cotonou, Bénin',
          employees: employees ? parseInt(employees) : 1,
          createdYear: createdYear ? parseInt(createdYear) : new Date().getFullYear(),
        },
      };
    } else if (role === 'imf') {
      if (!institution) return res.status(400).json({ error: 'Nom de l\'institution requis' });
      userData.imfProfile = { create: { institution } };
    }

    const user = await prisma.user.create({
      data: userData,
      include: { mpmeProfile: true, imfProfile: true },
    });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password: _, ...safeUser } = user;
    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { mpmeProfile: true, imfProfile: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { mpmeProfile: true, imfProfile: true },
      omit: { password: true },
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;

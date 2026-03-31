require('dotenv').config();
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'sedo_hackathon_2026_fallback_secret';
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const mpmeRoutes = require('./routes/mpme');
const transactionRoutes = require('./routes/transactions');
const scoreRoutes = require('./routes/score');
const financementRoutes = require('./routes/financement');
const imfRoutes = require('./routes/imf');
const sttRoutes = require('./routes/stt');
const sectorsRoutes = require('./routes/sectors');

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares globaux
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'SEDO API', version: '1.0.0' }));

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/mpme', mpmeRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/score', scoreRoutes);
app.use('/api/financement', financementRoutes);
app.use('/api/imf', imfRoutes);
app.use('/api/stt', sttRoutes);
app.use('/api/sectors', sectorsRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));

// Erreur globale
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`🚀 SEDO Backend démarré sur http://localhost:${PORT}`);
  console.log(`📊 Environnement : ${process.env.NODE_ENV}`);
  console.log(`🔑 JWT_SECRET: ${process.env.JWT_SECRET ? 'OK' : 'MANQUANT'}`);
});

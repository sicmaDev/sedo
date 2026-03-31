const express = require('express');
const twilio = require('twilio');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const APP_URL = process.env.APP_URL || 'http://localhost:4000';

// ─── Utilitaire : extraire un montant depuis du texte français ───────────────
function extractAmount(text) {
  if (!text) return null;
  const t = text.toLowerCase().trim();

  // Si c'est déjà un nombre
  const direct = parseFloat(t.replace(/\s/g, '').replace(',', '.'));
  if (!isNaN(direct) && direct > 0) return direct;

  // Mots français → chiffres
  const units = {
    zéro: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
    six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
    treize: 13, quatorze: 14, quinze: 15, seize: 16, 'dix-sept': 17,
    'dix-huit': 18, 'dix-neuf': 19, vingt: 20, trente: 30, quarante: 40,
    cinquante: 50, soixante: 60, 'soixante-dix': 70, 'quatre-vingt': 80,
    'quatre-vingt-dix': 90, cent: 100, cents: 100, mille: 1000,
    'mille francs': 1000, million: 1000000,
  };

  let total = 0;
  let current = 0;
  const words = t.replace(/[^a-zéèàùâêîôûäëïöü\-\s]/g, ' ').split(/\s+/);

  for (const word of words) {
    const val = units[word];
    if (val === undefined) continue;
    if (val === 100) {
      current = current === 0 ? 100 : current * 100;
    } else if (val === 1000) {
      current = current === 0 ? 1000 : current * 1000;
      total += current;
      current = 0;
    } else if (val === 1000000) {
      current = current === 0 ? 1000000 : current * 1000000;
      total += current;
      current = 0;
    } else {
      current += val;
    }
  }
  total += current;

  return total > 0 ? total : null;
}

// ─── Générer du TwiML ────────────────────────────────────────────────────────
function twiml(xml) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${xml}</Response>`;
}

function sayFr(text) {
  return `<Say language="fr-FR" voice="Polly.Lea">${text}</Say>`;
}

// ─── POST /api/ivr/config — sauvegarder numéro + heure ──────────────────────
router.post('/config', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const { ivrPhone, ivrTime } = req.body;
    const profile = await prisma.mPMEProfile.update({
      where: { userId: req.user.id },
      data: {
        ivrPhone: ivrPhone || null,
        ivrTime: ivrTime || '18:00',
      },
    });
    res.json({ success: true, ivrPhone: profile.ivrPhone, ivrTime: profile.ivrTime });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/ivr/call/now — déclencher un appel immédiatement (test) ───────
router.post('/call/now', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });
    if (!profile.ivrPhone) return res.status(400).json({ error: 'Numéro employeur non configuré' });

    const result = await triggerCall(profile);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/ivr/sessions — historique des sessions IVR ────────────────────
router.get('/sessions', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const sessions = await prisma.iVRSession.findMany({
      where: { mpmeId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Twilio Webhooks (publics — appelés par Twilio) ──────────────────────────

// Twilio appelle ce webhook quand l'employeur décroche
router.post('/answer/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await prisma.iVRSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status === 'expired') {
      return res.type('text/xml').send(twiml(
        sayFr('Cette session a expiré. Au revoir.') + '<Hangup/>'
      ));
    }

    await prisma.iVRSession.update({
      where: { id: sessionId },
      data: { status: 'active', step: 'ventes' },
    });

    const xml =
      sayFr('Bonjour ! Ici SEDO, votre assistant financier. Nous allons enregistrer vos opérations du jour.') +
      sayFr('Première question : quel est le montant total de vos ventes aujourd\'hui ? Dites le montant en francs CFA.') +
      `<Gather input="speech" language="fr-FR" action="${APP_URL}/api/ivr/ventes/${sessionId}" timeout="8" speechTimeout="2">` +
        sayFr('Je vous écoute.') +
      `</Gather>` +
      sayFr('Je n\'ai pas entendu. Nous réessaierons demain. Au revoir.') +
      '<Hangup/>';

    res.type('text/xml').send(twiml(xml));
  } catch (err) {
    console.error('IVR answer error:', err);
    res.type('text/xml').send(twiml(sayFr('Une erreur est survenue. Au revoir.') + '<Hangup/>'));
  }
});

// Twilio envoie la transcription des ventes ici
router.post('/ventes/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const speechResult = req.body.SpeechResult || '';
  const confidence = parseFloat(req.body.Confidence || 0);

  console.log(`IVR ventes [${sessionId}]: "${speechResult}" (${Math.round(confidence * 100)}%)`);

  try {
    const session = await prisma.iVRSession.findUnique({
      where: { id: sessionId },
      include: { mpme: true },
    });
    if (!session) return res.type('text/xml').send(twiml('<Hangup/>'));

    const montant = extractAmount(speechResult);

    if (!montant) {
      // Pas compris — redemander une fois
      const xml =
        sayFr(`Je n'ai pas compris. Pouvez-vous répéter le montant de vos ventes ?`) +
        `<Gather input="speech" language="fr-FR" action="${APP_URL}/api/ivr/ventes/${sessionId}" timeout="8" speechTimeout="2">` +
          sayFr('Je vous écoute.') +
        `</Gather>` +
        sayFr('Nous réessaierons demain. Au revoir.') +
        '<Hangup/>';
      return res.type('text/xml').send(twiml(xml));
    }

    // Sauvegarder la transaction entree
    await prisma.transaction.create({
      data: {
        mpmeId: session.mpmeId,
        type: 'entree',
        amount: montant,
        category: 'vente',
        description: 'Appel vocal SEDO',
        source: 'ivr',
        date: new Date(),
      },
    });

    // Mettre à jour la session
    await prisma.iVRSession.update({
      where: { id: sessionId },
      data: { venteAmount: montant, venteText: speechResult, step: 'depenses' },
    });

    const montantFormate = montant.toLocaleString('fr-FR');
    const xml =
      sayFr(`Parfait ! J'ai enregistré ${montantFormate} francs CFA de ventes.`) +
      sayFr('Deuxième question : quel est le montant total de vos dépenses aujourd\'hui ?') +
      `<Gather input="speech" language="fr-FR" action="${APP_URL}/api/ivr/depenses/${sessionId}" timeout="8" speechTimeout="2">` +
        sayFr('Je vous écoute.') +
      `</Gather>` +
      sayFr('Je n\'ai pas entendu vos dépenses. Elles seront mises à zéro. Au revoir.') +
      '<Hangup/>';

    res.type('text/xml').send(twiml(xml));
  } catch (err) {
    console.error('IVR ventes error:', err);
    res.type('text/xml').send(twiml(sayFr('Une erreur est survenue. Au revoir.') + '<Hangup/>'));
  }
});

// Twilio envoie la transcription des dépenses ici
router.post('/depenses/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const speechResult = req.body.SpeechResult || '';

  console.log(`IVR depenses [${sessionId}]: "${speechResult}"`);

  try {
    const session = await prisma.iVRSession.findUnique({ where: { id: sessionId } });
    if (!session) return res.type('text/xml').send(twiml('<Hangup/>'));

    const montant = extractAmount(speechResult) || 0;

    if (montant > 0) {
      await prisma.transaction.create({
        data: {
          mpmeId: session.mpmeId,
          type: 'sortie',
          amount: montant,
          category: 'achat',
          description: 'Appel vocal SEDO',
          source: 'ivr',
          date: new Date(),
        },
      });
    }

    await prisma.iVRSession.update({
      where: { id: sessionId },
      data: {
        depenseAmount: montant,
        depenseText: speechResult,
        status: 'completed',
        step: 'done',
        completedAt: new Date(),
      },
    });

    const venteStr = (session.venteAmount || 0).toLocaleString('fr-FR');
    const depenseStr = montant.toLocaleString('fr-FR');

    const xml =
      sayFr(`Merci ! J'ai bien enregistré ${depenseStr} francs CFA de dépenses.`) +
      sayFr(`Récapitulatif du jour : ventes ${venteStr} francs, dépenses ${depenseStr} francs.`) +
      sayFr('Bonne continuation ! À demain.') +
      '<Hangup/>';

    res.type('text/xml').send(twiml(xml));
  } catch (err) {
    console.error('IVR depenses error:', err);
    res.type('text/xml').send(twiml(sayFr('Une erreur est survenue. Au revoir.') + '<Hangup/>'));
  }
});

// ─── Fonction utilisée par le scheduler ──────────────────────────────────────
async function triggerCall(profile) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error('Twilio non configuré (variables manquantes)');
  }

  // Créer la session IVR
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // expire dans 2h
  const session = await prisma.iVRSession.create({
    data: {
      mpmeId: profile.id,
      status: 'pending',
      step: 'ventes',
      expiresAt,
    },
  });

  const client = twilio(accountSid, authToken);
  const call = await client.calls.create({
    to: profile.ivrPhone,
    from: fromNumber,
    url: `${APP_URL}/api/ivr/answer/${session.id}`,
    statusCallback: `${APP_URL}/api/ivr/status/${session.id}`,
    statusCallbackMethod: 'POST',
  });

  console.log(`📞 Appel IVR lancé → ${profile.ivrPhone} | SID: ${call.sid} | Session: ${session.id}`);
  return { success: true, callSid: call.sid, sessionId: session.id };
}

// ─── POST /api/ivr/status/:sessionId — callback statut Twilio ────────────────
router.post('/status/:sessionId', async (req, res) => {
  const { CallStatus } = req.body;
  const { sessionId } = req.params;
  console.log(`IVR status [${sessionId}]: ${CallStatus}`);

  if (['failed', 'busy', 'no-answer', 'canceled'].includes(CallStatus)) {
    await prisma.iVRSession.update({
      where: { id: sessionId },
      data: { status: 'expired' },
    }).catch(() => {});
  }

  res.sendStatus(200);
});

module.exports = router;
module.exports.triggerCall = triggerCall;

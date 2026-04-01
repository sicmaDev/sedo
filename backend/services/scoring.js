const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Calcule et sauvegarde le Score de Finançabilité
 * CDC SEDO — Pondération :
 *   - Mobile Money   : 30% (régularité + volume MoMo/Moov sur 6 mois)
 *   - Comptabilité   : 25% (régularité des saisies = semaines actives / 24)
 *   - Formalisation  : 25% (IFU 40pts + RCCM 35pts + NPI 25pts)
 *   - Profil secteur : 20% (complétude du profil)
 */
async function calculateScore(mpmeId) {
  const profile = await prisma.mPMEProfile.findUnique({
    where: { id: mpmeId },
    include: {
      transactions: {
        orderBy: { date: 'desc' },
        take: 1000,
      },
    },
  });

  if (!profile) throw new Error('Profil MPME introuvable');

  const txAll = profile.transactions;
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const txRecentes = txAll.filter((t) => new Date(t.date) >= sixMonthsAgo);

  // ── 1. Score Mobile Money (30%) ─────────────────────────────────────────
  // CDC : régularité + volume des transactions MoMo/Moov sur 6 mois
  const txMoMo = txRecentes.filter((t) => t.source === 'mobile_money');
  const momoCount = txMoMo.length;
  const momoVolume = txMoMo.reduce((sum, t) => sum + t.amount, 0);

  // Régularité MoMo : semaines avec au moins 1 transaction MoMo (cible 24)
  const momoWeeks = new Set(txMoMo.map((t) => isoWeek(t.date))).size;
  const momoRegularite = Math.min(100, (momoWeeks / 24) * 100);
  // Volume MoMo : cible 5 000 000 FCFA sur 6 mois
  const momoVolumeScore = Math.min(100, (momoVolume / 5_000_000) * 100);
  const mobileMoney = Math.round(momoRegularite * 0.6 + momoVolumeScore * 0.4);

  // ── 2. Score Comptabilité (25%) ──────────────────────────────────────────
  // CDC : "Régularité des saisies, complétude des données Module 2"
  // = semaines avec au moins 1 saisie (toutes sources) sur 6 mois, cible 24 semaines
  const totalTx = txRecentes.length;
  const weeksWithEntry = new Set(txRecentes.map((t) => isoWeek(t.date))).size;

  const regularite = Math.min(100, (weeksWithEntry / 24) * 100);
  // Complétude : volume de données (cible 80 transactions = bonus)
  const completude = Math.min(100, (totalTx / 80) * 100);
  const comptabilite = Math.round(regularite * 0.7 + completude * 0.3);

  // ── 3. Score Formalisation (25%) ─────────────────────────────────────────
  // CDC : IFU (40pts) + RCCM (35pts) + NPI (25pts)
  const ifuScore = profile.ifuStatus === 'Complet' ? 40 : profile.ifuStatus === 'En cours' ? 20 : 0;
  const rccmScore = profile.rccmStatus === 'Complet' ? 35 : profile.rccmStatus === 'En cours' ? 15 : 0;
  const npiScore = profile.npiStatus === 'Complet' ? 25 : profile.npiStatus === 'En cours' ? 10 : 0;
  const formalisation = ifuScore + rccmScore + npiScore;

  // ── 4. Score Profil Sectoriel (20%) ──────────────────────────────────────
  // CDC : complétude du profil + connaissance du secteur (Module 1)
  let profilSectoriel = 0;
  if (profile.sector) profilSectoriel += 30;
  if (profile.businessName || profile.company) profilSectoriel += 20;
  if (profile.location) profilSectoriel += 15;
  if (profile.employees > 0) profilSectoriel += 15;
  if (profile.createdYear) profilSectoriel += 20;

  // ── Score total pondéré ───────────────────────────────────────────────────
  const total =
    mobileMoney * 0.30 +
    comptabilite * 0.25 +
    formalisation * 0.25 +
    profilSectoriel * 0.20;

  const totalRounded = Math.round(total);

  // ── Alerte 6 mois → formalisation ────────────────────────────────────────
  // CDC : après 6 mois d'activité enregistrée, déclencher l'alerte formalisation
  const moisActifs = new Set(
    txRecentes.map((t) => {
      const d = new Date(t.date);
      return `${d.getFullYear()}-${d.getMonth()}`;
    })
  ).size;
  const alerteFormalisation = moisActifs >= 6 && formalisation < 100;

  // ── Recommandation prescriptive (CDC) ─────────────────────────────────────
  const recommendation = buildRecommendation({
    totalRounded, mobileMoney, comptabilite, formalisation, profilSectoriel,
    momoCount, momoWeeks, totalTx, weeksWithEntry, moisActifs, profile,
  });

  // ── Sauvegarde ────────────────────────────────────────────────────────────
  const score = await prisma.score.create({
    data: {
      mpmeId,
      total: totalRounded,
      mobileMoney: Math.round(mobileMoney),
      comptabilite: Math.round(comptabilite),
      formalisation: Math.round(formalisation),
      profilSectoriel: Math.round(profilSectoriel),
      recommendation,
    },
  });

  return { ...score, alerteFormalisation, moisActifs, weeksWithEntry, momoWeeks };
}

/**
 * Recommandation prescriptive — conforme au CDC SEDO
 * Exemple CDC : "Il vous manque 3 semaines de transactions et votre RCCM pour passer à 87/100"
 */
function buildRecommendation({ totalRounded, mobileMoney, comptabilite, profilSectoriel,
  momoCount, momoWeeks, weeksWithEntry, profile }) {

  // Calculer le score potentiel si les lacunes principales sont comblées
  const potMoMo = Math.max(mobileMoney, momoWeeks >= 4 ? 30 : mobileMoney);
  const potCompta = weeksWithEntry >= 20 ? 85 : Math.min(100, comptabilite + (24 - weeksWithEntry) * 2.9);
  const potIFU = profile.ifuStatus !== 'Complet' ? 40 : ifuVal(profile.ifuStatus);
  const potRCCM = profile.rccmStatus !== 'Complet' ? 35 : rccmVal(profile.rccmStatus);
  const potNPI = profile.npiStatus !== 'Complet' ? 25 : npiVal(profile.npiStatus);
  const potFormal = Math.min(100, potIFU + potRCCM + potNPI);
  const potProfil = profile.sector && (profile.businessName || profile.company) && profile.location && profile.employees > 0 && profile.createdYear ? 100 : profilSectoriel;

  const potentialScore = Math.round(
    potMoMo * 0.30 +
    potCompta * 0.25 +
    potFormal * 0.25 +
    potProfil * 0.20
  );

  // Actions prioritaires (triées par impact)
  const actions = [];

  // Comptabilité — priorité si faible régularité
  if (weeksWithEntry < 24) {
    const semManquantes = 24 - weeksWithEntry;
    actions.push({
      impact: Math.round((semManquantes / 24) * 25),
      msg: `enregistrer vos transactions pendant encore ${semManquantes} semaine${semManquantes > 1 ? 's' : ''} — vous avez couvert ${weeksWithEntry} semaine${weeksWithEntry > 1 ? 's' : ''} sur 24`,
    });
  }

  // Formalisation IFU
  if (profile.ifuStatus !== 'Complet') {
    const pts = profile.ifuStatus === 'En cours' ? 20 : 40;
    actions.push({ impact: Math.round(pts * 0.25), msg: `finaliser votre IFU (+${pts} points de formalisation)` });
  }

  // Formalisation RCCM
  if (profile.rccmStatus !== 'Complet') {
    const pts = profile.rccmStatus === 'En cours' ? 15 : 35;
    actions.push({ impact: Math.round(pts * 0.25), msg: `obtenir votre RCCM (+${pts} points de formalisation)` });
  }

  // Mobile Money
  if (mobileMoney < 50) {
    actions.push({
      impact: 10,
      msg: `connecter votre compte MTN MoMo ou Moov Money pour la synchronisation automatique (${momoCount} transaction${momoCount !== 1 ? 's' : ''} détectée${momoCount !== 1 ? 's' : ''})`,
    });
  }

  // Profil
  if (profilSectoriel < 80) {
    actions.push({ impact: 5, msg: `compléter votre profil — secteur, effectif, année de démarrage` });
  }

  // NPI
  if (profile.npiStatus !== 'Complet') {
    const pts = profile.npiStatus === 'En cours' ? 10 : 25;
    actions.push({ impact: Math.round(pts * 0.25), msg: `obtenir votre NPI (+${pts} points de formalisation)` });
  }

  // Trier par impact décroissant
  actions.sort((a, b) => b.impact - a.impact);

  if (actions.length === 0) {
    const accesMsg = totalRounded >= 76
      ? 'Votre dossier est transmissible aux institutions financières partenaires.'
      : totalRounded >= 56
      ? 'Vous êtes en cours de mise en relation avec les IMF partenaires.'
      : 'Vous accédez aux offres de microfinance et formations.';
    return `Excellent profil ! Score ${totalRounded}/100. ${accesMsg}`;
  }

  // Niveau cible selon CDC
  const niveauCible = totalRounded < 31
    ? 'la progression (31/100)'
    : totalRounded < 56
    ? 'l\'accès microfinance (56/100)'
    : totalRounded < 76
    ? 'l\'éligibilité au crédit (76/100)'
    : 'le score maximal';

  const needed = Math.max(0, (totalRounded < 31 ? 31 : totalRounded < 56 ? 56 : totalRounded < 76 ? 76 : 100) - totalRounded);

  const projMsg = potentialScore > totalRounded + 2
    ? ` En complétant ces étapes, vous pouvez atteindre ${potentialScore}/100.`
    : '';

  const prefix = needed > 0
    ? `Il vous manque ${needed} point${needed > 1 ? 's' : ''} pour atteindre ${niveauCible}.${projMsg} `
    : `Score : ${totalRounded}/100.${projMsg} `;

  const top = actions[0].msg;
  const second = actions[1] ? ` Ensuite : ${actions[1].msg}.` : '';

  return `${prefix}Priorité : ${top.charAt(0).toUpperCase() + top.slice(1)}.${second}`;
}

// Helpers notation
function isoWeek(date) {
  const d = new Date(date);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${weekNum}`;
}
function ifuVal(s) { return s === 'Complet' ? 40 : s === 'En cours' ? 20 : 0; }
function rccmVal(s) { return s === 'Complet' ? 35 : s === 'En cours' ? 15 : 0; }
function npiVal(s) { return s === 'Complet' ? 25 : s === 'En cours' ? 10 : 0; }

/**
 * Récupère le dernier score calculé pour une MPME
 */
async function getLatestScore(mpmeId) {
  return prisma.score.findFirst({
    where: { mpmeId },
    orderBy: { calculatedAt: 'desc' },
  });
}

module.exports = { calculateScore, getLatestScore };

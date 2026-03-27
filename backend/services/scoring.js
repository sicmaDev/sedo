const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Calcule et sauvegarde le score de finançabilité d'une MPME
 * Pondération :
 *   - Mobile Money   : 30%
 *   - Comptabilité   : 25%
 *   - Formalisation  : 25%
 *   - Profil secteur : 20%
 */
async function calculateScore(mpmeId) {
  const profile = await prisma.mPMEProfile.findUnique({
    where: { id: mpmeId },
    include: {
      transactions: {
        orderBy: { date: 'desc' },
        take: 500,
      },
    },
  });

  if (!profile) throw new Error('Profil MPME introuvable');

  const txAll = profile.transactions;
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  // --- 1. Score Mobile Money (30%) ---
  // Basé sur : volume des transactions sync Mobile Money sur 6 mois
  const txMoMo = txAll.filter(
    (t) => t.source === 'mobile_money' && new Date(t.date) >= sixMonthsAgo
  );
  const momoVolume = txMoMo.reduce((sum, t) => sum + t.amount, 0);
  const momoCount = txMoMo.length;
  // Cibles : 100 transactions et 5 000 000 FCFA = score max
  const momoByCount = Math.min(100, (momoCount / 100) * 100);
  const momoByVolume = Math.min(100, (momoVolume / 5000000) * 100);
  const mobileMoney = Math.round((momoByCount * 0.6 + momoByVolume * 0.4));

  // --- 2. Score Comptabilité (25%) ---
  // Basé sur : régularité des saisies sur 6 mois (au moins 1 saisie par semaine = 24 semaines)
  const txManuel = txAll.filter(
    (t) => t.source === 'manuel' && new Date(t.date) >= sixMonthsAgo
  );
  const totalTx = txAll.filter((t) => new Date(t.date) >= sixMonthsAgo).length;
  // Score basé sur la complétude (cible : 80 transactions sur 6 mois)
  const completude = Math.min(100, (totalTx / 80) * 100);
  // Bonus si transactions manuelles aussi saisies
  const manuelBonus = Math.min(20, txManuel.length * 0.5);
  const comptabilite = Math.round(Math.min(100, completude * 0.9 + manuelBonus));

  // --- 3. Score Formalisation (25%) ---
  // IFU : 40 pts max | RCCM : 35 pts max | NPI : 25 pts max
  const ifuScore =
    profile.ifuStatus === 'Complet' ? 40 : profile.ifuStatus === 'En cours' ? 20 : 0;
  const rccmScore =
    profile.rccmStatus === 'Complet' ? 35 : profile.rccmStatus === 'En cours' ? 15 : 0;
  const npiScore =
    profile.npiStatus === 'Complet' ? 25 : profile.npiStatus === 'En cours' ? 10 : 0;
  const formalisation = ifuScore + rccmScore + npiScore;

  // --- 4. Score Profil Sectoriel (20%) ---
  // Basé sur : complétude du profil
  let profilSectoriel = 0;
  if (profile.sector) profilSectoriel += 30;
  if (profile.company) profilSectoriel += 20;
  if (profile.location) profilSectoriel += 15;
  if (profile.employees > 0) profilSectoriel += 15;
  if (profile.createdYear) profilSectoriel += 20;

  // --- Score total pondéré ---
  const total =
    mobileMoney * 0.30 +
    comptabilite * 0.25 +
    formalisation * 0.25 +
    profilSectoriel * 0.20;

  const totalRounded = Math.round(total);

  // --- Recommandation personnalisée ---
  const recommendation = buildRecommendation({
    totalRounded, mobileMoney, comptabilite, formalisation, profilSectoriel,
    momoCount, totalTx, profile,
  });

  // Sauvegarde
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

  return score;
}

function buildRecommendation({ totalRounded, mobileMoney, comptabilite, formalisation, profilSectoriel, momoCount, totalTx, profile }) {
  const gaps = [];

  if (mobileMoney < 60) {
    gaps.push(`Synchronisez plus de transactions Mobile Money (actuellement ${momoCount} sur 6 mois, cible : 100)`);
  }
  if (comptabilite < 60) {
    gaps.push(`Enregistrez vos transactions plus régulièrement (actuellement ${totalTx} sur 6 mois, cible : 80)`);
  }
  if (profile.ifuStatus !== 'Complet') {
    gaps.push(`Finalisez votre IFU (+${profile.ifuStatus === 'En cours' ? 20 : 40} points potentiels)`);
  }
  if (profile.rccmStatus !== 'Complet') {
    gaps.push(`Obtenez votre RCCM (+${profile.rccmStatus === 'En cours' ? 20 : 35} points potentiels)`);
  }

  if (gaps.length === 0) {
    return `Excellent profil ! Score ${totalRounded}/100. Vous êtes éligible à plusieurs offres de financement.`;
  }

  const needed = Math.max(0, 75 - totalRounded);
  const prefix = needed > 0
    ? `Il vous manque ${needed} point${needed > 1 ? 's' : ''} pour atteindre l'éligibilité (75/100). `
    : `Score actuel : ${totalRounded}/100. `;

  return prefix + 'Priorités : ' + gaps[0] + '.';
}

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

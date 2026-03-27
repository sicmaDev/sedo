const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // --- Utilisateurs de démo ---
  const hashedPassword = await bcrypt.hash('sedo2026', 10);

  // MPME de démo
  const mpmeUser = await prisma.user.upsert({
    where: { email: 'kouassi@sedo.bj' },
    update: {},
    create: {
      email: 'kouassi@sedo.bj',
      password: hashedPassword,
      role: 'mpme',
      fullName: 'Kouassi Ama',
      phone: '+229 97 00 00 01',
      mpmeProfile: {
        create: {
          company: 'Ets Kouassi Commerce',
          sector: 'Commerce général',
          location: 'Cotonou, Bénin',
          employees: 3,
          createdYear: 2021,
          ifuStatus: 'En cours',
          rccmStatus: 'Non démarré',
          npiStatus: 'Non démarré',
        },
      },
    },
    include: { mpmeProfile: true },
  });

  // IMF de démo
  const imfUser = await prisma.user.upsert({
    where: { email: 'padme@sedo.bj' },
    update: {},
    create: {
      email: 'padme@sedo.bj',
      password: hashedPassword,
      role: 'imf',
      fullName: 'PADME Microfinance',
      imfProfile: {
        create: { institution: 'PADME Microfinance' },
      },
    },
  });

  // --- Transactions de démo pour Kouassi ---
  const mpmeId = mpmeUser.mpmeProfile.id;
  const now = new Date();

  const transactions = [];
  const months = 6;
  for (let m = 0; m < months; m++) {
    const baseDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    // Entrées du mois
    for (let i = 0; i < 15 + Math.floor(Math.random() * 10); i++) {
      const day = Math.floor(Math.random() * 28) + 1;
      transactions.push({
        mpmeId,
        type: 'entree',
        amount: 15000 + Math.floor(Math.random() * 30000),
        category: 'vente',
        description: 'Vente de marchandises',
        source: 'mobile_money',
        date: new Date(baseDate.getFullYear(), baseDate.getMonth(), day),
      });
    }
    // Sorties du mois
    for (let i = 0; i < 10 + Math.floor(Math.random() * 8); i++) {
      const day = Math.floor(Math.random() * 28) + 1;
      transactions.push({
        mpmeId,
        type: 'sortie',
        amount: 8000 + Math.floor(Math.random() * 20000),
        category: 'achat',
        description: 'Achat de stock',
        source: 'mobile_money',
        date: new Date(baseDate.getFullYear(), baseDate.getMonth(), day),
      });
    }
  }

  await prisma.transaction.createMany({ data: transactions, skipDuplicates: true });

  // --- Offres de financement ---
  await prisma.financingOffer.createMany({
    data: [
      {
        name: 'PADME Microfinance',
        provider: 'PADME',
        logo: 'P',
        subtitle: 'Microcrédit Express pour MPME en activité',
        minScore: 60,
        maxAmount: 500000,
        rate: 12,
        duration: '12 mois',
        offerType: 'credit',
        sector: null,
      },
      {
        name: 'BeniBiz',
        provider: 'BeniBiz',
        logo: 'B',
        subtitle: 'Subvention entrepreneuriale non remboursable',
        minScore: 50,
        maxAmount: 1000000,
        rate: null,
        duration: null,
        offerType: 'subvention',
        sector: 'Commerce général',
      },
      {
        name: 'BOA Bénin',
        provider: 'BOA',
        logo: 'BOA',
        subtitle: 'Crédit professionnel pour développement d\'activité',
        minScore: 75,
        maxAmount: 5000000,
        rate: 9,
        duration: '24-36 mois',
        offerType: 'credit',
        sector: null,
      },
      {
        name: 'FONDS ADPME',
        provider: 'ADPME',
        logo: 'A',
        subtitle: 'Appel à projets pour MPME formalisées',
        minScore: 70,
        maxAmount: 2000000,
        rate: null,
        duration: null,
        offerType: 'appel_projets',
        sector: null,
      },
    ],
    skipDuplicates: true,
  });

  // --- Calcul du score initial ---
  const txCount = await prisma.transaction.count({ where: { mpmeId } });
  const profile = mpmeUser.mpmeProfile;

  const mobileMoney = Math.min(100, (txCount / 100) * 100);
  const comptabilite = Math.min(100, (txCount / 80) * 100);
  const formalisation =
    (profile.ifuStatus === 'Complet' ? 40 : profile.ifuStatus === 'En cours' ? 20 : 0) +
    (profile.rccmStatus === 'Complet' ? 35 : profile.rccmStatus === 'En cours' ? 15 : 0) +
    (profile.npiStatus === 'Complet' ? 25 : profile.npiStatus === 'En cours' ? 10 : 0);
  const profilSectoriel = profile.sector && profile.company ? 80 : 50;

  const total =
    mobileMoney * 0.3 +
    comptabilite * 0.25 +
    formalisation * 0.25 +
    profilSectoriel * 0.2;

  await prisma.score.create({
    data: {
      mpmeId,
      total: Math.round(total),
      mobileMoney: Math.round(mobileMoney),
      comptabilite: Math.round(comptabilite),
      formalisation: Math.round(formalisation),
      profilSectoriel: Math.round(profilSectoriel),
      recommendation: `Complétez votre formalisation (+10 points) pour atteindre le seuil d'éligibilité de 75/100 et débloquer de nouvelles offres.`,
    },
  });

  console.log('✅ Seed terminé !');
  console.log('');
  console.log('Comptes de démo :');
  console.log('  MPME  → kouassi@sedo.bj   / sedo2026');
  console.log('  IMF   → padme@sedo.bj     / sedo2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

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

  // --- Fiches sectorielles ---
  const sectorSheets = [
    {
      sector: 'Commerce général',
      title: 'Commerce Général au Bénin',
      actors: JSON.stringify([
        { role: 'Fournisseurs', description: 'Grossistes du marché Dantokpa, importateurs de Lagos et Lomé' },
        { role: 'Clients', description: 'Ménages locaux, revendeurs ambulants, boutiques de quartier' },
        { role: 'Concurrents', description: 'Commerçants des marchés voisins, grandes surfaces (SCORE, Erevan)' },
        { role: 'Acteurs financiers', description: 'PADME, CLCAM, Mobile Money MTN/Moov' },
      ]),
      marketPrices: JSON.stringify([
        { item: 'Sac de riz (50 kg)', price: '22 000 – 28 000', unit: 'FCFA' },
        { item: 'Carton de savon (72 pcs)', price: '18 000 – 22 000', unit: 'FCFA' },
        { item: 'Bidon d\'huile (20 L)', price: '25 000 – 30 000', unit: 'FCFA' },
        { item: 'Carton de boissons (24 bouteilles)', price: '9 000 – 12 000', unit: 'FCFA' },
      ]),
      trends: 'Le commerce de détail au Bénin est en forte croissance avec l\'essor du marché de Dantokpa et du corridor Cotonou-Lagos. La digitalisation des paiements via Mobile Money (MTN MoMo, Moov Money) transforme les pratiques. La concurrence des supermarchés reste limitée en dehors de Cotonou.',
      regulation: 'IFU obligatoire pour tout commerçant (seuil : 0 FCFA depuis 2022). Patente annuelle à la Mairie. Registre des entrées/sorties conseillé. TVA applicable au-delà de 50M FCFA de chiffre d\'affaires.',
      tips: JSON.stringify([
        'Achetez en groupement avec d\'autres commerçants pour négocier de meilleurs prix fournisseurs',
        'Enregistrez chaque vente sur SEDO pour améliorer votre score et accéder au crédit',
        'Évitez le crédit informel (tontines à taux élevé) — préférez PADME ou CLCAM',
        'Constituez un stock tampon de 2 semaines pour faire face aux ruptures',
      ]),
    },
    {
      sector: 'Agriculture',
      title: 'Agriculture au Bénin',
      actors: JSON.stringify([
        { role: 'Fournisseurs intrants', description: 'SONAPRA, coopératives locales, marchés d\'intrants agricoles' },
        { role: 'Acheteurs', description: 'Collecteurs, marchés hebdomadaires, transformation agroalimentaire' },
        { role: 'Appui technique', description: 'CeRPA, ONG HELVETAS, SNV Bénin' },
        { role: 'Financement', description: 'FNDA (Fonds National de Développement Agricole), CLCAM' },
      ]),
      marketPrices: JSON.stringify([
        { item: 'Maïs (100 kg)', price: '18 000 – 25 000', unit: 'FCFA selon saison' },
        { item: 'Manioc (100 kg)', price: '8 000 – 12 000', unit: 'FCFA' },
        { item: 'Haricot niébé (100 kg)', price: '45 000 – 60 000', unit: 'FCFA' },
        { item: 'Tomate (cageot)', price: '3 000 – 8 000', unit: 'FCFA selon saison' },
      ]),
      trends: 'L\'agriculture représente 25% du PIB béninois. Les cultures de rente (coton, anacarde) dominent les exportations. La transformation locale (gari, huile de palme) offre une valeur ajoutée importante. Les variations climatiques impactent fortement les rendements.',
      regulation: 'Pas de licence requise pour les petits agriculteurs. IFU recommandé pour accéder aux subventions. Enregistrement coopérative possible via la SONAPRA. Respect des normes phytosanitaires pour l\'exportation.',
      tips: JSON.stringify([
        'Diversifiez vos cultures pour réduire le risque de mauvaise saison',
        'Rejoignez une coopérative pour accéder aux intrants subventionnés',
        'Transformez une partie de votre récolte (farine, huile) pour vendre à meilleur prix',
        'Enregistrez vos récoltes et ventes sur SEDO pour construire votre historique financier',
      ]),
    },
    {
      sector: 'Artisanat',
      title: 'Artisanat au Bénin',
      actors: JSON.stringify([
        { role: 'Clients locaux', description: 'Ménages, cérémonies, touristes à Ouidah et Abomey' },
        { role: 'Exportateurs', description: 'Boutiques d\'art africain, plateformes e-commerce internationales' },
        { role: 'Fournisseurs matières', description: 'Marché de Dantokpa, fournisseurs de tissu getzner, raphia' },
        { role: 'Appui', description: 'Chambre des Métiers du Bénin, ONFP' },
      ]),
      marketPrices: JSON.stringify([
        { item: 'Tissu pagne (6 yards)', price: '6 000 – 15 000', unit: 'FCFA selon qualité' },
        { item: 'Sculpture bois (petite)', price: '5 000 – 25 000', unit: 'FCFA' },
        { item: 'Poterie utilitaire', price: '2 000 – 8 000', unit: 'FCFA' },
        { item: 'Tenue brodée (sur mesure)', price: '15 000 – 50 000', unit: 'FCFA' },
      ]),
      trends: 'L\'artisanat béninois jouit d\'une réputation internationale (bronze du Bénin, tissus kita). La demande touristique augmente avec le développement du tourisme culturel. Les plateformes en ligne (Etsy, Instagram) ouvrent des marchés à l\'export.',
      regulation: 'Carte d\'artisan délivrée par la Chambre des Métiers (obligatoire pour les marchés officiels). IFU requis. Pas de TVA en dessous de 50M FCFA.',
      tips: JSON.stringify([
        'Photographiez vos créations et créez une page Facebook/Instagram pour toucher les expatriés et touristes',
        'Regroupez-vous en atelier collectif pour réduire les coûts de loyer et de matériel',
        'Tenez un carnet de commandes et enregistrez chaque vente sur SEDO',
        'Demandez votre carte d\'artisan — elle ouvre l\'accès aux formations et marchés subventionnés',
      ]),
    },
    {
      sector: 'Élevage',
      title: 'Élevage au Bénin',
      actors: JSON.stringify([
        { role: 'Fournisseurs aliments', description: 'Fabricants d\'aliments bétail, marchés de céréales' },
        { role: 'Acheteurs', description: 'Boucheries, restaurants, abattoirs de Cotonou, fêtes religieuses' },
        { role: 'Appui vétérinaire', description: 'Direction de l\'Élevage, vétérinaires privés, ONG Vétérinaires Sans Frontières' },
        { role: 'Financement', description: 'FNDA, ANOPER (Association Nationale des OPérations Rurales)' },
      ]),
      marketPrices: JSON.stringify([
        { item: 'Poulet de chair (2 kg)', price: '3 500 – 5 000', unit: 'FCFA' },
        { item: 'Cabri adulte', price: '35 000 – 60 000', unit: 'FCFA' },
        { item: 'Porc engraissé (80 kg)', price: '120 000 – 180 000', unit: 'FCFA' },
        { item: 'Plateau d\'œufs (30 pcs)', price: '2 500 – 3 500', unit: 'FCFA' },
      ]),
      trends: 'L\'aviculture moderne se développe fortement autour de Cotonou. La demande en protéines animales augmente avec la croissance urbaine. La maladie de Newcastle et la grippe aviaire restent des risques majeurs. L\'élevage porcin est en forte progression dans le Sud-Bénin.',
      regulation: 'Déclaration d\'élevage obligatoire au-delà de 50 têtes. Carnet de vaccination à tenir à jour. Respect des distances minimales des habitations pour les porcheries. Abattage uniquement dans les abattoirs agréés.',
      tips: JSON.stringify([
        'Vaccinoz régulièrement votre cheptel — une épidémie peut détruire plusieurs années d\'efforts',
        'Commencez petit (50 poulets) avant de scaler pour maîtriser les coûts',
        'Vendez directement aux restaurants pour éviter les intermédiaires',
        'Enregistrez vos dépenses vétérinaires et ventes sur SEDO pour prouver votre rentabilité',
      ]),
    },
    {
      sector: 'Transport',
      title: 'Transport au Bénin',
      actors: JSON.stringify([
        { role: 'Clients', description: 'Particuliers, commerçants, entreprises, administrations' },
        { role: 'Concurrents', description: 'Zémidjan (moto-taxi), SOBETRAM, taxis interurbains' },
        { role: 'Régulateurs', description: 'MTPT (Ministère des Transports), ANASTP, Police routière' },
        { role: 'Financement', description: 'Crédit moto/véhicule PADME, BOA, location-vente CFAO' },
      ]),
      marketPrices: JSON.stringify([
        { item: 'Course zémidjan (5 km)', price: '200 – 500', unit: 'FCFA' },
        { item: 'Location camionnette (journée)', price: '30 000 – 50 000', unit: 'FCFA' },
        { item: 'Transport Cotonou-Parakou', price: '5 000 – 8 000', unit: 'FCFA/personne' },
        { item: 'Carburant super (litre)', price: '600 – 650', unit: 'FCFA' },
      ]),
      trends: 'Le parc de zémidjans dépasse 200 000 à Cotonou. Les applications de transport (Gozem, Okarito) transforment le secteur avec des prix transparents. Les camionnettes de livraison sont en forte demande avec l\'essor du e-commerce local.',
      regulation: 'Permis de conduire catégorie A/B obligatoire. Carte grise, assurance RC (obligatoire), visite technique annuelle. Pour zémidjan : badge et gilet réglementaires. Taxe professionnelle annuelle.',
      tips: JSON.stringify([
        'Rejoignez une coopérative de transport pour bénéficier d\'assurances groupées moins chères',
        'Enregistrez-vous sur Gozem ou Okarito pour plus de courses et moins de temps mort',
        'Suivez vos recettes quotidiennes sur SEDO — la régularité améliore votre score de crédit',
        'Prévoyez un fonds d\'entretien (10% des recettes) pour éviter les pannes coûteuses',
      ]),
    },
    {
      sector: 'Restauration',
      title: 'Restauration au Bénin',
      actors: JSON.stringify([
        { role: 'Fournisseurs', description: 'Marchés de proximité, grossistes Dantokpa, producteurs locaux' },
        { role: 'Clients', description: 'Travailleurs, étudiants, familles, cérémonies et événements' },
        { role: 'Concurrents', description: 'Maquis informels, fast-foods, vendeurs ambulants' },
        { role: 'Appui', description: 'ANPE (formation), Mairie (autorisation d\'ouverture)' },
      ]),
      marketPrices: JSON.stringify([
        { item: 'Repas complet (restaurant populaire)', price: '500 – 1 500', unit: 'FCFA' },
        { item: 'Poulet braisé (1/2)', price: '2 000 – 3 500', unit: 'FCFA' },
        { item: 'Jus de gingembre (bouteille 75cl)', price: '300 – 500', unit: 'FCFA' },
        { item: 'Plateau traiteur (par personne)', price: '2 500 – 5 000', unit: 'FCFA/pers' },
      ]),
      trends: 'La restauration rapide est en plein boom autour des zones universitaires et bureaux. Les commandes via WhatsApp et la livraison à domicile se développent. La demande de traiteur pour cérémonies (baptêmes, mariages) représente des revenus importants.',
      regulation: 'Autorisation d\'ouverture délivrée par la Mairie. Carnet de santé du personnel (obligatoire). Contrôle d\'hygiène de la Direction de l\'Hygiène. IFU requis. Pas de TVA en dessous de 50M FCFA.',
      tips: JSON.stringify([
        'Proposez un menu du jour fixe — cela réduit le gaspillage et fidélise les clients',
        'Développez les commandes traiteur pour les cérémonies — les marges sont 2x supérieures',
        'Achetez vos denrées tôt le matin au marché pour avoir les meilleurs prix',
        'Enregistrez chaque jour vos recettes sur SEDO — même les petits montants comptent pour votre score',
      ]),
    },
  ];

  for (const sheet of sectorSheets) {
    await prisma.sectorSheet.upsert({
      where: { sector: sheet.sector },
      update: sheet,
      create: sheet,
    });
  }

  console.log('✅ Seed terminé !');
  console.log('');
  console.log('Comptes de démo :');
  console.log('  MPME  → kouassi@sedo.bj   / sedo2026');
  console.log('  IMF   → padme@sedo.bj     / sedo2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

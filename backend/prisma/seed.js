const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // --- Utilisateurs de démo ---
  const hashedPassword = await bcrypt.hash('sedo2026', 10);

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

  await prisma.user.upsert({
    where: { email: 'padme@sedo.bj' },
    update: {},
    create: {
      email: 'padme@sedo.bj',
      password: hashedPassword,
      role: 'imf',
      fullName: 'PADME Microfinance',
      imfProfile: { create: { institution: 'PADME Microfinance' } },
    },
  });

  // --- Transactions de démo ---
  const mpmeId = mpmeUser.mpmeProfile.id;
  const now = new Date();
  const transactions = [];
  for (let m = 0; m < 6; m++) {
    const baseDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    for (let i = 0; i < 15 + Math.floor(Math.random() * 10); i++) {
      const day = Math.floor(Math.random() * 28) + 1;
      transactions.push({ mpmeId, type: 'entree', amount: 15000 + Math.floor(Math.random() * 30000), category: 'vente', description: 'Vente de marchandises', source: 'mobile_money', date: new Date(baseDate.getFullYear(), baseDate.getMonth(), day) });
    }
    for (let i = 0; i < 10 + Math.floor(Math.random() * 8); i++) {
      const day = Math.floor(Math.random() * 28) + 1;
      transactions.push({ mpmeId, type: 'sortie', amount: 8000 + Math.floor(Math.random() * 20000), category: 'achat', description: 'Achat de stock', source: 'mobile_money', date: new Date(baseDate.getFullYear(), baseDate.getMonth(), day) });
    }
  }
  await prisma.transaction.createMany({ data: transactions, skipDuplicates: true });

  // --- Offres de financement ---
  await prisma.financingOffer.createMany({
    data: [
      { name: 'PADME Microfinance', provider: 'PADME', logo: 'P', subtitle: 'Microcrédit Express pour MPME en activité', minScore: 60, maxAmount: 500000, rate: 12, duration: '12 mois', offerType: 'credit', sector: null },
      { name: 'BeniBiz', provider: 'BeniBiz', logo: 'B', subtitle: 'Subvention entrepreneuriale non remboursable', minScore: 50, maxAmount: 1000000, rate: null, duration: null, offerType: 'subvention', sector: 'Commerce général' },
      { name: 'BOA Bénin', provider: 'BOA', logo: 'BOA', subtitle: 'Crédit professionnel pour développement d\'activité', minScore: 75, maxAmount: 5000000, rate: 9, duration: '24-36 mois', offerType: 'credit', sector: null },
      { name: 'FONDS ADPME', provider: 'ADPME', logo: 'A', subtitle: 'Appel à projets pour MPME formalisées', minScore: 70, maxAmount: 2000000, rate: null, duration: null, offerType: 'appel_projets', sector: null },
    ],
    skipDuplicates: true,
  });

  // --- Score initial ---
  const txCount = await prisma.transaction.count({ where: { mpmeId } });
  const profile = mpmeUser.mpmeProfile;
  const mobileMoney = Math.min(100, (txCount / 100) * 100);
  const comptabilite = Math.min(100, (txCount / 80) * 100);
  const formalisation =
    (profile.ifuStatus === 'Complet' ? 40 : profile.ifuStatus === 'En cours' ? 20 : 0) +
    (profile.rccmStatus === 'Complet' ? 35 : profile.rccmStatus === 'En cours' ? 15 : 0) +
    (profile.npiStatus === 'Complet' ? 25 : profile.npiStatus === 'En cours' ? 10 : 0);
  const profilSectoriel = profile.sector && profile.company ? 80 : 50;
  const total = mobileMoney * 0.3 + comptabilite * 0.25 + formalisation * 0.25 + profilSectoriel * 0.2;

  await prisma.score.create({
    data: { mpmeId, total: Math.round(total), mobileMoney: Math.round(mobileMoney), comptabilite: Math.round(comptabilite), formalisation: Math.round(formalisation), profilSectoriel: Math.round(profilSectoriel), recommendation: 'Complétez votre formalisation (+10 points) pour atteindre le seuil d\'éligibilité de 75/100 et débloquer de nouvelles offres.' },
  });

  // --- Fiches sectorielles ---
  const sectorSheets = [
    {
      sector: 'Commerce général',
      title: 'Commerce Général au Bénin',
      actors: JSON.stringify([
        {
          role: 'Fournisseurs',
          description: 'Grossistes du marché Dantokpa, importateurs de Lagos et Lomé',
          details: 'Les grossistes de Dantokpa livrent généralement tôt le matin (5h–9h). Pour négocier de meilleurs prix, regroupez vos commandes avec d\'autres commerçants et achetez en volume. Les importateurs de Lagos proposent des prix 10–15% inférieurs mais exigent un paiement à l\'avance et des délais de 3–7 jours. Privilégiez les fournisseurs avec qui vous avez un historique de paiement régulier pour obtenir des crédits fournisseurs.',
        },
        {
          role: 'Clients',
          description: 'Ménages locaux, revendeurs ambulants, boutiques de quartier',
          details: 'Les ménages achètent principalement en fin de journée et en fin de semaine. Les revendeurs ambulants sont des clients réguliers qui achètent en petites quantités mais plusieurs fois par semaine — fidélisez-les avec des prix stables. Les boutiques de quartier commandent souvent à crédit : limitez le crédit client à 7 jours max pour éviter les impayés. Accepter le paiement Mobile Money augmente le volume de ventes de 20–30%.',
        },
        {
          role: 'Concurrents',
          description: 'Commerçants des marchés voisins, grandes surfaces (SCORE, Erevan)',
          details: 'Les grandes surfaces (SCORE, Erevan) ciblent principalement la classe moyenne et les expatriés — leur prix est 30–50% plus élevé que les marchés. Votre avantage concurrentiel est la proximité, le service personnalisé et la flexibilité du crédit. Différenciez-vous par la qualité du service (livraison quartier, horaires étendus) plutôt que par le prix seul.',
        },
        {
          role: 'Acteurs financiers',
          description: 'PADME, CLCAM, Mobile Money MTN/Moov',
          details: 'PADME offre des microcrédits de 50 000 à 500 000 FCFA avec un taux de 12%/an — le plus accessible pour les MPME sans garantie immobilière. La CLCAM (Caisse Locale de Crédit Agricole et Mutuel) est présente dans tous les quartiers et propose des taux similaires. MTN MoMo et Moov Money permettent de recevoir les paiements clients sans frais et de construire un historique financier digital reconnu par les IMF.',
        },
      ]),
      marketPrices: JSON.stringify([
        {
          item: 'Sac de riz (50 kg)',
          price: '22 000 – 28 000',
          unit: 'FCFA',
          context: 'Prix en hausse de 8% depuis janvier 2026 suite aux perturbations logistiques au port de Cotonou. Meilleurs prix obtenus en achat groupé de 5 sacs minimum chez les grossistes de Dantokpa. Saison haute : mars–mai (prix montants), saison basse : septembre–novembre (prix bas). Privilégiez le riz Thai ou indien — meilleur rapport qualité/prix.',
        },
        {
          item: 'Carton de savon (72 pcs)',
          price: '18 000 – 22 000',
          unit: 'FCFA',
          context: 'Prix stable sur les 3 derniers mois. Les marques locales (Tandem, Star) sont 15% moins chères que les marques importées pour une qualité comparable. Marge de revente habituelle : 25–35% au détail. Achetez directement au distributeur COLGATE-PALMOLIVE à Cotonou pour éviter un intermédiaire.',
        },
        {
          item: 'Bidon d\'huile (20 L)',
          price: '25 000 – 30 000',
          unit: 'FCFA',
          context: 'L\'huile de palme locale est 20% moins chère que l\'huile de tournesol importée. Prix fluctuant selon la saison de récolte du palmier (pic de production : octobre–décembre). L\'huile conditionnée en petits sachets (250 ml) génère une marge de 40–50% mais demande plus de travail. Stockez 2 semaines d\'avance pour les périodes de forte demande (fêtes de fin d\'année).',
        },
        {
          item: 'Carton de boissons (24 bouteilles)',
          price: '9 000 – 12 000',
          unit: 'FCFA',
          context: 'La SOBEBRA (Brasserie du Bénin) impose un prix officiel — pas de négociation possible sur les boissons locales. La marge de revente est fixée à environ 20–25%. Les boissons importées (sodas, jus) permettent des marges plus élevées mais rotatent moins vite. Pic de demande : décembre–janvier et avril (Pâques). Commandez 3 semaines à l\'avance pour ces périodes.',
        },
      ]),
      trends: 'Le commerce de détail au Bénin est en forte croissance avec l\'essor du marché de Dantokpa et du corridor Cotonou-Lagos. La digitalisation des paiements via Mobile Money (MTN MoMo, Moov Money) transforme les pratiques. La concurrence des supermarchés reste limitée en dehors de Cotonou.',
      regulation: 'IFU obligatoire pour tout commerçant (seuil : 0 FCFA depuis 2022). Patente annuelle à la Mairie. Registre des entrées/sorties conseillé. TVA applicable au-delà de 50M FCFA de chiffre d\'affaires.',
      tips: JSON.stringify([
        { text: 'Achetez en groupement pour négocier de meilleurs prix fournisseurs', details: 'Formez un groupe de 3 à 5 commerçants vendant les mêmes produits. Désignez un responsable des achats qui centralise les commandes. Avec un volume x3 ou x4, vous pouvez obtenir 10–20% de remise sur le prix grossiste. Utilisez WhatsApp pour coordonner les commandes chaque semaine. La confiance mutuelle est clé — commencez avec des petits montants avant de passer aux grandes commandes groupées.' },
        { text: 'Enregistrez chaque vente sur SEDO pour améliorer votre score', details: 'Chaque transaction enregistrée sur SEDO contribue à votre score de finançabilité. Un commerçant avec 3 mois d\'historique régulier obtient en moyenne +15 points. Ce score est reconnu par PADME, CLCAM et BOA pour l\'accès au crédit. Même les petites ventes de 500 FCFA comptent — la régularité prime sur le montant. Configurez un rappel quotidien pour saisir vos ventes en fin de journée.' },
        { text: 'Évitez le crédit informel — préférez PADME ou CLCAM', details: 'Les tontines à intérêt et prêteurs informels pratiquent des taux de 30–120%/an, contre 12–18%/an pour les IMF officielles. Avant de contracter un crédit informel d\'urgence, appelez PADME (tél. : 21 31 25 25) — ils ont un produit "crédit urgent" débloqué en 48h. La CLCAM propose également un crédit calamité sans garantie pour les situations d\'urgence. Construisez une épargne de précaution sur votre compte Mobile Money.' },
        { text: 'Constituez un stock tampon de 2 semaines pour les ruptures', details: 'Identifiez vos 5 produits les plus vendus et maintenez toujours 2 semaines de stock minimum. Calculez votre consommation hebdomadaire moyenne sur SEDO et passez commande quand vous atteignez 1 semaine de stock restant. En période de fête ou de perturbation logistique, ce stock tampon vous permet de ne pas perdre de clients et d\'éviter d\'acheter en urgence à des prix gonflés. Prévoyez un local de stockage sec et ventilé pour les denrées sensibles.' },
      ]),
    },
    {
      sector: 'Agriculture',
      title: 'Agriculture au Bénin',
      actors: JSON.stringify([
        {
          role: 'Fournisseurs intrants',
          description: 'SONAPRA, coopératives locales, marchés d\'intrants agricoles',
          details: 'La SONAPRA (Société Nationale pour la Promotion Agricole) distribue des intrants subventionnés (engrais NPK, urée) chaque année entre mars et mai. Inscrivez-vous dès janvier pour être sur la liste. Les coopératives d\'intrants permettent d\'acheter en groupement et d\'accéder aux prix subventionnés même si vous n\'êtes pas membre d\'une coopérative de production. Les marchés d\'intrants privés à Cotonou (quartier Agla) proposent des alternatives sans file d\'attente mais 20–30% plus chers.',
        },
        {
          role: 'Acheteurs',
          description: 'Collecteurs, marchés hebdomadaires, transformation agroalimentaire',
          details: 'Les collecteurs viennent directement à la ferme mais proposent des prix 20–30% inférieurs au marché. Ne vendez pas toute votre récolte aux collecteurs — gardez 30–40% pour vendre directement au marché et maximiser vos revenus. Les unités de transformation agroalimentaire (fabriques de farine, d\'huile) cherchent des approvisionnements réguliers et paient mieux. Négociez des contrats d\'approvisionnement annuels avec elles pour sécuriser vos revenus.',
        },
        {
          role: 'Appui technique',
          description: 'CeRPA, ONG HELVETAS, SNV Bénin',
          details: 'Les Centres Régionaux pour la Promotion Agricole (CeRPA) offrent des formations gratuites sur les techniques culturales, la gestion post-récolte et l\'accès au crédit. Chaque département a son CeRPA. L\'ONG HELVETAS Bénin finance des projets d\'agriculture durable et offre des formations certifiantes. La SNV (Service Néerlandais de Développement) intervient sur la chaîne de valeur des cultures vivrières et peut connecter les producteurs à de nouveaux marchés.',
        },
        {
          role: 'Financement',
          description: 'FNDA, CLCAM',
          details: 'Le FNDA (Fonds National de Développement Agricole) propose des crédits spéciaux agriculture à 8%/an avec une franchise de 6 mois (pas de remboursement pendant la période de culture). Accessible aux agriculteurs membres d\'une coopérative avec un IFU. Montants : 100 000 à 2 000 000 FCFA. La CLCAM rurale accepte les récoltes stockées comme garantie (warrantage) — un mécanisme très adapté aux agriculteurs qui ont besoin de trésorerie sans vendre leur stock au mauvais moment.',
        },
      ]),
      marketPrices: JSON.stringify([
        {
          item: 'Maïs (100 kg)',
          price: '18 000 – 25 000',
          unit: 'FCFA selon saison',
          context: 'Prix bas : janvier–février (après récolte principale). Prix haut : juillet–septembre (soudure). La hausse actuelle de 15% est liée à la demande d\'exportation vers le Nigeria. Stratégie : vendez 50% à la récolte et stockez le reste pour vendre en soudure. Le stockage dans des sacs hermétiques triple-couches (disponibles SONAPRA) conserve le maïs 6–8 mois sans perte de qualité.',
        },
        {
          item: 'Manioc (100 kg)',
          price: '8 000 – 12 000',
          unit: 'FCFA',
          context: 'Culture à cycle long (8–18 mois) mais très résistante à la sécheresse. La transformation en gari (semoule de manioc) triple la valeur : 100 kg de manioc frais = 25–30 kg de gari vendus à 600–800 FCFA/kg. Marché du gari très porteur au Nigeria et dans les pays voisins. Privilégiez les variétés améliorées TMS (disponibles CeRPA) qui donnent 2x plus de rendement.',
        },
        {
          item: 'Haricot niébé (100 kg)',
          price: '45 000 – 60 000',
          unit: 'FCFA',
          context: 'Légumineuse à haute valeur nutritive et commerciale. Deux récoltes par an possibles. Très demandé pendant le Ramadan et les périodes de jeûne chrétien. Le niébé décortiqué vaut 20–30% de plus que le niébé en graine. Conservation facile (1 an dans des conditions sèches). Marché export vers la Côte d\'Ivoire et le Ghana très actif.',
        },
        {
          item: 'Tomate (cageot)',
          price: '3 000 – 8 000',
          unit: 'FCFA selon saison',
          context: 'Culture très rentable mais très risquée — les prix varient du simple au triple selon la saison. Pic de production : novembre–janvier (prix bas). Pic de prix : juin–août (saison sèche, faible offre). La tomate concentrée (faite maison ou semi-industrielle) permet de vendre hors saison à prix élevé. Durée de vie courte : vendez ou transformez dans les 5–7 jours après récolte.',
        },
      ]),
      trends: 'L\'agriculture représente 25% du PIB béninois. Les cultures de rente (coton, anacarde) dominent les exportations. La transformation locale (gari, huile de palme) offre une valeur ajoutée importante. Les variations climatiques impactent fortement les rendements.',
      regulation: 'Pas de licence requise pour les petits agriculteurs. IFU recommandé pour accéder aux subventions. Enregistrement coopérative possible via la SONAPRA. Respect des normes phytosanitaires pour l\'exportation.',
      tips: JSON.stringify([
        { text: 'Diversifiez vos cultures pour réduire le risque de mauvaise saison', details: 'Ne consacrez jamais plus de 60% de vos terres à une seule culture. Associez au moins 2 cultures à cycles différents : une culture principale (maïs, manioc) et une culture de diversification (niébé, légumes). Les cultures associées améliorent aussi la fertilité du sol naturellement. En cas de mauvaise récolte d\'une culture, l\'autre compense partiellement les pertes.' },
        { text: 'Rejoignez une coopérative pour accéder aux intrants subventionnés', details: 'Les coopératives agricoles reconnues par l\'État bénéficient des intrants SONAPRA à prix subventionné (30–50% moins cher que le marché libre). Pour créer ou rejoindre une coopérative, contactez le CeRPA de votre département. Les membres bénéficient aussi de formations gratuites, de matériel agricole partagé et d\'accès prioritaire aux crédits FNDA. Une coopérative de 15 membres peut accéder à des tracteurs subventionnés.' },
        { text: 'Transformez une partie de votre récolte pour vendre à meilleur prix', details: 'La transformation ajoute 200–400% de valeur à vos produits bruts. Exemples : manioc → gari (x3 de valeur), palmiste → huile de palme (x4 de valeur), tomate → concentré (x5 de valeur). Commencez avec des équipements simples (râpe à manioc manuelle : 15 000 FCFA) avant d\'investir dans des machines. Formez-vous aux techniques de transformation via le CeRPA — les formations sont gratuites et durent 3–5 jours.' },
        { text: 'Enregistrez vos récoltes et ventes sur SEDO pour construire votre historique financier', details: 'Un agriculteur avec 6 mois d\'historique SEDO peut accéder au crédit FNDA sans garantie foncière. Enregistrez : les ventes de récolte, les achats d\'intrants, les coûts de main-d\'œuvre. Avec un historique SEDO de 12 mois, votre score peut atteindre 65–70/100 — suffisant pour PADME et CLCAM. Le FNDA reconnaît officiellement le score SEDO depuis 2026 comme justificatif de capacité de remboursement.' },
      ]),
    },
    {
      sector: 'Artisanat',
      title: 'Artisanat au Bénin',
      actors: JSON.stringify([
        {
          role: 'Clients locaux',
          description: 'Ménages, cérémonies, touristes à Ouidah et Abomey',
          details: 'Les cérémonies (mariages, baptêmes, funérailles) représentent 40–60% du chiffre d\'affaires de nombreux artisans. Construisez un réseau de contacts dans les mosquées, églises et associations pour être recommandé. Les touristes (Ouidah, Abomey, Porto-Novo) achètent des pièces à 5–10x le prix local — apprenez quelques mots en anglais ou français touristique. Les hôtels haut de gamme de Cotonou cherchent des artisans pour décorer leurs espaces.',
        },
        {
          role: 'Exportateurs',
          description: 'Boutiques d\'art africain, plateformes e-commerce internationales',
          details: 'Les boutiques d\'art africain à Paris, Londres et New York revendent les pièces béninoises 5–15x le prix d\'achat local. Pour travailler avec eux, vous avez besoin de photos professionnelles de vos créations et d\'un prix catalogué en euros. Des plateformes comme Afrikrea, Etsy ou Instagram permettent de vendre directement à l\'export sans intermédiaire — la marge est alors intégralement pour vous. La Chambre des Métiers du Bénin organise des missions de prospection à l\'étranger chaque année.',
        },
        {
          role: 'Fournisseurs matières',
          description: 'Marché de Dantokpa, fournisseurs de tissu getzner, raphia',
          details: 'Le tissu getzner (imprimé africain haut de gamme) se trouve chez des importateurs spécialisés au marché Dantokpa — négociez en achetant 20 yards minimum. Le raphia, les perles et le bois sculptable se trouvent dans les marchés de Parakou et Lokossa à des prix 30–40% inférieurs à Cotonou. Pour le bronze (travail au cire perdue), les fournisseurs de lingots sont concentrés à Abomey-Calavi. Constituez un stock de matières premières pour 1 mois afin d\'eviter les ruptures lors des pics de commandes.',
        },
        {
          role: 'Appui',
          description: 'Chambre des Métiers du Bénin, ONFP',
          details: 'La Chambre des Métiers du Bénin (CMB) délivre la carte d\'artisan (obligatoire pour les marchés officiels) et organise des formations techniques et commerciales. Adhésion : 15 000 FCFA/an. L\'Office National de Formation Professionnelle (ONFP) propose des formations gratuites sur la gestion, le marketing digital et la vente en ligne pour les artisans. Ces formations débouchent sur un certificat reconnu qui renforce votre dossier de crédit.',
        },
      ]),
      marketPrices: JSON.stringify([
        {
          item: 'Tissu pagne (6 yards)',
          price: '6 000 – 15 000',
          unit: 'FCFA selon qualité',
          context: 'Trois gammes : wax hollandais (15 000–25 000 FCFA/6 yards, le plus valorisé), wax africain (8 000–15 000 FCFA) et tissus locaux basin/faso danfani (6 000–10 000 FCFA). Pour la confection de vêtements à vendre, le wax africain offre le meilleur équilibre coût/valeur perçue. Les commandes en ligne de la diaspora africaine valorisent fortement les tissus locaux béninois — un marché peu concurrentiel.',
        },
        {
          item: 'Sculpture bois (petite)',
          price: '5 000 – 25 000',
          unit: 'FCFA',
          context: 'Le prix varie énormément selon le bois utilisé (iroko, bois rouge, bois commun) et la finition (peint, ciré, brut). Une sculpture en iroko de qualité avec finition cire se revend 60 000–150 000 FCFA dans les boutiques de souvenirs de Cotonou et jusqu\'à 200 € en Europe. La valeur ajoutée est dans la finition et le storytelling (histoire de la pièce, signification culturelle).',
        },
        {
          item: 'Poterie utilitaire',
          price: '2 000 – 8 000',
          unit: 'FCFA',
          context: 'Marché local saturé pour la poterie utilitaire (jarres, canaris). La valeur ajoutée est dans la décoration artistique et l\'usage décoratif — une poterie décorée vaut 3–5x une poterie utilitaire. Cibler les hôtels, restaurants et expatriés pour des commandes décoratives. Les céramiques inspirées de l\'art Fon ou Yoruba ont une forte demande à l\'export.',
        },
        {
          item: 'Tenue brodée (sur mesure)',
          price: '15 000 – 50 000',
          unit: 'FCFA',
          context: 'La broderie de luxe (type machine + main) est la catégorie la plus rentable — marge de 60–80%. La saison haute est décembre–janvier (Noël, réveillon) et juin–juillet (fêtes religieuses). Les uniformes d\'entreprise représentent un marché régulier et prévisible : proposez vos services aux entreprises et associations locales. Un seul contrat d\'uniforme (200 pièces) peut représenter 3–6 mois de chiffre d\'affaires.',
        },
      ]),
      trends: 'L\'artisanat béninois jouit d\'une réputation internationale. La demande touristique augmente avec le développement du tourisme culturel. Les plateformes en ligne (Etsy, Instagram) ouvrent des marchés à l\'export.',
      regulation: 'Carte d\'artisan délivrée par la Chambre des Métiers (obligatoire pour les marchés officiels). IFU requis. Pas de TVA en dessous de 50M FCFA.',
      tips: JSON.stringify([
        { text: 'Photographiez vos créations et créez une page Instagram pour toucher les touristes et expatriés', details: 'Une bonne photo est votre meilleur commercial. Utilisez la lumière naturelle du matin (8h–10h), posez vos pièces sur un tissu uni blanc ou noir. Un téléphone récent suffit. Sur Instagram, utilisez des hashtags comme #artisanatbeninois #africancraft #beninart pour être trouvé. Publiez 3–4 fois par semaine. Les expatriés béninois en Europe et Amérique du Nord sont votre audience prioritaire — ils achètent pour les cérémonies et pour décorer leurs maisons.' },
        { text: 'Regroupez-vous en atelier collectif pour réduire les coûts', details: 'Un atelier collectif de 5–8 artisans partage le loyer (15 000–30 000 FCFA/mois chacun au lieu de 80 000–150 000 FCFA seul), les outils coûteux (machines à coudre, tours de potier) et les coûts d\'électricité. Les ateliers collectifs attirent aussi plus les touristes et clients (l\'ambiance de travail visible est attractive). La Chambre des Métiers du Bénin peut vous aider à trouver des artisans de votre discipline pour former un atelier.' },
        { text: 'Tenez un carnet de commandes et enregistrez chaque vente sur SEDO', details: 'Un artisan avec un historique de commandes régulières sur SEDO peut accéder à un préfinancement de commandes chez PADME — très utile pour acheter les matières premières d\'une grosse commande sans avancer les fonds. Notez pour chaque commande : le client, le produit, le prix convenu, l\'acompte reçu, la date de livraison. Cela vous permet aussi de gérer vos délais et d\'éviter les retards qui nuisent à votre réputation.' },
        { text: 'Demandez votre carte d\'artisan — elle ouvre l\'accès aux formations et marchés subventionnés', details: 'La carte d\'artisan (délivrée par la Chambre des Métiers du Bénin, 15 000 FCFA/an) est obligatoire pour participer aux salons nationaux et foires internationales subventionnés. Elle donne aussi accès aux formations ONFP gratuites et aux crédits à taux préférentiel de la Chambre. Pour l\'obtenir : apportez votre CNI, une photo d\'identité, une justification de votre activité (photos de vos créations, 2 témoignages de clients) et votre IFU.' },
      ]),
    },
    {
      sector: 'Élevage',
      title: 'Élevage au Bénin',
      actors: JSON.stringify([
        {
          role: 'Fournisseurs aliments',
          description: 'Fabricants d\'aliments bétail, marchés de céréales',
          details: 'Pour l\'aviculture, les aliments industriels (Provimi, CANA) assurent une croissance optimale mais coûtent 15–18 FCFA/kg. Une alternative économique : fabriquer soi-même l\'aliment (maïs + son de riz + tourteau de coton + concentré protéique) pour un coût de 10–12 FCFA/kg si achetés en gros. La Direction de l\'Élevage propose des formations gratuites sur la fabrication d\'aliments. Pour les ruminants (chèvres, ovins), une partie de l\'alimentation peut être couverte par le pâturage naturel — réduisez les coûts en combinant pâturage et aliments complémentaires.',
        },
        {
          role: 'Acheteurs',
          description: 'Boucheries, restaurants, abattoirs de Cotonou, fêtes religieuses',
          details: 'Les fêtes religieuses représentent des pics de vente exceptionnels : Tabaski (moutons), Pâques (poulets, porcs), Noël (volailles en général). Préparez vos lots 6–8 semaines avant ces fêtes. Les restaurants sont des acheteurs réguliers mais exigeants sur la taille et la qualité — négociez des contrats d\'approvisionnement hebdomadaires avec 2–3 restaurants pour sécuriser vos revenus. Les abattoirs de Cotonou achètent au poids et paient au comptant — c\'est le débouché le plus simple mais les prix sont les plus bas.',
        },
        {
          role: 'Appui vétérinaire',
          description: 'Direction de l\'Élevage, vétérinaires privés, ONG Vétérinaires Sans Frontières',
          details: 'La Direction de l\'Élevage organise des campagnes de vaccination gratuites 2 fois par an (Newcastle pour la volaille, PPCB pour les bovins). Inscrivez votre exploitation à la Direction Départementale de l\'Agriculture pour être informé des campagnes. Les vétérinaires privés (Association Nationale des Vétérinaires Béninois) proposent des contrats de suivi mensuel à partir de 10 000 FCFA/mois — très rentable vs le coût d\'une épidémie. VSF Bénin (Vétérinaires Sans Frontières) intervient dans les zones rurales avec des consultations gratuites.',
        },
        {
          role: 'Financement',
          description: 'FNDA, ANOPER',
          details: 'Le FNDA propose un crédit spécial élevage (taux 8%/an, franchise 3 mois, montant 100 000–5 000 000 FCFA) accessible aux éleveurs membres d\'une organisation professionnelle avec un IFU. L\'ANOPER (Association Nationale des Organisations Professionnelles d\'Éleveurs et de Ruminants) regroupe les éleveurs et donne accès aux crédits groupés, aux intrants subventionnés et aux programmes de formation. Adhésion : 10 000 FCFA/an.',
        },
      ]),
      marketPrices: JSON.stringify([
        {
          item: 'Poulet de chair (2 kg)',
          price: '3 500 – 5 000',
          unit: 'FCFA',
          context: 'Cycle de production : 6–8 semaines. Coût de production moyen (alimentation + intrants vétérinaires) : 2 800–3 200 FCFA/poulet. Marge brute : 15–25% selon la saison. Pic de prix : décembre (Noël), mars–avril (Pâques), été (période de mariage). Stratégie : planifiez 3 lots par an calés sur ces pics pour maximiser la marge. La vente directe à domicile (WhatsApp) génère 500–800 FCFA de marge supplémentaire par poulet vs les abattoirs.',
        },
        {
          item: 'Cabri adulte',
          price: '35 000 – 60 000',
          unit: 'FCFA',
          context: 'Valeur maximale atteinte pendant la Tabaski (Aïd el-Kébir) — comptez +40–80% sur les prix habituels. Démarrez l\'engraissement 3 mois avant la Tabaski pour vendre au prix fort. Cycle d\'élevage d\'une chèvre : 8–12 mois de la naissance à la vente. Les cabris locaux (race Djallonké) sont plus résistants aux maladies que les races améliorées importées — privilégiez-les pour débuter.',
        },
        {
          item: 'Porc engraissé (80 kg)',
          price: '120 000 – 180 000',
          unit: 'FCFA',
          context: 'L\'élevage porcin est très rentable mais réglementé (distance minimale des habitations, abattage en abattoir agréé). Cycle : 5–6 mois pour un porc de 80 kg. Coût de production : 60 000–80 000 FCFA. Marge brute : 50 000–100 000 FCFA/porc. Marché très porteur dans le Sud-Bénin (communautés chrétiennes). Attention : la PPA (Peste Porcine Africaine) peut décimer un cheptel entier — vaccination et biosécurité sont essentielles.',
        },
        {
          item: 'Plateau d\'œufs (30 pcs)',
          price: '2 500 – 3 500',
          unit: 'FCFA',
          context: 'La pondeuse produit 280–300 œufs/an sur 18 mois de production. Coût de production d\'un œuf : 60–75 FCFA. Prix de vente : 80–120 FCFA/unité. Marché très stable et demande quotidienne régulière — idéal pour les trésoreries prévisibles. Les supermarchés (SCORE, Erevan) cherchent des approvisionnements réguliers et paient mieux que les marchés mais exigent un calibrage constant et une livraison hebdomadaire.',
        },
      ]),
      trends: 'L\'aviculture moderne se développe fortement autour de Cotonou. La demande en protéines animales augmente avec la croissance urbaine. La maladie de Newcastle et la grippe aviaire restent des risques majeurs.',
      regulation: 'Déclaration d\'élevage obligatoire au-delà de 50 têtes. Carnet de vaccination à tenir à jour. Respect des distances minimales des habitations pour les porcheries. Abattage uniquement dans les abattoirs agréés.',
      tips: JSON.stringify([
        { text: 'Vaccinez régulièrement votre cheptel — une épidémie peut détruire plusieurs années d\'efforts', details: 'Le calendrier de vaccination minimal pour la volaille : Newcastle à 7 jours, Gumboro à 14 jours, rappel Newcastle à 21 jours, puis tous les 3 mois. Pour les ruminants : PPCB (Péripneumonie Contagieuse) et charbon annuellement. Les vaccins contre Newcastle coûtent 5–8 FCFA/dose en campagne collective — gratuit lors des campagnes gouvernementales. Un vétérinaire en contrat mensuel (10 000–15 000 FCFA) vous alerte en temps réel sur les risques épidémiques dans votre zone.' },
        { text: 'Commencez petit (50 poulets) avant de scaler pour maîtriser les coûts', details: 'Les erreurs de débutant (mauvaise ventilation, alimentation mal dosée, stress thermique) tuent 20–40% d\'un premier lot. Commencez avec 50–100 sujets pour apprendre sans prendre de risque financier majeur. Notez tout : température du poulailler, quantité d\'aliments, mortalité, poids hebdomadaire. Ces données vous permettent d\'optimiser au lot suivant. Après 3 lots réussis, scalez progressivement (200 → 500 → 1 000). Un poulailler de 1 000 sujets bien géré génère 300 000–500 000 FCFA de bénéfice par cycle.' },
        { text: 'Vendez directement aux restaurants pour éviter les intermédiaires', details: 'Un intermédiaire prend 500–1 000 FCFA/poulet. En vendant directement aux restaurants, vous récupérez cette marge. Identifiez 3–5 restaurants de taille moyenne dans votre quartier et proposez-leur une livraison hebdomadaire avec prix fixé d\'avance. Les restaurants valorisent la régularité et la qualité constante — ils préfèrent un fournisseur fiable même légèrement plus cher. Créez un groupe WhatsApp avec vos clients restaurants pour les commandes hebdomadaires.' },
        { text: 'Enregistrez vos dépenses vétérinaires et ventes sur SEDO pour prouver votre rentabilité', details: 'Les IMF ne financent l\'élevage que si vous pouvez prouver la rentabilité de vos cycles précédents. Un historique SEDO avec : coûts d\'achat des poussins/animaux, dépenses alimentation et vétérinaires, recettes de vente — permet de calculer votre rentabilité réelle et de convaincre un agent de crédit. Après 2–3 cycles documentés sur SEDO, votre score augmente de 10–20 points et vous accédez au crédit élevage FNDA.' },
      ]),
    },
    {
      sector: 'Transport',
      title: 'Transport au Bénin',
      actors: JSON.stringify([
        {
          role: 'Clients',
          description: 'Particuliers, commerçants, entreprises, administrations',
          details: 'Les commerçants (marchés, boutiques) sont les clients les plus réguliers pour les camionnettes de livraison — négociez des contrats hebdomadaires avec les grossistes de Dantokpa. Les administrations et ONG paient bien mais exigent une facture et parfois un numéro de marchés publics. Les particuliers via les apps (Gozem, Okarito) représentent un revenu stable avec moins de négociation. Le segment livraison e-commerce (Jumia, boutiques WhatsApp) est en forte croissance.',
        },
        {
          role: 'Concurrents',
          description: 'Zémidjan (moto-taxi), SOBETRAM, taxis interurbains',
          details: 'Le marché du transport est très fragmenté — il n\'y a pas de dominant absolu. Votre avantage concurrentiel vient de la fiabilité, la ponctualité et le soin des marchandises (pour la livraison). Pour les zémidjans, la concurrence avec les apps (Gozem, Okarito) s\'intensifie — rejoindre ces plateformes est maintenant presque obligatoire pour rester compétitif. Les taxis climatisés et les chauffeurs privés répondent à un segment premium (expatriés, hôtels) peu touché par la concurrence des motos.',
        },
        {
          role: 'Régulateurs',
          description: 'MTPT, ANASTP, Police routière',
          details: 'Le Ministère des Transports (MTPT) délivre les agréments de transport public. L\'ANASTP (Agence Nationale des Services de Transport Public) supervise les standards de sécurité. Les contrôles de police sont fréquents sur les axes Cotonou-Parakou et Cotonou-Lomé — assurez-vous que tous les documents (carte grise, assurance, visite technique, permis) sont en règle pour éviter les saisies coûteuses. Le permis de transport de marchandises (catégorie C) ouvre l\'accès aux marchés de livraison industrielle.',
        },
        {
          role: 'Financement',
          description: 'Crédit moto/véhicule PADME, BOA, location-vente CFAO',
          details: 'PADME propose un crédit moto à 12%/an sur 18–24 mois, accessible avec un apport de 20% et 3 mois d\'historique de recettes. CFAO Motors Bénin offre une location-vente de véhicules neufs avec apport de 15% — les paiements peuvent être calés sur les recettes hebdomadaires. BOA Bénin finance les camionnettes à partir de 7 millions FCFA avec garantie matériel. Le leasing est plus adapté que le crédit classique pour le transport car le véhicule sert de garantie.',
        },
      ]),
      marketPrices: JSON.stringify([
        {
          item: 'Course zémidjan (5 km)',
          price: '200 – 500',
          unit: 'FCFA',
          context: 'Le prix varie selon la zone (centre-ville plus cher), l\'heure (heures de pointe +20–30%), et la négociation. Avec Gozem ou Okarito, le prix est fixé par algorithme — environ 300–400 FCFA pour 5 km. Les courses via app éliminent la négociation et garantissent 30–40 courses/jour contre 20–25 sans app. Recettes moyennes d\'un zémidjan actif : 15 000–25 000 FCFA/jour brut, soit 8 000–15 000 FCFA net après carburant et entretien.',
        },
        {
          item: 'Location camionnette (journée)',
          price: '30 000 – 50 000',
          unit: 'FCFA',
          context: 'Le prix inclut généralement le chauffeur. Forte demande les jours de marché (lundi et jeudi à Cotonou). Les entreprises et ONG louent à la journée ou au mois — un contrat mensuel (400 000–600 000 FCFA) garantit un revenu stable. Les déménagements de particuliers (week-end) sont très rémunérateurs. Une camionnette bien entretenue rapporte 600 000–900 000 FCFA/mois en pleine activité.',
        },
        {
          item: 'Transport Cotonou-Parakou',
          price: '5 000 – 8 000',
          unit: 'FCFA/personne',
          context: 'Trajet de 430 km, durée 5–7h selon l\'état de la route. Le marché inter-urbain est dominé par des coopératives de bus (STIF, compagnies privées). Pour un taxi individuel, le tarif est 3–4x plus élevé. La demande augmente fortement les vendredis soir et dimanches. Attention : la RN2 Cotonou-Parakou est souvent endommagée en saison des pluies — prévoyez des délais supplémentaires.',
        },
        {
          item: 'Carburant super (litre)',
          price: '600 – 650',
          unit: 'FCFA',
          context: 'Le carburant représente 30–40% des charges d\'exploitation d\'un transporteur. Le "kpayo" (carburant de contrebande) est 20–30% moins cher mais endommage les moteurs et est interdit. Les stations officielles (Total, SONACOP) offrent des cartes de fidélité avec réductions pour les professionnels. Le GPL (gaz naturel) réduit de 40% les coûts de carburant pour les taxis mais nécessite une adaptation du moteur (coût : 150 000–200 000 FCFA, rentabilisé en 6–8 mois).',
        },
      ]),
      trends: 'Le parc de zémidjans dépasse 200 000 à Cotonou. Les applications de transport (Gozem, Okarito) transforment le secteur. Les camionnettes de livraison sont en forte demande avec l\'essor du e-commerce local.',
      regulation: 'Permis de conduire catégorie A/B obligatoire. Carte grise, assurance RC (obligatoire), visite technique annuelle. Pour zémidjan : badge et gilet réglementaires. Taxe professionnelle annuelle.',
      tips: JSON.stringify([
        { text: 'Rejoignez une coopérative de transport pour des assurances groupées moins chères', details: 'Une assurance individuelle pour moto coûte 35 000–50 000 FCFA/an. Via une coopérative de 50+ membres, ce coût descend à 20 000–28 000 FCFA/an avec une couverture identique. Les coopératives négocient aussi des tarifs préférentiels avec les garages agréés. En cas d\'accident ou de panne majeure, le fonds d\'entraide de la coopérative peut vous avancer les frais de réparation. Cherchez la coopérative de votre zone via la mairie ou l\'ANASTP.' },
        { text: 'Inscrivez-vous sur Gozem ou Okarito pour plus de courses et moins de temps mort', details: 'Les conducteurs Gozem font en moyenne 35–45 courses/jour contre 20–25 sans application. L\'algorithme optimise les trajets et réduit les temps d\'attente. Commission Gozem : 15–20% des recettes (négociable les 3 premiers mois). Pour s\'inscrire : moto en bon état (vérification physique), permis A valide, smartphone Android 4Go+ de RAM, photo d\'identité. Gozem offre une assurance accident conducteur incluse dans l\'abonnement.' },
        { text: 'Suivez vos recettes quotidiennes sur SEDO — la régularité améliore votre score', details: 'Un conducteur qui enregistre ses recettes quotidiennes sur 6 mois montre une capacité de remboursement régulière — le critère clé pour les crédits moto/véhicule. PADME accepte un historique SEDO de 3 mois comme justificatif pour un crédit moto sans autre garantie. Enregistrez même les petites recettes — un historique de 150 transactions vaut plus qu\'un gros montant ponctuel. Avec un score SEDO de 65+, le crédit moto PADME vous permet de renouveler votre engin sans apport immobilier.' },
        { text: 'Prévoyez un fonds d\'entretien de 10% des recettes pour éviter les pannes coûteuses', details: 'Un entretien préventif régulier (vidange tous les 3 000 km, 5 000 FCFA) évite les pannes coûteuses (moteur grippé, 150 000–300 000 FCFA). Ouvrez un compte Mobile Money dédié à l\'entretien et versez-y 10% de vos recettes brutes quotidiennement. Ne touchez à ce fonds que pour les réparations et l\'entretien. Après 6 mois, ce fonds couvre également le remplacement préventif des pneus et freins. Un véhicule bien entretenu vaut 30–40% de plus à la revente.' },
      ]),
    },
    {
      sector: 'Restauration',
      title: 'Restauration au Bénin',
      actors: JSON.stringify([
        {
          role: 'Fournisseurs',
          description: 'Marchés de proximité, grossistes Dantokpa, producteurs locaux',
          details: 'Achetez vos denrées périssables (légumes, viande, poisson) quotidiennement au marché de proximité pour garantir la fraîcheur. Pour les produits secs (riz, huile, condiments), achetez en gros à Dantokpa une fois par semaine — 20–30% moins cher qu\'au détail. Négociez avec 1–2 producteurs maraîchers locaux pour des livraisons directes à la ferme — plus frais et moins cher. Le carnet de commandes fixe avec des fournisseurs réguliers permet d\'éviter les ruptures lors des pics d\'activité.',
        },
        {
          role: 'Clients',
          description: 'Travailleurs, étudiants, familles, cérémonies et événements',
          details: 'Les travailleurs de bureau représentent le flux quotidien le plus prévisible — proposez un menu du jour à prix fixe (600–1 200 FCFA) pour les fidéliser. Les étudiants autour des universités constituent un marché de volume (moins de marge par repas mais grande quantité). Les cérémonies (mariages, baptêmes, funérailles) sont le segment le plus rémunérateur : marge de 50–70% sur le traiteur vs 25–35% sur la restauration courante. Constituez un fichier client WhatsApp pour les solliciter directement lors des cérémonies.',
        },
        {
          role: 'Concurrents',
          description: 'Maquis informels, fast-foods, vendeurs ambulants',
          details: 'Les maquis informels concurrencent sur le prix mais pas sur l\'hygiène ni le confort. Votre avantage concurrentiel : propreté visible, service rapide, paiement Mobile Money accepté. Les fast-foods (Chicken Nation, burgers locaux) ciblent la classe moyenne — vous pouvez coexister en visant la clientèle populaire et les travailleurs. Les vendeurs ambulants captent les clients pressés — proposez une formule "à emporter" pour ne pas perdre ce segment.',
        },
        {
          role: 'Appui',
          description: 'ANPE, Mairie',
          details: 'L\'Agence Nationale pour la Promotion de l\'Emploi (ANPE) propose des formations gratuites en cuisine, gestion de restaurant et hygiène alimentaire. Ces formations débouchent sur un certificat qui renforce votre dossier pour l\'autorisation d\'ouverture. La Mairie de Cotonou délivre l\'autorisation d\'ouverture (15 000–30 000 FCFA selon la superficie) et le permis d\'occupation de l\'espace public si vous avez une terrasse. Renouvelez votre autorisation chaque année en janvier pour éviter les fermetures administratives.',
        },
      ]),
      marketPrices: JSON.stringify([
        {
          item: 'Repas complet (restaurant populaire)',
          price: '500 – 1 500',
          unit: 'FCFA',
          context: 'Le prix du repas complet (riz + sauce + viande/poisson) varie selon le quartier et la clientèle cible. Zone universitaire : 500–800 FCFA. Zone bureau : 800–1 500 FCFA. La marge sur un repas est de 25–40% selon la composition. Le coût matière représente 55–65% du prix de vente. Pour augmenter la marge, réduisez le gaspillage (cuisinez en quantité adaptée à la demande prévisionnelle) et négociez des approvisionnements groupés.',
        },
        {
          item: 'Poulet braisé (1/2)',
          price: '2 000 – 3 500',
          unit: 'FCFA',
          context: 'Le poulet braisé est le produit roi de la restauration béninoise — marge de 40–55%. Coût matière : 1 200–1 800 FCFA pour un 1/2 poulet braisé prêt à servir. La présentation (accompagnements : alloco, légumes grillés) et la marinade maison sont des différenciateurs forts. Les clients paient 20–30% plus cher pour un poulet bien mariné et présenté. Proposez la livraison à domicile via WhatsApp le week-end — forte demande à prix +500 FCFA/livraison.',
        },
        {
          item: 'Jus de gingembre (bouteille 75cl)',
          price: '300 – 500',
          unit: 'FCFA',
          context: 'Le jus de gingembre maison est produit pour 50–80 FCFA/bouteille (gingembre + sucre + citron) et vendu 300–500 FCFA — marge de 300–500%. C\'est souvent le produit le plus rentable d\'un restaurant populaire. Proposez aussi les jus de bissap (hibiscus), de tamarin et de soursop pour diversifier. Ces jus locaux se différencient des sodas industriels et répondent à une demande croissante de produits naturels.',
        },
        {
          item: 'Plateau traiteur (par personne)',
          price: '2 500 – 5 000',
          unit: 'FCFA/pers',
          context: 'Le traiteur pour cérémonies est le segment le plus rémunérateur de la restauration. Pour 100 personnes, un plateau à 3 500 FCFA/pers génère 350 000 FCFA de chiffre d\'affaires avec une marge de 180 000–200 000 FCFA. Constituez un portfolio photos de vos réalisations passées pour vous vendre. Demandez toujours un acompte de 50% à la commande pour financer les achats. La saison haute est avril–juillet (mariages) et décembre (réveillons).',
        },
      ]),
      trends: 'La restauration rapide est en plein boom autour des zones universitaires et bureaux. Les commandes via WhatsApp et la livraison à domicile se développent. La demande de traiteur pour cérémonies représente des revenus importants.',
      regulation: 'Autorisation d\'ouverture délivrée par la Mairie. Carnet de santé du personnel (obligatoire). Contrôle d\'hygiène de la Direction de l\'Hygiène. IFU requis. Pas de TVA en dessous de 50M FCFA.',
      tips: JSON.stringify([
        { text: 'Proposez un menu du jour fixe — réduit le gaspillage et fidélise les clients', details: 'Un menu du jour fixe (1 plat principal + boisson) permet de cuisiner exactement la quantité nécessaire et réduit le gaspillage à moins de 5%. Annoncez votre menu du jour via un groupe WhatsApp de clients fidèles — les pré-commandes vous permettent de gérer exactement vos achats matinaux. Un client du menu du jour revient en moyenne 4 fois par semaine contre 1,2 fois pour les clients sans menu fixe. Variez le menu chaque jour de la semaine mais gardez un cycle prévisible (lundi = riz, mardi = igname...).' },
        { text: 'Développez les commandes traiteur pour les cérémonies — les marges sont 2x supérieures', details: 'La marge nette du traiteur (45–55%) est le double de la restauration courante (20–30%). Commencez par proposer vos services de traiteur à votre réseau familial et religieux pour des événements de 50–100 personnes. Constituez un portfolio photo soigné sur WhatsApp et Instagram. Pour les grosses cérémonies (+200 personnes), associez-vous temporairement avec 1–2 autres restaurateurs. Fixez votre prix traiteur avec un devis écrit et faites signer un bon de commande avec acompte.' },
        { text: 'Achetez vos denrées tôt le matin au marché pour avoir les meilleurs prix', details: 'Les meilleures pièces de viande et les légumes les plus frais partent entre 6h et 8h. Après 9h, les prix augmentent de 15–25% et la qualité est moins bonne. Établissez une liste de courses précise en fin de journée précédente pour être efficace le matin. En vous faisant connaître des vendeurs, vous obtiendrez un "bon client" qui vous réserve les meilleures pièces. Achetez les condiments et épices en gros une fois par semaine — plus économique et moins de déplacements.' },
        { text: 'Enregistrez chaque jour vos recettes sur SEDO — même les petits montants', details: 'La restauration a souvent des recettes dispersées (nombreuses petites transactions en espèces). Enregistrez-les en fin de journée sur SEDO en une saisie groupée si nécessaire. Un historique de 90 jours consécutifs sur SEDO débloque le "profil régulier" qui augmente votre score de 10–15 points. Les IMF valorisent particulièrement la régularité des restaurateurs (activité quotidienne prévisible). Avec un score SEDO de 65+, PADME peut vous financer une extension ou un équipement de cuisine.' },
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

  // --- Actualités sectorielles (recréées à chaque seed) ---
  await prisma.sectorNews.deleteMany({});
  const news = [
    { sector: null, title: 'Nouveau : IFU gratuit pour les MPME en 2026', body: 'Le gouvernement béninois a annoncé la gratuité de l\'IFU pour toutes les MPME ayant un chiffre d\'affaires inférieur à 30 millions FCFA. Rendez-vous à la Direction des Impôts la plus proche muni de votre CNI.', type: 'alerte', publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { sector: null, title: 'SEDO : mise à jour des fiches sectorielles de mars 2026', body: 'Les prix du marché et les informations réglementaires de toutes les fiches sectorielles ont été actualisés pour le mois de mars 2026.', type: 'info', publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    { sector: null, title: 'Appel à projets ADPME — Clôture le 30 avril 2026', body: 'L\'Agence de Développement des PME lance un appel à projets doté de 500 millions FCFA pour les MPME formalisées. Score SEDO minimum requis : 70/100.', type: 'opportunite', publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    { sector: 'Commerce général', title: 'Hausse des prix du riz importé (+8%) en mars 2026', body: 'Suite aux perturbations logistiques au port de Cotonou, le prix du sac de riz (50 kg) a augmenté de 8%. Anticipez vos achats groupés avant la prochaine livraison de stock.', type: 'alerte', publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    { sector: 'Commerce général', title: 'Marché de Dantokpa : nouvelles horaires de livraison fournisseurs', body: 'À partir du 1er avril 2026, les livraisons de gros au marché Dantokpa se feront uniquement entre 5h et 9h du matin. Adaptez votre organisation en conséquence.', type: 'info', publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    { sector: 'Commerce général', title: 'MTN MoMo : frais de retrait réduits pour les commerçants', body: 'MTN Bénin annonce une réduction de 30% des frais de retrait pour les commerçants enregistrés. Présentez votre IFU à l\'agence MTN pour bénéficier du tarif préférentiel.', type: 'opportunite', publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    { sector: 'Agriculture', title: 'Alerte sécheresse : zone Sud-Bénin — prévoir irrigation', body: 'La météo nationale prévoit un déficit pluviométrique de 40% sur la zone côtière en avril 2026. Les cultures maraîchères sont particulièrement exposées. Stockez l\'eau dès maintenant.', type: 'alerte', publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    { sector: 'Agriculture', title: 'Subvention intrants agricoles SONAPRA — inscriptions ouvertes', body: 'La SONAPRA ouvre les inscriptions pour la subvention engrais 2026. Les coopératives et agriculteurs individuels peuvent s\'inscrire jusqu\'au 15 avril. Apportez votre carte IFU.', type: 'opportunite', publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
    { sector: 'Agriculture', title: 'Prix du maïs en hausse de 15% sur les marchés du Nord', body: 'La demande pour l\'exportation vers le Nigeria a fait grimper le prix du maïs. Bonne nouvelle pour les producteurs : envisagez de retenir votre stock quelques semaines encore.', type: 'info', publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
    { sector: 'Artisanat', title: 'Salon de l\'Artisanat de Cotonou — appel aux exposants', body: 'Le Salon National de l\'Artisanat se tient du 20 au 25 mai 2026 au Palais des Congrès. Les artisans peuvent s\'inscrire gratuitement sur présentation de leur carte d\'artisan.', type: 'opportunite', publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { sector: 'Artisanat', title: 'Formation numérique pour artisans — ONFP Cotonou', body: 'L\'ONFP propose une formation gratuite de 3 jours sur la vente en ligne (Facebook, WhatsApp Business) pour les artisans. Inscriptions à l\'ONFP de Jéricho avant le 10 avril.', type: 'info', publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) },
    { sector: 'Élevage', title: 'Alerte grippe aviaire — mesures de prévention obligatoires', body: 'Un foyer de grippe aviaire H5N1 a été détecté dans la région de l\'Atlantique. La Direction de l\'Élevage recommande la vaccination d\'urgence et l\'isolement des nouveaux lots.', type: 'alerte', publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    { sector: 'Élevage', title: 'Hausse de la demande en volaille pour les fêtes de Pâques', body: 'La demande en poulets de chair augmente de 40% en avril pour les fêtes. Planifiez vos lots maintenant pour être prêt à livrer à temps aux restaurants et boucheries.', type: 'opportunite', publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    { sector: 'Transport', title: 'Nouvelle réglementation zémidjan — badge obligatoire dès mai 2026', body: 'La Mairie de Cotonou rend obligatoire le nouveau badge électronique pour tous les zémidjans à partir du 1er mai 2026. Enregistrez-vous dès maintenant à la Mairie (gratuit jusqu\'au 15 avril).', type: 'alerte', publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    { sector: 'Transport', title: 'Gozem recrute 500 conducteurs partenaires à Cotonou', body: 'La plateforme Gozem lance une campagne de recrutement. Conditions : moto en bon état, permis A valide, smartphone Android. Commission réduite à 15% les 3 premiers mois.', type: 'opportunite', publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) },
    { sector: 'Restauration', title: 'Contrôle d\'hygiène renforcé dans les restaurants de Cotonou', body: 'La Direction de l\'Hygiène annonce une campagne de contrôles inopinés en avril 2026. Assurez-vous que vos carnets de santé du personnel sont à jour et votre cuisine conforme aux normes.', type: 'alerte', publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    { sector: 'Restauration', title: 'Forte demande traiteur pour les mariages de la saison sèche', body: 'Avril-juin est la haute saison des cérémonies au Bénin. Les restaurateurs proposant des services traiteur voient leur chiffre d\'affaires doubler. Pensez à vous organiser à l\'avance.', type: 'opportunite', publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  ];

  for (const item of news) {
    await prisma.sectorNews.create({ data: item });
  }

  console.log('✅ Seed terminé !');
  console.log('  MPME  → +229 97 00 00 01 / sedo2026');
  console.log('  IMF   → padme@sedo.bj     / sedo2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

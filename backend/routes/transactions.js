const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

const router = express.Router();
const prisma = new PrismaClient();

// ─── Constantes couleurs OHADA/SEDO ─────────────────────────────────────────
const GREEN_OHADA = '#1e5631';   // vert foncé officiel
const YELLOW_OHADA = '#e8a020';   // bande jaune OHADA
const RED_BENIN = '#cc0000';   // rouge République du Bénin
const BLUE_HDR = '#1a3a5c';   // bleu entête tableau
const LIGHT_GRAY = '#f5f5f5';
const DARK_TEXT = '#1a1a1a';
const GRAY_TEXT = '#666666';
function formatFCFA(amount) {
  if (amount === null || amount === undefined) return '—';
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ' FCFA';
}
function formatDate(date) {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Helpers PDF OHADA ───────────────────────────────────────────────────────

/**
 * En-tête style officiel OHADA — République du Bénin
 * Retourne la position Y après l'entête
 */
function ohadaHeader(doc, docTitle, periodLabel, profile) {
  const pageW = doc.page.width;
  const mL = 40;
  const mR = 40;
  const cW = pageW - mL - mR;

  // ── Bloc titre gauche
  doc.fillColor(GREEN_OHADA).fontSize(11).font('Helvetica-Bold')
    .text(docTitle, mL, 18, { width: 310 });
  doc.fillColor(GRAY_TEXT).fontSize(7.5).font('Helvetica')
    .text('Référentiel OHADA – Système Comptable SYSCOHADA', mL, 34);

  // ── Bloc République du Bénin (droite)
  const dossierNum = `SEDO-${new Date().getFullYear()}-${profile.id.replace(/-/g, '').slice(-8).toUpperCase()}`;
  doc.fillColor(GREEN_OHADA).fontSize(8).font('Helvetica-Bold')
    .text(`N° Dossier : ${dossierNum}`, mL + 310, 40, { width: cW - 310, align: 'right' });

  // ── Double ligne séparatrice
  doc.rect(mL, 52, cW, 3).fill(GREEN_OHADA);
  doc.rect(mL, 56, cW, 3).fill(YELLOW_OHADA);

  let y = 66;

  // ── Section identification entreprise
  doc.rect(mL, y, cW, 18).fill(GREEN_OHADA);
  doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
    .text('IDENTIFICATION DE L\'ENTREPRISE', mL + 6, y + 5);
  y += 19;

  const infos = [
    [`Raison sociale : ${profile.company || 'N/A'}`, `Secteur d'activité : ${profile.sector || 'N/A'}`],
    [`Représentant légal : ${profile.user?.fullName || 'N/A'}`, `Localisation : ${profile.location || 'N/A'}`],
    [`Téléphone : ${profile.user?.phone || 'N/A'}  |  Email : ${profile.user?.email || 'N/A'}`,
    `IFU : ${profile.numeroIFU || 'N/A'}  |  RCCM : ${profile.numeroRCCM || 'N/A'}`],
  ];
  infos.forEach((row, i) => {
    const bg = i % 2 === 0 ? LIGHT_GRAY : '#ffffff';
    doc.rect(mL, y, cW, 15).fill(bg);
    doc.fillColor(DARK_TEXT).fontSize(7.5).font('Helvetica')
      .text(row[0], mL + 5, y + 4, { width: 255 })
      .text(row[1], mL + 265, y + 4, { width: cW - 270 });
    y += 15;
  });

  // ── Ligne période
  doc.rect(mL, y, cW, 14).fill(YELLOW_OHADA);
  doc.fillColor('#1a1a1a').fontSize(7.5).font('Helvetica-Bold')
    .text(`Période : ${periodLabel.toUpperCase()}   |   Généré le : ${new Date().toLocaleDateString('fr-FR')}`,
      mL + 6, y + 3, { width: cW - 12 });
  y += 16;

  return y + 4;
}

/**
 * Pied de page OHADA commun
 */
function ohadaFooter(doc, subtitle) {
  const pageW = doc.page.width;
  const mL = 40;
  const footY = doc.page.height - 30;
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.rect(0, footY, pageW, 30).fill(GREEN_OHADA);
    doc.fillColor('white').fontSize(7).font('Helvetica')
      .text('SEDO — Plateforme Fintech MPME Bénin  |  www.sedo.bj',
        mL, footY + 5, { lineBreak: false });
    doc.fillColor('white').fontSize(7)
      .text(subtitle,
        0, footY + 5, { align: 'right', width: pageW - mL, lineBreak: false });
    doc.fillColor('white').fontSize(7)
      .text('Document confidentiel – Usage strictement financier',
        mL, footY + 17, { lineBreak: false });
    doc.fillColor('white').fontSize(7)
      .text(`Page ${i - range.start + 1} / ${range.count}`,
        0, footY + 17, { align: 'right', width: pageW - mL, lineBreak: false });
  }
}

/**
 * Calcule les données annuelles pour le Compte de Résultat SYSCOHADA
 */
async function getResultatAnnuel(mpmeId, year) {
  const tx = await prisma.transaction.findMany({
    where: {
      mpmeId,
      date: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      },
    },
  });
  if (tx.length === 0) return null;

  const sum = (arr) => arr.reduce((s, t) => s + t.amount, 0);
  const entrees = tx.filter(t => t.type === 'entree');
  const sorties = tx.filter(t => t.type === 'sortie');

  const ca = sum(entrees.filter(t => t.category === 'vente'));
  const autresProduits = sum(entrees.filter(t => t.category !== 'vente'));
  const achats = sum(sorties.filter(t => t.category === 'achat'));
  const stocks = sum(sorties.filter(t => t.category === 'stock'));
  const chargesPerso = sum(sorties.filter(t => t.category === 'depense'));
  const autresCharges = sum(sorties.filter(t => t.category === 'autre'));
  const totalProduits = ca + autresProduits;
  const totalCharges = achats + stocks + chargesPerso + autresCharges;
  const ebit = totalProduits - totalCharges;

  return {
    ca, autresProduits, achats, stocks, chargesPerso, autresCharges,
    amortissements: null, ebit, chargesFinancieres: null,
    resultatAvantImpot: ebit, impot: null, resultatNet: ebit
  };
}

/**
 * Calcule les données cumulées pour le Bilan SYSCOHADA (au 31/12 de l'année)
 */
async function getBilanAnnuel(mpmeId, year) {
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);
  const allTx = await prisma.transaction.findMany({
    where: { mpmeId, date: { lte: endOfYear } },
  });
  if (allTx.length === 0) return null;

  const sum = (arr) => arr.reduce((s, t) => s + t.amount, 0);
  const totalEntrees = sum(allTx.filter(t => t.type === 'entree'));
  const totalSorties = sum(allTx.filter(t => t.type === 'sortie'));
  const stocksCumul = sum(allTx.filter(t => t.type === 'sortie' && t.category === 'stock'));

  // Résultat annuel (pour capital propre)
  const annualTx = allTx.filter(t => new Date(t.date).getFullYear() === year);
  const annualE = sum(annualTx.filter(t => t.type === 'entree'));
  const annualS = sum(annualTx.filter(t => t.type === 'sortie'));
  const resultat = annualE - annualS;

  const tresorerie = Math.max(0, totalEntrees - totalSorties);
  const totalActif = tresorerie + stocksCumul;
  const capitaux = Math.max(0, totalActif - Math.max(0, resultat));
  const totalPassif = totalActif; // équilibre comptable

  return {
    // ACTIF
    immobilisations: null,
    stocks: stocksCumul > 0 ? stocksCumul : null,
    creances: null,
    tresorerie,
    totalActif,
    // PASSIF
    capitaux: capitaux > 0 ? capitaux : null,
    emprunts: null,
    dettesFournisseurs: null,
    dettesFiscales: null,
    autresDettes: null,
    totalPassif,
    resultat,
  };
}

function resolvePeriod(query) {
  let startDate, endDate, periodLabel, filenameSlug;
  if (query.from && query.to) {
    startDate = new Date(query.from);
    endDate = new Date(query.to);
    endDate.setHours(23, 59, 59, 999);
    const fmt = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    periodLabel = `du ${fmt(startDate)} au ${fmt(endDate)}`;
    filenameSlug = `${query.from}_${query.to}`;
  } else {
    const now = new Date();
    let year, month;
    if (query.month) {
      [year, month] = query.month.split('-').map(Number);
    } else {
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59);
    periodLabel = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    filenameSlug = `${year}-${String(month).padStart(2, '0')}`;
  }
  return { startDate, endDate, periodLabel, filenameSlug };
}

// ─── 1. JOURNAL DE TRANSACTIONS ──────────────────────────────────────────────
// GET /api/transactions/journal.pdf
router.get('/journal.pdf', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { fullName: true, phone: true, email: true } } },
    });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const { startDate, endDate, periodLabel, filenameSlug } = resolvePeriod(req.query);

    const transactions = await prisma.transaction.findMany({
      where: { mpmeId: profile.id, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
    const totalSorties = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
    const soldeNet = totalEntrees - totalSorties;

    const doc = new PDFDocument({
      margins: { top: 20, left: 40, right: 40, bottom: 30 },
      size: 'A4',
      bufferPages: true,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="journal_sedo_${filenameSlug}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const mL = 40;
    const cW = pageW - mL * 2;

    let y = ohadaHeader(doc, 'JOURNAL DE TRANSACTIONS', periodLabel, profile);

    // ── Titre section ──
    doc.rect(mL, y, cW, 20).fill(GREEN_OHADA);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
      .text('JOURNAL DE TRANSACTIONS', mL + 6, y + 6, { width: cW - 12, align: 'center' });
    y += 22;

    // ── Résumé 3 cases ──
    const bW = (cW - 10) / 3;
    [
      { label: 'TOTAL ENTRÉES (CRÉDITS)', value: totalEntrees, color: GREEN_OHADA },
      { label: 'TOTAL SORTIES (DÉBITS)', value: totalSorties, color: '#c0392b' },
      { label: 'SOLDE NET', value: soldeNet, color: soldeNet >= 0 ? GREEN_OHADA : '#c0392b' },
    ].forEach((b, i) => {
      const bx = mL + i * (bW + 5);
      doc.rect(bx, y, bW, 32).fillAndStroke('#ffffff', '#cccccc');
      doc.fillColor(GRAY_TEXT).fontSize(6.5).font('Helvetica').text(b.label, bx + 5, y + 5, { width: bW - 10 });
      const sign = b.label === 'SOLDE NET' && soldeNet < 0 ? '-' : '';
      doc.fillColor(b.color).fontSize(10).font('Helvetica-Bold')
        .text(sign + formatFCFA(Math.abs(b.value)), bx + 5, y + 15, { width: bW - 10 });
    });
    y += 38;

    // ── En-tête tableau ──
    // Répartition : N°=22 | DATE=50 | LIBELLÉ=135 | CATÉG.=55 | DÉBIT=84 | CRÉDIT=84 | SOLDE=85 = 515
    const cols = {
      num: { x: mL, w: 22 },
      date: { x: mL + 22, w: 50 },
      lib: { x: mL + 72, w: 135 },
      cat: { x: mL + 207, w: 55 },
      debit: { x: mL + 262, w: 84 },
      cred: { x: mL + 346, w: 84 },
      solde: { x: mL + 430, w: 85 },
    };

    doc.rect(mL, y, cW, 18).fill(BLUE_HDR);
    doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold')
      .text('N°', cols.num.x + 2, y + 5, { width: cols.num.w })
      .text('DATE', cols.date.x + 2, y + 5, { width: cols.date.w })
      .text('LIBELLÉ', cols.lib.x + 2, y + 5, { width: cols.lib.w })
      .text('CATÉG.', cols.cat.x + 2, y + 5, { width: cols.cat.w })
      .text('DÉBIT', cols.debit.x, y + 5, { width: cols.debit.w, align: 'right' })
      .text('CRÉDIT', cols.cred.x, y + 5, { width: cols.cred.w, align: 'right' })
      .text('SOLDE', cols.solde.x, y + 5, { width: cols.solde.w, align: 'right' });
    y += 19;

    if (transactions.length === 0) {
      doc.rect(mL, y, cW, 24).fill(LIGHT_GRAY);
      doc.fillColor(GRAY_TEXT).fontSize(9).font('Helvetica')
        .text('Aucune transaction sur cette période.', mL, y + 8, { width: cW, align: 'center' });
      y += 26;
    } else {
      let solde = 0;
      transactions.forEach((tx, idx) => {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 40;
          // Répéter l'entête tableau sur nouvelle page
          doc.rect(mL, y, cW, 18).fill(BLUE_HDR);
          doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold')
            .text('N°', cols.num.x + 2, y + 5, { width: cols.num.w })
            .text('DATE', cols.date.x + 2, y + 5, { width: cols.date.w })
            .text('LIBELLÉ', cols.lib.x + 2, y + 5, { width: cols.lib.w })
            .text('CATÉG.', cols.cat.x + 2, y + 5, { width: cols.cat.w })
            .text('DÉBIT', cols.debit.x, y + 5, { width: cols.debit.w, align: 'right' })
            .text('CRÉDIT', cols.cred.x, y + 5, { width: cols.cred.w, align: 'right' })
            .text('SOLDE', cols.solde.x, y + 5, { width: cols.solde.w, align: 'right' });
          y += 19;
        }

        const isEntree = tx.type === 'entree';
        const debit = isEntree ? 0 : tx.amount;
        const credit = isEntree ? tx.amount : 0;
        solde += isEntree ? tx.amount : -tx.amount;

        const rowH = 16;
        const bg = idx % 2 === 0 ? '#ffffff' : LIGHT_GRAY;
        doc.rect(mL, y, cW, rowH).fill(bg);

        const catLabel = (tx.category || 'autre').charAt(0).toUpperCase() + (tx.category || 'autre').slice(1);
        const libelle = tx.description || (isEntree ? 'Entrée' : 'Sortie');

        doc.fillColor(DARK_TEXT).fontSize(7).font('Helvetica')
          .text(String(idx + 1).padStart(3, '0'), cols.num.x + 2, y + 5, { width: cols.num.w })
          .text(formatDate(tx.date), cols.date.x + 2, y + 5, { width: cols.date.w })
          .text(libelle, cols.lib.x + 2, y + 5, { width: cols.lib.w - 4, ellipsis: true })
          .text(catLabel, cols.cat.x + 2, y + 5, { width: cols.cat.w - 4 });

        // Débit (rouge)
        if (debit > 0)
          doc.fillColor('#c0392b').fontSize(7).font('Helvetica-Bold')
            .text(formatFCFA(debit), cols.debit.x, y + 5, { width: cols.debit.w, align: 'right' });
        else
          doc.fillColor(GRAY_TEXT).fontSize(7).font('Helvetica')
            .text('—', cols.debit.x, y + 5, { width: cols.debit.w, align: 'right' });

        // Crédit (vert)
        if (credit > 0)
          doc.fillColor(GREEN_OHADA).fontSize(7).font('Helvetica-Bold')
            .text(formatFCFA(credit), cols.cred.x, y + 5, { width: cols.cred.w, align: 'right' });
        else
          doc.fillColor(GRAY_TEXT).fontSize(7).font('Helvetica')
            .text('—', cols.cred.x, y + 5, { width: cols.cred.w, align: 'right' });

        // Solde courant
        doc.fillColor(solde >= 0 ? GREEN_OHADA : '#c0392b').fontSize(7).font('Helvetica-Bold')
          .text(formatFCFA(solde), cols.solde.x, y + 5, { width: cols.solde.w, align: 'right' });

        // Ligne séparatrice
        doc.moveTo(mL, y + rowH).lineTo(mL + cW, y + rowH)
          .strokeColor('#dddddd').lineWidth(0.3).stroke();
        y += rowH;
      });

      // ── Ligne totaux ──
      y += 4;
      doc.rect(mL, y, cW, 20).fill(GREEN_OHADA);
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
        .text('TOTAUX', cols.lib.x, y + 6, { width: cols.lib.w })
        .text(formatFCFA(totalSorties), cols.debit.x, y + 6, { width: cols.debit.w, align: 'right' })
        .text(formatFCFA(totalEntrees), cols.cred.x, y + 6, { width: cols.cred.w, align: 'right' });
      doc.fillColor(soldeNet >= 0 ? YELLOW_OHADA : '#ff9999').fontSize(8).font('Helvetica-Bold')
        .text(formatFCFA(soldeNet), cols.solde.x, y + 6, { width: cols.solde.w, align: 'right' });
      y += 24;
    }

    // ── Note méthodologique ──
    y += 4;
    doc.rect(mL, y, cW, 28).fillAndStroke('#fffde7', YELLOW_OHADA);
    doc.fillColor('#7d5a00').fontSize(7).font('Helvetica-Bold').text('ℹ  Note :', mL + 6, y + 5);
    doc.fillColor('#7d5a00').fontSize(7).font('Helvetica')
      .text('Ce journal est établi sur la base des transactions enregistrées dans SEDO (saisie manuelle et/ou Mobile Money). '
        + 'Les colonnes Débit et Crédit reflètent respectivement les sorties et les entrées de trésorerie. '
        + 'Document indicatif — non certifié par un expert-comptable agréé OHADA.',
        mL + 6, y + 14, { width: cW - 12 });
    y += 32;

    ohadaFooter(doc, `Journal de transactions | ${periodLabel} | ${transactions.length} opération(s)`);
    doc.flushPages();
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération journal PDF' });
  }
});

// GET /api/transactions?page=1&limit=20&type=entree&month=2025-06
router.get('/', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const { page = 1, limit = 20, type, month, from, to } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { mpmeId: profile.id };
    if (type) where.type = type;
    if (from && to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      where.date = { gte: new Date(from), lte: toDate };
    } else if (month) {
      const [year, m] = month.split('-');
      where.date = {
        gte: new Date(parseInt(year), parseInt(m) - 1, 1),
        lt: new Date(parseInt(year), parseInt(m), 1),
      };
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { date: 'desc' }, skip, take: parseInt(limit) }),
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
  const { type, amount, category, description, source, date, sector } = req.body;

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
        sector: sector || null,
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
    if (!tx || tx.mpmeId !== profile.id)
      return res.status(404).json({ error: 'Transaction introuvable' });
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

      const recettes = txs.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
      const depenses = txs.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
      const monthLabel = start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      history.push({ month: monthLabel, recettes, depenses, count: txs.length });
    }

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── 2. BILAN SIMPLIFIÉ SYSCOHADA ────────────────────────────────────────────
// GET /api/transactions/bilan.pdf
router.get('/bilan.pdf', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { fullName: true, phone: true, email: true } } },
    });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const { endDate, periodLabel, filenameSlug } = resolvePeriod(req.query);
    const yearN = endDate.getFullYear();
    const yearN1 = yearN - 1;
    const yearN2 = yearN - 2;

    // Données pour chaque exercice
    const [dataN, dataN1, dataN2] = await Promise.all([
      getBilanAnnuel(profile.id, yearN),
      getBilanAnnuel(profile.id, yearN1),
      getBilanAnnuel(profile.id, yearN2),
    ]);

    const doc = new PDFDocument({
      margins: { top: 20, left: 40, right: 40, bottom: 30 },
      size: 'A4',
      bufferPages: true,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bilan_sedo_${filenameSlug}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const mL = 40;
    const cW = pageW - mL * 2;

    let y = ohadaHeader(doc, 'BILAN SIMPLIFIÉ (SYSCOHADA)', periodLabel, profile);

    // ── Titre ──
    doc.rect(mL, y, cW, 20).fill(GREEN_OHADA);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
      .text('BILAN SIMPLIFIÉ (SYSCOHADA) – 3 DERNIERS EXERCICES', mL + 6, y + 6, { width: cW - 12, align: 'center' });
    y += 22;

    // ── Dimensions colonnes ──
    const colLabel = 230;
    const colYear = 88;
    const gap = 5;

    // En-tête colonnes
    doc.rect(mL, y, cW, 18).fill(BLUE_HDR);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
      .text('POSTES DU BILAN', mL + 4, y + 5, { width: colLabel })
      .text(`N-2 (${yearN2}) FCFA`, mL + colLabel + gap, y + 5, { width: colYear, align: 'right' })
      .text(`N-1 (${yearN1}) FCFA`, mL + colLabel + gap + colYear + gap, y + 5, { width: colYear, align: 'right' })
      .text(`N   (${yearN}) FCFA`, mL + colLabel + gap + (colYear + gap) * 2, y + 5, { width: colYear, align: 'right' });
    y += 20;

    // Fonction d'affichage d'une ligne OHADA
    function bilanRow(label, vN2, vN1, vN, isTotal = false, isSection = false) {
      if (y > doc.page.height - 60) { doc.addPage(); y = 40; }

      const rowH = isTotal ? 18 : 15;
      let bg;
      if (isSection) bg = '#dce8dc';
      else if (isTotal) bg = '#c8dcc8';
      else bg = y % 2 === 0 ? '#ffffff' : LIGHT_GRAY;

      doc.rect(mL, y, cW, rowH).fill(bg);

      const fSize = isTotal || isSection ? 8 : 7.5;
      const fFont = isTotal || isSection ? 'Helvetica-Bold' : 'Helvetica';
      const indent = isSection ? 0 : (isTotal ? 0 : 8);

      doc.fillColor(DARK_TEXT).fontSize(fSize).font(fFont)
        .text(label, mL + 4 + indent, y + (rowH - fSize) / 2, { width: colLabel - 4 });

      const xN2 = mL + colLabel + gap;
      const xN1 = xN2 + colYear + gap;
      const xN = xN1 + colYear + gap;

      const renderVal = (v, x) => {
        if (v === null || v === undefined) {
          doc.fillColor(GRAY_TEXT).fontSize(fSize).font('Helvetica')
            .text('—', x, y + (rowH - fSize) / 2, { width: colYear, align: 'right' });
        } else {
          const color = isTotal ? GREEN_OHADA : DARK_TEXT;
          doc.fillColor(color).fontSize(fSize).font(fFont)
            .text(formatFCFA(v), x, y + (rowH - fSize) / 2, { width: colYear, align: 'right' });
        }
      };

      renderVal(vN2 !== undefined ? vN2 : null, xN2);
      renderVal(vN1 !== undefined ? vN1 : null, xN1);
      renderVal(vN !== undefined ? vN : null, xN);

      doc.moveTo(mL, y + rowH).lineTo(mL + cW, y + rowH)
        .strokeColor('#cccccc').lineWidth(0.3).stroke();
      y += rowH;
    }

    const n2 = dataN2, n1 = dataN1, n = dataN;

    // ── ACTIF ──
    bilanRow('ACTIF', null, null, null, false, true);
    bilanRow('Immobilisations nettes (Actif immobilisé)',
      n2?.immobilisations, n1?.immobilisations, n?.immobilisations);
    bilanRow('Stocks et en-cours',
      n2?.stocks, n1?.stocks, n?.stocks);
    bilanRow('Créances clients et autres créances',
      n2?.creances, n1?.creances, n?.creances);
    bilanRow('Trésorerie-Actif (Banques, Caisse)',
      n2?.tresorerie, n1?.tresorerie, n?.tresorerie);
    bilanRow('TOTAL ACTIF',
      n2?.totalActif, n1?.totalActif, n?.totalActif, true);

    y += 6;

    // ── PASSIF ──
    bilanRow('PASSIF', null, null, null, false, true);
    bilanRow('Capitaux propres',
      n2?.capitaux, n1?.capitaux, n?.capitaux);
    bilanRow('Emprunts et dettes financières LT',
      n2?.emprunts, n1?.emprunts, n?.emprunts);
    bilanRow('Dettes fournisseurs',
      n2?.dettesFournisseurs, n1?.dettesFournisseurs, n?.dettesFournisseurs);
    bilanRow('Dettes fiscales et sociales (DGI/CNSS)',
      n2?.dettesFiscales, n1?.dettesFiscales, n?.dettesFiscales);
    bilanRow('Autres dettes à CT',
      n2?.autresDettes, n1?.autresDettes, n?.autresDettes);
    bilanRow('TOTAL PASSIF',
      n2?.totalPassif, n1?.totalPassif, n?.totalPassif, true);

    y += 10;

    // ── Résultat de l'exercice (récap) ──
    doc.rect(mL, y, cW, 18).fill(YELLOW_OHADA);
    doc.fillColor(DARK_TEXT).fontSize(8).font('Helvetica-Bold')
      .text('Résultat de l\'exercice (N)', mL + 4, y + 5, { width: colLabel })
      .text(n2 ? formatFCFA(n2.resultat) : '—', mL + colLabel + gap, y + 5, { width: colYear, align: 'right' })
      .text(n1 ? formatFCFA(n1.resultat) : '—', mL + colLabel + gap + colYear + gap, y + 5, { width: colYear, align: 'right' })
      .text(n ? formatFCFA(n.resultat) : '—', mL + colLabel + gap + (colYear + gap) * 2, y + 5, { width: colYear, align: 'right' });
    y += 22;

    // ── Note méthodologique ──
    doc.rect(mL, y, cW, 36).fillAndStroke('#fffde7', YELLOW_OHADA);
    doc.fillColor('#7d5a00').fontSize(7).font('Helvetica-Bold').text('ℹ  Note méthodologique :', mL + 6, y + 5);
    doc.fillColor('#7d5a00').fontSize(7).font('Helvetica')
      .text('Ce bilan est établi sur la base des transactions enregistrées dans SEDO. '
        + 'La Trésorerie-Actif correspond au solde cumulé (entrées − sorties). '
        + 'Les postes "Immobilisations", "Créances", "Emprunts" et "Dettes" nécessitent une saisie complémentaire. '
        + 'Les exercices N-1 et N-2 affichent "—" si aucune transaction n\'a été enregistrée pour ces années. '
        + 'Document indicatif — non certifié par un expert-comptable agréé OHADA.',
        mL + 6, y + 15, { width: cW - 12 });
    y += 40;

    ohadaFooter(doc, `Bilan simplifié SYSCOHADA | Exercice ${yearN}`);
    doc.flushPages();
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération bilan PDF' });
  }
});

// ─── 3. COMPTE DE RÉSULTAT SIMPLIFIÉ SYSCOHADA ──────────────────────────────
// GET /api/transactions/resultat.pdf
router.get('/resultat.pdf', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { fullName: true, phone: true, email: true } } },
    });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const { endDate, periodLabel, filenameSlug } = resolvePeriod(req.query);
    const yearN = endDate.getFullYear();
    const yearN1 = yearN - 1;
    const yearN2 = yearN - 2;

    const [dataN, dataN1, dataN2] = await Promise.all([
      getResultatAnnuel(profile.id, yearN),
      getResultatAnnuel(profile.id, yearN1),
      getResultatAnnuel(profile.id, yearN2),
    ]);

    const doc = new PDFDocument({
      margins: { top: 20, left: 40, right: 40, bottom: 30 },
      size: 'A4',
      bufferPages: true,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="compte_resultat_sedo_${filenameSlug}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const mL = 40;
    const cW = pageW - mL * 2;

    let y = ohadaHeader(doc, 'COMPTE DE RÉSULTAT SIMPLIFIÉ (SYSCOHADA)', periodLabel, profile);

    // ── Titre ──
    doc.rect(mL, y, cW, 20).fill(GREEN_OHADA);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
      .text('COMPTE DE RÉSULTAT SIMPLIFIÉ (SYSCOHADA) – 3 DERNIERS EXERCICES', mL + 6, y + 6, { width: cW - 12, align: 'center' });
    y += 22;

    // ── Résumé exercice N ──
    if (dataN) {
      const bW = (cW - 10) / 3;
      [
        { label: `CHIFFRE D'AFFAIRES HT (${yearN})`, value: dataN.ca, color: GREEN_OHADA },
        { label: `TOTAL CHARGES (${yearN})`, value: dataN.achats + dataN.stocks + dataN.chargesPerso + dataN.autresCharges, color: '#c0392b' },
        { label: `RÉSULTAT NET (${yearN})`, value: dataN.resultatNet, color: dataN.resultatNet >= 0 ? GREEN_OHADA : '#c0392b' },
      ].forEach((b, i) => {
        const bx = mL + i * (bW + 5);
        doc.rect(bx, y, bW, 32).fillAndStroke('#ffffff', '#cccccc');
        doc.fillColor(GRAY_TEXT).fontSize(6.5).font('Helvetica').text(b.label, bx + 5, y + 4, { width: bW - 10 });
        doc.fillColor(b.color).fontSize(10).font('Helvetica-Bold')
          .text(formatFCFA(b.value), bx + 5, y + 16, { width: bW - 10 });
      });
      y += 38;
    }

    // ── Colonnes tableau ──
    const colLabel = 250;
    const colYear = 82;
    const gap = 5;

    doc.rect(mL, y, cW, 18).fill(BLUE_HDR);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
      .text('RUBRIQUES', mL + 4, y + 5, { width: colLabel })
      .text(`N-2 (${yearN2}) FCFA`, mL + colLabel + gap, y + 5, { width: colYear, align: 'right' })
      .text(`N-1 (${yearN1}) FCFA`, mL + colLabel + gap + colYear + gap, y + 5, { width: colYear, align: 'right' })
      .text(`N   (${yearN}) FCFA`, mL + colLabel + gap + (colYear + gap) * 2, y + 5, { width: colYear, align: 'right' });
    y += 20;

    // Fonction ligne compte de résultat
    let rowIdx = 0;
    function resultatRow(label, vN2, vN1, vN, isTotal = false, isSousTotal = false) {
      if (y > doc.page.height - 60) { doc.addPage(); y = 40; }

      const rowH = isTotal ? 20 : 16;
      const fSize = isTotal ? 9 : 8;
      const fFont = isTotal || isSousTotal ? 'Helvetica-Bold' : 'Helvetica';
      const bg = isTotal ? GREEN_OHADA
        : isSousTotal ? '#dce8dc'
          : rowIdx % 2 === 0 ? '#ffffff' : LIGHT_GRAY;

      doc.rect(mL, y, cW, rowH).fill(bg);

      const tColor = isTotal ? 'white' : DARK_TEXT;
      doc.fillColor(tColor).fontSize(fSize).font(fFont)
        .text(label, mL + 4, y + (rowH - fSize) / 2 + 1, { width: colLabel });

      const xN2 = mL + colLabel + gap;
      const xN1 = xN2 + colYear + gap;
      const xN = xN1 + colYear + gap;

      const renderV = (v, x) => {
        if (v === null || v === undefined) {
          doc.fillColor(isTotal ? 'white' : GRAY_TEXT).fontSize(fSize).font('Helvetica')
            .text('—', x, y + (rowH - fSize) / 2 + 1, { width: colYear, align: 'right' });
        } else {
          const cColor = isTotal ? 'white' : (v < 0 ? '#c0392b' : DARK_TEXT);
          doc.fillColor(cColor).fontSize(fSize).font(fFont)
            .text(formatFCFA(v), x, y + (rowH - fSize) / 2 + 1, { width: colYear, align: 'right' });
        }
      };

      renderV(vN2, xN2);
      renderV(vN1, xN1);
      renderV(vN, xN);

      if (!isTotal)
        doc.moveTo(mL, y + rowH).lineTo(mL + cW, y + rowH)
          .strokeColor('#cccccc').lineWidth(0.3).stroke();

      y += rowH;
      rowIdx++;
    }

    const n2 = dataN2, n1 = dataN1, n = dataN;

    resultatRow("Chiffre d'affaires (CA) HT",
      n2?.ca, n1?.ca, n?.ca);
    resultatRow('Autres produits d\'exploitation',
      n2?.autresProduits, n1?.autresProduits, n?.autresProduits);

    // Sous-total produits
    const totalProd = (d) => d ? (d.ca || 0) + (d.autresProduits || 0) : null;
    resultatRow('TOTAL PRODUITS D\'EXPLOITATION',
      totalProd(n2), totalProd(n1), totalProd(n), false, true);

    y += 4;

    resultatRow('Achats et variation de stocks',
      n2?.achats, n1?.achats, n?.achats);
    resultatRow('Charges de personnel (salaires + CNSS)',
      n2?.chargesPerso, n1?.chargesPerso, n?.chargesPerso);
    resultatRow('Autres charges d\'exploitation',
      n2?.autresCharges, n1?.autresCharges, n?.autresCharges);
    resultatRow('Dotations aux amortissements',
      n2?.amortissements, n1?.amortissements, n?.amortissements);

    y += 2;
    resultatRow('Résultat d\'exploitation (EBIT)',
      n2?.ebit, n1?.ebit, n?.ebit, false, true);

    y += 4;
    resultatRow('Charges et produits financiers',
      n2?.chargesFinancieres, n1?.chargesFinancieres, n?.chargesFinancieres);
    resultatRow('Résultat avant impôt',
      n2?.resultatAvantImpot, n1?.resultatAvantImpot, n?.resultatAvantImpot, false, true);

    y += 4;
    resultatRow('Impôt sur les bénéfices (IBF / AIBE)',
      n2?.impot, n1?.impot, n?.impot);

    y += 2;
    resultatRow('RÉSULTAT NET',
      n2?.resultatNet, n1?.resultatNet, n?.resultatNet, true);

    y += 10;

    // ── Interprétation exercice N ──
    if (dataN) {
      const isPositif = dataN.resultatNet >= 0;
      const msg = isPositif
        ? `L'entreprise est bénéficiaire sur l'exercice ${yearN}. Résultat net : ${formatFCFA(dataN.resultatNet)}. `
        + `Rentabilité : ${dataN.ca > 0 ? Math.round(dataN.resultatNet / dataN.ca * 100) : 0}%.`
        : `L'entreprise est déficitaire sur l'exercice ${yearN}. Déficit : ${formatFCFA(Math.abs(dataN.resultatNet))}. `
        + 'Analysez vos principales charges pour optimiser votre résultat.';
      const bgColor = isPositif ? '#e8f5e9' : '#ffebee';
      const bColor = isPositif ? GREEN_OHADA : '#c0392b';

      doc.rect(mL, y, cW, 24).fillAndStroke(bgColor, bColor);
      doc.fillColor(bColor).fontSize(8).font('Helvetica-Bold')
        .text(isPositif ? '✓  Exercice bénéficiaire' : '⚠  Exercice déficitaire', mL + 8, y + 5);
      doc.fillColor(isPositif ? '#1b5e20' : '#b71c1c').fontSize(7.5).font('Helvetica')
        .text(msg, mL + 8, y + 14, { width: cW - 16 });
      y += 28;
    }

    // ── Note méthodologique ──
    doc.rect(mL, y, cW, 36).fillAndStroke('#fffde7', YELLOW_OHADA);
    doc.fillColor('#7d5a00').fontSize(7).font('Helvetica-Bold').text('ℹ  Note méthodologique :', mL + 6, y + 5);
    doc.fillColor('#7d5a00').fontSize(7).font('Helvetica')
      .text('Le Chiffre d\'affaires correspond aux transactions de type "Vente". Les charges de personnel incluent les saisies catégorisées "Dépense". '
        + 'Les postes "Amortissements", "Charges financières" et "Impôt IBF/AIBE" nécessitent une saisie complémentaire pour être complets. '
        + 'Les exercices N-1 et N-2 affichent "—" en l\'absence de données enregistrées pour ces années. '
        + 'Document indicatif — non certifié par un expert-comptable agréé OHADA.',
        mL + 6, y + 15, { width: cW - 12 });

    ohadaFooter(doc, `Compte de résultat SYSCOHADA | Exercice ${yearN}`);
    doc.flushPages();
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération compte de résultat PDF' });
  }
});

module.exports = router;

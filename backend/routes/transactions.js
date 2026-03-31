const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const PDFDocument = require('pdfkit');

const router = express.Router();
const prisma = new PrismaClient();

const GREEN = '#22c55e';
const DARK = '#111827';
const GRAY = '#6b7280';
const LIGHT_GRAY = '#f3f4f6';
const RED = '#ef4444';

function formatFCFA(amount) {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
}
function formatDate(date) {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// GET /api/transactions/journal.pdf
router.get('/journal.pdf', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { fullName: true, phone: true } } },
    });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    // Resolve date range: supports ?from=YYYY-MM-DD&to=YYYY-MM-DD or ?month=YYYY-MM
    let startDate, endDate, periodLabel, filenameSlug;
    if (req.query.from && req.query.to) {
      startDate = new Date(req.query.from);
      endDate = new Date(req.query.to);
      endDate.setHours(23, 59, 59, 999);
      const fmt = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      periodLabel = `du ${fmt(startDate)} au ${fmt(endDate)}`;
      filenameSlug = `${req.query.from}_${req.query.to}`;
    } else {
      let year, month;
      if (req.query.month) {
        [year, month] = req.query.month.split('-').map(Number);
      } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth() + 1;
      }
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 1);
      periodLabel = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      filenameSlug = `${year}-${String(month).padStart(2, '0')}`;
    }

    const transactions = await prisma.transaction.findMany({
      where: { mpmeId: profile.id, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
    const totalSorties = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
    const soldeNet = totalEntrees - totalSorties;

    // --- Build PDF ---
    const doc = new PDFDocument({ margins: { top: 40, left: 40, right: 40, bottom: 0 }, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="journal_sedo_${filenameSlug}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const marginL = 40;
    const contentW = pageW - marginL * 2;

    // Header bar
    doc.rect(0, 0, pageW, 60).fill(GREEN);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('SEDO', marginL, 15);
    doc.fontSize(10).font('Helvetica').text('Plateforme Fintech MPME — Bénin', marginL, 38);
    doc.fontSize(12).font('Helvetica-Bold').text('JOURNAL DE TRANSACTIONS', 0, 22, { align: 'right', width: pageW - marginL });
    doc.fontSize(9).font('Helvetica').text(periodLabel.toUpperCase(), 0, 38, { align: 'right', width: pageW - marginL });

    let y = 75;

    // Company info box
    doc.rect(marginL, y, contentW, 60).fillAndStroke(LIGHT_GRAY, '#e5e7eb');
    doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold').text(profile.user?.fullName || 'N/A', marginL + 10, y + 8);
    doc.fontSize(9).font('Helvetica').fillColor(GRAY)
      .text(`Entreprise : ${profile.businessName || 'N/A'}`, marginL + 10, y + 24)
      .text(`Secteur : ${profile.sector || 'N/A'}  |  Localisation : ${profile.location || 'N/A'}`, marginL + 10, y + 38)
      .text(`Tél : ${profile.user?.phone || 'N/A'}`, marginL + 10, y + 52);
    doc.fillColor(GRAY).fontSize(9).text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 0, y + 8, { align: 'right', width: pageW - marginL });

    y += 70;

    // Summary boxes (3 columns)
    const boxW = (contentW - 20) / 3;
    const boxes = [
      { label: 'ENTRÉES', value: formatFCFA(totalEntrees), color: GREEN },
      { label: 'SORTIES', value: formatFCFA(totalSorties), color: RED },
      { label: 'SOLDE NET', value: formatFCFA(soldeNet), color: soldeNet >= 0 ? GREEN : RED },
    ];
    boxes.forEach((box, i) => {
      const bx = marginL + i * (boxW + 10);
      doc.rect(bx, y, boxW, 50).fillAndStroke('#ffffff', '#e5e7eb');
      doc.fontSize(8).font('Helvetica').fillColor(GRAY).text(box.label, bx + 8, y + 8);
      doc.fontSize(13).font('Helvetica-Bold').fillColor(box.color).text(box.value, bx + 8, y + 22, { width: boxW - 16 });
    });

    y += 62;

    // Table header
    const cols = { date: marginL, type: marginL + 75, cat: marginL + 145, desc: marginL + 240, amount: marginL + contentW - 100 };
    doc.rect(marginL, y, contentW, 20).fill(DARK);
    doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
      .text('DATE', cols.date + 4, y + 6)
      .text('TYPE', cols.type + 4, y + 6)
      .text('CATÉGORIE', cols.cat + 4, y + 6)
      .text('DESCRIPTION', cols.desc + 4, y + 6)
      .text('MONTANT', cols.amount, y + 6, { width: 100, align: 'right' });

    y += 22;

    // Rows
    if (transactions.length === 0) {
      doc.rect(marginL, y, contentW, 30).fillAndStroke(LIGHT_GRAY, '#e5e7eb');
      doc.fillColor(GRAY).fontSize(10).font('Helvetica').text('Aucune transaction pour cette période.', marginL, y + 9, { width: contentW, align: 'center' });
      y += 32;
    } else {
      transactions.forEach((tx, idx) => {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 40;
        }
        const rowH = 22;
        const bg = idx % 2 === 0 ? '#ffffff' : LIGHT_GRAY;
        doc.rect(marginL, y, contentW, rowH).fill(bg);

        const isEntree = tx.type === 'entree';
        doc.fillColor(DARK).fontSize(8).font('Helvetica')
          .text(formatDate(tx.date), cols.date + 4, y + 7)
          .text(tx.category || '-', cols.cat + 4, y + 7, { width: 90, ellipsis: true })
          .text(tx.description || '-', cols.desc + 4, y + 7, { width: 110, ellipsis: true });
        doc.fillColor(isEntree ? GREEN : RED).font('Helvetica-Bold')
          .text(isEntree ? 'Entrée' : 'Sortie', cols.type + 4, y + 7);
        doc.fillColor(isEntree ? GREEN : RED).font('Helvetica-Bold')
          .text((isEntree ? '+' : '-') + formatFCFA(tx.amount), cols.amount, y + 7, { width: 100, align: 'right' });

        // row bottom border
        doc.moveTo(marginL, y + rowH).lineTo(marginL + contentW, y + rowH).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        y += rowH;
      });

      // Totals row
      y += 4;
      doc.rect(marginL, y, contentW, 24).fill(DARK);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
        .text('TOTAL', cols.date + 4, y + 7)
        .text(formatFCFA(totalEntrees), cols.desc + 4, y + 7, { width: 110 })
        .text(formatFCFA(totalSorties), cols.desc + 120, y + 7, { width: 110 });
      doc.fillColor(soldeNet >= 0 ? GREEN : RED).font('Helvetica-Bold')
        .text((soldeNet >= 0 ? '+' : '') + formatFCFA(soldeNet), cols.amount, y + 7, { width: 100, align: 'right' });
      y += 28;
    }

    // Footer
    const footerY = doc.page.height - 35;
    doc.rect(0, footerY, pageW, 35).fill(DARK);
    doc.fillColor(GRAY).fontSize(8).font('Helvetica')
      .text('SEDO — Plateforme Fintech MPME Bénin | www.sedo.bj', marginL, footerY + 6)
      .text(`${transactions.length} transaction(s) | ${periodLabel}`, 0, footerY + 6, { align: 'right', width: pageW - marginL })
      .text('Document généré automatiquement — non contractuel', marginL, footerY + 18);

    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération PDF' });
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
      prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
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
  const { type, amount, category, description, source, date } = req.body;

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

    if (!tx || tx.mpmeId !== profile.id) {
      return res.status(404).json({ error: 'Transaction introuvable' });
    }

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

      const recettes = txs.filter((t) => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
      const depenses = txs.filter((t) => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);

      const monthLabel = start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      history.push({ month: monthLabel, recettes, depenses, count: txs.length });
    }

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── Helpers PDF partagés ────────────────────────────────────────────────────
function pdfHeader(doc, title, periodLabel, profile) {
  const pageW = doc.page.width;
  const marginL = 40;
  doc.rect(0, 0, pageW, 60).fill(GREEN);
  doc.fillColor('white').fontSize(22).font('Helvetica-Bold').text('SEDO', marginL, 15);
  doc.fontSize(10).font('Helvetica').text('Plateforme Fintech MPME — Bénin', marginL, 38);
  doc.fontSize(12).font('Helvetica-Bold').text(title, 0, 22, { align: 'right', width: pageW - marginL });
  doc.fontSize(9).font('Helvetica').text(periodLabel.toUpperCase(), 0, 38, { align: 'right', width: pageW - marginL });

  let y = 75;
  doc.rect(marginL, y, pageW - marginL * 2, 58).fillAndStroke('#f3f4f6', '#e5e7eb');
  doc.fillColor('#111827').fontSize(11).font('Helvetica-Bold').text(profile.user?.fullName || 'N/A', marginL + 10, y + 8);
  doc.fontSize(9).font('Helvetica').fillColor('#6b7280')
    .text(`Entreprise : ${profile.businessName || 'N/A'}`, marginL + 10, y + 22)
    .text(`Secteur : ${profile.sector || 'N/A'}  |  Localisation : ${profile.location || 'N/A'}`, marginL + 10, y + 36)
    .text(`Tél : ${profile.user?.phone || 'N/A'}`, marginL + 10, y + 50);
  doc.fillColor('#6b7280').fontSize(9).text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 0, y + 8, { align: 'right', width: pageW - marginL });
  return y + 68;
}

function pdfFooter(doc, subtitle) {
  const pageW = doc.page.width;
  const marginL = 40;
  const footerY = doc.page.height - 35;
  doc.rect(0, footerY, pageW, 35).fill('#111827');
  doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
    .text('SEDO — Plateforme Fintech MPME Bénin', marginL, footerY + 6)
    .text(subtitle, 0, footerY + 6, { align: 'right', width: pageW - marginL })
    .text('Document généré automatiquement — non contractuel', marginL, footerY + 18);
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
    endDate = new Date(year, month, 1);
    periodLabel = startDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    filenameSlug = `${year}-${String(month).padStart(2, '0')}`;
  }
  return { startDate, endDate, periodLabel, filenameSlug };
}

// GET /api/transactions/bilan.pdf
router.get('/bilan.pdf', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { fullName: true, phone: true } } },
    });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const { startDate, endDate, periodLabel, filenameSlug } = resolvePeriod(req.query);

    // Toutes les transactions jusqu'à la date de fin (cumul)
    const allTx = await prisma.transaction.findMany({
      where: { mpmeId: profile.id, date: { lte: endDate } },
      orderBy: { date: 'asc' },
    });
    const periodTx = allTx.filter(t => new Date(t.date) >= startDate);

    // Calculs ACTIF
    const totalEntreesGlobal = allTx.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
    const totalSortiesGlobal = allTx.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
    const tresorerie = Math.max(0, totalEntreesGlobal - totalSortiesGlobal);

    // Calculs PASSIF
    const totalEntreesPeriode = periodTx.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
    const totalSortiesPeriode = periodTx.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
    const resultatPeriode = totalEntreesPeriode - totalSortiesPeriode;
    const capitalInitial = Math.max(0, tresorerie - resultatPeriode);

    const doc = new PDFDocument({ margins: { top: 40, left: 40, right: 40, bottom: 0 }, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="bilan_sedo_${filenameSlug}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const marginL = 40;
    const contentW = pageW - marginL * 2;
    let y = pdfHeader(doc, 'BILAN SIMPLIFIÉ', periodLabel, profile);

    // ── Résumé ──
    const boxW = (contentW - 10) / 2;
    [
      { label: 'TOTAL ACTIF', value: formatFCFA(tresorerie), color: GREEN },
      { label: 'TOTAL PASSIF', value: formatFCFA(tresorerie), color: '#6b7280' },
    ].forEach((b, i) => {
      const bx = marginL + i * (boxW + 10);
      doc.rect(bx, y, boxW, 44).fillAndStroke('#ffffff', '#e5e7eb');
      doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(b.label, bx + 8, y + 7);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(b.color).text(b.value, bx + 8, y + 20, { width: boxW - 16 });
    });
    y += 54;

    // ── Tableau Actif / Passif côte à côte ──
    const colW = (contentW - 10) / 2;

    // Actif header
    doc.rect(marginL, y, colW, 22).fill(GREEN);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text('ACTIF', marginL + 8, y + 7);
    // Passif header
    doc.rect(marginL + colW + 10, y, colW, 22).fill('#111827');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text('PASSIF & CAPITAUX', marginL + colW + 18, y + 7);
    y += 24;

    const actifRows = [
      { label: 'Trésorerie disponible', value: tresorerie, note: 'Solde cumulé (entrées − sorties)' },
      { label: 'Créances clients', value: 0, note: 'Non renseigné' },
      { label: 'Stock marchandises', value: 0, note: 'Non renseigné' },
    ];
    const passifRows = [
      { label: 'Capital propre estimé', value: capitalInitial, note: 'Trésorerie − résultat période' },
      { label: `Résultat ${periodLabel}`, value: resultatPeriode, note: resultatPeriode >= 0 ? 'Bénéfice' : 'Déficit' },
      { label: 'Dettes fournisseurs', value: 0, note: 'Non renseigné' },
    ];

    const rowH = 32;
    actifRows.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      const rx = marginL;
      doc.rect(rx, y + i * rowH, colW, rowH).fill(bg);
      doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold').text(row.label, rx + 8, y + i * rowH + 6, { width: colW - 80 });
      doc.fillColor('#6b7280').fontSize(7).font('Helvetica').text(row.note, rx + 8, y + i * rowH + 18, { width: colW - 80 });
      doc.fillColor(row.value > 0 ? GREEN : '#6b7280').fontSize(9).font('Helvetica-Bold')
        .text(formatFCFA(row.value), rx + colW - 95, y + i * rowH + 10, { width: 85, align: 'right' });
      doc.moveTo(rx, y + i * rowH + rowH).lineTo(rx + colW, y + i * rowH + rowH).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    });

    passifRows.forEach((row, i) => {
      const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
      const rx = marginL + colW + 10;
      doc.rect(rx, y + i * rowH, colW, rowH).fill(bg);
      doc.fillColor('#111827').fontSize(8).font('Helvetica-Bold').text(row.label, rx + 8, y + i * rowH + 6, { width: colW - 80 });
      doc.fillColor('#6b7280').fontSize(7).font('Helvetica').text(row.note, rx + 8, y + i * rowH + 18, { width: colW - 80 });
      const isNeg = row.value < 0;
      doc.fillColor(isNeg ? RED : row.value > 0 ? '#111827' : '#6b7280').fontSize(9).font('Helvetica-Bold')
        .text((isNeg ? '-' : '') + formatFCFA(Math.abs(row.value)), rx + colW - 95, y + i * rowH + 10, { width: 85, align: 'right' });
      doc.moveTo(rx, y + i * rowH + rowH).lineTo(rx + colW, y + i * rowH + rowH).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
    });

    y += actifRows.length * rowH + 8;

    // Total rows
    [
      { label: 'TOTAL ACTIF', value: tresorerie, color: GREEN, x: marginL },
      { label: 'TOTAL PASSIF', value: tresorerie, color: '#111827', x: marginL + colW + 10 },
    ].forEach(({ label, value, color, x }) => {
      doc.rect(x, y, colW, 24).fill(color);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text(label, x + 8, y + 7);
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text(formatFCFA(value), x + colW - 95, y + 7, { width: 85, align: 'right' });
    });
    y += 32;

    // Note explicative
    doc.rect(marginL, y, contentW, 38).fillAndStroke('#fffbeb', '#fcd34d');
    doc.fillColor('#92400e').fontSize(8).font('Helvetica-Bold').text('ℹ  Note méthodologique', marginL + 10, y + 7);
    doc.fillColor('#92400e').fontSize(7).font('Helvetica')
      .text('Ce bilan est établi sur la base des transactions enregistrées dans SEDO. Les postes "Créances", "Stock" et "Dettes" nécessitent une saisie manuelle pour être complets. Document indicatif — non certifié par un expert-comptable.', marginL + 10, y + 18, { width: contentW - 20 });

    pdfFooter(doc, `Bilan simplifié | ${periodLabel}`);
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération bilan PDF' });
  }
});

// GET /api/transactions/resultat.pdf
router.get('/resultat.pdf', authenticate, requireRole('mpme'), async (req, res) => {
  try {
    const profile = await prisma.mPMEProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { fullName: true, phone: true } } },
    });
    if (!profile) return res.status(404).json({ error: 'Profil introuvable' });

    const { startDate, endDate, periodLabel, filenameSlug } = resolvePeriod(req.query);

    const transactions = await prisma.transaction.findMany({
      where: { mpmeId: profile.id, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    // Regrouper par catégorie
    const produits = {}; // entrées
    const charges = {};  // sorties
    transactions.forEach(tx => {
      const cat = tx.category || 'autre';
      if (tx.type === 'entree') {
        produits[cat] = (produits[cat] || 0) + tx.amount;
      } else {
        charges[cat] = (charges[cat] || 0) + tx.amount;
      }
    });

    const totalProduits = Object.values(produits).reduce((s, v) => s + v, 0);
    const totalCharges = Object.values(charges).reduce((s, v) => s + v, 0);
    const resultatNet = totalProduits - totalCharges;

    const doc = new PDFDocument({ margins: { top: 40, left: 40, right: 40, bottom: 0 }, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="compte_resultat_sedo_${filenameSlug}.pdf"`);
    doc.pipe(res);

    const pageW = doc.page.width;
    const marginL = 40;
    const contentW = pageW - marginL * 2;
    let y = pdfHeader(doc, 'COMPTE DE RÉSULTAT', periodLabel, profile);

    // ── Résumé 3 cases ──
    const bW = (contentW - 20) / 3;
    [
      { label: 'PRODUITS (ENTRÉES)', value: totalProduits, color: GREEN },
      { label: 'CHARGES (SORTIES)', value: totalCharges, color: RED },
      { label: 'RÉSULTAT NET', value: resultatNet, color: resultatNet >= 0 ? GREEN : RED },
    ].forEach((b, i) => {
      const bx = marginL + i * (bW + 10);
      doc.rect(bx, y, bW, 48).fillAndStroke('#ffffff', '#e5e7eb');
      doc.fontSize(8).font('Helvetica').fillColor('#6b7280').text(b.label, bx + 6, y + 7);
      doc.fontSize(12).font('Helvetica-Bold').fillColor(b.color)
        .text((b.label === 'RÉSULTAT NET' && resultatNet < 0 ? '-' : '') + formatFCFA(Math.abs(b.value)), bx + 6, y + 22, { width: bW - 12 });
    });
    y += 58;

    // ── Section Produits ──
    doc.rect(marginL, y, contentW, 22).fill(GREEN);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text('PRODUITS D\'EXPLOITATION', marginL + 8, y + 7);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text('Montant', marginL + contentW - 95, y + 7, { width: 85, align: 'right' });
    y += 24;

    if (Object.keys(produits).length === 0) {
      doc.rect(marginL, y, contentW, 24).fill('#f9fafb');
      doc.fillColor('#6b7280').fontSize(8).font('Helvetica').text('Aucun produit enregistré sur cette période', marginL + 8, y + 8);
      y += 26;
    } else {
      Object.entries(produits).forEach(([cat, val], i) => {
        const bg = i % 2 === 0 ? '#ffffff' : '#f0fdf4';
        doc.rect(marginL, y, contentW, 24).fill(bg);
        doc.fillColor('#111827').fontSize(9).font('Helvetica').text(cat.charAt(0).toUpperCase() + cat.slice(1), marginL + 8, y + 8);
        doc.fillColor(GREEN).fontSize(9).font('Helvetica-Bold').text('+' + formatFCFA(val), marginL + contentW - 95, y + 8, { width: 85, align: 'right' });
        doc.moveTo(marginL, y + 24).lineTo(marginL + contentW, y + 24).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        y += 24;
      });
    }
    // Sous-total produits
    doc.rect(marginL, y, contentW, 22).fill('#dcfce7');
    doc.fillColor('#166534').fontSize(9).font('Helvetica-Bold')
      .text('Total Produits', marginL + 8, y + 7)
      .text(formatFCFA(totalProduits), marginL + contentW - 95, y + 7, { width: 85, align: 'right' });
    y += 30;

    // ── Section Charges ──
    doc.rect(marginL, y, contentW, 22).fill('#111827');
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text('CHARGES D\'EXPLOITATION', marginL + 8, y + 7);
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold').text('Montant', marginL + contentW - 95, y + 7, { width: 85, align: 'right' });
    y += 24;

    if (Object.keys(charges).length === 0) {
      doc.rect(marginL, y, contentW, 24).fill('#f9fafb');
      doc.fillColor('#6b7280').fontSize(8).font('Helvetica').text('Aucune charge enregistrée sur cette période', marginL + 8, y + 8);
      y += 26;
    } else {
      Object.entries(charges).forEach(([cat, val], i) => {
        if (y > doc.page.height - 100) { doc.addPage(); y = 40; }
        const bg = i % 2 === 0 ? '#ffffff' : '#fff1f2';
        doc.rect(marginL, y, contentW, 24).fill(bg);
        doc.fillColor('#111827').fontSize(9).font('Helvetica').text(cat.charAt(0).toUpperCase() + cat.slice(1), marginL + 8, y + 8);
        doc.fillColor(RED).fontSize(9).font('Helvetica-Bold').text('-' + formatFCFA(val), marginL + contentW - 95, y + 8, { width: 85, align: 'right' });
        doc.moveTo(marginL, y + 24).lineTo(marginL + contentW, y + 24).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
        y += 24;
      });
    }
    // Sous-total charges
    doc.rect(marginL, y, contentW, 22).fill('#fee2e2');
    doc.fillColor('#991b1b').fontSize(9).font('Helvetica-Bold')
      .text('Total Charges', marginL + 8, y + 7)
      .text(formatFCFA(totalCharges), marginL + contentW - 95, y + 7, { width: 85, align: 'right' });
    y += 30;

    // ── Résultat Net ──
    const resColor = resultatNet >= 0 ? GREEN : RED;
    const resBg = resultatNet >= 0 ? '#dcfce7' : '#fee2e2';
    doc.rect(marginL, y, contentW, 32).fill(resColor);
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
      .text('RÉSULTAT NET DE LA PÉRIODE', marginL + 8, y + 9)
      .text((resultatNet < 0 ? '-' : '+') + formatFCFA(Math.abs(resultatNet)), marginL + contentW - 110, y + 9, { width: 100, align: 'right' });
    y += 40;

    // Interprétation
    const interpMsg = resultatNet > 0
      ? `Votre activité est bénéficiaire sur cette période. Bénéfice net : ${formatFCFA(resultatNet)}.`
      : resultatNet < 0
      ? `Votre activité est déficitaire sur cette période. Déficit : ${formatFCFA(Math.abs(resultatNet))}. Analysez vos principales charges pour optimiser.`
      : `Vos produits et charges s'équilibrent exactement sur cette période.`;
    doc.rect(marginL, y, contentW, 36).fillAndStroke(resBg, resultatNet >= 0 ? '#86efac' : '#fca5a5');
    doc.fillColor(resultatNet >= 0 ? '#166534' : '#991b1b').fontSize(8).font('Helvetica').text(interpMsg, marginL + 10, y + 10, { width: contentW - 20 });

    pdfFooter(doc, `Compte de résultat | ${periodLabel}`);
    doc.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: 'Erreur génération compte de résultat PDF' });
  }
});

module.exports = router;

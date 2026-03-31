import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// Téléchargement PDF comptable (même logique que Comptabilite.jsx)
function downloadDoc(endpoint, from, to, filename) {
  const token = localStorage.getItem('sedo_token');
  const base = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const url = `${base}/api/transactions/${endpoint}?from=${from}&to=${to}`;
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => {
      if (!r.ok) throw new Error('Erreur génération PDF');
      return r.blob();
    })
    .then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    });
}

// Calcule la période des 6 derniers mois (from / to ISO)
function last6Months() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - 6, 1);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

const comptaDocs = [
  { endpoint: 'journal.pdf',  label: 'Journal des transactions',  icon: '📓', desc: 'Toutes les entrées/sorties sur 6 mois', filename: 'sedo-journal-6mois.pdf' },
  { endpoint: 'bilan.pdf',    label: 'Bilan Simplifié',           icon: '⚖️',  desc: 'Actif / Passif — situation patrimoniale',  filename: 'sedo-bilan.pdf' },
  { endpoint: 'resultat.pdf', label: 'Compte de Résultat',        icon: '📈', desc: 'Produits / Charges / Résultat net',        filename: 'sedo-compte-resultat.pdf' },
];

function DocComptables() {
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);
  const { from, to } = last6Months();

  const handleDownload = async (doc) => {
    setDownloading(doc.endpoint);
    setError(null);
    try {
      await downloadDoc(doc.endpoint, from, to, doc.filename);
    } catch {
      setError(doc.label);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100 space-y-3">
      <div>
        <h3 className="font-bold text-gray-800 text-sm lg:text-base">📂 Documents comptables à joindre</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Générés automatiquement depuis vos données Module 2 — 6 derniers mois ({from} → {to})
        </p>
      </div>
      <div className="space-y-2">
        {comptaDocs.map((doc) => (
          <div key={doc.endpoint} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-xl flex-shrink-0">{doc.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs lg:text-sm font-semibold text-gray-800">{doc.label}</p>
              <p className="text-[10px] lg:text-xs text-gray-400">{doc.desc}</p>
            </div>
            <button
              onClick={() => handleDownload(doc)}
              disabled={!!downloading}
              className="flex-shrink-0 bg-sedo-green text-white text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1">
              {downloading === doc.endpoint ? (
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
              ) : '⬇'} PDF
            </button>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-500">Erreur lors du téléchargement de «{error}». Vérifiez que vous avez des transactions enregistrées.</p>
      )}
      <p className="text-[10px] text-gray-400">
        Ces documents (Journal, Bilan, Compte de Résultat) peuvent être exigés lors du dépôt de votre dossier IFU ou RCCM comme justificatifs d'activité économique.
      </p>
    </div>
  );
}

const STATUTS = ['Non démarré', 'En cours', 'Complet'];

const docs = [
  {
    key: 'ifuStatus',
    code: 'IFU',
    label: 'Identifiant Fiscal Unique',
    pts: 40,
    icon: '🏛️',
    color: 'blue',
    description: "L'IFU est votre numéro fiscal officiel délivré par la Direction Générale des Impôts (DGI) du Bénin. Obligatoire pour toute activité commerciale formelle.",
    steps: [
      { step: 1, titre: 'Réunir les documents', detail: 'Pièce d\'identité (CNI ou passeport), justificatif de domicile de moins de 3 mois, photo d\'identité.' },
      { step: 2, titre: 'Se rendre à la DGI', detail: 'Direction Générale des Impôts, Boulevard Saint-Michel, Cotonou. Guichet "Immatriculation" — ouvert lundi–vendredi 8h–16h.' },
      { step: 3, titre: 'Remplir le formulaire', detail: 'Formulaire d\'immatriculation fiscale (fourni sur place ou téléchargeable sur dgi.finances.bj).' },
      { step: 4, titre: 'Déposer le dossier', detail: 'Dépôt au guichet avec l\'ensemble des pièces. Délai de traitement : 5 à 10 jours ouvrables.' },
      { step: 5, titre: 'Récupérer l\'IFU', detail: 'Votre IFU vous est remis sous forme de carte ou de document officiel.' },
    ],
    apiex: true,
  },
  {
    key: 'rccmStatus',
    code: 'RCCM',
    label: 'Registre du Commerce et du Crédit Mobilier',
    pts: 35,
    icon: '📋',
    color: 'purple',
    description: 'Le RCCM est l\'immatriculation de votre entreprise au registre du commerce. Il atteste de l\'existence légale de votre activité commerciale.',
    steps: [
      { step: 1, titre: 'Préparer le dossier', detail: 'IFU (obligatoire), CNI, justificatif de domicile, statuts de l\'entreprise si SARL/SA, capital minimum selon forme juridique.' },
      { step: 2, titre: 'Contacter le Guichet Unique', detail: 'Agence de Promotion des Investissements et des Exportations (APIEx), Cotonou. Tél : +229 21 30 88 40.' },
      { step: 3, titre: 'Remplir le formulaire d\'immatriculation', detail: 'Formulaire CRIET disponible au guichet. Préciser : forme juridique, capital, activité principale, adresse du siège.' },
      { step: 4, titre: 'Payer les frais', detail: 'Frais d\'immatriculation variables selon la forme juridique (environ 15 000 à 50 000 FCFA). Paiement en caisse.' },
      { step: 5, titre: 'Obtenir l\'extrait RCCM', detail: 'Délai : 3 à 5 jours. L\'extrait RCCM est valable 3 mois. Renouvellement annuel recommandé.' },
    ],
    apiex: true,
  },
  {
    key: 'npiStatus',
    code: 'NPI',
    label: 'Numéro Personnel d\'Identification',
    pts: 25,
    icon: '🪪',
    color: 'orange',
    description: 'Le NPI est un identifiant unique délivré par l\'INSAE (Institut National de la Statistique). Il est requis pour l\'accès à certains services publics et financiers.',
    steps: [
      { step: 1, titre: 'Rassembler les pièces', detail: 'Acte de naissance (original ou copie certifiée), CNI ou passeport, photo d\'identité récente.' },
      { step: 2, titre: 'Se rendre à l\'INSAE', detail: 'Institut National de la Statistique et de l\'Analyse Économique, Cotonou. Ou dans l\'une des antennes régionales.' },
      { step: 3, titre: 'Remplir la demande', detail: 'Formulaire de demande de NPI disponible sur place. Indiquer : état civil complet, adresse, profession.' },
      { step: 4, titre: 'Enregistrement biométrique', detail: 'Prise de photo et d\'empreintes digitales sur place. Aucun frais en principe.' },
      { step: 5, titre: 'Récupérer le NPI', detail: 'Délai : 7 à 14 jours. Le NPI est remis sous forme de carte ou de document officiel nominatif.' },
    ],
    apiex: false,
  },
];

const colorMap = {
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
};

const statusStyle = {
  'Non démarré': 'bg-gray-100 text-gray-500',
  'En cours': 'bg-amber-100 text-amber-700',
  'Complet': 'bg-green-100 text-green-700',
};

const statusIcon = {
  'Non démarré': '○',
  'En cours': '◑',
  'Complet': '✓',
};

function ptsEarned(status, pts) {
  if (status === 'Complet') return pts;
  if (status === 'En cours') return Math.round(pts * 0.5);
  return 0;
}

export default function Formalisation() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [updating, setUpdating] = useState(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['mpme-profile'],
    queryFn: () => api.get('/mpme/profile').then((r) => r.data),
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: (data) => api.put('/mpme/profile', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['mpme-profile']);
      queryClient.invalidateQueries(['score']);
      setUpdating(null);
    },
    onError: () => setUpdating(null),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-green rounded-full animate-spin" />
    </div>
  );

  // Score formalisation
  const totalPts = docs.reduce((sum, d) => {
    const status = profile?.[d.key] || 'Non démarré';
    return sum + ptsEarned(status, d.pts);
  }, 0);
  const maxPts = 100;
  const pct = Math.round((totalPts / maxPts) * 100);

  const completedCount = docs.filter((d) => (profile?.[d.key] || 'Non démarré') === 'Complet').length;

  return (
    <div className="px-4 py-5 lg:px-0 lg:py-0 space-y-5 lg:space-y-6">

      {/* Hero */}
      <div className="bg-gradient-to-br from-sedo-green to-sedo-green-dark rounded-2xl p-6 lg:p-8 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12">
          <div className="flex flex-col items-center lg:items-start">
            <p className="text-green-100 text-sm mb-3">📝 Formalisation de votre activité</p>
            <div className="relative w-32 h-32 lg:w-40 lg:h-40">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3.5"
                  strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl lg:text-4xl font-black">{totalPts}</span>
                <span className="text-green-200 text-sm">/100</span>
              </div>
            </div>
            <span className="mt-3 text-xs lg:text-sm bg-white/20 px-3 py-1 rounded-full font-medium">
              {completedCount}/3 documents complétés
            </span>
          </div>

          <div className="hidden lg:block flex-1">
            <h3 className="font-bold text-base text-white/80 mb-3">Impact sur votre score global</h3>
            <div className="space-y-2">
              <div className="bg-white/10 rounded-xl p-3 text-sm text-white">
                La formalisation représente <strong>25%</strong> de votre Score de Finançabilité SEDO.
              </div>
              <div className="space-y-1.5">
                {docs.map((d) => {
                  const status = profile?.[d.key] || 'Non démarré';
                  const earned = ptsEarned(status, d.pts);
                  return (
                    <div key={d.key} className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2">
                      <span className="text-sm text-white">{d.code} — {d.label.split(' ').slice(0, 3).join(' ')}…</span>
                      <span className="text-sm font-bold text-white">{earned}/{d.pts} pts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Pre-filled info from Module 2 */}
        {(profile?.company || profile?.sector) && (
          <div className="mt-4 bg-white/10 rounded-xl p-3 text-xs text-green-100 flex flex-wrap gap-x-4 gap-y-1">
            {profile.company && <span>🏢 {profile.company}</span>}
            {profile.sector && <span>🎯 {profile.sector}</span>}
            {profile.location && <span>📍 {profile.location}</span>}
            {profile.employees > 0 && <span>👥 {profile.employees} employé{profile.employees > 1 ? 's' : ''}</span>}
          </div>
        )}
      </div>

      {/* APIEx notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 items-start">
        <span className="text-xl flex-shrink-0">🔗</span>
        <div>
          <p className="text-sm font-bold text-blue-800 mb-1">Intégration APIEx — Guichet Unique</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            SEDO est connecté à l'API du Guichet Unique (APIEx) du Bénin. Dans la version complète, votre dossier de formalisation
            sera pré-rempli et soumis directement en ligne. Pour l'instant, suivez le guide pas à pas ci-dessous.
          </p>
        </div>
      </div>

      {/* Document cards */}
      <div className="space-y-4">
        <h3 className="font-bold text-gray-800 text-sm lg:text-base">Vos 3 documents clés</h3>
        {docs.map((doc) => {
          const status = profile?.[doc.key] || 'Non démarré';
          const earned = ptsEarned(status, doc.pts);
          const isExpanded = expanded === doc.key;
          const c = colorMap[doc.color];
          const isUpdating = updating === doc.key;

          return (
            <div key={doc.key} className={`rounded-2xl border-2 overflow-hidden ${status === 'Complet' ? 'border-sedo-green' : c.border} bg-white shadow-sm`}>
              {/* Card header */}
              <div className="p-4 lg:p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl ${c.bg} flex items-center justify-center text-2xl lg:text-3xl flex-shrink-0`}>
                    {doc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{doc.code}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[status]}`}>
                        {statusIcon[status]} {status}
                      </span>
                    </div>
                    <p className="font-bold text-sm lg:text-base text-gray-900 mt-1">{doc.label}</p>
                    <p className="text-[11px] lg:text-xs text-gray-400 mt-0.5">{doc.description}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-xl lg:text-2xl font-black ${status === 'Complet' ? 'text-sedo-green' : c.text}`}>{earned}</p>
                    <p className="text-[10px] text-gray-400">/{doc.pts} pts</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${status === 'Complet' ? 'bg-sedo-green' : status === 'En cours' ? 'bg-amber-400' : 'bg-gray-300'}`}
                    style={{ width: `${(earned / doc.pts) * 100}%` }}
                  />
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  {/* Status buttons */}
                  <div className="flex gap-1">
                    {STATUTS.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          if (s !== status) {
                            setUpdating(doc.key);
                            updateStatus({ [doc.key]: s });
                          }
                        }}
                        disabled={isUpdating}
                        className={`text-[11px] lg:text-xs px-2.5 py-1.5 rounded-xl font-medium border transition-all
                          ${status === s
                            ? (s === 'Complet' ? 'bg-sedo-green text-white border-sedo-green' : s === 'En cours' ? 'bg-amber-500 text-white border-amber-500' : 'bg-gray-700 text-white border-gray-700')
                            : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
                          } disabled:opacity-50`}>
                        {statusIcon[s]} {s}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setExpanded(isExpanded ? null : doc.key)}
                    className="ml-auto text-xs text-sedo-green font-semibold underline">
                    {isExpanded ? 'Masquer le guide' : '📖 Voir le guide'}
                  </button>
                </div>
              </div>

              {/* Expandable guide */}
              {isExpanded && (
                <div className={`border-t-2 ${c.border} ${c.bg} p-4 lg:p-5`}>
                  <h4 className={`text-sm font-bold ${c.text} mb-3`}>Guide pas à pas — {doc.code}</h4>
                  <div className="space-y-3">
                    {doc.steps.map((s) => (
                      <div key={s.step} className="flex gap-3">
                        <div className={`w-6 h-6 rounded-full ${c.dot} text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5`}>
                          {s.step}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{s.titre}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {doc.apiex && (
                    <div className="mt-4 bg-white rounded-xl p-3 border border-blue-200 flex gap-2 items-center">
                      <span className="text-base">🔗</span>
                      <p className="text-xs text-blue-700">
                        <strong>APIEx :</strong> Ce document peut être soumis via le Guichet Unique en ligne à{' '}
                        <span className="underline">guichetunique.bj</span>. L'intégration directe est disponible dans SEDO Pro.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => setExpanded(null)}
                    className="mt-3 text-xs text-gray-400 underline">
                    Fermer le guide
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile impact recap */}
      <div className="lg:hidden bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-bold text-sm text-gray-800 mb-3">📊 Impact sur le score</h3>
        <div className="space-y-2">
          {docs.map((d) => {
            const status = profile?.[d.key] || 'Non démarré';
            const earned = ptsEarned(status, d.pts);
            return (
              <div key={d.key} className="flex items-center justify-between">
                <span className="text-xs text-gray-600">{d.code} — {d.label.split(' ').slice(0, 3).join(' ')}…</span>
                <span className="text-xs font-bold text-sedo-green">{earned}/{d.pts} pts</span>
              </div>
            );
          })}
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-700">Total formalisation</span>
            <span className="text-sm font-black text-sedo-green">{totalPts}/100</span>
          </div>
          <p className="text-[10px] text-gray-400">La formalisation représente 25% de votre score global SEDO.</p>
        </div>
      </div>

      {/* Documents comptables à joindre au dossier */}
      <DocComptables />

      {/* Tip */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
        <p className="text-xs lg:text-sm font-bold text-sedo-green mb-1">💡 Conseil SEDO</p>
        <p className="text-xs lg:text-sm text-green-700 leading-relaxed">
          Commencez par l'<strong>IFU</strong> — c'est le prérequis pour le RCCM. Une fois les 3 documents obtenus,
          votre score de formalisation atteint <strong>100 points</strong>, soit +25 points sur votre score global.
          Cela vous rapproche directement de l'éligibilité au crédit formel (76/100).
        </p>
      </div>
    </div>
  );
}

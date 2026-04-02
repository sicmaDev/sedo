import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  BookOpen, Scale, BarChart2, Download, Loader2,
  Building2, ClipboardList, CreditCard,
  MapPin, Users, Calendar, Lock,
  User, Phone, Mail,
  Lightbulb, Link2, Globe,
  CheckCircle, Circle, CheckCircle2, Check,
  ArrowRight, ArrowLeft, Save,
  FolderOpen,
} from 'lucide-react';

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
  { endpoint: 'journal.pdf',  label: 'Journal des transactions', Icon: BookOpen,  desc: 'Toutes les entrées/sorties sur 6 mois',  filename: 'sedo-journal-6mois.pdf' },
  { endpoint: 'bilan.pdf',    label: 'Bilan Simplifié',          Icon: Scale,     desc: 'Actif / Passif — situation patrimoniale', filename: 'sedo-bilan.pdf' },
  { endpoint: 'resultat.pdf', label: 'Compte de Résultat',       Icon: BarChart2, desc: 'Produits / Charges / Résultat net',       filename: 'sedo-compte-resultat.pdf' },
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
        <h3 className="font-bold text-gray-800 text-sm lg:text-base flex items-center gap-2"><FolderOpen className="w-4 h-4 text-sedo-green" /> Documents comptables à joindre</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Générés automatiquement depuis vos données Module 2 — 6 derniers mois ({from} → {to})
        </p>
      </div>
      <div className="space-y-2">
        {comptaDocs.map((doc) => (
          <div key={doc.endpoint} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <doc.Icon className="w-5 h-5 text-gray-500 flex-shrink-0" />
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
              ) : <Download className="w-3.5 h-3.5" />} PDF
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

const docs = [
  {
    key: 'ifuStatus',
    numeroKey: 'numeroIFU',
    code: 'IFU',
    label: 'Identifiant Fiscal Unique',
    pts: 40,
    Icon: Building2,
    color: 'blue',
    description: "L'IFU est votre numéro fiscal officiel délivré par la Direction Générale des Impôts (DGI) du Bénin. Obligatoire pour toute activité commerciale formelle.",
    steps: [
      { step: 1, titre: 'Avoir votre NPI', detail: 'Le NPI (ANIP) est obligatoire pour obtenir l\'IFU en ligne. Si vous ne l\'avez pas encore, obtenez-le d\'abord sur eservices.anip.bj.' },
      { step: 2, titre: 'Aller sur ifu.impots.bj', detail: 'Portail officiel de la Direction Générale des Impôts (DGI). Accessible 24h/24, 7j/7.' },
      { step: 3, titre: 'Remplir le formulaire en ligne', detail: 'Saisissez votre NPI, vos informations personnelles et d\'activité. Aucun déplacement requis.' },
      { step: 4, titre: 'Soumettre la demande', detail: 'Validez votre demande en ligne. Traitement en moins de 24h par la DGI.' },
      { step: 5, titre: 'Recevoir votre IFU', detail: 'L\'IFU vous est communiqué par SMS ou téléchargeable directement sur le portail.' },
    ],
    onlineUrl: 'https://ifu.impots.bj/',
    apiex: true,
  },
  {
    key: 'rccmStatus',
    numeroKey: 'numeroRCCM',
    code: 'RCCM',
    label: 'Registre du Commerce et du Crédit Mobilier',
    pts: 35,
    Icon: ClipboardList,
    color: 'purple',
    description: 'Le RCCM est l\'immatriculation de votre entreprise au registre du commerce. Il atteste de l\'existence légale de votre activité commerciale.',
    steps: [
      { step: 1, titre: 'Préparer les documents', detail: 'IFU (obligatoire), CNI, justificatif de domicile, statuts si SARL/SA, capital minimum selon forme juridique.' },
      { step: 2, titre: 'Aller sur monentreprise.bj', detail: 'Plateforme officielle APIEx pour la création et formalisation d\'entreprise en ligne. Aucun déplacement requis.' },
      { step: 3, titre: 'Créer un compte et remplir le formulaire', detail: 'Précisez : forme juridique, capital, activité principale, adresse du siège. Téléversez vos pièces justificatives.' },
      { step: 4, titre: 'Payer les frais en ligne', detail: 'Frais variables selon la forme juridique (15 000 à 50 000 FCFA). Paiement sécurisé en ligne (Mobile Money ou carte).' },
      { step: 5, titre: 'Obtenir le RCCM', detail: 'Délai : 3 à 5 jours. Document envoyé par email ou téléchargeable sur votre espace monentreprise.bj.' },
    ],
    onlineUrl: 'https://monentreprise.bj/',
    apiex: true,
  },
  {
    key: 'npiStatus',
    numeroKey: 'numeroNPI',
    code: 'NPI',
    label: 'Numéro Personnel d\'Identification',
    pts: 25,
    Icon: CreditCard,
    color: 'orange',
    description: 'Le NPI est un identifiant unique délivré par l\'ANIP (Agence Nationale d\'Identification des Personnes). Il est requis pour l\'accès à certains services publics et financiers.',
    steps: [
      { step: 1, titre: 'Rassembler les pièces', detail: 'Acte de naissance (original ou copie certifiée), CNI ou passeport, photo d\'identité récente.' },
      { step: 2, titre: 'Aller sur eservices.anip.bj', detail: 'Portail e-services de l\'ANIP, accessible 24h/24, 7j/7. Disponible aussi sur l\'app mobile "ANIP BJ" (Google Play).' },
      { step: 3, titre: 'Créer un compte et remplir la demande', detail: 'Indiquez votre état civil complet, adresse, profession. Téléversez votre acte de naissance et CNI.' },
      { step: 4, titre: 'Enregistrement biométrique', detail: 'Prise de photo et empreintes réalisées en antenne ANIP ou mairie partenaire (sur rendez-vous après soumission en ligne).' },
      { step: 5, titre: 'Recevoir le NPI', detail: 'Délai : 7 à 14 jours. Document disponible en ligne sur votre espace ANIP. Gratuit.' },
    ],
    onlineUrl: 'https://eservices.anip.bj/',
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

function StatusIcon({ status, className = 'w-3 h-3' }) {
  if (status === 'Complet')  return <CheckCircle2 className={`${className} text-sedo-green`} />;
  if (status === 'En cours') return <CheckCircle  className={`${className} text-amber-500`} />;
  return <Circle className={`${className} text-gray-400`} />;
}

function ptsEarned(status, pts) {
  if (status === 'Complet') return pts;
  if (status === 'En cours') return Math.round(pts * 0.5);
  return 0;
}

const FORMES_JURIDIQUES = ['', 'Entreprise Individuelle (EI)', 'SARL', 'GIE', 'SAS', 'SA', 'Association'];
const REGIMES_FISCAUX   = ['', 'Forfait', 'Réel Simplifié', 'Réel Normal'];

const STEPS = [
  { id: 1, label: 'Entreprise', Icon: Building2,     short: 'Votre activité' },
  { id: 2, label: 'Gérant',     Icon: User,          short: 'Identité du représentant' },
  { id: 3, label: 'Documents',  Icon: ClipboardList, short: 'IFU / RCCM / NPI' },
];

const CHAMP_VIDE = {
  formeJuridique: '', objetSocial: '', adressePrecise: '', regimeFiscal: '', capitalSocial: '',
  employees: '', createdYear: '', langue: '',
  dateNaissance: '', numeroCIP: '',
  numeroIFU: '', numeroRCCM: '', numeroNPI: '',
};

const LANGUES = ['Français', 'Fon', 'Yoruba', 'Adja', 'Dendi', 'Autre'];

function StatusPill({ status }) {
  const cls = status === 'Complet'  ? 'bg-green-100 text-green-700'
            : status === 'En cours' ? 'bg-amber-100 text-amber-700'
            : 'bg-gray-100 text-gray-500';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${cls}`}>
      <StatusIcon status={status} className="w-2.5 h-2.5" /> {status || 'Non démarré'}
    </span>
  );
}

function FieldLocked({ label, value, Icon }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1.5">
        {label}
        <span className="ml-1.5 text-[10px] font-normal bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> auto</span>
      </label>
      <div className="w-full text-sm border border-gray-100 rounded-2xl px-4 py-3 bg-gray-50 text-gray-500 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <span className="truncate">{value || '—'}</span>
      </div>
    </div>
  );
}

function FieldInput({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-700 mb-1.5">
        {label}{required && <span className="text-sedo-green ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function DossierFormalisation({ profile }) {
  const queryClient               = useQueryClient();
  const [step, setStep]           = useState(1);
  const [form, setForm]           = useState(CHAMP_VIDE);
  const [saved, setSaved]         = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      formeJuridique: profile.formeJuridique || '',
      objetSocial:    profile.objetSocial    || '',
      adressePrecise: profile.adressePrecise || '',
      regimeFiscal:   profile.regimeFiscal   || '',
      capitalSocial:  profile.capitalSocial  || '',
      employees:      profile.employees  != null ? String(profile.employees)  : '',
      createdYear:    profile.createdYear != null ? String(profile.createdYear) : '',
      langue:         profile.langue         || '',
      dateNaissance:  profile.dateNaissance  || '',
      numeroCIP:      profile.numeroCIP      || '',
      numeroIFU:      profile.numeroIFU      || '',
      numeroRCCM:     profile.numeroRCCM     || '',
      numeroNPI:      profile.numeroNPI      || '',
    });
  }, [profile]);

  const { mutate: saveForm, isPending } = useMutation({
    mutationFn: (data) => {
      const payload = { ...data };
      if (payload.employees)   payload.employees   = parseInt(payload.employees);
      if (payload.createdYear) payload.createdYear = parseInt(payload.createdYear);
      return api.put('/mpme/profile', payload);
    },
    onSuccess: async () => {
      await api.post('/score/calculate').catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['mpme-profile'] });
      queryClient.invalidateQueries({ queryKey: ['score'] });
      setStep(1);
      setSaved(true);
      setSaveError(null);
      setTimeout(() => setSaved(false), 4000);
    },
    onError: () => setSaveError("Erreur lors de l'enregistrement. Réessayez."),
  });

  const set   = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
  const iCls  = 'w-full text-sm border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sedo-green/30 focus:border-sedo-green bg-white transition-colors';
  const sCls  = `${iCls} appearance-none`;

  /* ── Steps ────────────────────────────────────────────────────── */
  const stepContent = {
    1: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldLocked label="Raison sociale" value={profile?.company} Icon={Building2} />
          <FieldInput label="Forme juridique" required>
            <select className={sCls} value={form.formeJuridique} onChange={set('formeJuridique')}>
              {FORMES_JURIDIQUES.map((f) => <option key={f} value={f}>{f || '— Sélectionner —'}</option>)}
            </select>
          </FieldInput>
          <FieldLocked label="Secteur d'activité" value={profile?.sector} Icon={ClipboardList} />
          <FieldInput label="Objet social">
            <input className={iCls} placeholder="Ex : Commerce de détail alimentaire" value={form.objetSocial} onChange={set('objetSocial')} />
          </FieldInput>
          <FieldLocked label="Siège social" value={profile?.location} Icon={MapPin} />
          <FieldInput label="Adresse précise (rue / quartier)">
            <input className={iCls} placeholder="Ex : Quartier Gbèto, Rue 234" value={form.adressePrecise} onChange={set('adressePrecise')} />
          </FieldInput>
          <FieldInput label="Régime fiscal">
            <select className={sCls} value={form.regimeFiscal} onChange={set('regimeFiscal')}>
              {REGIMES_FISCAUX.map((r) => <option key={r} value={r}>{r || '— Sélectionner —'}</option>)}
            </select>
          </FieldInput>
          <FieldInput label="Capital social (FCFA)">
            <input className={iCls} type="number" placeholder="Ex : 100 000" value={form.capitalSocial} onChange={set('capitalSocial')} />
          </FieldInput>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {profile?.createdYear != null ? (
            <FieldLocked label="Année de création" value={String(profile.createdYear)} Icon={Calendar} />
          ) : (
            <FieldInput label="Année de création">
              <input className={iCls} type="number" placeholder="Ex : 2019" min="1990" max={new Date().getFullYear()} value={form.createdYear} onChange={set('createdYear')} />
            </FieldInput>
          )}
          {profile?.employees != null ? (
            <FieldLocked label="Nombre d'employés" value={`${profile.employees} pers.`} Icon={Users} />
          ) : (
            <FieldInput label="Nombre d'employés">
              <input className={iCls} type="number" placeholder="Ex : 3" min="1" value={form.employees} onChange={set('employees')} />
            </FieldInput>
          )}
        </div>

        {/* Langue */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-2">
            Langue parlée
            {profile?.langue
              ? <span className="ml-1.5 text-[10px] font-normal bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> auto</span>
              : null}
          </label>
          {profile?.langue ? (
            <div className="w-full text-sm border border-gray-100 rounded-2xl px-4 py-3 bg-gray-50 text-gray-500 flex items-center gap-2">
              <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>{profile.langue}</span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {LANGUES.map((l) => (
                <button key={l} type="button" onClick={() => setForm((p) => ({ ...p, langue: l }))}
                  className={`rounded-2xl px-3 py-2.5 border-2 text-xs font-semibold transition-all active:scale-95
                    ${form.langue === l ? 'border-sedo-green bg-green-50 text-sedo-green font-bold' : 'border-gray-100 bg-gray-50 text-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    ),

    2: (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldLocked label="Nom complet" value={profile?.user?.fullName} Icon={User} />
          <FieldLocked label="Téléphone" value={profile?.user?.phone} Icon={Phone} />
          <FieldLocked label="Email" value={profile?.user?.email} Icon={Mail} />
          <FieldInput label="Date de naissance" required>
            <input className={iCls} type="date" value={form.dateNaissance} onChange={set('dateNaissance')} />
          </FieldInput>
        </div>
        <FieldInput label="Numéro CIP (Carte d'Identité Personnelle — ANIP)" required>
          <input className={iCls} placeholder="Ex : BJ-123456789" value={form.numeroCIP} onChange={set('numeroCIP')} />
        </FieldInput>
        <div className="bg-sedo-green-light border border-sedo-green/20 rounded-2xl p-3.5 flex gap-3 items-start">
          <Lightbulb className="w-4 h-4 text-sedo-green flex-shrink-0 mt-0.5" />
          <p className="text-xs text-sedo-green-dark leading-relaxed">
            Le <strong>CIP</strong> est votre identifiant unique délivré par l'<strong>ANIP</strong> (Agence Nationale d'Identification des Personnes). Vous pouvez l'obtenir gratuitement dans une antenne ANIP ou une mairie partenaire.
          </p>
        </div>
      </div>
    ),

    3: (
      <div className="space-y-3">
        {/* IFU */}
        <div className="rounded-2xl border-2 border-blue-100 bg-blue-50/40 overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5 text-blue-600" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-blue-900">Identifiant Fiscal Unique (IFU)</p>
              <p className="text-[11px] text-blue-500 mt-0.5">DGI Bénin — dgi.finances.bj — gratuit</p>
            </div>
            <StatusPill status={profile?.ifuStatus} />
          </div>
          <div className="px-4 pb-4">
            <input className="w-full text-sm border border-blue-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white transition-colors" placeholder="Ex : IFU-2024-001234" value={form.numeroIFU} onChange={set('numeroIFU')} />
          </div>
        </div>

        {/* RCCM */}
        <div className="rounded-2xl border-2 border-purple-100 bg-purple-50/40 overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0"><ClipboardList className="w-5 h-5 text-purple-600" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-purple-900">RCCM — Registre du Commerce</p>
              <p className="text-[11px] text-purple-500 mt-0.5">APIEx Guichet Unique — 15 000 à 50 000 FCFA</p>
            </div>
            <StatusPill status={profile?.rccmStatus} />
          </div>
          <div className="px-4 pb-4">
            <input className="w-full text-sm border border-purple-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 bg-white transition-colors" placeholder="Ex : RB/COT/23 B 12345" value={form.numeroRCCM} onChange={set('numeroRCCM')} />
          </div>
        </div>

        {/* NPI */}
        <div className="rounded-2xl border-2 border-orange-100 bg-orange-50/40 overflow-hidden">
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0"><CreditCard className="w-5 h-5 text-orange-600" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-orange-900">NPI — Numéro Personnel d'Identification</p>
              <p className="text-[11px] text-orange-500 mt-0.5">ANIP Bénin — gratuit</p>
            </div>
            <StatusPill status={profile?.npiStatus} />
          </div>
          <div className="px-4 pb-4">
            <input className="w-full text-sm border border-orange-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 bg-white transition-colors" placeholder="Ex : NPI-12345678" value={form.numeroNPI} onChange={set('numeroNPI')} />
          </div>
        </div>
      </div>
    ),
  };

  const progress = Math.round(((step - 1) / STEPS.length) * 100);

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div className="h-1 bg-sedo-green transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>

      {/* Header */}
      <div className="bg-gradient-to-br from-sedo-green to-sedo-green-dark px-5 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-green-200 font-bold mb-0.5">Étape {step} sur {STEPS.length}</p>
            <p className="text-white font-black text-base lg:text-lg flex items-center gap-2">
              {(() => { const S = STEPS[step-1]; return <S.Icon className="w-5 h-5" />; })()}
              {STEPS[step-1].label}
            </p>
            <p className="text-green-100 text-xs mt-0.5">{STEPS[step-1].short}</p>
          </div>
          {/* Step pills */}
          <div className="flex gap-1.5">
            {STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`w-8 h-8 rounded-full text-xs font-black transition-all active:scale-90
                  ${step > s.id  ? 'bg-white text-sedo-green'
                  : step === s.id ? 'bg-white/30 text-white ring-2 ring-white'
                  :                 'bg-white/10 text-green-300'}`}>
                {step > s.id ? <Check className="w-3.5 h-3.5" /> : s.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-5">
        {stepContent[step]}
      </div>

      {/* Navigation footer */}
      <div className="px-5 pb-5 flex items-center justify-between gap-3">
        <button
          onClick={() => setStep((p) => Math.max(1, p - 1))}
          disabled={step === 1}
          className="text-sm font-black text-gray-400 hover:text-gray-700 disabled:opacity-0 disabled:pointer-events-none transition-all px-4 py-3 rounded-2xl border-2 border-gray-100 hover:border-gray-200 active:scale-95 flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`rounded-full transition-all duration-300 ${
                step === s.id ? 'w-5 h-2 bg-sedo-green'
                : step > s.id ? 'w-2 h-2 bg-sedo-green/50'
                :               'w-2 h-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {step < STEPS.length ? (
          <button
            onClick={() => setStep((p) => Math.min(STEPS.length, p + 1))}
            className="text-sm font-black bg-sedo-green text-white px-6 py-3 rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-md shadow-sedo-green/20 flex items-center gap-1.5">
            Suivant <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-sm font-bold text-sedo-green animate-pulse">✓ Sauvegardé !</span>
            )}
            {saveError && (
              <span className="text-xs text-red-500">{saveError}</span>
            )}
            <button
              onClick={() => { setSaveError(null); saveForm(form); }}
              disabled={isPending}
              className="flex items-center gap-2 text-sm font-black bg-sedo-green text-white px-6 py-3 rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-md shadow-sedo-green/20 disabled:opacity-50">
              {isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Save className="w-4 h-4" />} Enregistrer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Formalisation() {
  const [expanded, setExpanded] = useState(null);
  const { data: profile, isLoading } = useQuery({
    queryKey: ['mpme-profile'],
    queryFn: () => api.get('/mpme/profile').then((r) => r.data),
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
            <p className="text-green-100 text-sm mb-3 flex items-center gap-1.5"><ClipboardList className="w-4 h-4" /> Formalisation de votre activité</p>
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
            {profile.company && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {profile.company}</span>}
            {profile.sector && <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" /> {profile.sector}</span>}
            {profile.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {profile.location}</span>}
            {profile.employees > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {profile.employees} employé{profile.employees > 1 ? 's' : ''}</span>}
            {profile.langue && <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {profile.langue}</span>}
          </div>
        )}
      </div>

      {/* APIEx notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3 items-start">
        <Link2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
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
          const numero = profile?.[doc.numeroKey];

          return (
            <div key={doc.key} className={`rounded-2xl border-2 overflow-hidden ${status === 'Complet' ? 'border-sedo-green' : c.border} bg-white shadow-sm`}>
              {/* Card header */}
              <div className="p-4 lg:p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 lg:w-14 lg:h-14 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
                    <doc.Icon className={`w-6 h-6 lg:w-7 lg:h-7 ${c.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>{doc.code}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusStyle[status]} flex items-center gap-1`}>
                        <StatusIcon status={status} /> {status}
                      </span>
                      {numero && (
                        <span className="text-[10px] font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-[140px]">
                          {numero}
                        </span>
                      )}
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
                <div className="mt-3 flex items-center">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : doc.key)}
                    className="ml-auto text-xs text-sedo-green font-semibold underline">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      {isExpanded ? 'Masquer le guide' : 'Voir le guide'}
                    </span>
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

                  {doc.onlineUrl && (
                    <a
                      href={doc.onlineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border-2 ${c.border} bg-white hover:${c.bg} transition-colors`}
                    >
                      <Globe className="w-4 h-4 text-sedo-green flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800">Faire la démarche en ligne</p>
                        <p className={`text-[11px] ${c.text} truncate`}>{doc.onlineUrl}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </a>
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
        <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5"><BarChart2 className="w-4 h-4 text-sedo-green" /> Impact sur le score</h3>
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

      {/* Dossier de formalisation pré-rempli */}
      <DossierFormalisation profile={profile} />

      {/* Documents comptables à joindre au dossier */}
      <DocComptables />

      {/* Tip */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
        <p className="text-xs lg:text-sm font-bold text-sedo-green mb-1 flex items-center gap-1.5"><Lightbulb className="w-4 h-4" /> Conseil SEDO</p>
        <p className="text-xs lg:text-sm text-green-700 leading-relaxed">
          Commencez par l'<strong>IFU</strong> — c'est le prérequis pour le RCCM. Une fois les 3 documents obtenus,
          votre score de formalisation atteint <strong>100 points</strong>, soit +25 points sur votre score global.
          Cela vous rapproche directement de l'éligibilité au crédit formel (76/100).
        </p>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useVoiceGuide } from '@/lib/VoiceGuideContext';

function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getPreset(preset) {
  const now = new Date();
  switch (preset) {
    case 'month': return {
      from: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: toISODate(now),
      label: 'Ce mois',
    };
    case 'prev_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toISODate(first), to: toISODate(last), label: 'Mois précédent' };
    }
    case '3months': return {
      from: toISODate(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
      to: toISODate(now),
      label: '3 derniers mois',
    };
    case '6months': return {
      from: toISODate(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
      to: toISODate(now),
      label: '6 derniers mois',
    };
    default: return null;
  }
}

function formatFCFA(amount) {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function downloadDoc(endpoint, from, to, filename) {
  const token = localStorage.getItem('sedo_token');
  const base = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  const url = `${base}/api/transactions/${endpoint}?from=${from}&to=${to}`;
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(res => {
      if (!res.ok) throw new Error('Erreur génération PDF');
      return res.blob();
    })
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${filename}_${from}_${to}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(() => alert('Erreur lors de la génération du document PDF'));
}

const sectors = ['🏪 Commerce', '🐄 Élevage', '🌾 Agriculture', '✂️ Artisanat', '🚗 Transport', '🍽️ Restauration'];
const LANGS = ['🇫🇷 Français', 'Fon', 'Yoruba', 'Adja'];

const PRESETS = [
  { key: 'month', label: 'Ce mois' },
  { key: 'prev_month', label: 'Mois préc.' },
  { key: '3months', label: '3 mois' },
  { key: '6months', label: '6 mois' },
  { key: 'custom', label: 'Personnalisé' },
];

// ─── Fiche Comptable ────────────────────────────────────────────────────────
function FicheComptable() {
  const defaultPreset = getPreset('month');
  const [activePreset, setActivePreset] = useState('month');
  const [from, setFrom] = useState(defaultPreset.from);
  const [to, setTo] = useState(defaultPreset.to);
  const [downloading, setDownloading] = useState(null); // 'journal' | 'bilan' | 'resultat'

  const applyPreset = (key) => {
    setActivePreset(key);
    if (key !== 'custom') {
      const p = getPreset(key);
      setFrom(p.from);
      setTo(p.to);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ['fiche-transactions', from, to],
    queryFn: () => api.get('/transactions', { params: { from, to, limit: 500 } }).then(r => r.data),
    enabled: !!from && !!to,
  });

  const transactions = data?.transactions || [];
  const totalEntrees = transactions.filter(t => t.type === 'entree').reduce((s, t) => s + t.amount, 0);
  const totalSorties = transactions.filter(t => t.type === 'sortie').reduce((s, t) => s + t.amount, 0);
  const solde = totalEntrees - totalSorties;

  // Group by day
  const byDay = transactions.reduce((acc, tx) => {
    const day = formatDate(tx.date);
    if (!acc[day]) acc[day] = [];
    acc[day].push(tx);
    return acc;
  }, {});

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base lg:text-lg font-bold text-gray-800">📒 Fiche comptable</h3>
          <p className="text-xs text-gray-400">
            {from === to ? formatDate(from) : `${formatDate(from)} → ${formatDate(to)}`}
          </p>
        </div>
      </div>

      {/* Period filter */}
      <div className="bg-white rounded-2xl p-3 lg:p-4 shadow-sm border border-gray-100 space-y-3">
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${activePreset === p.key ? 'bg-sedo-green text-white border-sedo-green' : 'border-gray-200 text-gray-500'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {activePreset === 'custom' && (
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-gray-400 block mb-0.5">Du</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-sedo-green"
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="text-[10px] text-gray-400 block mb-0.5">Au</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-700 focus:outline-none focus:border-sedo-green"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 lg:gap-4">
        {[
          { label: 'Entrées', value: totalEntrees, color: 'text-sedo-green', bg: 'bg-green-50', border: 'border-green-100', icon: '💰' },
          { label: 'Sorties', value: totalSorties, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100', icon: '💸' },
          { label: 'Solde net', value: solde, color: solde >= 0 ? 'text-sedo-green' : 'text-red-500', bg: solde >= 0 ? 'bg-green-50' : 'bg-red-50', border: solde >= 0 ? 'border-green-100' : 'border-red-100', icon: '📊' },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} border ${card.border} rounded-xl p-2.5 lg:p-4`}>
            <p className="text-lg lg:text-xl">{card.icon}</p>
            <p className="text-[10px] lg:text-xs text-gray-500 font-medium mt-1">{card.label}</p>
            <p className={`text-xs lg:text-sm font-bold ${card.color} mt-0.5 leading-tight`}>
              {isLoading ? '...' : (card.label === 'Solde net' && card.value < 0 ? '-' : '') + formatFCFA(Math.abs(card.value))}
            </p>
          </div>
        ))}
      </div>

      {/* Transaction list by day */}
      <div className="space-y-3">
        {isLoading && (
          <div className="text-center py-10 text-gray-400 text-sm">Chargement...</div>
        )}
        {!isLoading && transactions.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm font-semibold text-gray-600">Aucune transaction sur cette période</p>
            <p className="text-xs text-gray-400 mt-1">Commencez par enregistrer une transaction.</p>
          </div>
        )}
        {!isLoading && Object.entries(byDay).map(([day, txs]) => (
          <div key={day} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-600">{day}</span>
              <span className="text-[10px] text-gray-400">{txs.length} opération{txs.length > 1 ? 's' : ''}</span>
            </div>
            {txs.map((tx, i) => (
              <div key={tx.id} className={`flex items-center gap-3 px-4 py-3 ${i < txs.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0 ${tx.type === 'entree' ? 'bg-green-100' : 'bg-red-100'}`}>
                  {tx.type === 'entree' ? '💰' : '💸'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-semibold text-gray-800 truncate">
                    {tx.description || (tx.type === 'entree' ? 'Entrée' : 'Sortie')}
                  </p>
                  <p className="text-[10px] lg:text-xs text-gray-400 capitalize">
                    {tx.sector ? `${tx.sector} · ` : ''}{tx.category || 'autre'} · {tx.source}
                  </p>
                </div>
                <p className={`text-sm lg:text-base font-bold flex-shrink-0 ${tx.type === 'entree' ? 'text-sedo-green' : 'text-red-500'}`}>
                  {tx.type === 'entree' ? '+' : '-'}{formatFCFA(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Documents comptables */}
      <div className={`rounded-2xl border transition-all ${transactions.length > 0 ? 'bg-gray-50 border-gray-100' : 'opacity-40 pointer-events-none bg-gray-50 border-gray-100'}`}>
        <div className="px-4 pt-4 pb-2">
          <p className="text-xs font-bold text-gray-700">📄 Documents comptables</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {transactions.length > 0
              ? `${transactions.length} transaction(s) · ${formatDate(from)} → ${formatDate(to)}`
              : 'Aucune transaction à exporter'}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {[
            { key: 'journal', endpoint: 'journal.pdf', label: 'Journal', icon: '📋', filename: 'journal_sedo', desc: 'Toutes les transactions' },
            { key: 'bilan', endpoint: 'bilan.pdf', label: 'Bilan', icon: '⚖️', filename: 'bilan_sedo', desc: 'Actif / Passif' },
            { key: 'resultat', endpoint: 'resultat.pdf', label: 'Résultat', icon: '📊', filename: 'compte_resultat_sedo', desc: 'Produits / Charges' },
          ].map(doc => (
            <button
              key={doc.key}
              onClick={() => {
                setDownloading(doc.key);
                downloadDoc(doc.endpoint, from, to, doc.filename).finally(() => setDownloading(null));
              }}
              disabled={downloading !== null || transactions.length === 0}
              className="flex flex-col items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-3 hover:border-sedo-green hover:bg-green-50 transition-all disabled:opacity-60"
            >
              <span className="text-xl">{downloading === doc.key ? '⏳' : doc.icon}</span>
              <span className="text-xs font-bold text-gray-800">{doc.label}</span>
              <span className="text-[10px] text-gray-400 text-center leading-tight">{doc.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function Comptabilite() {
  const queryClient = useQueryClient();
  const { reportAction } = useVoiceGuide() || {};
  const [activeTab, setActiveTab] = useState('pictogrammes');
  const [step, setStep] = useState(1);
  const [sector, setSector] = useState('');
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [toast, setToast] = useState('');
  const [ussdInput, setUssdInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [selectedLang, setSelectedLang] = useState('🇫🇷 Français');
  const [parsedTx, setParsedTx] = useState(null);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const reset = () => { setStep(1); setSector(''); setType(''); setAmount(''); setDesc(''); };

  const { mutate: saveTransaction, isPending } = useMutation({
    mutationFn: (data) => api.post('/transactions', data),
    onSuccess: () => {
      api.post('/score/calculate').then(() => {
        queryClient.invalidateQueries(['score']);
        queryClient.invalidateQueries(['mpme-stats']);
      });
      queryClient.invalidateQueries(['fiche-transactions']);
      showToast('✅ Transaction enregistrée !');
      reset();
    },
    onError: () => showToast('❌ Erreur lors de l\'enregistrement'),
  });

  const handleSave = () => {
    if (!amount || parseFloat(amount) <= 0) { showToast('⚠️ Montant invalide'); return; }
    saveTransaction({
      type, amount: parseFloat(amount),
      category: sector.includes('Commerce') ? 'vente' : sector.includes('Agriculture') ? 'achat' : 'autre',
      description: desc || `${type === 'entree' ? 'Entrée' : 'Sortie'} — ${sector}`,
      source: 'manuel',
      sector: sector.replace(/^[^\s]+\s/, ''), // retire l'emoji, ex: "🌾 Agriculture" → "Agriculture"
    });
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        const langCode = selectedLang.includes('Fon') ? 'fon' : selectedLang.includes('Yoruba') ? 'yoruba' : selectedLang.includes('Adja') ? 'adja' : 'fr';
        formData.append('language', langCode);
        try {
          const res = await api.post('/stt/transcribe', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          const text = res.data.text;
          setTranscript(text);
          const match = text.match(/(\d[\d\s]*)/);
          if (match) {
            const val = match[1].replace(/\s/g, '');
            setParsedTx({ amount: val, type: text.toLowerCase().includes('dépens') || text.toLowerCase().includes('achat') ? 'sortie' : 'entree' });
          }
        } catch { setTranscript('Service STT indisponible. Veuillez réessayer.'); }
      };
      mr.start();
      setIsListening(true);
      reportAction?.('mic_start');
    } catch { showToast('❌ Microphone inaccessible'); }
  };

  const stopListening = () => { mediaRef.current?.stop(); setIsListening(false); reportAction?.('mic_stop'); };

  const saveVoiceTx = () => {
    if (!parsedTx?.amount) { showToast('⚠️ Montant non détecté, saisissez-le manuellement'); return; }
    saveTransaction({ type: parsedTx.type, amount: parseFloat(parsedTx.amount), description: transcript, source: 'manuel' });
    setTranscript(''); setParsedTx(null);
  };

  return (
    <div className="px-4 py-5 lg:px-0 lg:py-0 space-y-5 lg:space-y-6">
      {toast && (
        <div className="fixed top-4 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-96 z-50 bg-gray-900 text-white rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-center">
          {toast}
        </div>
      )}

      {/* ── SECTION SAISIE ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Label section */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Enregistrer une transaction</p>
        </div>

        {/* Tabs saisie */}
        <div className="flex p-2 gap-1">
          {[{ id: 'pictogrammes', icon: '🎨', label: 'Pictogrammes' }, { id: 'vocal', icon: '🎙️', label: 'Vocal' }, { id: 'ussd', icon: '📞', label: 'USSD' }].map((t) => (
            <button key={t.id} {...(t.id === 'vocal' ? { 'data-guide': 'tab_vocal' } : {})}
              onClick={() => { setActiveTab(t.id); reportAction?.(t.id === 'vocal' ? 'vocal_tab' : 'wrong_tab'); }}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${activeTab === t.id ? 'bg-sedo-green text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Contenu saisie */}
        <div className="p-3 pt-1">

          {/* Pictogrammes */}
          {activeTab === 'pictogrammes' && (
            <div className="space-y-3">
              {/* Stepper compact */}
              <div className="flex items-center gap-1.5 px-1">
                {[1, 2, 3].map((s) => (
                  <div key={s} className={`flex items-center gap-1 ${s < 3 ? 'flex-1' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-sedo-green text-white' : 'bg-gray-200 text-gray-400'}`}>{s}</div>
                    <span className={`text-[10px] font-medium ${step >= s ? 'text-sedo-green' : 'text-gray-400'}`}>{s === 1 ? 'Secteur' : s === 2 ? 'Type' : 'Montant'}</span>
                    {s < 3 && <div className={`flex-1 h-0.5 mx-1 rounded ${step > s ? 'bg-sedo-green' : 'bg-gray-200'}`} />}
                  </div>
                ))}
              </div>

              {step === 1 && (
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                  {sectors.map((s) => (
                    <button key={s} onClick={() => { setSector(s); setStep(2); }}
                      className={`rounded-xl p-2.5 border-2 flex flex-col items-center gap-1 transition-all active:scale-95 ${sector === s ? 'border-sedo-green bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                      <span className="text-2xl">{s.split(' ')[0]}</span>
                      <span className="text-[10px] font-medium text-gray-600">{s.split(' ')[1]}</span>
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setStep(1)} className="text-gray-400 text-sm">‹</button>
                    <p className="text-xs font-bold text-gray-800">Type — {sector}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ icon: '💰', label: "Entrée", value: 'entree' }, { icon: '💸', label: "Sortie", value: 'sortie' }].map((t) => (
                      <button key={t.value} onClick={() => { setType(t.value); setStep(3); }}
                        className={`rounded-2xl p-4 border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${type === t.value ? 'border-sedo-green bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                        <span className="text-3xl">{t.icon}</span>
                        <span className="text-xs font-semibold text-gray-700">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={() => setStep(2)} className="text-gray-400 text-sm">‹</button>
                    <p className="text-xs font-bold text-gray-800">Montant — {type === 'entree' ? '💰 Entrée' : '💸 Sortie'}</p>
                  </div>
                  <div className="space-y-2">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Montant en FCFA" min="0"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-bold text-xl focus:outline-none focus:border-sedo-green" />
                    <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optionnel)"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-800 text-sm focus:outline-none focus:border-sedo-green" />
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button onClick={reset} className="py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 font-medium">↩️ Recommencer</button>
                      <button onClick={handleSave} disabled={isPending}
                        className="py-2.5 bg-sedo-green text-white rounded-xl text-sm font-bold disabled:opacity-60">
                        {isPending ? 'Enregistrement...' : '✅ Enregistrer'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Vocal */}
          {activeTab === 'vocal' && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {LANGS.map((l) => (
                  <button key={l} {...(l === LANGS[0] ? { 'data-guide': 'lang_selector' } : {})} onClick={() => { setSelectedLang(l); reportAction?.('lang_selected'); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedLang === l ? 'bg-sedo-green text-white border-sedo-green' : 'border-gray-200 text-gray-500'}`}>{l}</button>
                ))}
              </div>
              <div className="flex flex-col items-center gap-3 py-2">
                <button data-guide="mic_button" onClick={isListening ? stopListening : startListening}
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-lg transition-all ${isListening ? 'bg-red-500 animate-pulse scale-110' : 'bg-sedo-green'}`}>
                  🎤
                </button>
                <p className="text-xs text-gray-500 text-center">{isListening ? 'Écoute en cours... Appuyez pour arrêter' : 'Appuyez sur le micro pour commencer'}</p>
                {transcript && (
                  <div className="w-full bg-green-50 border border-green-200 rounded-xl p-3">
                    <p className="text-xs font-bold text-sedo-green mb-1">Transcription :</p>
                    <p className="text-sm text-gray-700">{transcript}</p>
                    {parsedTx && (
                      <div className="mt-2 flex gap-2">
                        <span className="text-xs bg-white border border-green-200 rounded-lg px-2 py-1">
                          {parsedTx.type === 'entree' ? '💰' : '💸'} {parsedTx.amount} FCFA
                        </span>
                        <button data-guide="confirm_button" onClick={() => { saveVoiceTx(); reportAction?.('confirmed'); }} disabled={isPending}
                          className="flex-1 text-xs bg-sedo-green text-white rounded-lg px-3 py-1 font-bold">
                          ✅ Confirmer
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-green-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-sedo-green mb-1">💡 Exemples</p>
                {['"J\'ai reçu 15000 francs pour une vente"', '"J\'ai dépensé 8500 francs pour des marchandises"'].map((ex) => (
                  <p key={ex} className="text-[10px] text-green-700 py-1 border-b border-green-100 last:border-0">{ex}</p>
                ))}
              </div>
            </div>
          )}

          {/* USSD */}
          {activeTab === 'ussd' && (
            <div className="space-y-3">
              <div className="bg-gray-900 rounded-2xl p-4 text-green-400 font-mono">
                <p className="text-center text-sm font-bold text-white mb-1">SEDO - MPME</p>
                <p className="text-center text-xs text-gray-400 mb-3">*123#</p>
                <div className="bg-black rounded-xl p-3 mb-3 text-xs space-y-1">
                  <p>Menu Principal:</p>
                  {['1. Enregistrer transaction','2. Voir mon score','3. Solde du mois','4. Alertes financement','0. Quitter'].map(m => <p key={m} className="ml-2">{m}</p>)}
                  <p className="mt-2">Tapez votre choix:</p>
                  <div className="bg-gray-900 rounded px-2 py-1 mt-1 text-green-300">{ussdInput || '▌'}</div>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center">
                  {['1','2','3','4','5','6','7','8','9','*','0','#'].map((k) => (
                    <button key={k} onClick={() => setUssdInput((p) => p + k)}
                      className="bg-gray-700 text-white rounded-lg py-2 text-sm font-bold active:bg-gray-600">{k}</button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button onClick={() => setUssdInput('')} className="bg-red-700 text-white rounded-lg py-2 text-xs font-bold">↩️ Retour</button>
                  <button onClick={() => showToast('📱 USSD — Intégration Africa\'s Talking en cours')}
                    className="bg-sedo-green text-white rounded-lg py-2 text-xs font-bold">✅ Valider</button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs font-bold text-blue-700">📡 USSD via Africa's Talking</p>
                <p className="text-[10px] text-blue-600 mt-0.5">Composez le *123# depuis n'importe quel téléphone, même sans internet.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FICHE COMPTABLE — toujours visible ── */}
      <FicheComptable />
    </div>
  );
}

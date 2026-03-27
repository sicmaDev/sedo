import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

const sectors = ['🏪 Commerce', '🐄 Élevage', '🌾 Agriculture', '✂️ Artisanat', '🚗 Transport', '🍽️ Restauration'];
const LANGS = ['🇫🇷 Français', 'Fon', 'Yoruba', 'Adja'];

export default function Comptabilite() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pictogrammes');
  const [step, setStep] = useState(1);
  const [sector, setSector] = useState('');
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [toast, setToast] = useState('');
  const [ussdInput, setUssdInput] = useState('');

  // Vocal
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
      queryClient.invalidateQueries(['mpme-stats']);
      queryClient.invalidateQueries(['score']);
      showToast('✅ Transaction enregistrée !');
      reset();
    },
    onError: () => showToast('❌ Erreur lors de l\'enregistrement'),
  });

  const handleSave = () => {
    if (!amount || parseFloat(amount) <= 0) { showToast('⚠️ Montant invalide'); return; }
    saveTransaction({
      type,
      amount: parseFloat(amount),
      category: sector.includes('Commerce') ? 'vente' : sector.includes('Agriculture') ? 'achat' : 'autre',
      description: desc || `${type === 'entree' ? 'Entrée' : 'Sortie'} — ${sector}`,
      source: 'manuel',
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
          // Extraction simple du montant
          const match = text.match(/(\d[\d\s]*)/);
          if (match) {
            const val = match[1].replace(/\s/g, '');
            setParsedTx({ amount: val, type: text.toLowerCase().includes('dépens') || text.toLowerCase().includes('achat') ? 'sortie' : 'entree' });
          }
        } catch { setTranscript('Service STT indisponible. Veuillez réessayer.'); }
      };
      mr.start();
      setIsListening(true);
    } catch { showToast('❌ Microphone inaccessible'); }
  };

  const stopListening = () => {
    mediaRef.current?.stop();
    setIsListening(false);
  };

  const saveVoiceTx = () => {
    if (!parsedTx?.amount) { showToast('⚠️ Montant non détecté, saisissez-le manuellement'); return; }
    saveTransaction({ type: parsedTx.type, amount: parseFloat(parsedTx.amount), description: transcript, source: 'manuel' });
    setTranscript(''); setParsedTx(null);
  };

  return (
    <div className="px-4 py-5 space-y-5">
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-gray-900 text-white rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-center">
          {toast}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
        {[{ id: 'pictogrammes', icon: '🎨', label: 'Pictogrammes' }, { id: 'vocal', icon: '🎙️', label: 'Vocal' }, { id: 'ussd', icon: '📞', label: 'USSD' }].map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all ${activeTab === t.id ? 'bg-sedo-green text-white shadow-sm' : 'text-gray-400'}`}>
            <span>{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Pictogrammes */}
      {activeTab === 'pictogrammes' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`flex items-center gap-1 ${s < 3 ? 'flex-1' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-sedo-green text-white' : 'bg-gray-200 text-gray-400'}`}>{s}</div>
                <span className={`text-xs font-medium ${step >= s ? 'text-sedo-green' : 'text-gray-400'}`}>{s === 1 ? 'Secteur' : s === 2 ? 'Type' : 'Montant'}</span>
                {s < 3 && <div className={`flex-1 h-0.5 mx-1 rounded ${step > s ? 'bg-sedo-green' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-800 mb-3">Sélectionnez votre secteur</p>
              <div className="grid grid-cols-3 gap-2">
                {sectors.map((s) => (
                  <button key={s} onClick={() => { setSector(s); setStep(2); }}
                    className={`rounded-xl p-3 border-2 flex flex-col items-center gap-1 transition-all active:scale-95 ${sector === s ? 'border-sedo-green bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                    <span className="text-2xl">{s.split(' ')[0]}</span>
                    <span className="text-[10px] font-medium text-gray-600">{s.split(' ')[1]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep(1)} className="text-gray-400 text-sm">‹</button>
                <p className="text-sm font-bold text-gray-800">Type — {sector}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[{ icon: '💰', label: "Entrée d'argent", value: 'entree' }, { icon: '💸', label: "Sortie d'argent", value: 'sortie' }].map((t) => (
                  <button key={t.value} onClick={() => { setType(t.value); setStep(3); }}
                    className={`rounded-2xl p-5 border-2 flex flex-col items-center gap-2 transition-all active:scale-95 ${type === t.value ? 'border-sedo-green bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                    <span className="text-3xl">{t.icon}</span>
                    <span className="text-sm font-semibold text-gray-700">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setStep(2)} className="text-gray-400 text-sm">‹</button>
                <p className="text-sm font-bold text-gray-800">Montant — {type === 'entree' ? '💰 Entrée' : '💸 Sortie'}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">💵 Montant en FCFA</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 15 000" min="0"
                    className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 font-bold text-lg focus:outline-none focus:border-sedo-green" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">📝 Description (optionnel)</label>
                  <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Vente de marchandises"
                    className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm focus:outline-none focus:border-sedo-green" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={reset} className="py-3 border border-gray-200 rounded-xl text-sm text-gray-500 font-medium">↩️ Recommencer</button>
                  <button onClick={handleSave} disabled={isPending}
                    className="py-3 bg-sedo-green text-white rounded-xl text-sm font-bold disabled:opacity-60">
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
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex gap-2 mb-4 flex-wrap">
              {LANGS.map((l) => (
                <button key={l} onClick={() => setSelectedLang(l)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${selectedLang === l ? 'bg-sedo-green text-white border-sedo-green' : 'border-gray-200 text-gray-500'}`}>{l}</button>
              ))}
            </div>
            <div className="flex flex-col items-center gap-4 py-4">
              <button onClick={isListening ? stopListening : startListening}
                className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl shadow-lg transition-all ${isListening ? 'bg-red-500 animate-pulse scale-110' : 'bg-sedo-green'}`}>
                🎤
              </button>
              <p className="text-sm text-gray-500">{isListening ? 'Écoute en cours... Appuyez pour arrêter' : 'Appuyez sur le micro pour commencer'}</p>
              {transcript && (
                <div className="w-full bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-sedo-green mb-1">Transcription :</p>
                  <p className="text-sm text-gray-700">{transcript}</p>
                  {parsedTx && (
                    <div className="mt-3 flex gap-2">
                      <span className="text-xs bg-white border border-green-200 rounded-lg px-2 py-1">
                        {parsedTx.type === 'entree' ? '💰' : '💸'} {parsedTx.amount} FCFA
                      </span>
                      <button onClick={saveVoiceTx} disabled={isPending}
                        className="flex-1 text-xs bg-sedo-green text-white rounded-lg px-3 py-1 font-bold">
                        ✅ Confirmer
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!transcript && !isListening && (
                <div className="w-full bg-gray-50 rounded-xl p-3 min-h-[60px] text-sm text-gray-400 italic">
                  Votre transcription apparaîtra ici...
                </div>
              )}
            </div>
          </div>
          <div className="bg-green-50 rounded-2xl p-4">
            <p className="text-xs font-bold text-sedo-green mb-2">💡 Exemples de phrases</p>
            {['"J\'ai reçu 15000 francs pour une vente"', '"J\'ai dépensé 8500 francs pour des marchandises"', '"Entrée de 25000 francs client"'].map((ex) => (
              <p key={ex} className="text-xs text-green-700 py-1.5 border-b border-green-100 last:border-0">{ex}</p>
            ))}
          </div>
        </div>
      )}

      {/* USSD */}
      {activeTab === 'ussd' && (
        <div className="space-y-4">
          <div className="bg-gray-900 rounded-2xl p-5 text-green-400 font-mono">
            <p className="text-center text-sm font-bold text-white mb-1">SEDO - MPME</p>
            <p className="text-center text-xs text-gray-400 mb-4">*123#</p>
            <div className="bg-black rounded-xl p-3 mb-4 text-xs space-y-1">
              <p>Menu Principal:</p>
              <p className="ml-2">1. Enregistrer transaction</p>
              <p className="ml-2">2. Voir mon score</p>
              <p className="ml-2">3. Solde du mois</p>
              <p className="ml-2">4. Alertes financement</p>
              <p className="ml-2">0. Quitter</p>
              <p className="mt-2">Tapez votre choix:</p>
              <div className="bg-gray-900 rounded px-2 py-1 mt-1 text-green-300">{ussdInput || '▌'}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
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
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-sedo-blue mb-1">📡 USSD via Africa's Talking</p>
            <p className="text-xs text-blue-700">Composez le *123# depuis n'importe quel téléphone, même sans internet.</p>
          </div>
        </div>
      )}
    </div>
  );
}

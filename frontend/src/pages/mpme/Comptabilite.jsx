import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useVoiceGuide } from '@/lib/VoiceGuideContext';
import { Grid3x3, Mic, Phone, ArrowUpCircle, ArrowDownCircle, Check, Lightbulb, Radio, DollarSign } from 'lucide-react';

const sectors = ['🏪 Commerce', '🐄 Élevage', '🌾 Agriculture', '✂️ Artisanat', '🚗 Transport', '🍽️ Restauration'];

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState('');
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
      type, amount: parseFloat(amount),
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
        setIsAnalyzing(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        formData.append('language', 'fon');
        try {
          const res = await api.post('/stt/transcribe', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          const text = res.data.text;
          const donnees = res.data.donnees;
          setTranscript(text);
          if (donnees && donnees.montant) {
            const typeFromAction = donnees.action === 'achat' ? 'sortie' : 'entree';
            setParsedTx({ amount: String(donnees.montant), type: typeFromAction });
          }
        } catch { setTranscript('Service STT indisponible. Veuillez réessayer.'); }
        finally { setIsAnalyzing(false); }
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

      {/* Tabs */}
      <div className="flex bg-white rounded-2xl p-1 shadow-sm border border-gray-100">
        {[{ id: 'pictogrammes', Icon: Grid3x3, label: 'Pictogrammes' }, { id: 'vocal', Icon: Mic, label: 'Vocal' }, { id: 'ussd', Icon: Phone, label: 'USSD' }].map((t) => (
          <button key={t.id} {...(t.id === 'vocal' ? { 'data-guide': 'tab_vocal' } : {})} onClick={() => { setActiveTab(t.id); reportAction?.(t.id === 'vocal' ? 'vocal_tab' : 'wrong_tab'); }}
            className={`flex-1 py-2 lg:py-3 rounded-xl text-xs lg:text-sm font-semibold flex flex-col lg:flex-row items-center justify-center gap-1 lg:gap-2 transition-all ${activeTab === t.id ? 'bg-sedo-green text-white shadow-sm' : 'text-gray-400'}`}>
            <t.Icon className="w-4 h-4 lg:w-5 lg:h-5" /><span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Pictogrammes */}
      {activeTab === 'pictogrammes' && (
        <div className="space-y-4 lg:space-y-6">
          {/* Stepper */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`flex items-center gap-1 ${s < 3 ? 'flex-1' : ''}`}>
                <div className={`w-7 h-7 lg:w-9 lg:h-9 rounded-full flex items-center justify-center text-xs lg:text-sm font-bold transition-all ${step >= s ? 'bg-sedo-green text-white' : 'bg-gray-200 text-gray-400'}`}>{s}</div>
                <span className={`text-xs lg:text-sm font-medium ${step >= s ? 'text-sedo-green' : 'text-gray-400'}`}>{s === 1 ? 'Secteur' : s === 2 ? 'Type' : 'Montant'}</span>
                {s < 3 && <div className={`flex-1 h-0.5 mx-1 rounded ${step > s ? 'bg-sedo-green' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
              <p className="text-sm lg:text-base font-bold text-gray-800 mb-3 lg:mb-4">Sélectionnez votre secteur</p>
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 lg:gap-3">
                {sectors.map((s) => (
                  <button key={s} onClick={() => { setSector(s); setStep(2); }}
                    className={`rounded-xl p-3 lg:p-4 border-2 flex flex-col items-center gap-1 lg:gap-2 transition-all active:scale-95 ${sector === s ? 'border-sedo-green bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                    <span className="text-2xl lg:text-3xl">{s.split(' ')[0]}</span>
                    <span className="text-[10px] lg:text-xs font-medium text-gray-600">{s.split(' ')[1]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep(1)} className="text-gray-400 text-sm lg:text-base">‹</button>
                <p className="text-sm lg:text-base font-bold text-gray-800">Type — {sector}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:gap-5">
                {[{ Icon: ArrowUpCircle, label: "Entrée d'argent", value: 'entree', color: 'text-sedo-green' }, { Icon: ArrowDownCircle, label: "Sortie d'argent", value: 'sortie', color: 'text-red-500' }].map((t) => (
                  <button key={t.value} onClick={() => { setType(t.value); setStep(3); }}
                    className={`rounded-2xl p-5 lg:p-8 border-2 flex flex-col items-center gap-2 lg:gap-3 transition-all active:scale-95 ${type === t.value ? 'border-sedo-green bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                    <t.Icon className={`w-12 h-12 lg:w-16 lg:h-16 ${t.color}`} />
                    <span className="text-sm lg:text-base font-semibold text-gray-700">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep(2)} className="text-gray-400 text-sm lg:text-base">‹</button>
                <p className="text-sm lg:text-base font-bold text-gray-800 flex items-center gap-1.5">
                  {type === 'entree' ? <ArrowUpCircle className="w-4 h-4 text-sedo-green" /> : <ArrowDownCircle className="w-4 h-4 text-red-500" />}
                  Montant — {type === 'entree' ? 'Entrée' : 'Sortie'}
                </p>
              </div>
              <div className="space-y-4 lg:max-w-md">
                <div>
                  <label className="text-xs lg:text-sm text-gray-500 font-medium flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> Montant en FCFA</label>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ex: 15 000" min="0"
                    className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 lg:py-4 text-gray-800 font-bold text-lg lg:text-2xl focus:outline-none focus:border-sedo-green" />
                </div>
                <div>
                  <label className="text-xs lg:text-sm text-gray-500 font-medium">📝 Description (optionnel)</label>
                  <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Vente de marchandises"
                    className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 lg:py-4 text-gray-800 text-sm lg:text-base focus:outline-none focus:border-sedo-green" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={reset} className="py-3 lg:py-4 border border-gray-200 rounded-xl text-sm lg:text-base text-gray-500 font-medium">↩️ Recommencer</button>
                  <button onClick={handleSave} disabled={isPending}
                    className="py-3 lg:py-4 bg-sedo-green text-white rounded-xl text-sm lg:text-base font-bold disabled:opacity-60">
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
        <div className="space-y-4 lg:space-y-6">
          <div className="bg-white rounded-2xl p-5 lg:p-8 shadow-sm border border-gray-100">
            <div className="flex flex-col items-center gap-4 lg:gap-6 py-4">
              <button data-guide="mic_button" onClick={isListening ? stopListening : startListening}
                className={`w-20 h-20 lg:w-32 lg:h-32 rounded-full flex items-center justify-center shadow-lg transition-all ${isListening ? 'bg-red-500 animate-pulse scale-110' : 'bg-sedo-green'}`}>
                <Mic className="w-8 h-8 lg:w-12 lg:h-12 text-white" />
              </button>
              {isAnalyzing ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-sedo-green border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm lg:text-base text-sedo-green font-medium text-center">Analyse de votre enregistrement en cours...</p>
                </div>
              ) : (
                <p className="text-sm lg:text-base text-gray-500 text-center">{isListening ? 'Écoute en cours... Appuyez pour arrêter' : 'Appuyez sur le micro pour commencer'}</p>
              )}
              {transcript && (
                <div className="w-full bg-green-50 border border-green-200 rounded-xl p-3 lg:p-5">
                  <p className="text-xs lg:text-sm font-bold text-sedo-green mb-1">Transcription :</p>
                  <p className="text-sm lg:text-base text-gray-700">{transcript}</p>
                  {parsedTx && (
                    <div className="mt-3 flex gap-2">
                      <span className="text-xs lg:text-sm bg-white border border-green-200 rounded-lg px-2 py-1">
                        {parsedTx.type === 'entree' ? '💰' : '💸'} {parsedTx.amount} FCFA
                      </span>
                      <button data-guide="confirm_button" onClick={() => { saveVoiceTx(); reportAction?.('confirmed'); }} disabled={isPending}
                        className="flex-1 text-xs lg:text-sm bg-sedo-green text-white rounded-lg px-3 py-1 font-bold">
                        ✅ Confirmer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="bg-green-50 rounded-2xl p-4 lg:p-6">
            <p className="text-xs lg:text-sm font-bold text-sedo-green mb-2 flex items-center gap-1.5"><Lightbulb className="w-4 h-4" /> Exemples de phrases</p>
            {['"J\'ai reçu 15000 francs pour une vente"', '"J\'ai dépensé 8500 francs pour des marchandises"', '"Entrée de 25000 francs client"'].map((ex) => (
              <p key={ex} className="text-xs lg:text-sm text-green-700 py-2 border-b border-green-100 last:border-0">{ex}</p>
            ))}
          </div>
        </div>
      )}

      {/* USSD */}
      {activeTab === 'ussd' && (
        <div className="space-y-4 lg:max-w-md">
          <div className="bg-gray-900 rounded-2xl p-5 lg:p-8 text-green-400 font-mono">
            <p className="text-center text-sm lg:text-base font-bold text-white mb-1">SEDO - MPME</p>
            <p className="text-center text-xs lg:text-sm text-gray-400 mb-4">*123#</p>
            <div className="bg-black rounded-xl p-3 lg:p-5 mb-4 text-xs lg:text-sm space-y-1">
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
                  className="bg-gray-700 text-white rounded-lg py-2 lg:py-3 text-sm lg:text-base font-bold active:bg-gray-600">{k}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => setUssdInput('')} className="bg-red-700 text-white rounded-lg py-2 lg:py-3 text-xs lg:text-sm font-bold">↩️ Retour</button>
              <button onClick={() => showToast('📱 USSD — Intégration Africa\'s Talking en cours')}
                className="bg-sedo-green text-white rounded-lg py-2 lg:py-3 text-xs lg:text-sm font-bold">✅ Valider</button>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 lg:p-6">
            <p className="text-xs lg:text-sm font-bold text-sedo-blue mb-1 flex items-center gap-1.5"><Radio className="w-4 h-4" /> USSD via Africa's Talking</p>
            <p className="text-xs lg:text-sm text-blue-700">Composez le *123# depuis n'importe quel téléphone, même sans internet.</p>
          </div>
        </div>
      )}
    </div>
  );
}

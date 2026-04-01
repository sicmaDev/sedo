import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// ─── Machine d'états ─────────────────────────────────────────────────────────
const STATES = {
  IDLE: 'idle',
  RINGING: 'ringing',
  CONNECTED: 'connected',
  ASK_VENTES: 'ask_ventes',
  LISTEN_VENTES: 'listen_ventes',
  ASK_DEPENSES: 'ask_depenses',
  LISTEN_DEPENSES: 'listen_depenses',
  RECAP: 'recap',
  SAVING: 'saving',
  DONE: 'done',
  ERROR: 'error',
};

// ─── Extraction montant depuis texte ─────────────────────────────────────────
function extractAmount(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  // Chiffres directs
  const numMatch = t.match(/(\d[\d\s]*(?:[.,]\d+)?)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1].replace(/\s/g, '').replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
  }

  // Mots → chiffres
  const map = {
    'cent': 100, 'deux cents': 200, 'trois cents': 300, 'quatre cents': 400,
    'cinq cents': 500, 'six cents': 600, 'sept cents': 700, 'huit cents': 800,
    'neuf cents': 900, 'mille': 1000, 'deux mille': 2000, 'trois mille': 3000,
    'quatre mille': 4000, 'cinq mille': 5000, 'dix mille': 10000,
    'vingt mille': 20000, 'cinquante mille': 50000, 'cent mille': 100000,
  };
  for (const [word, val] of Object.entries(map)) {
    if (t.includes(word)) return val;
  }

  return null;
}

// ─── Synthèse vocale ──────────────────────────────────────────────────────────
function speak(text, onEnd) {
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'fr-FR';
  utter.rate = 0.92;
  utter.pitch = 1.05;
  const voices = window.speechSynthesis.getVoices();
  const fr = voices.find((v) => v.lang === 'fr-FR' || v.lang.startsWith('fr'));
  if (fr) utter.voice = fr;
  if (onEnd) utter.onend = onEnd;
  window.speechSynthesis.speak(utter);
}

// ─── Reconnaissance vocale ───────────────────────────────────────────────────
function createRecognition(onResult, onError) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = 'fr-FR';
  rec.interimResults = true;   // résultats intermédiaires pour détecter la voix plus tôt
  rec.continuous = false;
  rec.maxAlternatives = 5;

  let finalResult = '';
  let silenceTimer = null;

  rec.onresult = (e) => {
    clearTimeout(silenceTimer);
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) {
        finalResult += t;
      } else {
        interim += t;
      }
    }
    // Si on a un résultat intermédiaire, attendre 1.5s de silence avant de valider
    if (interim || finalResult) {
      silenceTimer = setTimeout(() => {
        const text = (finalResult || interim).trim();
        if (text) onResult(text);
      }, 1500);
    }
  };

  rec.onend = () => {
    clearTimeout(silenceTimer);
    if (finalResult.trim()) {
      onResult(finalResult.trim());
    }
  };

  rec.onerror = (e) => {
    clearTimeout(silenceTimer);
    onError(e);
  };

  return rec;
}

// ─── Composant principal ─────────────────────────────────────────────────────
export default function PhoneSimulator() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState(STATES.IDLE);
  const [log, setLog] = useState([]);
  const [venteRaw, setVenteRaw] = useState('');
  const [depenseRaw, setDepenseRaw] = useState('');
  const [venteAmount, setVenteAmount] = useState(null);
  const [depenseAmount, setDepenseAmount] = useState(null);
  const [micActive, setMicActive] = useState(false);
  const [dots, setDots] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [currentHandler, setCurrentHandler] = useState(null); // callback pour saisie manuelle
  const recRef = useRef(null);
  const ringRef = useRef(null);

  // Bip de sonnerie simulé
  const startRing = () => {
    let count = 0;
    ringRef.current = setInterval(() => {
      speak('');
      count++;
      if (count >= 4) stopRing();
    }, 1500);
  };
  const stopRing = () => { clearInterval(ringRef.current); };

  // Dots animés pour "écoute en cours"
  useEffect(() => {
    if (!micActive) return;
    const t = setInterval(() => setDots((d) => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(t);
  }, [micActive]);

  const addLog = (text, type = 'system') => {
    setLog((prev) => [...prev, { text, type, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
  };

  // ─── Flux principal ──────────────────────────────────────────────────────
  const startCall = useCallback(() => {
    setLog([]);
    setVenteRaw('');
    setDepenseRaw('');
    setVenteAmount(null);
    setDepenseAmount(null);
    setPhase(STATES.RINGING);
    addLog('Appel entrant... Agent SEDO Vocal', 'system');

    // Sonnerie 3 secondes puis connexion
    setTimeout(() => {
      setPhase(STATES.CONNECTED);
      addLog('Connecté — Agent SEDO', 'system');
      speak(
        'Bonjour ! Ici SEDO, votre assistant financier. Nous allons enregistrer vos opérations du jour.',
        () => {
          setTimeout(() => askVentes(), 800);
        }
      );
    }, 3000);
  }, []);

  const askVentes = useCallback(() => {
    setPhase(STATES.ASK_VENTES);
    addLog('Agent : Quel est le montant total de vos ventes aujourd\'hui ?', 'agent');
    speak(
      'Première question : quel est le montant total de vos ventes aujourd\'hui ? Dites le montant en francs.',
      () => setTimeout(() => listenVentes(), 600)
    );
  }, []);

  const listenVentes = useCallback(() => {
    setPhase(STATES.LISTEN_VENTES);
    setMicActive(true);
    setManualInput('');
    setCurrentHandler(() => (text) => {
      setMicActive(false);
      setCurrentHandler(null);
      recRef.current?.abort?.();
      addLog(`Vous (clavier) : "${text}"`, 'user');
      const montant = extractAmount(text);
      if (montant) {
        setVenteAmount(montant);
        addLog(`Compris : ${montant.toLocaleString('fr-FR')} FCFA`, 'system');
        speak(`Parfait ! J'ai enregistré ${montant.toLocaleString('fr-FR')} francs de ventes.`,
          () => setTimeout(() => askDepenses(), 800));
      } else {
        addLog('Montant non compris — réessayez', 'warn');
        speak('Je n\'ai pas compris. Réessayez.', () => setTimeout(() => listenVentes(), 800));
      }
    });
    addLog('En écoute — parlez ou tapez le montant ci-dessous...', 'system');

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      addLog('SpeechRecognition non supporté — Chrome recommandé', 'error');
      setPhase(STATES.ERROR);
      return;
    }

    let handled = false;
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 5;

    let best = '';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) best = e.results[i][0].transcript;
        else if (!best) best = e.results[i][0].transcript;
      }
    };

    rec.onend = () => {
      if (handled) return;
      handled = true;
      setMicActive(false);
      const text = best.trim();
      if (!text) {
        addLog('Aucune voix détectée — réessayez', 'warn');
        speak('Je n\'ai rien entendu. Réessayons.', () => setTimeout(() => listenVentes(), 800));
        return;
      }
      addLog(`Vous : "${text}"`, 'user');
      const montant = extractAmount(text);
      if (montant) {
        setVenteAmount(montant);
        addLog(`Compris : ${montant.toLocaleString('fr-FR')} FCFA`, 'system');
        speak(`Parfait ! J'ai enregistré ${montant.toLocaleString('fr-FR')} francs de ventes.`,
          () => setTimeout(() => askDepenses(), 800));
      } else {
        addLog(`"${text}" — montant non compris, réessayez`, 'warn');
        speak('Je n\'ai pas compris le montant. Dites juste le chiffre, par exemple : cinq mille.',
          () => setTimeout(() => listenVentes(), 800));
      }
    };

    rec.onerror = (e) => {
      if (handled) return;
      if (e.error === 'no-speech') {
        handled = true;
        setMicActive(false);
        addLog('Aucune voix — réessayez', 'warn');
        speak('Je n\'ai rien entendu. Réessayons.', () => setTimeout(() => listenVentes(), 800));
      } else if (e.error !== 'aborted') {
        handled = true;
        setMicActive(false);
        addLog('Erreur microphone : ' + e.error, 'error');
        setPhase(STATES.ERROR);
      }
    };

    recRef.current = rec;
    rec.start();
  }, []);

  const askDepenses = useCallback(() => {
    setPhase(STATES.ASK_DEPENSES);
    addLog('Agent : Quel est le montant total de vos dépenses aujourd\'hui ?', 'agent');
    speak(
      'Deuxième question : quel est le montant total de vos dépenses aujourd\'hui ?',
      () => setTimeout(() => listenDepenses(), 600)
    );
  }, []);

  const listenDepenses = useCallback(() => {
    setPhase(STATES.LISTEN_DEPENSES);
    setMicActive(true);
    setManualInput('');
    setCurrentHandler(() => (text) => {
      setMicActive(false);
      setCurrentHandler(null);
      recRef.current?.abort?.();
      addLog(`Vous (clavier) : "${text}"`, 'user');
      const montant = extractAmount(text) || 0;
      if (montant > 0) addLog(`Compris : ${montant.toLocaleString('fr-FR')} FCFA`, 'system');
      else addLog('Montant non compris — dépenses mises à 0', 'warn');
      doRecap(montant);
    });
    addLog('En écoute — parlez ou tapez le montant ci-dessous...', 'system');

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setPhase(STATES.ERROR); return; }

    let handled = false;
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 5;

    let best = '';
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) best = e.results[i][0].transcript;
        else if (!best) best = e.results[i][0].transcript;
      }
    };

    rec.onend = () => {
      if (handled) return;
      handled = true;
      setMicActive(false);
      const text = best.trim();
      if (!text) {
        addLog('Aucune voix — dépenses mises à 0', 'warn');
        doRecap(0);
        return;
      }
      addLog(`Vous : "${text}"`, 'user');
      const montant = extractAmount(text) || 0;
      if (montant > 0) {
        addLog(`Compris : ${montant.toLocaleString('fr-FR')} FCFA`, 'system');
      } else {
        addLog('Montant non compris — dépenses mises à 0', 'warn');
      }
      doRecap(montant);
    };

    rec.onerror = (e) => {
      if (handled) return;
      handled = true;
      setMicActive(false);
      if (e.error === 'no-speech') {
        addLog('Aucune voix — dépenses mises à 0', 'warn');
        doRecap(0);
      } else if (e.error !== 'aborted') {
        addLog('Erreur microphone : ' + e.error, 'error');
        setPhase(STATES.ERROR);
      }
    };

    recRef.current = rec;
    rec.start();
  }, []);

  const doRecap = useCallback((dep) => {
    setPhase(STATES.RECAP);
    setDepenseAmount(dep);

    setVenteAmount((vente) => {
      const venteStr = (vente || 0).toLocaleString('fr-FR');
      const depStr = dep.toLocaleString('fr-FR');
      addLog(`Récap : Ventes ${venteStr} F | Dépenses ${depStr} F`, 'system');
      speak(
        `Récapitulatif du jour : ventes ${venteStr} francs, dépenses ${depStr} francs. Merci et bonne continuation !`,
        () => setTimeout(() => saveTransactions(vente || 0, dep), 1000)
      );
      return vente;
    });
  }, []);

  const saveTransactions = useCallback(async (vente, dep) => {
    setPhase(STATES.SAVING);
    addLog('Sauvegarde en cours...', 'system');
    try {
      await api.post('/simulator/save', {
        venteAmount: vente,
        depenseAmount: dep,
      });
      queryClient.invalidateQueries(['mpme-stats']);
      queryClient.invalidateQueries(['score']);
      addLog('Transactions enregistrées avec succès !', 'success');
      setPhase(STATES.DONE);
    } catch (err) {
      addLog('Erreur sauvegarde : ' + (err.response?.data?.error || 'Erreur serveur'), 'error');
      setPhase(STATES.ERROR);
    }
  }, [queryClient]);

  const hangUp = () => {
    window.speechSynthesis.cancel();
    recRef.current?.stop();
    stopRing();
    setMicActive(false);
    setCurrentHandler(null);
    setManualInput('');
    setPhase(STATES.IDLE);
    addLog('Appel terminé', 'system');
  };

  const submitManual = () => {
    const val = manualInput.trim();
    if (!val || !currentHandler) return;
    setManualInput('');
    currentHandler(val);
  };

  // ─── UI helpers ──────────────────────────────────────────────────────────
  const isInCall = ![STATES.IDLE, STATES.DONE, STATES.ERROR].includes(phase);
  const isRinging = phase === STATES.RINGING;

  const phaseLabel = {
    [STATES.IDLE]: 'Prêt',
    [STATES.RINGING]: 'Appel entrant...',
    [STATES.CONNECTED]: 'Connecté',
    [STATES.ASK_VENTES]: 'Question ventes',
    [STATES.LISTEN_VENTES]: 'Écoute ventes',
    [STATES.ASK_DEPENSES]: 'Question dépenses',
    [STATES.LISTEN_DEPENSES]: 'Écoute dépenses',
    [STATES.RECAP]: 'Récapitulatif',
    [STATES.SAVING]: 'Enregistrement...',
    [STATES.DONE]: 'Terminé',
    [STATES.ERROR]: 'Erreur',
  }[phase];

  const logColors = {
    system: 'text-gray-400',
    agent: 'text-sedo-green font-medium',
    user: 'text-blue-300 font-medium',
    warn: 'text-yellow-400',
    error: 'text-red-400',
    success: 'text-emerald-400 font-bold',
  };

  return (
    <div className="px-4 py-5 lg:px-0 lg:py-0 flex flex-col lg:flex-row gap-6 items-start">

      {/* ── Téléphone ─────────────────────────────────────────────── */}
      <div className="w-full lg:w-72 mx-auto lg:mx-0 flex-shrink-0">
        <div className="relative mx-auto w-64 bg-gray-900 rounded-[2.5rem] shadow-2xl border-4 border-gray-700 overflow-hidden">

          {/* Haut téléphone */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-16 h-1.5 bg-gray-600 rounded-full" />
          </div>

          {/* Écran */}
          <div className="bg-gray-950 mx-2 rounded-2xl overflow-hidden" style={{ minHeight: 340 }}>

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 pt-2 pb-1">
              <span className="text-white text-[10px] font-bold">MTN BJ</span>
              <span className="text-white text-[10px]">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              <div className="flex items-center gap-1">
                <span className="text-white text-[10px]">📶</span>
                <span className="text-white text-[10px]">🔋</span>
              </div>
            </div>

            {/* Contenu écran */}
            <div className="flex flex-col items-center justify-center px-4 py-6 gap-3" style={{ minHeight: 270 }}>

              {/* Logo SEDO */}
              <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
                isRinging ? 'animate-bounce bg-sedo-green' :
                micActive ? 'bg-blue-600 animate-pulse' :
                isInCall ? 'bg-sedo-green' :
                phase === STATES.DONE ? 'bg-emerald-500' :
                phase === STATES.ERROR ? 'bg-red-600' :
                'bg-gray-700'
              }`}>
                <span className="text-3xl">
                  {micActive ? '🎤' : isRinging ? '📳' : isInCall ? '🤖' : phase === STATES.DONE ? '✅' : '📱'}
                </span>
              </div>

              {/* Nom appelant */}
              <div className="text-center">
                <p className="text-white font-bold text-base">Agent SEDO</p>
                <p className="text-gray-400 text-xs">+229 SEDO VOCAL</p>
              </div>

              {/* Statut */}
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                isRinging ? 'bg-yellow-500/20 text-yellow-300' :
                micActive ? 'bg-blue-500/20 text-blue-300' :
                phase === STATES.DONE ? 'bg-emerald-500/20 text-emerald-300' :
                phase === STATES.ERROR ? 'bg-red-500/20 text-red-300' :
                'bg-white/10 text-gray-300'
              }`}>
                {micActive ? `Écoute${dots}` : phaseLabel}
              </div>

              {/* Résultats si done */}
              {phase === STATES.DONE && (
                <div className="w-full bg-white/5 rounded-xl p-3 space-y-1 mt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Ventes</span>
                    <span className="text-emerald-400 font-bold">+{(venteAmount || 0).toLocaleString('fr-FR')} F</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Dépenses</span>
                    <span className="text-red-400 font-bold">-{(depenseAmount || 0).toLocaleString('fr-FR')} F</span>
                  </div>
                  <div className="h-px bg-white/10 my-1" />
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Net</span>
                    <span className={`font-bold ${(venteAmount || 0) - (depenseAmount || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {((venteAmount || 0) - (depenseAmount || 0)).toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Boutons appel */}
          <div className="flex justify-around items-center py-5 px-6">
            {/* Raccrocher */}
            <button
              onClick={hangUp}
              disabled={!isInCall && phase !== STATES.DONE}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 text-2xl ${
                isInCall ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-500'
              }`}
            >
              ✕
            </button>

            {/* Décrocher / Relancer */}
            <button
              onClick={startCall}
              disabled={isInCall}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 text-2xl ${
                !isInCall ? 'bg-sedo-green text-white animate-pulse' : 'bg-gray-700 text-gray-500'
              }`}
            >
              📞
            </button>
          </div>

          {/* Bas téléphone */}
          <div className="flex justify-center pb-3">
            <div className="w-8 h-8 rounded-full border-2 border-gray-600" />
          </div>
        </div>

        {/* Légende */}
        <p className="text-center text-xs text-gray-400 mt-3">
          {phase === STATES.IDLE ? 'Appuyez sur 📞 pour simuler l\'appel' :
           phase === STATES.DONE ? 'Transactions enregistrées ✅' :
           phase === STATES.ERROR ? 'Utilisez Chrome pour la reconnaissance vocale' :
           'Parlez clairement le montant en FCFA'}
        </p>

        {/* Saisie manuelle si micro ne capte pas */}
        {micActive && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-3">
            <p className="text-xs text-gray-500 mb-2 font-medium text-center">
              🎤 Voix non captée ? Tapez le montant :
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                placeholder="Ex: 5000"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-800 focus:outline-none focus:border-sedo-green"
                autoFocus
              />
              <button
                onClick={submitManual}
                disabled={!manualInput.trim()}
                className="px-4 py-2 bg-sedo-green text-white rounded-xl text-sm font-bold disabled:opacity-40"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Journal + Infos ───────────────────────────────────────── */}
      <div className="flex-1 space-y-4 w-full">

        {/* Journal temps réel */}
        <div className="bg-gray-900 rounded-2xl p-4 shadow-inner">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${isInCall ? 'bg-sedo-green animate-pulse' : 'bg-gray-600'}`} />
            <p className="text-white text-xs font-bold tracking-widest uppercase">Journal de session</p>
          </div>

          <div className="space-y-1 font-mono text-xs max-h-64 overflow-y-auto">
            {log.length === 0 ? (
              <p className="text-gray-600 italic">En attente de l'appel...</p>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-600 flex-shrink-0">{entry.time}</span>
                  <span className={logColors[entry.type] || 'text-gray-400'}>{entry.text}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Explication */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            💡 Comment utiliser le simulateur
          </p>
          <div className="space-y-2">
            {[
              { step: '1', text: 'Appuyez sur le bouton vert 📞 pour démarrer l\'appel simulé' },
              { step: '2', text: 'L\'agent SEDO vous pose la question sur vos ventes — répondez à voix haute (ex: "cinq mille francs" ou "5000")' },
              { step: '3', text: 'L\'agent pose la question sur vos dépenses — répondez de la même façon' },
              { step: '4', text: 'L\'agent récapitule et les transactions sont automatiquement enregistrées dans votre comptabilité' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div className="w-5 h-5 bg-sedo-green text-white rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{item.step}</div>
                <p className="text-xs lg:text-sm text-gray-600">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-yellow-50 border border-yellow-100 rounded-xl p-3">
            <p className="text-xs text-yellow-700 font-medium">⚠️ Nécessite Chrome ou Edge — la reconnaissance vocale n'est pas disponible sur Firefox.</p>
          </div>
        </div>

        {/* Exemples de phrases */}
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <p className="text-xs font-bold text-sedo-green mb-2">Exemples de réponses</p>
          {[
            '"cinq mille francs"',
            '"j\'ai vendu pour vingt mille"',
            '"15000"',
            '"deux mille cinq cents"',
          ].map((ex) => (
            <p key={ex} className="text-xs text-green-700 py-1.5 border-b border-green-100 last:border-0 font-mono">{ex}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

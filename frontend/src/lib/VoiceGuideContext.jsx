import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const VoiceGuideContext = createContext(null);

const STEPS = {
  WELCOME:         'welcome',
  WAIT_COMPTA:     'wait_compta',
  COMPTA_ARRIVED:  'compta_arrived',
  WAIT_VOCAL_TAB:  'wait_vocal_tab',
  VOCAL_TAB_ACTIVE:'vocal_tab_active',
  WAIT_LANG:       'wait_lang',
  LANG_SELECTED:   'lang_selected',
  WAIT_MIC:        'wait_mic',
  MIC_ACTIVE:      'mic_active',
  MIC_STOPPED:     'mic_stopped',
  WAIT_CONFIRM:    'wait_confirm',
  DONE:            'done',
};

const STEP_AUDIO = {
  [STEPS.WELCOME]:          'guide_welcome.mp3',
  [STEPS.COMPTA_ARRIVED]:   'guide_compta_vocal_tab.mp3',
  [STEPS.VOCAL_TAB_ACTIVE]: 'guide_choose_lang.mp3',
  [STEPS.LANG_SELECTED]:    'guide_press_mic.mp3',
  [STEPS.MIC_STOPPED]:      'guide_confirm_tx.mp3',
  [STEPS.DONE]:             'guide_done.mp3',
};

const AUTO_ADVANCE = {
  [STEPS.WELCOME]:          STEPS.WAIT_COMPTA,
  [STEPS.COMPTA_ARRIVED]:   STEPS.WAIT_VOCAL_TAB,
  [STEPS.VOCAL_TAB_ACTIVE]: STEPS.WAIT_LANG,
  [STEPS.LANG_SELECTED]:    STEPS.WAIT_MIC,
  [STEPS.MIC_STOPPED]:      STEPS.WAIT_CONFIRM,
};

export function VoiceGuideProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [step, setStep] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);
  const lastAudioRef = useRef(null);

  const playAudio = useCallback((file) => {
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(`/audio/${file}`);
    audioRef.current = audio;
    lastAudioRef.current = file;
    setSpeaking(true);
    audio.play().catch(() => setSpeaking(false));
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => setSpeaking(false);
  }, []);

  // Démarrage automatique au premier lancement sur le dashboard
  useEffect(() => {
    if (!user || user.role !== 'mpme') return;
    if (localStorage.getItem(`sedo_guide_done_${user.id}`)) return;
    if (step !== null) return;
    if (location.pathname === '/mpme') {
      setTimeout(() => setStep(STEPS.WELCOME), 1500);
    }
  }, [user, location.pathname]);

  // Jouer l'audio quand on entre dans une étape
  useEffect(() => {
    if (!step) return;
    const audioFile = STEP_AUDIO[step];
    if (audioFile) playAudio(audioFile);
  }, [step]);

  // Auto-avancer après la fin de l'audio
  useEffect(() => {
    if (!step || speaking) return;
    const nextStep = AUTO_ADVANCE[step];
    if (nextStep) setStep(nextStep);
    if (step === STEPS.DONE) setTimeout(() => setStep(null), 500);
  }, [speaking]);

  // Surveiller la navigation
  useEffect(() => {
    if (!step) return;
    if (step === STEPS.WAIT_COMPTA) {
      if (location.pathname === '/mpme/comptabilite') {
        setStep(STEPS.COMPTA_ARRIVED);
      } else if (location.pathname !== '/mpme') {
        playAudio('guide_wrong_nav.mp3');
      }
    }
  }, [location.pathname]);

  const reportAction = useCallback((action) => {
    if (!step) return;
    switch (step) {
      case STEPS.WAIT_VOCAL_TAB:
        if (action === 'vocal_tab') setStep(STEPS.VOCAL_TAB_ACTIVE);
        else playAudio('guide_wrong_tab.mp3');
        break;
      case STEPS.WAIT_LANG:
        if (action === 'lang_selected') setStep(STEPS.LANG_SELECTED);
        break;
      case STEPS.WAIT_MIC:
        if (action === 'mic_start') setStep(STEPS.MIC_ACTIVE);
        break;
      case STEPS.MIC_ACTIVE:
        if (action === 'mic_stop') setStep(STEPS.MIC_STOPPED);
        break;
      case STEPS.WAIT_CONFIRM:
        if (action === 'confirmed') {
          localStorage.setItem(`sedo_guide_done_${user?.id}`, 'true');
          setStep(STEPS.DONE);
        }
        break;
    }
  }, [step, user, playAudio]);

  const replay = useCallback(() => {
    if (lastAudioRef.current) playAudio(lastAudioRef.current);
  }, [playAudio]);

  const skipGuide = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    localStorage.setItem(`sedo_guide_done_${user?.id}`, 'true');
    setStep(null);
    setSpeaking(false);
  }, [user]);

  return (
    <VoiceGuideContext.Provider value={{ step, speaking, reportAction }}>
      {children}

      {/* Bouton flottant guide actif */}
      {step !== null && (
        <div className="fixed bottom-24 right-4 lg:bottom-8 z-50 flex flex-col items-center gap-2">
          <button onClick={skipGuide}
            className="text-[10px] text-gray-500 bg-white rounded-full px-2 py-0.5 shadow border border-gray-100">
            Passer
          </button>
          <button onClick={replay}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${speaking ? 'bg-sedo-green animate-pulse scale-110' : 'bg-sedo-green opacity-60'}`}>
            <span className="text-xl">🔊</span>
          </button>
        </div>
      )}
    </VoiceGuideContext.Provider>
  );
}

export const useVoiceGuide = () => useContext(VoiceGuideContext);

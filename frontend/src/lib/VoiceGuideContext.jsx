import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const VoiceGuideContext = createContext(null);

const STEPS = {
  WELCOME:          'welcome',
  WAIT_COMPTA:      'wait_compta',
  COMPTA_ARRIVED:   'compta_arrived',
  WAIT_VOCAL_TAB:   'wait_vocal_tab',
  VOCAL_TAB_ACTIVE: 'vocal_tab_active',
  WAIT_LANG:        'wait_lang',
  LANG_SELECTED:    'lang_selected',
  WAIT_MIC:         'wait_mic',
  MIC_ACTIVE:       'mic_active',
  MIC_STOPPED:      'mic_stopped',
  WAIT_CONFIRM:     'wait_confirm',
  DONE:             'done',
};

// Élément cible à encercler pour chaque étape d'attente
const WAIT_TARGETS = {
  [STEPS.WAIT_COMPTA]:    '[data-guide="nav_compta"]',
  [STEPS.WAIT_VOCAL_TAB]: '[data-guide="tab_vocal"]',
  [STEPS.WAIT_LANG]:      '[data-guide="lang_selector"]',
  [STEPS.WAIT_MIC]:       '[data-guide="mic_button"]',
  [STEPS.WAIT_CONFIRM]:   '[data-guide="confirm_button"]',
};

// Audio de correction si mauvais clic
const CORRECTION_AUDIO = {
  [STEPS.WAIT_COMPTA]:    'guide_wrong_nav.ogg',
  [STEPS.WAIT_VOCAL_TAB]: 'guide_wrong_tab.ogg',
  [STEPS.WAIT_LANG]:      'guide_wrong_tab.ogg',
  [STEPS.WAIT_MIC]:       'guide_wrong_nav.ogg',
  [STEPS.WAIT_CONFIRM]:   'guide_wrong_nav.ogg',
};

const STEP_AUDIO = {
  [STEPS.WELCOME]:          'guide_welcome.ogg',
  [STEPS.COMPTA_ARRIVED]:   'guide_compta_vocal_tab.ogg',
  [STEPS.VOCAL_TAB_ACTIVE]: 'guide_choose_lang.ogg',
  [STEPS.LANG_SELECTED]:    'guide_press_mic.ogg',
  [STEPS.MIC_STOPPED]:      'guide_confirm_tx.ogg',
  [STEPS.DONE]:             'guide_done.ogg',
};

const AUTO_ADVANCE = {
  [STEPS.WELCOME]:          STEPS.WAIT_COMPTA,
  [STEPS.COMPTA_ARRIVED]:   STEPS.WAIT_VOCAL_TAB,
  [STEPS.VOCAL_TAB_ACTIVE]: STEPS.WAIT_LANG,
  [STEPS.LANG_SELECTED]:    STEPS.WAIT_MIC,
  [STEPS.MIC_STOPPED]:      STEPS.WAIT_CONFIRM,
};

function SpotlightOverlay({ targetSelector }) {
  const [rect, setRect] = useState(null);
  const PAD = 12;
  const RADIUS = 14;

  useEffect(() => {
    if (!targetSelector) { setRect(null); return; }

    const update = () => {
      const el = document.querySelector(targetSelector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
      }
    };

    update();
    const interval = setInterval(update, 300);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [targetSelector]);

  if (!rect) return null;

  const hx = rect.x - PAD;
  const hy = rect.y - PAD;
  const hw = rect.w + PAD * 2;
  const hh = rect.h + PAD * 2;

  return (
    // pointer-events: none — purement visuel, tous les clics passent à travers
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ width: '100vw', height: '100vh' }}
      >
        <defs>
          <mask id="sedo-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={hx} y={hy} width={hw} height={hh} rx={RADIUS} fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(29, 158, 117, 0.88)"
          mask="url(#sedo-spotlight-mask)"
        />
        <rect
          x={hx} y={hy} width={hw} height={hh} rx={RADIUS}
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          opacity="0.9"
        />
      </svg>
    </div>
  );
}

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

  // Démarrage automatique
  useEffect(() => {
    if (!user || user.role !== 'mpme') return;
    if (localStorage.getItem(`sedo_guide_done_${user.id}`)) return;
    if (step !== null) return;
    if (location.pathname === '/mpme') {
      setTimeout(() => setStep(STEPS.WELCOME), 1500);
    }
  }, [user, location.pathname]);

  // Jouer audio à chaque étape
  useEffect(() => {
    if (!step) return;
    const audioFile = STEP_AUDIO[step];
    if (audioFile) playAudio(audioFile);
  }, [step]);

  // Auto-avancer après audio
  useEffect(() => {
    if (!step || speaking) return;
    const nextStep = AUTO_ADVANCE[step];
    if (nextStep) setStep(nextStep);
    if (step === STEPS.DONE) setTimeout(() => setStep(null), 500);
  }, [speaking]);

  // Surveiller navigation
  useEffect(() => {
    if (!step) return;
    if (step === STEPS.WAIT_COMPTA) {
      if (location.pathname === '/mpme/comptabilite') setStep(STEPS.COMPTA_ARRIVED);
    }
  }, [location.pathname]);

  const reportAction = useCallback((action) => {
    if (!step) return;
    switch (step) {
      case STEPS.WAIT_VOCAL_TAB:
        if (action === 'vocal_tab') setStep(STEPS.VOCAL_TAB_ACTIVE);
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
  }, [step, user]);

  const replay = useCallback(() => {
    if (lastAudioRef.current) playAudio(lastAudioRef.current);
  }, [playAudio]);

  const skipGuide = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    localStorage.setItem(`sedo_guide_done_${user?.id}`, 'true');
    setStep(null);
    setSpeaking(false);
  }, [user]);

  const currentTarget = step ? WAIT_TARGETS[step] : null;
  const correctionAudio = step ? CORRECTION_AUDIO[step] : null;

  // Listener global — bloque les clics hors cible
  useEffect(() => {
    if (!currentTarget) return;

    const handleClick = (e) => {
      const el = document.querySelector(currentTarget);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const PAD = 20;
      const inTarget =
        e.clientX >= r.left - PAD && e.clientX <= r.right + PAD &&
        e.clientY >= r.top - PAD && e.clientY <= r.bottom + PAD;

      if (!inTarget) {
        e.preventDefault();
        e.stopPropagation();
        if (correctionAudio) playAudio(correctionAudio);
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [currentTarget, correctionAudio, playAudio]);

  return (
    <VoiceGuideContext.Provider value={{ step, speaking, reportAction }}>
      {children}

      {/* Spotlight overlay — visuel uniquement */}
      {currentTarget && <SpotlightOverlay targetSelector={currentTarget} />}

      {/* Bouton flottant guide */}
      {step !== null && (
        <div className="fixed bottom-24 right-4 lg:bottom-8 z-[70] flex flex-col items-center gap-2">
          <button onClick={skipGuide}
            className="text-[10px] text-white bg-sedo-green/60 rounded-full px-2 py-0.5 shadow border border-white/20">
            Passer
          </button>
          <button onClick={replay}
            className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all ${speaking ? 'bg-white animate-pulse scale-110' : 'bg-white opacity-80'}`}>
            <span className="text-xl">🔊</span>
          </button>
        </div>
      )}
    </VoiceGuideContext.Provider>
  );
}

export const useVoiceGuide = () => useContext(VoiceGuideContext);

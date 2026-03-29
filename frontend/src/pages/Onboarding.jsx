import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const slides = [
  {
    icon: '🌱',
    title: 'Bienvenue sur SEDO',
    desc: 'La plateforme qui aide les petites entreprises du Bénin à accéder au financement.',
    bg: 'from-sedo-green to-sedo-green-dark',
  },
  {
    icon: '📊',
    title: 'Suivez votre activité',
    desc: 'Enregistrez vos transactions par pictogrammes, par la voix ou via USSD — même sans connexion.',
    bg: 'from-blue-500 to-blue-700',
  },
  {
    icon: '💯',
    title: 'Obtenez votre score',
    desc: 'SEDO calcule automatiquement votre score de finançabilité sur 100 points.',
    bg: 'from-purple-500 to-purple-700',
  },
  {
    icon: '💰',
    title: 'Accédez au financement',
    desc: 'Les institutions financières partenaires vous envoient des offres adaptées à votre profil.',
    bg: 'from-orange-400 to-orange-600',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const isLast = step === slides.length - 1;
  const slide = slides[step];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${slide.bg} flex flex-col transition-all duration-500`}>

      {/* Skip */}
      <div className="flex justify-end px-5 pt-5">
        <button onClick={() => { localStorage.setItem('sedo_onboarding_done', 'true'); navigate('/login'); }} className="text-white/70 text-sm font-medium">
          Passer
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="w-28 h-28 bg-white/20 rounded-3xl flex items-center justify-center text-6xl mb-8 shadow-lg">
          {slide.icon}
        </div>
        <h1 className="text-2xl font-black text-white mb-3">{slide.title}</h1>
        <p className="text-white/80 text-sm leading-relaxed max-w-xs">{slide.desc}</p>
      </div>

      {/* Bottom */}
      <div className="px-6 pb-10">
        {/* Dots */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${i === step ? 'w-6 h-2 bg-white' : 'w-2 h-2 bg-white/40'}`} />
          ))}
        </div>

        {isLast ? (
          <div className="space-y-3">
            <button onClick={() => { localStorage.setItem('sedo_onboarding_done', 'true'); navigate('/login'); }}
              className="w-full py-4 bg-white text-sedo-green rounded-2xl font-black text-base active:scale-95 transition-transform shadow-lg">
              Se connecter
            </button>
            <button onClick={() => { localStorage.setItem('sedo_onboarding_done', 'true'); navigate('/register'); }}
              className="w-full py-4 bg-white/20 text-white rounded-2xl font-bold text-base active:scale-95 transition-transform border border-white/30">
              Créer un compte
            </button>
          </div>
        ) : (
          <button onClick={() => setStep(step + 1)}
            className="w-full py-4 bg-white/20 text-white rounded-2xl font-bold text-base active:scale-95 transition-transform border border-white/30">
            Suivant →
          </button>
        )}
      </div>
    </div>
  );
}

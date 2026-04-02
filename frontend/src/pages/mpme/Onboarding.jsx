import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';

const sectors = [
  { icon: '🏪', label: 'Commerce' },
  { icon: '🐄', label: 'Élevage' },
  { icon: '🌾', label: 'Agriculture' },
  { icon: '✂️', label: 'Artisanat' },
  { icon: '🚗', label: 'Transport' },
  { icon: '🍽️', label: 'Restauration' },
];

const criteria = [
  { icon: '📱', color: 'bg-purple-50 text-purple-600', label: 'Mobile Money', pct: 30, desc: 'Vos transactions via MTN, Moov ou Wave' },
  { icon: '📊', color: 'bg-blue-50 text-blue-600', label: 'Comptabilité', pct: 25, desc: 'Régularité d\'enregistrement de vos entrées/sorties' },
  { icon: '📋', color: 'bg-orange-50 text-orange-600', label: 'Formalisation', pct: 25, desc: 'IFU, RCCM, NPI — vos documents officiels' },
  { icon: '🏭', color: 'bg-green-50 text-sedo-green', label: 'Profil sectoriel', pct: 20, desc: 'Potentiel de votre secteur d\'activité' },
];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [sector, setSector] = useState('');
  const [location, setLocation] = useState('');
  const [employees, setEmployees] = useState('');
  const [createdYear, setCreatedYear] = useState('');
  const [langue, setLangue] = useState('');

  const firstName = (user?.fullName || '').split(' ')[0];

  const saveAndFinish = async () => {
    setSaving(true);
    try {
      const payload = { sector, location };
      if (employees) payload.employees = parseInt(employees);
      if (createdYear) payload.createdYear = parseInt(createdYear);
      if (langue) payload.langue = langue;
      await api.put('/mpme/profile', payload);
    } catch {
      // non bloquant
    } finally {
      localStorage.setItem(`sedo_onboarded_${user?.id}`, 'true');
      setSaving(false);
      navigate('/mpme', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-200">
        <div
          className="h-1.5 bg-sedo-green transition-all duration-500"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>

      {/* Étape 1 — Bienvenue */}
      {step === 1 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
          <img src="/sedo-icon-white.jpeg" alt="SEDO" className="w-24 h-24 rounded-2xl shadow-lg mb-6 object-cover border border-gray-100" />
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            Bienvenue, {firstName} !
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-xs">
            SEDO va vous aider à obtenir un financement en suivant votre activité et en calculant votre score de finançabilité.
          </p>
          <div className="w-full max-w-xs space-y-3 mb-8">
            {[
              { icon: '📊', text: 'Enregistrez vos transactions facilement' },
              { icon: '💯', text: 'Obtenez votre score de finançabilité' },
              { icon: '💰', text: 'Accédez aux offres de financement' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100">
                <span className="text-2xl">{icon}</span>
                <p className="text-sm text-gray-700 font-medium text-left">{text}</p>
              </div>
            ))}
          </div>
          <button onClick={() => setStep(2)}
            className="w-full max-w-xs py-4 bg-sedo-green text-white rounded-2xl font-black text-base active:scale-95 transition-transform shadow-lg">
            Commencer la configuration
          </button>
          <p className="text-xs text-gray-400 mt-3">2 minutes suffisent</p>
        </div>
      )}

      {/* Étape 2 — Votre activité */}
      {step === 2 && (
        <div className="flex-1 flex flex-col px-5 py-6 overflow-y-auto">
          <div className="mb-6">
            <p className="text-xs text-sedo-green font-bold mb-1">Étape 1 sur 3</p>
            <h2 className="text-xl font-black text-gray-900">Votre activité</h2>
            <p className="text-sm text-gray-400 mt-1">Ces informations servent à calculer votre score</p>
          </div>

          {/* Secteur */}
          <div className="mb-5">
            <label className="text-sm font-bold text-gray-700 mb-3 block">Quel est votre secteur ?</label>
            <div className="grid grid-cols-3 gap-2">
              {sectors.map((s) => (
                <button key={s.label} onClick={() => setSector(`${s.icon} ${s.label}`)}
                  className={`rounded-xl p-3 border-2 flex flex-col items-center gap-1 transition-all active:scale-95 ${sector === `${s.icon} ${s.label}` ? 'border-sedo-green bg-green-50' : 'border-gray-100 bg-white'}`}>
                  <span className="text-2xl">{s.icon}</span>
                  <span className="text-[10px] font-medium text-gray-600">{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Localisation */}
          <div className="mb-4">
            <label className="text-sm font-bold text-gray-700 mb-1.5 block">Localisation</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Cotonou, Bohicon, Porto-Novo..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sedo-green" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-8">
            {/* Effectif */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">
                Effectif
                <span className="ml-1.5 text-[10px] font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">optionnel</span>
              </label>
              <input type="number" value={employees} onChange={(e) => setEmployees(e.target.value)}
                placeholder="Ex: 3" min="1"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sedo-green" />
            </div>
            {/* Année création */}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-1.5 block">
                Année création
                <span className="ml-1.5 text-[10px] font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">optionnel</span>
              </label>
              <input type="number" value={createdYear} onChange={(e) => setCreatedYear(e.target.value)}
                placeholder="Ex: 2019" min="1990" max={new Date().getFullYear()}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sedo-green" />
            </div>
          </div>

          {/* Langue */}
          <div className="mb-8">
            <label className="text-sm font-bold text-gray-700 mb-3 block">
              Langue parlée
              <span className="ml-1.5 text-[10px] font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">optionnel</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['Français', 'Fon', 'Yoruba', 'Adja', 'Dendi', 'Autre'].map((l) => (
                <button key={l} onClick={() => setLangue(l)}
                  className={`rounded-xl px-3 py-2.5 border-2 text-sm font-medium transition-all active:scale-95 ${langue === l ? 'border-sedo-green bg-green-50 text-sedo-green font-bold' : 'border-gray-100 bg-white text-gray-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setStep(3)} disabled={!sector || !location}
            className="w-full py-4 bg-sedo-green text-white rounded-2xl font-black text-base disabled:opacity-40 active:scale-95 transition-transform">
            Continuer →
          </button>
        </div>
      )}

      {/* Étape 3 — Votre score */}
      {step === 3 && (
        <div className="flex-1 flex flex-col px-5 py-6 overflow-y-auto">
          <div className="mb-6">
            <p className="text-xs text-sedo-green font-bold mb-1">Étape 2 sur 3</p>
            <h2 className="text-xl font-black text-gray-900">Votre score SEDO</h2>
            <p className="text-sm text-gray-400 mt-1">4 critères évaluent votre finançabilité</p>
          </div>

          {/* Score circle */}
          <div className="flex justify-center mb-6">
            <div className="w-28 h-28 rounded-full bg-sedo-green flex flex-col items-center justify-center shadow-lg">
              <span className="text-3xl font-black text-white">—</span>
              <span className="text-xs text-green-100 font-medium">/100</span>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {criteria.map((c) => (
              <div key={c.label} className={`rounded-2xl p-4 ${c.color.split(' ')[0]} border border-gray-100`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{c.icon}</span>
                    <span className="font-bold text-sm text-gray-800">{c.label}</span>
                  </div>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-full bg-white ${c.color.split(' ')[1]}`}>{c.pct}%</span>
                </div>
                <p className="text-xs text-gray-500 ml-7">{c.desc}</p>
              </div>
            ))}
          </div>

          <button onClick={() => setStep(4)}
            className="w-full py-4 bg-sedo-green text-white rounded-2xl font-black text-base active:scale-95 transition-transform">
            Continuer →
          </button>
        </div>
      )}

      {/* Étape 4 — Prêt ! */}
      {step === 4 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-5xl mb-6 shadow-sm">
            🎉
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Tout est prêt !</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-xs">
            Votre espace SEDO est configuré. Commencez à enregistrer vos transactions pour faire monter votre score et accéder au financement.
          </p>
          <div className="w-full max-w-xs bg-green-50 rounded-2xl p-4 mb-8 border border-green-100">
            <p className="text-xs font-bold text-sedo-green mb-2">Premier conseil</p>
            <p className="text-xs text-green-700 leading-relaxed">
              Enregistrez au moins une transaction dès aujourd'hui. Plus vous êtes régulier, plus votre score augmente.
            </p>
          </div>
          <button onClick={saveAndFinish} disabled={saving}
            className="w-full max-w-xs py-4 bg-sedo-green text-white rounded-2xl font-black text-base disabled:opacity-60 active:scale-95 transition-transform shadow-lg">
            {saving ? 'Configuration...' : 'Accéder à mon espace →'}
          </button>
        </div>
      )}

    </div>
  );
}

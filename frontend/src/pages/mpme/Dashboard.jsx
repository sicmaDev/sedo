import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatFCFA, scoreLevel } from '@/lib/utils';

export default function MPMEDashboard() {
  const navigate = useNavigate();

  const { data: score, isLoading: loadingScore } = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get('/score').then((r) => r.data),
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['mpme-stats'],
    queryFn: () => api.get('/mpme/stats').then((r) => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: ['mpme-profile'],
    queryFn: () => api.get('/mpme/profile').then((r) => r.data),
  });

  const { data: offers } = useQuery({
    queryKey: ['financing-offers'],
    queryFn: () => api.get('/financement/offers').then((r) => r.data),
  });

  const total = score?.total ?? 0;
  const level = scoreLevel(total);
  const eligibleOffers = offers?.filter((o) => o.eligible) ?? [];

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Score hero */}
      <div className="bg-gradient-to-br from-sedo-green to-sedo-green-dark rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100 text-sm">Score de finançabilité</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-5xl font-black">{loadingScore ? '—' : total}</span>
              <span className="text-green-200 text-lg mb-1">/100</span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-white/20 text-white`}>{level.label}</span>
          </div>
          <div className="w-20 h-20 relative">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3"
                strokeDasharray={`${total} ${100 - total}`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{total}</span>
          </div>
        </div>
        <div className="mt-3 bg-white/10 rounded-xl p-3">
          <p className="text-xs text-green-100">🔄 Zéro effort — Mobile Money synchronisé automatiquement</p>
        </div>
      </div>

      {/* Profil ADPME */}
      {profile && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-sm">👤 Profil entreprise</h3>
            <span className="text-xs text-gray-400">{profile.company}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Raison sociale', profile.company],
              ['Secteur', profile.sector],
              ['Création', profile.createdYear],
              ['Effectif', `${profile.employees} employé${profile.employees > 1 ? 's' : ''}`],
              ['Localisation', profile.location],
              ['IFU', profile.ifuStatus],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-xl p-2">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">{k}</p>
                <p className="text-xs font-semibold text-gray-800 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/mpme/profil')}
            className="mt-3 w-full text-center text-sedo-green text-xs font-semibold py-2 border border-sedo-green rounded-xl">
            Mettre à jour
          </button>
        </div>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '💰', label: 'Recettes du mois', value: formatFCFA(stats.recettes), sub: `${stats.evolution >= 0 ? '↑' : '↓'} ${Math.abs(stats.evolution)}% vs mois dernier`, color: 'green' },
            { icon: '📉', label: 'Dépenses du mois', value: formatFCFA(stats.depenses), sub: `${stats.recettes > 0 ? Math.round((stats.depenses / stats.recettes) * 100) : 0}% des recettes`, color: 'red' },
            { icon: '📱', label: 'Transactions sync.', value: String(stats.txSync), sub: 'Mobile Money', color: 'blue' },
            { icon: '📝', label: 'Formalisation', value: `${stats.formalisation}%`, sub: `${stats.formRemaining} étape${stats.formRemaining !== 1 ? 's' : ''} restante${stats.formRemaining !== 1 ? 's' : ''}`, color: 'orange' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <span className="text-2xl">{s.icon}</span>
              <p className="font-bold text-gray-900 text-sm mt-2 leading-tight">{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-1 leading-tight">{s.label}</p>
              <p className={`text-[10px] mt-1 px-1.5 py-0.5 rounded-full inline-block ${
                s.color === 'green' ? 'bg-green-50 text-green-600' :
                s.color === 'red' ? 'bg-red-50 text-red-600' :
                s.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
              }`}>{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h3 className="font-bold text-gray-800 text-sm mb-3">⚡ Actions rapides</h3>
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: '🎨', label: 'Enregistrer', path: '/mpme/comptabilite' },
            { icon: '💯', label: 'Mon score', path: '/mpme/score' },
            { icon: '💰', label: 'Financement', path: '/mpme/financement' },
          ].map((a) => (
            <button key={a.label} onClick={() => navigate(a.path)}
              className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col items-center gap-1 active:scale-95 transition-transform">
              <span className="text-2xl">{a.icon}</span>
              <span className="text-[10px] font-medium text-gray-600">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Opportunités */}
      <div>
        <h3 className="font-bold text-gray-800 text-sm mb-3">💼 Opportunités de financement</h3>
        <div className="space-y-2">
          {eligibleOffers.slice(0, 2).map((o) => (
            <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm border border-green-100 flex items-start gap-3">
              <span className="text-xl">✅</span>
              <div className="flex-1">
                <p className="font-bold text-sm text-gray-900">{o.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatFCFA(o.maxAmount)} — {o.rate ? `${o.rate}%/an` : 'Non remboursable'}</p>
              </div>
            </div>
          ))}
          {offers?.filter((o) => !o.eligible).slice(0, 1).map((o) => (
            <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm border border-yellow-100 flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="font-bold text-sm text-gray-900">{o.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Score requis : {o.minScore}. Vous êtes à {o.gapToEligibility} point{o.gapToEligibility > 1 ? 's' : ''} !</p>
              </div>
            </div>
          ))}
          <button onClick={() => navigate('/mpme/financement')}
            className="w-full text-center text-sedo-green text-xs font-semibold py-2">
            Voir toutes les opportunités →
          </button>
        </div>
      </div>
    </div>
  );
}

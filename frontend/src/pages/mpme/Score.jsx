import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { scoreLevel } from '@/lib/utils';

const criteriaConfig = [
  { key: 'mobileMoney', icon: '📱', label: 'Mobile Money', pct: 30, desc: 'Régularité et volume des transactions synchronisées' },
  { key: 'comptabilite', icon: '📊', label: 'Comptabilité', pct: 25, desc: 'Qualité et complétude des données financières' },
  { key: 'formalisation', icon: '📝', label: 'Formalisation', pct: 25, desc: 'Progression dans les démarches légales (IFU, RCCM...)' },
  { key: 'profilSectoriel', icon: '🎯', label: 'Profil sectoriel', pct: 20, desc: 'Cohérence du profil avec le secteur d\'activité' },
];

export default function Score() {
  const queryClient = useQueryClient();

  const { data: score, isLoading } = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get('/score').then((r) => r.data),
  });

  const { mutate: recalculate, isPending } = useMutation({
    mutationFn: () => api.post('/score/calculate'),
    onSuccess: () => queryClient.invalidateQueries(['score']),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-green rounded-full animate-spin" />
    </div>
  );

  const total = score?.total ?? 0;
  const level = scoreLevel(total);

  return (
    <div className="px-4 py-5 space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-sedo-green to-sedo-green-dark rounded-2xl p-6 text-white flex flex-col items-center">
        <p className="text-green-100 text-sm mb-3">💯 Score de finançabilité</p>
        <div className="relative w-36 h-36">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3.5"
              strokeDasharray={`${total} ${100 - total}`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black">{total}</span>
            <span className="text-green-200 text-sm">/100</span>
          </div>
        </div>
        <span className="mt-3 text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">{level.label}</span>
        <button onClick={() => recalculate()} disabled={isPending}
          className="mt-3 text-xs text-green-100 underline disabled:opacity-50">
          {isPending ? 'Calcul en cours...' : '🔄 Recalculer le score'}
        </button>
      </div>

      {/* Critères */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-800 text-sm">Détail par critère</h3>
        {criteriaConfig.map((c) => {
          const val = score?.[c.key] ?? 0;
          return (
            <div key={c.key} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{c.icon}</span>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{c.label}</p>
                    <p className="text-[10px] text-gray-400">{c.pct}% du score total</p>
                  </div>
                </div>
                <span className="text-lg font-black text-sedo-green">{Math.round(val)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-sedo-green h-2 rounded-full transition-all duration-500" style={{ width: `${val}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-2">{c.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Recommandation */}
      {score?.recommendation && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-sedo-green mb-1">💡 Recommandation personnalisée</p>
          <p className="text-xs text-green-700 leading-relaxed">{score.recommendation}</p>
        </div>
      )}

      {/* Niveaux */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-bold text-sm text-gray-800 mb-3">📊 Niveaux de maturité</h3>
        <div className="space-y-2">
          {[
            { range: '76 – 100', label: 'Éligible au crédit', color: 'bg-green-100 text-green-700', active: total >= 76 },
            { range: '56 – 75', label: 'Presque éligible', color: 'bg-yellow-100 text-yellow-700', active: total >= 56 && total < 76 },
            { range: '31 – 55', label: 'En progression', color: 'bg-orange-100 text-orange-700', active: total >= 31 && total < 56 },
            { range: '0 – 30', label: 'Non éligible', color: 'bg-red-100 text-red-700', active: total < 31 },
          ].map((n) => (
            <div key={n.range} className={`flex items-center justify-between p-2 rounded-xl ${n.active ? n.color : 'bg-gray-50'}`}>
              <span className={`text-xs font-semibold ${n.active ? '' : 'text-gray-400'}`}>{n.range}</span>
              <span className={`text-xs font-bold ${n.active ? '' : 'text-gray-400'}`}>{n.label} {n.active ? '← vous' : ''}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

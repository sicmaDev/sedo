import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function IMFDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['imf-stats'],
    queryFn: () => api.get('/imf/stats').then((r) => r.data),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-blue rounded-full animate-spin" />
    </div>
  );

  const cards = [
    { icon: '👥', label: 'MPME éligibles', value: stats?.eligible ?? 0, sub: `${stats?.tauxEligibilite ?? 0}% du total`, color: 'green' },
    { icon: '📋', label: 'En progression', value: stats?.enProgression ?? 0, sub: 'Score 31-74', color: 'blue' },
    { icon: '💰', label: 'MPME totales', value: stats?.total ?? 0, sub: 'Sur la plateforme', color: 'purple' },
    { icon: '📊', label: 'Score moyen', value: `${stats?.scoresMoyen ?? 0}/100`, sub: 'Toutes MPME', color: 'teal' },
  ];

  const colorMap = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    teal: 'bg-teal-50 text-teal-600',
  };

  const evolution = stats?.evolution ?? [];
  const maxVal = Math.max(...evolution.map((e) => e.count), 1);

  return (
    <div className="px-4 py-5 space-y-5">
      <div className="bg-gradient-to-br from-sedo-blue to-blue-700 rounded-2xl p-5 text-white">
        <p className="text-blue-100 text-sm">Tableau de bord IMF</p>
        <h2 className="text-2xl font-black mt-1">Suivi en temps réel</h2>
        <p className="text-blue-200 text-xs mt-1">MPME éligibles et opportunités de crédit</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <span className="text-2xl">{s.icon}</span>
            <p className="font-black text-gray-900 text-xl mt-2">{s.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
            <p className={`text-[10px] mt-1.5 px-2 py-0.5 rounded-full inline-block font-medium ${colorMap[s.color]}`}>{s.sub}</p>
          </div>
        ))}
      </div>

      {evolution.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm text-gray-800 mb-4">📈 Évolution sur 6 mois</h3>
          <div className="flex items-end gap-2 h-28">
            {evolution.map((e, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-sedo-blue font-bold">{e.count}</span>
                <div className="w-full bg-sedo-blue rounded-t-lg transition-all" style={{ height: `${(e.count / maxVal) * 96}px` }} />
                <span className="text-[9px] text-gray-400">{e.month}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

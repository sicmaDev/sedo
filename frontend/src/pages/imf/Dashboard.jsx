import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { CheckCircle, ClipboardList, Users, Award, TrendingUp } from 'lucide-react';

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
    { Icon: CheckCircle, label: 'MPME éligibles', value: stats?.eligible ?? 0, sub: `${stats?.tauxEligibilite ?? 0}% du total`, color: 'green' },
    { Icon: ClipboardList, label: 'En progression', value: stats?.enProgression ?? 0, sub: 'Score 31–74', color: 'blue' },
    { Icon: Users, label: 'MPME totales', value: stats?.total ?? 0, sub: 'Sur la plateforme', color: 'purple' },
    { Icon: Award, label: 'Score moyen', value: `${stats?.scoresMoyen ?? 0}/100`, sub: 'Toutes MPME', color: 'teal' },
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
    <div className="px-4 py-5 lg:px-0 lg:py-0 space-y-5 lg:space-y-6">

      {/* Hero */}
      <div className="bg-gradient-to-br from-sedo-blue to-blue-700 rounded-2xl p-5 lg:p-8 text-white">
        <p className="text-blue-100 text-sm lg:text-base">Tableau de bord IMF</p>
        <h2 className="text-2xl lg:text-4xl font-black mt-1">Suivi en temps réel</h2>
        <div className="flex gap-4 lg:gap-8 mt-4">
          <div>
            <p className="text-3xl lg:text-5xl font-black">{stats?.eligible ?? '—'}</p>
            <p className="text-blue-200 text-xs lg:text-sm mt-1">MPME éligibles au financement</p>
          </div>
          <div className="border-l border-white/20 pl-4 lg:pl-8">
            <p className="text-3xl lg:text-5xl font-black">{stats?.tauxEligibilite ?? '—'}%</p>
            <p className="text-blue-200 text-xs lg:text-sm mt-1">Taux d'éligibilité global</p>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
        {cards.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <s.Icon className={`w-6 h-6 lg:w-7 lg:h-7 ${colorMap[s.color].replace('bg-', 'text-').replace('-50', '-600')}`} />
            <p className="font-black text-gray-900 text-xl lg:text-3xl mt-2">{s.value}</p>
            <p className="text-[10px] lg:text-xs text-gray-400 mt-0.5">{s.label}</p>
            <p className={`text-[10px] lg:text-xs mt-2 px-2 py-0.5 rounded-full inline-block font-medium ${colorMap[s.color]}`}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Graphique évolution */}
      {evolution.length > 0 && (
        <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm lg:text-base text-gray-800 mb-4 lg:mb-6 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-sedo-blue" /> Évolution du portefeuille — 6 mois</h3>
          <div className="flex items-end gap-2 lg:gap-4 h-28 lg:h-48">
            {evolution.map((e, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] lg:text-xs text-sedo-blue font-bold">{e.count}</span>
                <div className="w-full bg-sedo-blue rounded-t-lg transition-all" style={{ height: `${(e.count / maxVal) * 100}%`, minHeight: 4 }} />
                <span className="text-[9px] lg:text-xs text-gray-400">{e.month}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

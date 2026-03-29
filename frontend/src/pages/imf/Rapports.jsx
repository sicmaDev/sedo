import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const SECTOR_COLORS = ['#1D9E75', '#2563EB', '#F59E0B', '#8B5CF6', '#EF4444'];

export default function Rapports() {
  const { data: stats } = useQuery({
    queryKey: ['imf-stats'],
    queryFn: () => api.get('/imf/stats').then((r) => r.data),
  });

  const { data: mpmeList } = useQuery({
    queryKey: ['imf-mpme'],
    queryFn: () => api.get('/imf/mpme').then((r) => r.data),
  });

  const sectorMap = {};
  (mpmeList ?? []).forEach((m) => { sectorMap[m.sector] = (sectorMap[m.sector] || 0) + 1; });
  const total = mpmeList?.length || 1;
  const sectorData = Object.entries(sectorMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, count], i) => ({ name, count, pct: Math.round((count / total) * 100), color: SECTOR_COLORS[i] }));

  const regionMap = {};
  (mpmeList ?? []).forEach((m) => {
    const region = m.location?.split(',')[0]?.trim() || 'Autre';
    if (!regionMap[region]) regionMap[region] = { total: 0, eligible: 0 };
    regionMap[region].total++;
    if ((m.score ?? 0) >= 75) regionMap[region].eligible++;
  });
  const regions = Object.entries(regionMap)
    .sort((a, b) => b[1].total - a[1].total).slice(0, 5)
    .map(([region, d]) => ({ region, ...d, pct: d.total > 0 ? Math.round((d.eligible / d.total) * 100) : 0 }));

  return (
    <div className="px-4 py-5 lg:px-0 lg:py-0 space-y-5 lg:space-y-6">
      <div>
        <h2 className="text-lg lg:text-2xl font-black text-gray-900">📈 Rapports & Statistiques</h2>
        <p className="text-xs lg:text-sm text-gray-400">Vue d'ensemble du portefeuille MPME</p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
        {[
          { label: 'MPME totales', value: stats?.total ?? 0, icon: '👥' },
          { label: 'Taux d\'éligibilité', value: `${stats?.tauxEligibilite ?? 0}%`, icon: '📊' },
          { label: 'MPME éligibles', value: stats?.eligible ?? 0, icon: '✅' },
          { label: 'Score moyen', value: `${stats?.scoresMoyen ?? 0}/100`, icon: '💯' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100 text-center">
            <span className="text-2xl lg:text-3xl">{s.icon}</span>
            <p className="font-black text-gray-900 text-xl lg:text-3xl mt-1">{s.value}</p>
            <p className="text-[10px] lg:text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-5 lg:space-y-0">
        {/* Répartition par secteur */}
        {sectorData.length > 0 && (
          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-sm lg:text-base text-gray-800 mb-4">🎯 Répartition par secteur</h3>
            <div className="space-y-4">
              {sectorData.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs lg:text-sm mb-1.5">
                    <span className="text-gray-700 font-medium">{s.name}</span>
                    <span className="font-bold" style={{ color: s.color }}>{s.pct}% ({s.count} MPME)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 lg:h-3">
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Régions */}
        {regions.length > 0 && (
          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-sm lg:text-base text-gray-800 mb-4">🗺️ Taux d'éligibilité par région</h3>
            <div className="space-y-2">
              {regions.map(({ region, total: t, eligible, pct }) => (
                <div key={region} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-xs lg:text-sm font-semibold text-gray-800">{region}</p>
                    <p className="text-[10px] lg:text-xs text-gray-400">{eligible}/{t} MPME éligibles</p>
                  </div>
                  <span className="text-sm lg:text-xl font-black text-sedo-blue">{pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <button className="w-full py-3 lg:py-4 bg-sedo-blue text-white rounded-xl text-sm lg:text-base font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform">
        📥 Exporter rapport PDF
      </button>
    </div>
  );
}

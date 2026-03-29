import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const typeColors = {
  success: 'border-green-100 bg-green-50',
  warning: 'border-yellow-100 bg-yellow-50',
  info: 'border-blue-100 bg-blue-50',
};

export default function Alertes() {
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['imf-alerts'],
    queryFn: () => api.get('/imf/alerts').then((r) => r.data),
    refetchInterval: 30000,
  });

  return (
    <div className="px-4 py-5 lg:px-0 lg:py-0 space-y-4 lg:space-y-5">
      <div>
        <h2 className="text-lg lg:text-2xl font-black text-gray-900">🔔 Alertes</h2>
        <p className="text-xs lg:text-sm text-gray-400">Notifications en temps réel · Actualisation toutes les 30s</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-blue rounded-full animate-spin" />
        </div>
      ) : alerts?.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-3">🔔</p>
          <p className="text-gray-400 text-sm lg:text-base">Aucune alerte récente</p>
        </div>
      ) : (
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
          {alerts?.map((a, i) => (
            <div key={i} className={`rounded-2xl p-4 lg:p-5 border ${typeColors[a.type] || typeColors.info}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl lg:text-2xl flex-shrink-0">{a.icon}</span>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-sm lg:text-base text-gray-900">{a.title}</p>
                    <span className="text-[10px] lg:text-xs text-gray-400 flex-shrink-0">{a.time}</span>
                  </div>
                  <p className="text-xs lg:text-sm text-gray-500 mt-1 leading-relaxed">{a.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

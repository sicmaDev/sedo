import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatFCFA } from '@/lib/utils';

export default function Financement() {
  const { data: offers, isLoading } = useQuery({
    queryKey: ['financing-offers'],
    queryFn: () => api.get('/financement/offers').then((r) => r.data),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-green rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 py-5 lg:px-0 lg:py-0 space-y-4 lg:space-y-5">
      <div>
        <h2 className="text-lg lg:text-2xl font-black text-gray-900">💰 Opportunités</h2>
        <p className="text-xs lg:text-sm text-gray-400 mt-0.5">Offres personnalisées selon votre score et profil</p>
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-4 lg:space-y-0">
        {offers?.map((o) => {
          const isEligible = o.eligible;
          return (
            <div key={o.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isEligible ? 'border-green-100' : 'border-yellow-100'}`}>
              <div className={`px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between ${isEligible ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center text-sm lg:text-base font-black text-white ${isEligible ? 'bg-sedo-green' : 'bg-yellow-500'}`}>
                    {o.logo}
                  </div>
                  <div>
                    <p className="font-bold text-sm lg:text-base text-gray-900">{o.name}</p>
                    <p className="text-[10px] lg:text-xs text-gray-400">{o.subtitle}</p>
                  </div>
                </div>
                <span className={`text-[10px] lg:text-xs font-bold px-2 py-1 rounded-full ${isEligible ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {isEligible ? '✅ Compatible' : `⚠️ Score : ${o.minScore}`}
                </span>
              </div>

              <div className="p-4 lg:p-6 grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                <div><p className="text-[10px] lg:text-xs text-gray-400 uppercase">Montant max</p><p className="text-xs lg:text-sm font-bold text-gray-800 mt-0.5">{formatFCFA(o.maxAmount)}</p></div>
                <div><p className="text-[10px] lg:text-xs text-gray-400 uppercase">Type</p><p className="text-xs lg:text-sm font-bold text-gray-800 mt-0.5">{o.offerType === 'subvention' ? 'Subvention' : 'Crédit'}</p></div>
                {o.rate && <div><p className="text-[10px] lg:text-xs text-gray-400 uppercase">Taux</p><p className="text-xs lg:text-sm font-bold text-gray-800 mt-0.5">{o.rate}% / an</p></div>}
                {o.duration && <div><p className="text-[10px] lg:text-xs text-gray-400 uppercase">Durée</p><p className="text-xs lg:text-sm font-bold text-gray-800 mt-0.5">{o.duration}</p></div>}
                <div><p className="text-[10px] lg:text-xs text-gray-400 uppercase">Score requis</p><p className="text-xs lg:text-sm font-bold text-gray-800 mt-0.5">{o.minScore}+ {isEligible ? '✓' : `(−${o.gapToEligibility} pts)`}</p></div>
                {o.sector && <div><p className="text-[10px] lg:text-xs text-gray-400 uppercase">Secteur</p><p className="text-xs lg:text-sm font-bold text-gray-800 mt-0.5">{o.sector}</p></div>}
              </div>

              <div className="px-4 lg:px-6 pb-4 lg:pb-5">
                <button className={`w-full py-3 lg:py-4 rounded-xl text-sm lg:text-base font-bold transition-all active:scale-95 ${isEligible ? 'bg-sedo-green text-white' : 'bg-yellow-500 text-white'}`}>
                  {isEligible
                    ? o.offerType === 'subvention' ? '🎁 Postuler maintenant' : `📞 Contacter ${o.provider}`
                    : '🔒 Améliorer votre score'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
    <div className="px-4 py-5 space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900">💰 Opportunités</h2>
        <p className="text-xs text-gray-400 mt-0.5">Offres personnalisées selon votre score et profil</p>
      </div>

      {offers?.map((o) => {
        const isEligible = o.eligible;
        const color = isEligible ? 'green' : 'yellow';
        return (
          <div key={o.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isEligible ? 'border-green-100' : 'border-yellow-100'}`}>
            <div className={`px-4 py-2 flex items-center justify-between ${isEligible ? 'bg-green-50' : 'bg-yellow-50'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white ${isEligible ? 'bg-sedo-green' : 'bg-yellow-500'}`}>
                  {o.logo}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{o.name}</p>
                  <p className="text-[10px] text-gray-400">{o.subtitle}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${isEligible ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {isEligible ? '✅ Compatible' : `⚠️ Score requis : ${o.minScore}`}
              </span>
            </div>

            <div className="p-4 grid grid-cols-2 gap-2">
              <div><p className="text-[10px] text-gray-400 uppercase">Montant max</p><p className="text-xs font-bold text-gray-800 mt-0.5">{formatFCFA(o.maxAmount)}</p></div>
              <div><p className="text-[10px] text-gray-400 uppercase">Type</p><p className="text-xs font-bold text-gray-800 mt-0.5">{o.offerType === 'subvention' ? 'Subvention (don)' : 'Crédit'}</p></div>
              {o.rate && <div><p className="text-[10px] text-gray-400 uppercase">Taux</p><p className="text-xs font-bold text-gray-800 mt-0.5">{o.rate}% / an</p></div>}
              {o.duration && <div><p className="text-[10px] text-gray-400 uppercase">Durée</p><p className="text-xs font-bold text-gray-800 mt-0.5">{o.duration}</p></div>}
              <div><p className="text-[10px] text-gray-400 uppercase">Score requis</p><p className="text-xs font-bold text-gray-800 mt-0.5">{o.minScore}+ {isEligible ? '✓' : `(il manque ${o.gapToEligibility} pts)`}</p></div>
              {o.sector && <div><p className="text-[10px] text-gray-400 uppercase">Secteur</p><p className="text-xs font-bold text-gray-800 mt-0.5">{o.sector}</p></div>}
            </div>

            <div className="px-4 pb-4">
              <button className={`w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${isEligible ? 'bg-sedo-green text-white' : 'bg-yellow-500 text-white'}`}>
                {isEligible
                  ? o.offerType === 'subvention' ? '🎁 Postuler maintenant' : `📞 Contacter ${o.provider}`
                  : '🔒 Améliorer votre score'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

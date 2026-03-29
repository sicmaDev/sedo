import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatFCFA } from '@/lib/utils';

const criteriaConfig = [
  { key: 'mobileMoney', label: 'Mobile Money', pct: 30 },
  { key: 'comptabilite', label: 'Comptabilité', pct: 25 },
  { key: 'formalisation', label: 'Formalisation', pct: 25 },
  { key: 'profilSectoriel', label: 'Profil sectoriel', pct: 20 },
];

export default function Dossier() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['imf-dossier', id],
    queryFn: () => api.get(`/imf/mpme/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-blue rounded-full animate-spin" />
    </div>
  );
  if (!data) return <p className="text-center text-gray-400 py-8">Dossier introuvable</p>;

  const score = data.score;
  const total = score?.total ?? 0;

  return (
    <div className="px-4 py-5 lg:px-0 lg:py-0 space-y-4 lg:space-y-6">
      <button onClick={() => navigate('/imf/mpme')} className="flex items-center gap-1 text-sedo-blue text-sm lg:text-base font-medium">
        ‹ Retour à la liste
      </button>

      <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-4 lg:space-y-0">
        {/* Infos */}
        <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm lg:text-base text-gray-800 mb-3 lg:mb-4">👤 Informations entrepreneur</h3>
          <div className="grid grid-cols-2 gap-2 lg:gap-3">
            {[
              ['Nom complet', data.fullName],
              ['Téléphone', data.phone || '—'],
              ['Secteur', data.sector],
              ['Ancienneté', `${new Date().getFullYear() - data.createdYear} ans (${data.createdYear})`],
              ['Localisation', data.location],
              ['Effectif', `${data.employees} employé${data.employees > 1 ? 's' : ''}`],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-xl p-3 lg:p-4">
                <p className="text-[10px] lg:text-xs text-gray-400">{k}</p>
                <p className="text-xs lg:text-sm font-semibold text-gray-800 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Score détaillé */}
        {score && (
          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-sm lg:text-base text-gray-800 mb-3 lg:mb-4">💯 Score détaillé : {total}/100</h3>
            <div className="space-y-3 lg:space-y-4">
              {criteriaConfig.map((c) => {
                const val = score[c.key] ?? 0;
                return (
                  <div key={c.key}>
                    <div className="flex justify-between text-xs lg:text-sm mb-1">
                      <span className="text-gray-600 font-medium">{c.label} <span className="text-gray-400">({c.pct}%)</span></span>
                      <span className="font-black text-sedo-blue">{Math.round(val)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 lg:h-3">
                      <div className="bg-sedo-blue h-2 lg:h-3 rounded-full" style={{ width: `${val}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Historique financier */}
      {data.history && (
        <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm lg:text-base text-gray-800 mb-3 lg:mb-4">📊 Historique financier</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 text-xs lg:text-sm font-medium">Mois</th>
                  <th className="text-right pb-2 text-xs lg:text-sm font-medium">Recettes</th>
                  <th className="text-right pb-2 text-xs lg:text-sm font-medium">Marge</th>
                  <th className="text-right pb-2 text-xs lg:text-sm font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((h) => (
                  <tr key={h.month} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 lg:py-3 text-xs lg:text-sm font-medium text-gray-700">{h.month}</td>
                    <td className="py-2 lg:py-3 text-right text-xs lg:text-sm text-green-600 font-semibold">{formatFCFA(h.recettes)}</td>
                    <td className="py-2 lg:py-3 text-right text-xs lg:text-sm text-blue-600 font-semibold">{formatFCFA(h.marge)}</td>
                    <td className="py-2 lg:py-3 text-right text-xs lg:text-sm text-gray-500">{h.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommandation */}
      {score?.recommendation && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 lg:p-6">
          <p className="text-xs lg:text-sm font-bold text-sedo-green mb-1">✅ Recommandation SEDO</p>
          <p className="text-xs lg:text-sm text-green-700 leading-relaxed">{score.recommendation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 lg:space-y-3 lg:grid lg:grid-cols-3 lg:space-y-0 lg:gap-3">
        <button className="w-full py-3 lg:py-4 bg-sedo-blue text-white rounded-xl text-sm lg:text-base font-bold active:scale-95 transition-transform">✅ Approuver le dossier</button>
        <button className="w-full py-3 lg:py-4 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl text-sm lg:text-base font-bold active:scale-95 transition-transform">📋 Demander des informations</button>
        <button className="w-full py-3 lg:py-4 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm lg:text-base font-bold active:scale-95 transition-transform">❌ Refuser</button>
      </div>
    </div>
  );
}

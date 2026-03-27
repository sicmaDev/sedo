import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import api from '@/lib/api';
import { formatFCFA } from '@/lib/utils';

export default function Profil() {
  const { user, logout } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['mpme-profile'],
    queryFn: () => api.get('/mpme/profile').then((r) => r.data),
  });

  const { data: history } = useQuery({
    queryKey: ['tx-history'],
    queryFn: () => api.get('/transactions/history').then((r) => r.data),
  });

  const { data: score } = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get('/score').then((r) => r.data),
  });

  const initial = (user?.fullName || 'K')[0].toUpperCase();

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Avatar */}
      <div className="flex flex-col items-center py-4">
        <div className="w-20 h-20 bg-gradient-to-br from-sedo-green to-sedo-green-dark rounded-full flex items-center justify-center text-3xl text-white font-black shadow-lg">
          {initial}
        </div>
        <h2 className="font-black text-gray-900 text-lg mt-3">{user?.fullName}</h2>
        <p className="text-sm text-gray-400">{user?.phone || user?.email}</p>
        <div className="mt-2 flex gap-2">
          <span className="bg-green-100 text-sedo-green text-xs px-3 py-1 rounded-full font-bold">Score: {score?.total ?? '—'}/100</span>
          <span className="bg-blue-100 text-blue-600 text-xs px-3 py-1 rounded-full font-bold">MPME Active</span>
        </div>
      </div>

      {/* Infos */}
      {profile && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
          <h3 className="font-bold text-sm text-gray-800">👤 Informations entrepreneur</h3>
          {[
            ['Nom complet', user?.fullName],
            ['Email', user?.email],
            ['Téléphone', user?.phone || '—'],
            ['Entreprise', profile.company],
            ['Secteur', profile.sector],
            ['Ancienneté', `${new Date().getFullYear() - profile.createdYear} ans (depuis ${profile.createdYear})`],
            ['Localisation', profile.location],
            ['Effectif', `${profile.employees} employé${profile.employees > 1 ? 's' : ''}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-400">{k}</span>
              <span className="text-xs font-semibold text-gray-800">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Formalisation */}
      {profile && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm text-gray-800 mb-3">📋 Statut formalisation</h3>
          {[
            { label: 'IFU', status: profile.ifuStatus },
            { label: 'RCCM', status: profile.rccmStatus },
            { label: 'NPI', status: profile.npiStatus },
          ].map(({ label, status }) => (
            <div key={label} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-500">{label}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                status === 'Complet' ? 'bg-green-100 text-green-700' :
                status === 'En cours' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
              }`}>{status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Historique */}
      {history && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-bold text-sm text-gray-800 mb-3">📊 Historique — 6 derniers mois</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2">Mois</th>
                  <th className="text-right pb-2">Recettes</th>
                  <th className="text-right pb-2">Dépenses</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.month} className="border-b border-gray-50 last:border-0">
                    <td className="py-2 font-medium text-gray-700">{h.month}</td>
                    <td className="py-2 text-right text-green-600 font-semibold">{formatFCFA(h.recettes)}</td>
                    <td className="py-2 text-right text-red-500 font-semibold">{formatFCFA(h.depenses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button onClick={logout}
        className="w-full py-3 border-2 border-red-200 rounded-xl text-sm text-red-500 font-medium active:scale-95 transition-transform">
        🚪 Se déconnecter
      </button>
    </div>
  );
}

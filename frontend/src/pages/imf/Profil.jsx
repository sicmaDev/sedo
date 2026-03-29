import { useAuth } from '@/lib/AuthContext';

export default function IMFProfil() {
  const { user, logout } = useAuth();
  const initial = (user?.fullName || 'I')[0].toUpperCase();

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Avatar */}
      <div className="flex flex-col items-center py-4">
        <div className="w-20 h-20 bg-gradient-to-br from-sedo-blue to-blue-700 rounded-full flex items-center justify-center text-3xl text-white font-black shadow-lg">
          {initial}
        </div>
        <h2 className="font-black text-gray-900 text-lg mt-3">{user?.fullName}</h2>
        <p className="text-sm text-gray-400">{user?.email}</p>
        <div className="mt-2">
          <span className="bg-blue-100 text-blue-600 text-xs px-3 py-1 rounded-full font-bold">Institution Financière</span>
        </div>
      </div>

      {/* Infos */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
        <h3 className="font-bold text-sm text-gray-800">🏦 Informations institution</h3>
        {[
          ['Nom complet', user?.fullName],
          ['Email', user?.email],
          ['Téléphone', user?.phone || '—'],
          ['Institution', user?.imfProfile?.institution || '—'],
          ['Rôle', 'Institution de microfinance'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-400">{k}</span>
            <span className="text-xs font-semibold text-gray-800 text-right max-w-[60%]">{v}</span>
          </div>
        ))}
      </div>

      {/* Accès */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-bold text-sm text-gray-800 mb-3">🔐 Accès & permissions</h3>
        {[
          ['Tableau de bord', '✅ Accès complet'],
          ['Dossiers MPME', '✅ Accès complet'],
          ['Rapports', '✅ Accès complet'],
          ['Alertes', '✅ Accès complet'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
            <span className="text-xs text-gray-400">{k}</span>
            <span className="text-xs font-semibold text-green-600">{v}</span>
          </div>
        ))}
      </div>

      <button onClick={logout}
        className="w-full py-3 border-2 border-red-200 rounded-xl text-sm text-red-500 font-medium active:scale-95 transition-transform">
        🚪 Se déconnecter
      </button>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    navigate(user.role === 'imf' ? '/imf' : '/mpme');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sedo-green to-sedo-green-dark flex flex-col">
      <div className="flex items-center justify-center pt-16 pb-8 px-6">
        <div className="text-center">
          <img src="/sedo-icon-512.png" alt="SEDO" className="w-24 h-24 mx-auto mb-4 rounded-2xl shadow-lg" />
          <p className="text-green-100 text-sm mt-1 font-medium">Solution Intégrée d'Accompagnement des MPME</p>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 rounded-t-3xl pt-10 px-5 pb-8 flex flex-col gap-4">
        <p className="text-center text-gray-500 text-sm font-medium mb-2">Choisissez votre espace</p>

        <button onClick={() => navigate('/login')}
          className="bg-white rounded-2xl p-6 shadow-sm border border-green-100 text-left active:scale-95 transition-transform">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🌱</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">Espace MPME</h2>
              <p className="text-gray-500 text-sm mt-0.5">Gérez votre activité, suivez votre score et accédez au financement</p>
            </div>
            <span className="text-sedo-green text-xl">›</span>
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            {['📊 Comptabilité', '💯 Score', '💰 Financement'].map((tag) => (
              <span key={tag} className="text-xs bg-green-50 text-sedo-green px-2 py-1 rounded-full font-medium">{tag}</span>
            ))}
          </div>
        </button>

        <button onClick={() => navigate('/login')}
          className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 text-left active:scale-95 transition-transform">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">🏦</div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900">Espace Institution</h2>
              <p className="text-gray-500 text-sm mt-0.5">Tableau de bord IMF, gestion des dossiers et analyses</p>
            </div>
            <span className="text-sedo-blue text-xl">›</span>
          </div>
          <div className="flex gap-2 mt-4 flex-wrap">
            {['📋 Dossiers', '📈 Rapports', '🔔 Alertes'].map((tag) => (
              <span key={tag} className="text-xs bg-blue-50 text-sedo-blue px-2 py-1 rounded-full font-medium">{tag}</span>
            ))}
          </div>
        </button>

        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-4 mt-2 border border-gray-100">
          <p className="text-xs text-gray-500 text-center">
            ✨ <strong>SEDO</strong> fonctionne hors-ligne · Hackathon TechnoServe / Epitech Bénin 2026
          </p>
        </div>
      </div>
    </div>
  );
}

import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';

const isMobile = window.matchMedia('(max-width: 1024px)').matches
  || window.matchMedia('(display-mode: standalone)').matches;

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (user) {
    return <Navigate to={user.role === 'imf' ? '/imf' : '/mpme'} replace />;
  }

  if (isMobile) {
    const done = localStorage.getItem('sedo_onboarding_done');
    return <Navigate to={done ? '/login' : '/onboarding'} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sedo-green to-sedo-green-dark flex flex-col">
      <div className="flex items-center justify-center pt-14 pb-8 px-6">
        <div className="text-center">
          <img src="/sedo-logo-green.jpeg" alt="SEDO" className="h-20 mx-auto mb-3 object-contain" />
          <p className="text-green-100 text-sm font-medium">Solution Intégrée d'Accompagnement des MPME</p>
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

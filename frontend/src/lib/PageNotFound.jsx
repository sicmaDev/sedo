import { useNavigate } from 'react-router-dom';

export default function PageNotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="text-6xl mb-4">🔍</div>
      <h1 className="text-2xl font-black text-gray-900 mb-2">Page introuvable</h1>
      <p className="text-gray-400 text-sm mb-6 text-center">Cette page n'existe pas ou vous n'avez pas accès.</p>
      <button onClick={() => navigate('/')} className="px-6 py-3 bg-sedo-green text-white rounded-xl font-bold text-sm">
        Retour à l'accueil
      </button>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useAuth } from '@/lib/AuthContext';

const isMobile = window.matchMedia('(max-width: 1024px)').matches
  || window.matchMedia('(display-mode: standalone)').matches;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const user = await login(isMobile ? null : email, password, isMobile ? phone : null);
      if (isMobile && user.role === 'imf') {
        setError("L'espace IMF est réservé aux ordinateurs. Connectez-vous depuis un navigateur web.");
        setLoading(false);
        return;
      }
      navigate(user.role === 'imf' ? '/imf' : '/mpme');
    } catch (err) {
      setError(err.response?.data?.error || 'Identifiants incorrects');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sedo-green to-sedo-green-dark flex flex-col">
      <div className="flex items-center justify-center pt-16 pb-8 px-6">
        <div className="text-center">
          <img src="/sedo-icon-512.png" alt="SEDO" className="w-20 h-20 mx-auto mb-3 rounded-2xl shadow-lg" />
          <p className="text-green-100 text-xs mt-1">Connexion à votre espace</p>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 rounded-t-3xl pt-8 px-5 pb-8">
        <h2 className="text-xl font-black text-gray-900 mb-6">Se connecter</h2>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs text-red-600 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isMobile ? (
            <div>
              <label className="text-xs text-gray-500 font-medium">Téléphone</label>
              <div className="mt-1 border border-gray-200 rounded-xl px-4 py-3 bg-white focus-within:border-sedo-green">
                <PhoneInput
                  defaultCountry="BJ"
                  value={phone}
                  onChange={setPhone}
                  international
                  className="w-full text-sm outline-none"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-500 font-medium">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="kouassi@sedo.bj"
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sedo-green" />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 font-medium">Mot de passe</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sedo-green" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-sedo-green text-white rounded-xl font-bold text-sm disabled:opacity-60 active:scale-95 transition-transform">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {!isMobile && (
          <div className="mt-4 bg-green-50 rounded-xl p-3">
            <p className="text-xs font-bold text-sedo-green mb-1">Comptes de démo</p>
            <p className="text-xs text-green-700">MPME : kouassi@sedo.bj / sedo2026</p>
            <p className="text-xs text-green-700">IMF  : padme@sedo.bj / sedo2026</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-sedo-green font-semibold">S'inscrire</Link>
        </p>
      </div>
    </div>
  );
}

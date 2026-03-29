import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { useAuth } from '@/lib/AuthContext';

const isMobile = window.matchMedia('(max-width: 1024px)').matches
  || window.matchMedia('(display-mode: standalone)').matches;

const SECTORS = ['Commerce général', 'Agriculture', 'Artisanat', 'Transport', 'Restauration', 'Élevage', 'Services', 'Autre'];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState('mpme');
  const [phone, setPhone] = useState('');
  const [form, setForm] = useState({
    fullName: '', email: '', password: '',
    company: '', sector: 'Commerce général', location: 'Cotonou, Bénin',
    employees: '1', createdYear: String(new Date().getFullYear()),
    institution: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    if (role === 'mpme' && !phone) { setError('Le numéro de téléphone est requis'); setLoading(false); return; }
    if (role === 'imf' && !form.email) { setError("L'email est requis"); setLoading(false); return; }
    try {
      const payload = {
        ...form,
        role,
        ...(role === 'mpme' ? { phone } : { email: form.email }),
      };
      const user = await register(payload);
      navigate(user.role === 'imf' ? '/imf' : '/mpme');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'inscription');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sedo-green to-sedo-green-dark flex flex-col">
      <div className="flex items-center justify-center pt-12 pb-6 px-6">
        <div className="text-center">
          <img src="/sedo-icon-512.png" alt="SEDO" className="w-14 h-14 mx-auto mb-2 rounded-xl shadow-lg" />
          <h1 className="text-2xl font-black text-white">SEDO</h1>
        </div>
      </div>

      <div className="flex-1 bg-gray-50 rounded-t-3xl pt-6 px-5 pb-10">
        <h2 className="text-xl font-black text-gray-900 mb-4">Créer un compte</h2>

        {/* Choix du rôle — masqué sur mobile */}
        {!isMobile && (
          <div className="flex gap-2 mb-5">
            {[{ id: 'mpme', label: '🌱 MPME', sub: 'Entrepreneur' }, { id: 'imf', label: '🏦 Institution', sub: 'IMF / Banque' }].map((r) => (
              <button key={r.id} type="button" onClick={() => setRole(r.id)}
                className={`flex-1 py-3 rounded-xl border-2 text-sm font-bold transition-all ${role === r.id ? 'border-sedo-green bg-green-50 text-sedo-green' : 'border-gray-200 text-gray-400'}`}>
                {r.label}<br /><span className="text-xs font-normal">{r.sub}</span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs text-red-600 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Nom complet" type="text" value={form.fullName} onChange={set('fullName')} placeholder="Kouassi Ama" required />

          {/* MPME → téléphone | IMF → email */}
          {role === 'mpme' ? (
            <div>
              <label className="text-xs text-gray-500 font-medium">Téléphone</label>
              <div className="mt-1 border border-gray-200 rounded-xl px-4 py-3 bg-white focus-within:border-sedo-green [&_input]:outline-none [&_input]:border-none [&_input]:bg-transparent [&_input]:w-full [&_input]:text-sm">
                <PhoneInput
                  defaultCountry="BJ"
                  value={phone}
                  onChange={setPhone}
                  international
                />
              </div>
            </div>
          ) : (
            <Field label="Email" type="email" value={form.email} onChange={set('email')} placeholder="padme@institution.bj" required />
          )}

          <Field label="Mot de passe" type="password" value={form.password} onChange={set('password')} placeholder="Min. 6 caractères" required />

          {role === 'mpme' && <>
            <Field label="Nom de l'entreprise" type="text" value={form.company} onChange={set('company')} placeholder="Ets Kouassi Commerce" required />
            <div>
              <label className="text-xs text-gray-500 font-medium">Secteur d'activité</label>
              <select value={form.sector} onChange={set('sector')} required
                className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sedo-green bg-white">
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <Field label="Localisation" type="text" value={form.location} onChange={set('location')} placeholder="Cotonou, Bénin" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Nombre d'employés" type="number" value={form.employees} onChange={set('employees')} placeholder="1" />
              <Field label="Année de création" type="number" value={form.createdYear} onChange={set('createdYear')} placeholder="2021" />
            </div>
          </>}

          {role === 'imf' && (
            <Field label="Nom de l'institution" type="text" value={form.institution} onChange={set('institution')} placeholder="PADME Microfinance" required />
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-sedo-green text-white rounded-xl font-bold text-sm disabled:opacity-60 active:scale-95 transition-transform mt-2">
            {loading ? 'Inscription...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-5">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-sedo-green font-semibold">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <input {...props} className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sedo-green" />
    </div>
  );
}

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import PageNotFound from '@/lib/PageNotFound';

import Home from '@/pages/Home';
import Login from '@/pages/Login';
import Register from '@/pages/Register';

import MPMELayout from '@/components/MPMELayout';
import MPMEDashboard from '@/pages/mpme/Dashboard';
import Comptabilite from '@/pages/mpme/Comptabilite';
import Score from '@/pages/mpme/Score';
import Financement from '@/pages/mpme/Financement';
import Profil from '@/pages/mpme/Profil';

import IMFLayout from '@/components/IMFLayout';
import IMFDashboard from '@/pages/imf/Dashboard';
import IMFMpme from '@/pages/imf/MPME';
import Dossier from '@/pages/imf/Dossier';
import Rapports from '@/pages/imf/Rapports';
import Alertes from '@/pages/imf/Alertes';
import IMFProfil from '@/pages/imf/Profil';
import Onboarding from '@/pages/Onboarding';

function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-green rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-green rounded-full animate-spin" />
    </div>
  );

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={user ? <Navigate to={user.role === 'imf' ? '/imf' : '/mpme'} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={user.role === 'imf' ? '/imf' : '/mpme'} /> : <Register />} />

      {/* Onboarding public */}
      <Route path="/onboarding" element={<Onboarding />} />

      {/* Espace MPME */}
      <Route element={<ProtectedRoute role="mpme"><MPMELayout /></ProtectedRoute>}>
        <Route path="/mpme" element={<MPMEDashboard />} />
        <Route path="/mpme/comptabilite" element={<Comptabilite />} />
        <Route path="/mpme/score" element={<Score />} />
        <Route path="/mpme/financement" element={<Financement />} />
        <Route path="/mpme/profil" element={<Profil />} />
      </Route>

      {/* Espace IMF */}
      <Route element={<ProtectedRoute role="imf"><IMFLayout /></ProtectedRoute>}>
        <Route path="/imf" element={<IMFDashboard />} />
        <Route path="/imf/mpme" element={<IMFMpme />} />
        <Route path="/imf/dossier/:id" element={<Dossier />} />
        <Route path="/imf/rapports" element={<Rapports />} />
        <Route path="/imf/alertes" element={<Alertes />} />
        <Route path="/imf/profil" element={<IMFProfil />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

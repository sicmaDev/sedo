import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Home, BarChart2, Award, Wallet, User, BookOpen, ClipboardList } from 'lucide-react';

const tabs = [
  { path: '/mpme', label: 'Accueil', Icon: Home, exact: true },
  { path: '/mpme/comptabilite', label: 'Comptabilité', Icon: BarChart2 },
  { path: '/mpme/formalisation', label: 'Formalisation', Icon: ClipboardList },
  { path: '/mpme/score', label: 'Score', Icon: Award },
  { path: '/mpme/financement', label: 'Financement', Icon: Wallet },
  { path: '/mpme/secteur', label: 'Secteur', Icon: BookOpen },
  { path: '/mpme/profil', label: 'Profil', Icon: User },
];

const pageTitles = {
  '/mpme': 'Tableau de bord',
  '/mpme/comptabilite': 'Comptabilité',
  '/mpme/formalisation': 'Formalisation',
  '/mpme/score': 'Score de finançabilité',
  '/mpme/financement': 'Opportunités de financement',
  '/mpme/secteur': 'Connaissance Sectorielle',
  '/mpme/profil': 'Mon profil',
};

export default function MPMELayout() {
  const { user, logout } = useAuth();
  const [topbarMenu, setTopbarMenu] = useState(false);
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || 'SEDO';


  const { data: score } = useQuery({
    queryKey: ['score'],
    queryFn: () => api.get('/score').then((r) => r.data),
  });

  const { data: profile } = useQuery({
    queryKey: ['mpme-profile'],
    queryFn: () => api.get('/mpme/profile').then((r) => r.data),
  });

  const sector = profile?.sector;
  const { data: sectorAlerts = 0 } = useQuery({
    queryKey: ['sector-alerts', sector],
    enabled: !!sector,
    queryFn: async () => {
      const seen = localStorage.getItem(`sedo_news_seen_${sector}`) || new Date(0).toISOString();
      const res = await api.get(`/sectors/${encodeURIComponent(sector)}/news/alerts?since=${seen}`);
      return res.data.count;
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-x-hidden w-full">

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-gray-100 fixed top-0 left-0 bottom-0 z-40 shadow-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <img src="/sedo-logo-white.jpeg" alt="SEDO" className="h-10 object-contain rounded-xl" />
          <p className="text-xs text-gray-400 ml-auto">Espace MPME</p>
        </div>

        {/* Score pill */}
        <div className="mx-4 mt-5 bg-gradient-to-r from-sedo-green to-sedo-green-dark rounded-2xl p-4 text-white">
          <p className="text-xs text-green-100">Score de finançabilité</p>
          <p className="text-3xl font-black mt-1">{score ? `${score.total}` : '—'}<span className="text-lg text-green-200">/100</span></p>
          <p className="text-xs text-green-200 mt-1">{profile?.company || user?.fullName}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 mt-5 space-y-1">
          {tabs.map((tab) => (
            <NavLink key={tab.path} to={tab.path} end={tab.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-green-50 text-sedo-green' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}>
              <div className="relative flex-shrink-0">
                <tab.Icon className="w-5 h-5" />
                {tab.path === '/mpme/secteur' && sectorAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>
              <span className="text-base">{tab.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-5 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sedo-green rounded-full flex items-center justify-center text-white font-black text-base">
              {(user?.fullName || 'U')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-72">

        {/* Header mobile */}
        <div className="lg:hidden bg-sedo-green text-white px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-30">
          <NavLink to="/" className="text-white opacity-80 text-lg">‹</NavLink>
          <div className="flex-1 flex items-center gap-2">
            <img src="/sedo-icon-white.jpeg" alt="SEDO" className="h-8 w-8 rounded-lg object-cover" />
            <p className="text-green-100 text-xs">{profile?.company || user?.fullName}</p>
          </div>
          <div className="bg-white/20 rounded-full px-3 py-1">
            <span className="text-xs font-bold">{score ? `${score.total}/100` : '—/100'}</span>
          </div>
        </div>

        {/* Topbar desktop */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
          <div>
            <h1 className="text-xl font-black text-gray-900">{pageTitle}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="bg-green-50 text-sedo-green rounded-xl px-4 py-2 text-sm font-bold">
              Score : {score ? `${score.total}/100` : '—'}
            </div>
            <button onClick={() => setTopbarMenu(!topbarMenu)}
              className="w-10 h-10 bg-sedo-green rounded-full flex items-center justify-center text-white font-black hover:opacity-90 transition-opacity">
              {(user?.fullName || 'U')[0]}
            </button>
            {topbarMenu && (
              <div className="absolute top-12 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 min-w-[180px]">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800 truncate">{user?.fullName}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                </div>
                <NavLink to="/mpme/profil" onClick={() => setTopbarMenu(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                  👤 Mon profil
                </NavLink>
                <button onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
                  🚪 Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-8 lg:px-8 lg:py-6 lg:w-full overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex shadow-lg z-50">
        {tabs.map((tab) => (
          <NavLink key={tab.path} to={tab.path} end={tab.exact}
            {...(tab.path === '/mpme/comptabilite' ? { 'data-guide': 'nav_compta' } : {})}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${isActive ? 'text-sedo-green' : 'text-gray-400'}`}>
            {({ isActive }) => (
              <>
                <div className="relative">
                  <tab.Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                  {tab.path === '/mpme/secteur' && sectorAlerts > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-sedo-green' : 'text-gray-400'}`}>{tab.label}</span>
                {isActive && <div className="w-1 h-1 bg-sedo-green rounded-full mt-0.5" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { LayoutDashboard, Users, TrendingUp, Bell, User, LogOut } from 'lucide-react';

const tabs = [
  { path: '/imf', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
  { path: '/imf/mpme', label: 'MPME', Icon: Users },
  { path: '/imf/rapports', label: 'Rapports', Icon: TrendingUp },
  { path: '/imf/alertes', label: 'Alertes', Icon: Bell },
  { path: '/imf/profil', label: 'Profil', Icon: User },
];

const pageTitles = {
  '/imf': 'Tableau de bord',
  '/imf/mpme': 'Liste des MPME',
  '/imf/rapports': 'Rapports & analyses',
  '/imf/alertes': 'Alertes',
  '/imf/profil': 'Mon profil',
};

export default function IMFLayout() {
  const { user, logout } = useAuth();
  const [topbarMenu, setTopbarMenu] = useState(false);
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || 'SEDO';

  const { data: stats } = useQuery({
    queryKey: ['imf-stats'],
    queryFn: () => api.get('/imf/stats').then((r) => r.data),
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-gray-100 fixed top-0 left-0 bottom-0 z-40 shadow-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <img src="/sedo-logo-white.jpeg" alt="SEDO" className="h-10 object-contain rounded-xl" />
          <p className="text-xs text-gray-400 ml-auto">Espace Institution</p>
        </div>

        {/* Stats pill */}
        <div className="mx-4 mt-5 bg-gradient-to-r from-sedo-blue to-blue-700 rounded-2xl p-4 text-white">
          <p className="text-xs text-blue-100">MPME éligibles</p>
          <p className="text-3xl font-black mt-1">{stats ? stats.eligible : '—'}</p>
          <p className="text-xs text-blue-200 mt-1">{stats ? `${stats.tauxEligibilite}% du total · ${stats.total} MPME` : 'Chargement...'}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 mt-5 space-y-1">
          {tabs.map((tab) => (
            <NavLink key={tab.path} to={tab.path} end={tab.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-sedo-blue' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}>
              <tab.Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-base">{tab.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-5 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sedo-blue rounded-full flex items-center justify-center text-white font-black text-base">
              {(user?.fullName || 'I')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.imfProfile?.institution || user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-72">

        {/* Header mobile */}
        <div className="lg:hidden bg-sedo-blue text-white px-4 py-3 flex items-center gap-3 shadow-sm sticky top-0 z-30">
          <NavLink to="/" className="text-white opacity-80 text-lg">‹</NavLink>
          <div className="flex-1">
            <h1 className="font-bold text-base leading-tight">Espace Institution</h1>
            <p className="text-blue-100 text-xs">{user?.imfProfile?.institution || user?.fullName}</p>
          </div>
          <div className="bg-white/20 rounded-full px-3 py-1">
            <span className="text-xs font-bold">{stats ? `${stats.eligible} MPME` : '—'}</span>
          </div>
        </div>

        {/* Topbar desktop */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100 sticky top-0 z-30">
          <div>
            <h1 className="text-xl font-black text-gray-900">{pageTitle}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="bg-blue-50 text-sedo-blue rounded-xl px-4 py-2 text-sm font-bold">
              {stats ? `${stats.eligible} MPME éligibles` : '—'}
            </div>
            <button onClick={() => setTopbarMenu(!topbarMenu)}
              className="w-10 h-10 bg-sedo-blue rounded-full flex items-center justify-center text-white font-black hover:opacity-90 transition-opacity">
              {(user?.fullName || 'I')[0]}
            </button>
            {topbarMenu && (
              <div className="absolute top-12 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 min-w-[180px]">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-800 truncate">{user?.fullName}</p>
                  <p className="text-xs text-gray-400 truncate">{user?.imfProfile?.institution || user?.email}</p>
                </div>
                <NavLink to="/imf/profil" onClick={() => setTopbarMenu(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                  <User className="w-4 h-4" /> Mon profil
                </NavLink>
                <button onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50">
                  <LogOut className="w-4 h-4" /> Se déconnecter
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-8 lg:px-8 lg:py-6 lg:w-full">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex shadow-lg z-50">
        {tabs.map((tab) => (
          <NavLink key={tab.path} to={tab.path} end={tab.exact}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${isActive ? 'text-sedo-blue' : 'text-gray-400'}`}>
            {({ isActive }) => (
              <>
                <tab.Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                <span className={`text-[10px] font-medium ${isActive ? 'text-sedo-blue' : 'text-gray-400'}`}>{tab.label}</span>
                {isActive && <div className="w-1 h-1 bg-sedo-blue rounded-full mt-0.5" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

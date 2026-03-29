import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const tabs = [
  { path: '/imf', label: 'Dashboard', icon: '📊', exact: true },
  { path: '/imf/mpme', label: 'MPME', icon: '👥' },
  { path: '/imf/rapports', label: 'Rapports', icon: '📈' },
  { path: '/imf/alertes', label: 'Alertes', icon: '🔔' },
  { path: '/imf/profil', label: 'Profil', icon: '👤' },
];

export default function IMFLayout() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['imf-stats'],
    queryFn: () => api.get('/imf/stats').then((r) => r.data),
  });

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 fixed top-0 left-0 bottom-0 z-40 shadow-sm">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
          <img src="/sedo-icon-512.png" alt="SEDO" className="w-10 h-10 rounded-xl" />
          <div>
            <p className="font-black text-gray-900 text-base leading-tight">SEDO</p>
            <p className="text-[10px] text-gray-400">Espace Institution</p>
          </div>
        </div>

        {/* Stats pill */}
        <div className="mx-4 mt-4 bg-gradient-to-r from-sedo-blue to-blue-700 rounded-xl p-3 text-white">
          <p className="text-[10px] text-blue-100">MPME éligibles</p>
          <p className="text-2xl font-black mt-0.5">{stats ? `${stats.eligible}` : '—'}</p>
          <p className="text-[10px] text-blue-200 mt-0.5">{stats ? `${stats.tauxEligibilite}% du total` : 'Chargement...'}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 mt-4 space-y-1">
          {tabs.map((tab) => (
            <NavLink key={tab.path} to={tab.path} end={tab.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-50 text-sedo-blue' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}>
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-sedo-blue rounded-full flex items-center justify-center text-white text-sm font-black">
              {(user?.fullName || 'I')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user?.fullName}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.imfProfile?.institution || user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-64">

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

        {/* Page content */}
        <main className="flex-1 pb-20 lg:pb-8 lg:px-6 lg:py-6 lg:max-w-5xl lg:w-full">
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
                <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>{tab.icon}</span>
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

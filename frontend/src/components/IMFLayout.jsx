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
];

export default function IMFLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['imf-stats'],
    queryFn: () => api.get('/imf/stats').then((r) => r.data),
  });

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-sedo-blue text-white px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <NavLink to="/" className="text-white opacity-80 text-lg">‹</NavLink>
        <div>
          <h1 className="font-bold text-base leading-tight">Espace Institution</h1>
          <p className="text-blue-100 text-xs">{user?.imfProfile?.institution || user?.fullName}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="bg-white/20 rounded-full px-3 py-1">
            <span className="text-xs font-bold">{stats ? `${stats.eligible} MPME` : '— MPME'}</span>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="hidden lg:flex flex-col gap-1 p-1">
            <span className="w-5 h-0.5 bg-white rounded" />
            <span className="w-5 h-0.5 bg-white rounded" />
            <span className="w-5 h-0.5 bg-white rounded" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="hidden lg:block absolute top-14 right-4 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50 min-w-[180px]">
          {tabs.map((tab) => (
            <NavLink key={tab.path} to={tab.path} end={tab.exact} onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${isActive ? 'text-sedo-blue bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span>{tab.icon}</span><span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20 lg:pb-4 lg:max-w-5xl lg:mx-auto lg:w-full">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex shadow-lg z-50 lg:hidden">
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

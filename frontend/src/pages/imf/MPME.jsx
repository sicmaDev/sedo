import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { scoreColor } from '@/lib/utils';

const tabs = ['Tous', 'Score 75+', 'Score 50-74', 'Score <50'];

export default function IMFMpme() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');

  const { data: mpmeList, isLoading } = useQuery({
    queryKey: ['imf-mpme'],
    queryFn: () => api.get('/imf/mpme').then((r) => r.data),
  });

  const filtered = (mpmeList ?? []).filter((m) => {
    const s = m.score ?? 0;
    const matchTab = activeTab === 0 ? true : activeTab === 1 ? s >= 75 : activeTab === 2 ? s >= 50 && s < 75 : s < 50;
    const matchSearch = !search || m.fullName?.toLowerCase().includes(search.toLowerCase()) || m.company?.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const scoreLabel = (s) => s >= 75 ? 'Éligible' : s >= 50 ? 'En progression' : 'Insuffisant';

  return (
    <div className="px-4 py-5 space-y-4">
      <div>
        <h2 className="text-lg font-black text-gray-900">👥 MPME qualifiées</h2>
        <p className="text-xs text-gray-400">Score et profil de finançabilité</p>
      </div>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher une MPME..."
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sedo-blue" />

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeTab === i ? 'bg-sedo-blue text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
            {t} {i === 0 ? `(${mpmeList?.length ?? 0})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-blue rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Aucune MPME trouvée</p>}
          {filtered.map((m) => {
            const s = m.score ?? 0;
            return (
              <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-sedo-blue font-black text-sm">
                      {(m.fullName || '?')[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900">{m.fullName}</p>
                      <p className="text-[10px] text-gray-400">{m.company}</p>
                    </div>
                  </div>
                  <div className={`flex flex-col items-center px-2 py-1 rounded-xl ${scoreColor(s)}`}>
                    <span className="font-black text-sm">{s}</span>
                    <span className="text-[9px] font-medium">{scoreLabel(s)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">{m.sector} · {m.location}</span>
                  <button onClick={() => navigate(`/imf/dossier/${m.id}`)}
                    className="text-xs text-sedo-blue font-semibold px-3 py-1.5 bg-blue-50 rounded-xl active:scale-95 transition-transform">
                    Voir →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

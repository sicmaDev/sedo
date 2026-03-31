import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  BookOpen, Users, ShoppingCart, TrendingUp, Scale, Lightbulb,
  Volume2, VolumeX, WifiOff, RefreshCw, ChevronDown, ChevronUp,
  Bell, Info, AlertTriangle, Sparkles, X, ChevronRight,
} from 'lucide-react';

const CACHE_KEY = (sector) => `sedo_sector_${sector}`;
const NEWS_CACHE_KEY = (sector) => `sedo_news_${sector}`;
const NEWS_SEEN_KEY = (sector) => `sedo_news_seen_${sector}`;
const CACHE_TTL = 24 * 60 * 60 * 1000;
const NEWS_TTL  =  1 * 60 * 60 * 1000;

function getCached(key, ttl = CACHE_TTL) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > ttl) return null;
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// ─── Bottom Sheet ──────────────────────────────────────────────────────────────
function BottomSheet({ item, onClose }) {
  useEffect(() => {
    if (item) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [item]);

  if (!item) return null;

  const { Icon, iconColor, tag, title, subtitle, detail } = item;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[80]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-[90] max-h-[80vh] flex flex-col">
        {/* Handle */}
        <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pb-4 border-b border-gray-100 flex items-start gap-3">
          {Icon && (
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor || 'bg-green-50'}`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {tag && <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{tag}</span>}
            <h3 className="font-black text-gray-900 text-base leading-tight mt-0.5">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 flex-shrink-0 ml-1">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm text-gray-700 leading-relaxed">{detail}</p>
        </div>

        {/* Safe area bottom */}
        <div className="flex-shrink-0 pb-6" />
      </div>
    </>
  );
}

// ─── Section accordion ─────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children, color = 'text-sedo-green', badge }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${color}`} />
          <h3 className="font-bold text-sm lg:text-base text-gray-800">{title}</h3>
          {badge > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 lg:px-6 lg:pb-5">{children}</div>}
    </div>
  );
}

const NEWS_STYLES = {
  alerte:      { Icon: AlertTriangle, bg: 'bg-red-50 border-red-100',    text: 'text-red-600',    label: 'Alerte' },
  opportunite: { Icon: Sparkles,      bg: 'bg-green-50 border-green-100', text: 'text-sedo-green', label: 'Opportunité' },
  info:        { Icon: Info,          bg: 'bg-blue-50 border-blue-100',   text: 'text-blue-600',   label: 'Info' },
};

export default function Secteur() {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null);

  const { data: profile } = useQuery({
    queryKey: ['mpme-profile'],
    queryFn: () => api.get('/mpme/profile').then((r) => r.data),
  });

  const sector = profile?.sector;

  const { data: sheet, isLoading, isError, refetch } = useQuery({
    queryKey: ['sector-sheet', sector],
    enabled: !!sector,
    queryFn: async () => {
      try {
        const res = await api.get(`/sectors/${encodeURIComponent(sector)}/sheet`);
        setCache(CACHE_KEY(sector), res.data);
        return res.data;
      } catch {
        const cached = getCached(CACHE_KEY(sector));
        if (cached) return cached;
        throw new Error('offline');
      }
    },
    initialData: () => getCached(CACHE_KEY(sector)) ?? undefined,
    staleTime: CACHE_TTL,
  });

  const { data: news = [] } = useQuery({
    queryKey: ['sector-news', sector],
    enabled: !!sector,
    queryFn: async () => {
      try {
        const res = await api.get(`/sectors/${encodeURIComponent(sector)}/news`);
        setCache(NEWS_CACHE_KEY(sector), res.data);
        return res.data;
      } catch {
        return getCached(NEWS_CACHE_KEY(sector), NEWS_TTL) ?? [];
      }
    },
    initialData: () => getCached(NEWS_CACHE_KEY(sector), NEWS_TTL) ?? undefined,
    staleTime: NEWS_TTL,
  });

  useEffect(() => {
    if (!sector) return;
    localStorage.setItem(NEWS_SEEN_KEY(sector), new Date().toISOString());
  }, [sector]);

  const lastSeen = sector ? localStorage.getItem(NEWS_SEEN_KEY(sector)) : null;
  const unreadAlerts = news.filter(
    (n) => n.type === 'alerte' && (!lastSeen || new Date(n.publishedAt) > new Date(lastSeen))
  ).length;

  const toggleAudio = () => {
    if (!sheet?.audioFile) return;
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      const audio = new Audio(`/audio/${sheet.audioFile}`);
      audioRef.current = audio;
      audio.play();
      setPlaying(true);
      audio.onended = () => setPlaying(false);
    }
  };

  if (isLoading || !profile) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-sedo-green rounded-full animate-spin" />
    </div>
  );

  if (isError && !sheet) return (
    <div className="px-4 py-10 flex flex-col items-center gap-4 text-center">
      <WifiOff className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500 text-sm">Fiche indisponible hors-ligne.<br />Connectez-vous pour charger votre fiche secteur.</p>
      <button onClick={() => refetch()} className="flex items-center gap-2 text-sedo-green text-sm font-semibold">
        <RefreshCw className="w-4 h-4" /> Réessayer
      </button>
    </div>
  );

  return (
    <div className="px-4 py-5 lg:px-0 lg:py-0 space-y-4 lg:space-y-5">

      {/* Hero */}
      <div className="bg-gradient-to-br from-sedo-green to-sedo-green-dark rounded-2xl p-5 lg:p-8 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-green-100 text-xs lg:text-sm mb-1">Votre secteur</p>
            <h2 className="text-xl lg:text-3xl font-black leading-tight">{sheet.title}</h2>
            <p className="text-green-200 text-xs lg:text-sm mt-2">
              Mise à jour : {new Date(sheet.updatedAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          {sheet.audioFile && (
            <button onClick={toggleAudio}
              className={`ml-4 w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${playing ? 'bg-white animate-pulse' : 'bg-white/20 hover:bg-white/30'}`}>
              {playing
                ? <VolumeX className="w-5 h-5 text-sedo-green" />
                : <Volume2 className="w-5 h-5 text-white" />}
            </button>
          )}
        </div>
      </div>

      {/* Actualités & Alertes */}
      {news.length > 0 && (
        <Section icon={Bell} title="Actualités & Alertes" color="text-red-500" badge={unreadAlerts}>
          <div className="space-y-3">
            {news.map((item) => {
              const style = NEWS_STYLES[item.type] || NEWS_STYLES.info;
              return (
                <button key={item.id} onClick={() => setSelected({
                  Icon: style.Icon,
                  iconColor: `${style.bg} ${style.text}`,
                  tag: style.label,
                  title: item.title,
                  subtitle: new Date(item.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
                  detail: item.body,
                })}
                  className={`w-full text-left rounded-xl border p-3 lg:p-4 ${style.bg} active:scale-[0.98] transition-transform`}>
                  <div className="flex items-center gap-2 mb-1">
                    <style.Icon className={`w-4 h-4 flex-shrink-0 ${style.text}`} />
                    <span className={`text-[10px] lg:text-xs font-bold uppercase tracking-wide ${style.text}`}>{style.label}</span>
                    <span className="text-[10px] lg:text-xs text-gray-400 ml-auto">
                      {new Date(item.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                  <p className="text-xs lg:text-sm text-gray-600 mt-1 leading-relaxed line-clamp-2">{item.body}</p>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Acteurs */}
      <Section icon={Users} title="Acteurs clés du secteur">
        <div className="space-y-1">
          {sheet.actors.map((a, i) => (
            <button key={i} onClick={() => setSelected({
              Icon: Users,
              iconColor: 'bg-green-50 text-sedo-green',
              tag: 'Acteur',
              title: a.role,
              subtitle: a.description,
              detail: a.details,
            })}
              className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors">
              <div className="w-2 h-2 rounded-full bg-sedo-green flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">{a.role}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{a.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      </Section>

      {/* Prix du marché */}
      <Section icon={ShoppingCart} title="Prix du marché" color="text-blue-500">
        <div className="space-y-1">
          {sheet.marketPrices.map((p, i) => (
            <button key={i} onClick={() => setSelected({
              Icon: ShoppingCart,
              iconColor: 'bg-blue-50 text-blue-500',
              tag: 'Prix du marché',
              title: p.item,
              subtitle: `${p.price} ${p.unit}`,
              detail: p.context,
            })}
              className="w-full text-left flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-50 last:border-0">
              <p className="text-sm text-gray-700">{p.item}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <p className="text-sm font-bold text-blue-600">
                  {p.price} <span className="font-normal text-gray-400">{p.unit}</span>
                </p>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>
          ))}
        </div>
        <p className="text-[10px] lg:text-xs text-gray-400 mt-3">Prix indicatifs — marché de Cotonou</p>
      </Section>

      {/* Tendances */}
      <Section icon={TrendingUp} title="Tendances & opportunités" color="text-purple-500">
        <p className="text-sm lg:text-base text-gray-600 leading-relaxed">{sheet.trends}</p>
      </Section>

      {/* Réglementation */}
      <Section icon={Scale} title="Réglementation essentielle" color="text-orange-500">
        <p className="text-sm lg:text-base text-gray-600 leading-relaxed">{sheet.regulation}</p>
      </Section>

      {/* Conseils */}
      <Section icon={Lightbulb} title="Conseils pratiques" color="text-yellow-500">
        <div className="space-y-2">
          {sheet.tips.map((tip, i) => {
            const text = tip.text || tip;
            const detail = tip.details;
            return (
              <button key={i} onClick={() => detail && setSelected({
                Icon: Lightbulb,
                iconColor: 'bg-yellow-50 text-yellow-500',
                tag: `Conseil ${i + 1}`,
                title: text,
                detail,
              })}
                className={`w-full text-left flex gap-3 bg-yellow-50 rounded-xl p-3 transition-colors ${detail ? 'active:bg-yellow-100 hover:bg-yellow-100' : ''}`}>
                <span className="text-yellow-500 font-black text-sm flex-shrink-0">{i + 1}</span>
                <p className="text-sm text-gray-700 flex-1">{text}</p>
                {detail && <ChevronRight className="w-4 h-4 text-yellow-400 flex-shrink-0 self-center" />}
              </button>
            );
          })}
        </div>
      </Section>

      {getCached(CACHE_KEY(sector)) && (
        <div className="flex items-center gap-2 text-xs text-gray-400 justify-center pb-2">
          <WifiOff className="w-3.5 h-3.5" /> Fiche disponible hors-ligne
        </div>
      )}

      {/* Bottom Sheet détail */}
      <BottomSheet item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

import React, { useEffect, useState, useRef } from 'react';
import { Users, FileText, Flag, Wifi, TrendingUp, UserCheck } from 'lucide-react';
import { useDictionary } from '../../utils/dictionary';

interface Stats {
  totalUsers: number; newUsersToday: number;
  totalPosts: number; newPostsToday: number;
  totalReports: number; onlineCount: number;
  dailyLogins: { date: string; count: number }[];
  weeklyPosts: { date: string; count: number }[];
}

interface Props { api: (path: string, opts?: RequestInit) => Promise<Response>; token: string; }

function MiniChart({ data, color, label }: { data: { date: string; count: number }[]; color: string; label: string }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: { date: string; count: number } } | null>(null);
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="relative flex items-end gap-1 h-12">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer group"
          onMouseEnter={e => setTooltip({ x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2, y: e.currentTarget.getBoundingClientRect().top, d })}
          onMouseLeave={() => setTooltip(null)}
        >
          <div
            className="w-full rounded-sm transition-all group-hover:opacity-100"
            style={{ height: `${Math.max((d.count / max) * 44, d.count > 0 ? 3 : 0)}px`, backgroundColor: color, opacity: 0.75 }}
          />
        </div>
      ))}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <div className="font-semibold">{tooltip.d.count.toLocaleString()} {label}</div>
          <div className="text-gray-400 text-[10px]">
            {new Date(tooltip.d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}

export default function StatsPage({ api, token }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [onlineHistory, setOnlineHistory] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const { t } = useDictionary();

  const fetchStats = async () => {
    const res = await api('/stats');
    if (res.ok) {
      const data: Stats = await res.json();
      setStats(data);
      setOnlineHistory(prev => [...prev.slice(-29), data.onlineCount]);
    }
  };

  useEffect(() => {
    fetchStats();
    intervalRef.current = setInterval(fetchStats, 5000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
    </div>
  );

  const cards = [
    { label: t('admin.totalUsers'), value: stats.totalUsers, sub: t('admin.newToday').replace('{n}', String(stats.newUsersToday)), icon: <Users size={20} />, color: '#5B65F2', bg: '#EEF0FF', isOnline: false },
    { label: t('admin.onlineNow'), value: stats.onlineCount, sub: t('admin.realtime'), icon: <Wifi size={20} />, color: '#10b981', bg: '#d1fae5', isOnline: true },
    { label: t('admin.totalPosts'), value: stats.totalPosts, sub: t('admin.newToday').replace('{n}', String(stats.newPostsToday)), icon: <FileText size={20} />, color: '#f59e0b', bg: '#fef3c7', isOnline: false },
    { label: t('admin.reportsToday'), value: stats.totalReports, sub: t('admin.waitingReview'), icon: <Flag size={20} />, color: '#ef4444', bg: '#fee2e2', isOnline: false },
  ];

  const maxOnline = Math.max(...onlineHistory, 1);

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: c.bg, color: c.color }}>
                {c.icon}
              </div>
              {c.isOnline && (
                <span className="flex items-center gap-1 text-[10px] text-green-600 font-medium">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-gray-900">{c.value.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>
            <div className="text-[11px] mt-1 font-medium" style={{ color: c.color }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Realtime Online Chart */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">{t('admin.onlineUsersRealtime')}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('admin.realtimeUpdate')}</p>
          </div>
          <div className="flex items-center gap-1.5 text-green-600 text-sm font-bold">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            {stats.onlineCount} {t('admin.userCol')}
          </div>
        </div>
        <div className="flex items-end gap-0.5 h-24">
          {onlineHistory.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all duration-500"
              style={{
                height: `${(v / maxOnline) * 88}px`,
                backgroundColor: i === onlineHistory.length - 1 ? '#10b981' : '#5B65F2',
                opacity: 0.3 + (i / onlineHistory.length) * 0.7,
              }}
              title={`${v} ${t('admin.userCol')}`}
            />
          ))}
        </div>
      </div>

      {/* Weekly Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck size={16} className="text-[#5B65F2]" />
            <h2 className="font-bold text-gray-900 text-sm">{t('admin.activityLast7Days')}</h2>
          </div>
          <MiniChart data={stats.dailyLogins} color="#5B65F2" label={t('admin.activeUsers')} />
          <div className="flex justify-between mt-2">
            {stats.dailyLogins.map((d, i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-gray-400">
                {new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-[#f59e0b]" />
            <h2 className="font-bold text-gray-900 text-sm">{t('admin.totalPosts')} ย้อนหลัง 7 วัน</h2>
          </div>
          <MiniChart data={stats.weeklyPosts} color="#f59e0b" label={t('admin.posts')} />
          <div className="flex justify-between mt-2">
            {stats.weeklyPosts.map((d, i) => (
              <div key={i} className="flex-1 text-center text-[9px] text-gray-400">
                {new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

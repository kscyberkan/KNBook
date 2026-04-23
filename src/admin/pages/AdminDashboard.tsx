import React, { useState } from 'react';
import { LayoutDashboard, Users, FileText, Flag, LogOut, Menu, ScrollText } from 'lucide-react';
import StatsPage from './StatsPage';
import UsersPage from './UsersPage';
import PostsPage from './PostsPage';
import ReportsPage from './ReportsPage';
import AuditLogPage from './AuditLogPage';

type Page = 'stats' | 'users' | 'posts' | 'reports' | 'logs';

interface Props { token: string; onLogout: () => void; }

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'stats',   label: 'ภาพรวม',   icon: <LayoutDashboard size={18} /> },
  { id: 'users',   label: 'ผู้ใช้งาน', icon: <Users size={18} /> },
  { id: 'posts',   label: 'โพสต์',     icon: <FileText size={18} /> },
  { id: 'reports', label: 'รายงาน',    icon: <Flag size={18} /> },
  { id: 'logs',    label: 'Audit Log', icon: <ScrollText size={18} /> },
];

export default function AdminDashboard({ token, onLogout }: Props) {
  const [page, setPage] = useState<Page>('stats');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const api = (path: string, opts?: RequestInit) =>
    fetch(`/api/admin${path}`, { ...opts, headers: { 'x-admin-token': token, 'Content-Type': 'application/json', ...(opts?.headers ?? {}) } });

  const renderPage = () => {
    switch (page) {
      case 'stats':   return <StatsPage api={api} token={token} />;
      case 'users':   return <UsersPage api={api} />;
      case 'posts':   return <PostsPage api={api} />;
      case 'reports': return <ReportsPage api={api} />;
      case 'logs':    return <AuditLogPage api={api} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className={`fixed inset-y-0 left-0 z-50 w-60 bg-gradient-to-b from-[#1a1d3a] to-[#2d3170] text-white flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}>
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#5B65F2] to-[#7B83F5] rounded-xl flex items-center justify-center font-black text-lg shadow-lg">K</div>
            <div>
              <div className="font-bold text-sm">KN Admin</div>
              <div className="text-[10px] text-white/40">Control Panel</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setPage(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${page === item.id ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/8 hover:text-white'}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-colors">
            <LogOut size={18} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
            <Menu size={20} />
          </button>
          <h1 className="font-bold text-gray-900 text-sm">{navItems.find(n => n.id === page)?.label}</h1>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{renderPage()}</main>
      </div>
    </div>
  );
}

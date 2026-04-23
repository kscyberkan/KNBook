import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface Log { id: number; action: string; targetId: number; postId: number | null; detail: string | null; createdAt: string; }

interface Props { api: (path: string, opts?: RequestInit) => Promise<Response>; }

const actionLabel: Record<string, { label: string; color: string }> = {
  ban_user:       { label: 'แบน User',      color: 'bg-red-100 text-red-700' },
  unban_user:     { label: 'ปลดแบน User',   color: 'bg-green-100 text-green-700' },
  delete_post:    { label: 'ลบโพสต์',       color: 'bg-orange-100 text-orange-700' },
  restore_post:   { label: 'กู้คืนโพสต์',   color: 'bg-blue-100 text-blue-700' },
  dismiss_report: { label: 'ปิดรายงาน',     color: 'bg-gray-100 text-gray-600' },
};

export default function AuditLogPage({ api }: Props) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async (p = page) => {
    setLoading(true);
    const res = await api(`/logs?page=${p}`);
    const data = await res.json();
    setLogs(data.logs); setTotal(data.total); setPages(data.pages);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(page); }, [page]);

  const downloadCSV = (type: 'users' | 'stats') => {
    const token = sessionStorage.getItem('admin_token') ?? '';
    const a = document.createElement('a');
    a.href = `/api/admin/export/${type}`;
    // fetch แล้ว download
    fetch(`/api/admin/export/${type}`, { headers: { 'x-admin-token': token } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url; a.download = `${type}.csv`; a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-4">
      {/* Export buttons */}
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-gray-400">ประวัติการดำเนินการทั้งหมด <span className="font-semibold text-gray-700">{total.toLocaleString()}</span> รายการ</p>
        <div className="flex gap-2">
          <button onClick={() => downloadCSV('users')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5B65F2]/10 hover:bg-[#5B65F2]/20 text-[#5B65F2] text-xs font-medium rounded-lg transition-colors">
            <Download size={13} /> Export Users CSV
          </button>
          <button onClick={() => downloadCSV('stats')} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium rounded-lg transition-colors">
            <Download size={13} /> Export Stats CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">ยังไม่มีประวัติการดำเนินการ</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map(log => {
              const meta = actionLabel[log.action] ?? { label: log.action, color: 'bg-gray-100 text-gray-600' };
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex-shrink-0 mt-0.5 ${meta.color}`}>{meta.label}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500">
                      <span>ID: {log.targetId}</span>
                      {log.postId && <span className="text-[#5B65F2]">โพสต์ #{log.postId}</span>}
                    </div>
                    {log.detail && <p className="text-xs text-gray-400 mt-0.5 truncate">{log.detail}</p>}
                  </div>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">
                    {new Date(log.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">หน้า {page} / {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

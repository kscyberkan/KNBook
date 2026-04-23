import React, { useEffect, useState } from 'react';
import { Trash2, X, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { modal } from '../../components/Modal';

interface Report {
  id: number; reason: string; createdAt: string;
  user: { id: number; name: string; profileImage: string | null };
  post: {
    id: number; text: string | null; imageUrl: string | null;
    user: { id: number; name: string };
    _count: { reports: number };
  };
}

interface Props { api: (path: string, opts?: RequestInit) => Promise<Response>; }

export default function ReportsPage({ api }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchReports = async (p = page) => {
    setLoading(true);
    const res = await api(`/reports?page=${p}`);
    const data = await res.json();
    setReports(data.reports); setTotal(data.total); setPages(data.pages);
    setLoading(false);
  };

  useEffect(() => { fetchReports(page); }, [page]);

  const deletePost = (report: Report) => {
    modal.confirm(`ลบโพสต์ของ "${report.post.user.name}" และปิดรายงานทั้งหมดของโพสต์นี้?`, async () => {
      await api('/posts/delete', { method: 'POST', body: JSON.stringify({ postId: report.post.id }) });
      fetchReports(page);
    }, 'ลบโพสต์');
  };

  const dismiss = (report: Report) => {
    modal.confirm('ปิดรายงานนี้โดยไม่ดำเนินการ?', async () => {
      await api('/reports/dismiss', { method: 'POST', body: JSON.stringify({ reportId: report.id }) });
      fetchReports(page);
    }, 'ปิดรายงาน');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-2">
        <Flag size={14} className="text-red-500" />
        <p className="text-xs text-gray-400">รายงานทั้งหมด <span className="font-semibold text-gray-700">{total.toLocaleString()}</span> รายการ</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Flag size={32} className="mb-2 opacity-30" />
            <p className="text-sm">ไม่มีรายงาน</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {reports.map(report => (
              <div key={report.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Reporter */}
                  <img
                    src={report.user.profileImage ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${report.user.name}`}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{report.user.name}</span>
                      <span className="text-xs text-gray-400">รายงาน</span>
                      <span className="text-sm font-semibold text-gray-900">{report.post.user.name}</span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(report.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Reason */}
                    <div className="mt-1.5 inline-flex items-center gap-1.5 bg-red-50 text-red-600 text-xs px-2.5 py-1 rounded-full font-medium">
                      <Flag size={10} />
                      {report.reason}
                    </div>

                    {/* Post preview */}
                    <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] text-gray-400">โพสต์ของ</span>
                        <span className="text-[11px] font-semibold text-gray-700">{report.post.user.name}</span>
                        {report.post._count.reports > 1 && (
                          <span className="text-[10px] text-red-500 font-medium">({report.post._count.reports} รายงาน)</span>
                        )}
                      </div>
                      {report.post.text && (
                        <p className="text-xs text-gray-600 line-clamp-2">{report.post.text}</p>
                      )}
                      {report.post.imageUrl && (
                        <img src={report.post.imageUrl} className="mt-1.5 h-16 w-auto rounded-lg object-cover" />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => deletePost(report)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        <Trash2 size={12} /> ลบโพสต์
                      </button>
                      <button
                        onClick={() => dismiss(report)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-colors"
                      >
                        <X size={12} /> ปิดรายงาน
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">หน้า {page} / {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

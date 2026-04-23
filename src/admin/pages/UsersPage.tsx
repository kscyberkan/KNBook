import React, { useEffect, useState } from 'react';
import { Search, Ban, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { modal } from '../../components/Modal';

interface User {
  id: number; name: string; username: string;
  profileImage: string | null; createdAt: string;
  banned: boolean; _count: { posts: number };
}

interface Props { api: (path: string, opts?: RequestInit) => Promise<Response>; }

export default function UsersPage({ api }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async (p = page, s = search) => {
    setLoading(true);
    const res = await api(`/users?page=${p}&search=${encodeURIComponent(s)}`);
    const data = await res.json();
    setUsers(data.users); setTotal(data.total); setPages(data.pages);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(1, search); setPage(1); }, [search]);
  useEffect(() => { fetchUsers(page, search); }, [page]);

  const toggleBan = async (user: User) => {
    const action = user.banned ? 'ปลดแบน' : 'แบน';
    modal.confirm(`ต้องการ${action} "${user.name}" ใช่หรือไม่?`, async () => {
      await api('/users/ban', { method: 'POST', body: JSON.stringify({ userId: user.id, banned: !user.banned }) });
      fetchUsers(page, search);
    }, action);
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อหรือ username..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B65F2]/20 focus:border-[#5B65F2]"
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">ทั้งหมด {total.toLocaleString()} คน</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-[#5B65F2]/30 border-t-[#5B65F2] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">ผู้ใช้</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden md:table-cell">Username</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">โพสต์</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 hidden lg:table-cell">สมัครเมื่อ</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">สถานะ</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50/50 transition-colors ${u.banned ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={u.profileImage ?? `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        />
                        <span className="font-medium text-gray-900 truncate max-w-[120px]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{u.username}</td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden sm:table-cell">{u._count.posts}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                      {new Date(u.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        u.banned ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                      }`}>
                        {u.banned ? <Ban size={10} /> : <CheckCircle size={10} />}
                        {u.banned ? 'แบน' : 'ปกติ'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleBan(u)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          u.banned
                            ? 'bg-green-50 text-green-600 hover:bg-green-100'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {u.banned ? 'ปลดแบน' : 'แบน'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
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

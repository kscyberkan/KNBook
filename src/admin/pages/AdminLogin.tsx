import React, { useState } from 'react';
import { Shield, Eye, EyeOff } from 'lucide-react';

interface Props { onLogin: (token: string) => void; }

export default function AdminLogin({ onLogin }: Props) {
  const [token, setToken] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/stats', { headers: { 'x-admin-token': token } });
    if (res.ok) {
      onLogin(token);
    } else {
      setError('Token ไม่ถูกต้อง');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1d3a] to-[#2d3170] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#5B65F2] to-[#7B83F5] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-[#5B65F2]/30">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">KN Admin</h1>
          <p className="text-sm text-gray-400 mt-1">เข้าสู่ระบบจัดการ</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Admin Token"
              className="w-full px-4 py-3 pr-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5B65F2]/30 focus:border-[#5B65F2]"
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={!token || loading}
            className="w-full py-3 bg-gradient-to-r from-[#5B65F2] to-[#7B83F5] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}

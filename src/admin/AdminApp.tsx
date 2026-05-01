import React, { useState } from 'react';
import { ModalProvider } from '../components/Modal';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import '../index.css';
import { DictionaryProvider } from '../utils/dictionary';

export function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') ?? '');

  const handleLogin = (t: string) => {
    sessionStorage.setItem('admin_token', t);
    setToken(t);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setToken('');
  };

  return (
    <DictionaryProvider>
      <ModalProvider />
      {token
        ? <AdminDashboard token={token} onLogout={handleLogout} />
        : <AdminLogin onLogin={handleLogin} />
      }
    </DictionaryProvider>
  );
}

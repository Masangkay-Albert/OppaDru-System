// src/modules/admin-side/pages/AdminLoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const success = await login(email, password);
    if (success) {
      navigate('/admin/dashboard');
    } else {
      setError('Invalid admin email or password');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${oppaDruLogo})` }} />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,22,16,0.90),rgba(46,122,69,0.78))]" />

      <div className="relative w-full max-w-sm rounded-[24px] border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-6 flex flex-col items-center">
          <img
            src={oppaDruLogo}
            alt="Oppa Dru"
            className="mb-3 h-16 w-16 rounded-full border-4 border-[var(--oppa-green-soft)] object-cover shadow-lg"
          />
          <h1 className="font-serif text-2xl font-bold text-[var(--oppa-text)]">Admin Portal</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Oppa Dru Korean Fried Chicken</p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
              placeholder="admin@oppadru.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="bg-oppa-gradient w-full rounded-lg py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="mt-4 w-full rounded-lg border border-[var(--oppa-border)] py-2 font-medium text-[var(--oppa-text)] transition hover:bg-[var(--oppa-cream)]"
        >
          Back to Landing Page
        </button>

        <p className="mt-6 text-center text-xs text-[var(--oppa-text-muted)]">
          Default demo credentials: admin@oppadru.com / Admin@123
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import LoginBrandPanel from '../../../components/LoginBrandPanel';

const AdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-[var(--oppa-cream)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Admin Portal" description="Oppa Dru Korean Fried Chicken" />

      <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="size-7 text-[var(--oppa-green)]" />
              <span className="text-2xl font-semibold text-[var(--oppa-green)]">
                Oppa Dru
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--oppa-green)] mb-2">
              Admin Portal
            </h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">
              Sign in to manage your store
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-8 space-y-5 shadow-lg border border-[var(--oppa-border)]"
          >
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Admin Email
              </label>
              <div className="admin-login-field relative flex h-12 items-center">
                <Mail aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4 transition-colors" />
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-full w-full rounded-[11px] border-0 bg-transparent py-2.5 pl-10 pr-4 text-sm outline-none focus:border-0 focus:outline-none focus:ring-0"
                  placeholder="admin@oppadru.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Password
              </label>
              <div className="admin-login-field relative flex h-12 items-center">
                <Lock aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4 transition-colors" />
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-full w-full rounded-[11px] border-0 bg-transparent py-2.5 pl-10 pr-12 text-sm outline-none focus:border-0 focus:outline-none focus:ring-0"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-500 hover:text-gray-800"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[var(--oppa-green)] text-white font-semibold rounded-xl hover:bg-[var(--oppa-green-dark)] transition-colors disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <button
            onClick={() => navigate("/login")}
            className="w-full mt-4 text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)] transition-colors flex items-center justify-center gap-1"
          >
            <ArrowLeft size={16} />
            Back to login options
          </button>
        </div>
      </main>
    </div>
  );
};

export default AdminLoginPage;
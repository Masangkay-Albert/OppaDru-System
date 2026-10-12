import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, Store } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import LoginBrandPanel from '../../../components/LoginBrandPanel';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';

const FranchiseLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useFranchiseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    const success = await login(email, password);
    if (success) {
      navigate('/franchise/dashboard');
      return;
    }

    setError('Invalid franchise email or password');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Franchise Portal" description="Oppa Dru Multi-Branch Operations" />

      <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <Store className="size-7 text-[var(--oppa-green)]" />
              <span className="text-2xl font-semibold text-[var(--oppa-green)]">Oppa Dru</span>
            </div>
            <h1 className="mb-2 text-2xl font-semibold text-[var(--oppa-green)]">Franchise Manager</h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">Sign in to your branch dashboard</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-[var(--oppa-border)] bg-white p-8 shadow-lg">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">Franchise Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                  placeholder="manager@oppadru.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-12 text-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] disabled:opacity-60"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[var(--oppa-text-muted)]">
            <Link to="/franchise-opportunities" className="font-medium text-[var(--oppa-green)] hover:underline">
              Apply for a franchise
            </Link>
            <button onClick={() => navigate('/login')} className="inline-flex items-center gap-1 hover:text-[var(--oppa-green)]">
              <ArrowLeft size={16} /> Back to login options
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FranchiseLoginPage;

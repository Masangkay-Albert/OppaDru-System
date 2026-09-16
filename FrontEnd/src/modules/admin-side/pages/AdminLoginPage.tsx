import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import heroSectionImg from '../../../assets/herosection.png';

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
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--oppa-green)] relative items-center justify-center overflow-hidden">
        <img
          src={heroSectionImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-10"
        />
        <div className="relative text-center px-12">
          <h2 className="text-4xl font-semibold text-white mb-4">
            Admin Portal
          </h2>
          <p className="text-white/70 font-serif text-xl max-w-sm mx-auto">
            Oppa Dru Korean Fried Chicken
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-[var(--oppa-cream)]">
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
              <label className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent"
                  placeholder="admin@oppadru.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
            onClick={() => navigate("/")}
            className="w-full mt-4 text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)] transition-colors flex items-center justify-center gap-1"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminLoginPage;
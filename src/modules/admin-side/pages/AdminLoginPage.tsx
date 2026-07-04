// src/modules/admin-side/pages/AdminLoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { Shield } from 'lucide-react';
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
    <div className="relative flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${oppaDruLogo})` }} />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(13,22,16,0.88),rgba(55,97,39,0.72))]" />
      <div className="relative w-full max-w-sm rounded-[24px] border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 rounded-full bg-lime-700 p-3 text-white shadow-lg">
            <Shield size={28} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Portal</h1>
          <p className="mt-1 text-sm text-gray-500">Oppa Dru Korean Fried Chicken</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
              placeholder="admin@oppadru.com"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-lime-700"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-lime-700 hover:bg-lime-800 text-white font-medium py-2 rounded-lg transition disabled:opacity-60"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-full mt-4 border border-gray-200 text-gray-700 font-medium py-2 rounded-lg hover:bg-gray-50 transition"
        >
          Back to Landing Page
        </button>

        <p className="text-xs text-gray-400 mt-6 text-center">
          Default demo credentials: admin@oppadru.com / Admin@123
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;

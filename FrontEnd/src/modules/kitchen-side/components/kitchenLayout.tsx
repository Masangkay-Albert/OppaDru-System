import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChefHat, LogOut } from 'lucide-react';
import { employeeAuth } from '../../../services/employeeAuth'; 

const KitchenLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    employeeAuth.logout();
    navigate('/staff/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[var(--oppa-cream)] via-[var(--oppa-cream)] to-[#f0f5ec]">
      {/* Simple Kitchen Header */}
      <header className="border-b border-[var(--oppa-border)] bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-xl font-bold tracking-tight text-[var(--oppa-green)]">Oppa Dru</h1>
            <span className="flex items-center gap-1 rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--oppa-green)]">
              <ChefHat size={13} /> Kitchen
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-[var(--oppa-text-muted)] transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-700 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </header>

      
      <main className="mx-auto w-full max-w-[1360px] flex-1 px-6 pb-8 pt-6">
        <div>
          {children}
        </div>
      </main>
    </div>
  );
};

export default KitchenLayout;
// src/modules/driver-side/components/DriverLayout.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Truck } from 'lucide-react';
import { useAuth } from '../../../contexts/Authcontext'; 

interface DriverLayoutProps {
  children: React.ReactNode;
}

const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { logout } = useAuth(); 

  const handleLogout = () => {
    if (logout) {
      logout();
    }
    navigate('/'); 
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--oppa-cream)] via-[var(--oppa-cream)] to-[#f0f5ec]">
      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-30 border-b border-[var(--oppa-border)] bg-white shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center justify-between px-4 md:px-6">
          
          {/* Logo & Portal Badge */}
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-xl font-bold tracking-tight text-[var(--oppa-green)]">
              Oppa Dru
            </h1>
            <span className="flex items-center gap-1 bg-[#e76f51] text-white text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
              <Truck size={12} />
              Driver
            </span>
          </div>

          {/* Actions */}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-[var(--oppa-text-muted)] transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-700 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
            title="Log out"
          >
            <span className="hidden sm:inline">Logout</span>
            <LogOut size={18} />
          </button>
          
        </div>
      </header>

      {/* Main Page Content */}
      <main className="mx-auto w-full max-w-[1360px] px-4 pb-8 pt-6 md:px-6">
        {children}
      </main>
    </div>
  );
};

export default DriverLayout;
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
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-30 bg-white shadow-sm border-b border-[#e76f51]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Portal Badge */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#2d6a4f] font-serif tracking-tight">
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
            className="flex items-center gap-2 text-[var(--oppa-text-muted)] hover:text-red-500 transition-colors text-sm font-medium"
            title="Log out"
          >
            <span className="hidden sm:inline">Logout</span>
            <LogOut size={18} />
          </button>
          
        </div>
      </header>

      {/* Main Page Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default DriverLayout;
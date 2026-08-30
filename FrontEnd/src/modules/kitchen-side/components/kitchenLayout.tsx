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
    <div className="min-h-screen bg-[var(--oppa-cream)] flex flex-col">
      {/* Simple Kitchen Header */}
      <header className="bg-white border-b border-[var(--oppa-border)] px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <ChefHat className="text-[var(--oppa-green)]" size={24} />
          <span className="font-bold text-[var(--oppa-green)] text-lg">Oppa Dru Kitchen</span>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </header>

      
      <main className="flex-1 p-6">
        <div className="mx-auto max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
};

export default KitchenLayout;
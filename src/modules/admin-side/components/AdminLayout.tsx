// src/modules/admin-side/components/AdminLayout.tsx
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Briefcase,
  FileBarChart,
  LogOut,
  Home,
  Menu,
  X,
} from 'lucide-react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/employees', label: 'Employees', icon: Briefcase },
  { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
];

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleExit = () => {
    logout();
    navigate('/admin/login');
  };

  const handleBackToLanding = () => {
    navigate('/');
  };

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex h-screen min-h-screen overflow-hidden bg-[var(--oppa-cream)]">
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={closeSidebar}
      />

      <aside
        className={`bg-oppa-gradient fixed inset-y-0 left-0 z-50 flex w-72 flex-col shadow-xl transition-transform duration-300 md:static md:w-64 md:translate-x-0 md:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-5 py-5 md:justify-start">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={oppaDruLogo}
              alt="Oppa Dru"
              className="h-10 w-10 flex-shrink-0 rounded-full border-2 border-white/25 object-cover shadow-sm"
            />
            <div className="min-w-0 leading-tight">
              <span className="block truncate font-serif text-base font-bold text-[var(--oppa-cream)]">
                Oppa Dru
              </span>
              <span className="block truncate text-xs font-medium text-[var(--oppa-cream)]/70">
                Admin Panel
              </span>
            </div>
          </div>
          <button
            className="rounded-lg p-2 text-[var(--oppa-cream)] hover:bg-white/10 md:hidden"
            onClick={closeSidebar}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-[var(--oppa-cream)] text-[var(--oppa-green-dark)] shadow-sm'
                    : 'text-[var(--oppa-cream)]/80 hover:bg-white/10 hover:text-[var(--oppa-cream)]'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-white/10 px-3 py-4">
          <button
            onClick={() => {
              closeSidebar();
              handleBackToLanding();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--oppa-cream)]/80 transition hover:bg-white/10 hover:text-[var(--oppa-cream)]"
          >
            <Home size={18} />
            Back to Landing
          </button>

          <button
            onClick={() => {
              closeSidebar();
              handleExit();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--oppa-cream)]/80 transition hover:bg-red-500/20 hover:text-red-100"
          >
            <LogOut size={18} />
            Exit
          </button>
        </div>
      </aside>

      <main className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--oppa-border)] bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm font-medium text-[var(--oppa-text)]"
          >
            <Menu size={18} />
            Menu
          </button>
          <div className="flex items-center gap-2">
            <img src={oppaDruLogo} alt="Oppa Dru" className="h-8 w-8 rounded-full object-cover" />
            <span className="font-serif text-sm font-bold text-[var(--oppa-text)]">Oppa Dru</span>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 sm:px-6">{children}</div>
      </main>
    </div>
  );
};

export default AdminLayout;

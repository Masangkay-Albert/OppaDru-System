import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShoppingCart,
  Store,
  Users,
  X,
} from 'lucide-react';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';

const navigation = [
  { to: '/franchise/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/franchise/pos', label: 'POS', icon: ShoppingCart },
  { to: '/franchise/orders', label: 'Orders', icon: ClipboardList },
  { to: '/franchise/inventory', label: 'Inventory', icon: Boxes },
  { to: '/franchise/reports', label: 'Reports', icon: BarChart3 },
  { to: '/franchise/users', label: 'Branch Users', icon: Users },
  { to: '/franchise/settings', label: 'Settings', icon: Settings },
];

const FranchiseLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { franchiseUser, logout } = useFranchiseAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const branchName = franchiseUser?.franchise?.name || 'Franchise Branch';

  const sidebar = (
    <>
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <img src={oppaDruLogo} alt="Oppa Dru" className="h-10 w-10 rounded-full border border-white/20 object-cover" />
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-bold text-white">Oppa Dru</p>
          <p className="text-xs text-white/65">Franchise Portal</p>
        </div>
        <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-white md:hidden" aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">Current branch</p>
        <p className="mt-1 flex items-center gap-2 truncate text-sm font-semibold text-white"><Store size={14} />{branchName}</p>
      </div>
      <nav aria-label="Franchise portal" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/franchise/dashboard'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white text-[var(--oppa-green-dark)] shadow-sm' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
          >
            <Icon size={17} />{label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        <p className="truncate text-xs font-semibold text-white">{franchiseUser?.full_name || franchiseUser?.email}</p>
        <p className="mb-3 truncate text-[11px] text-white/60">{franchiseUser?.email}</p>
        <button onClick={() => { logout(); navigate('/franchise/login'); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/80 hover:bg-red-500/20 hover:text-white"><LogOut size={16} /> Sign out</button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[var(--oppa-cream)]">
      {mobileOpen && <button aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`bg-oppa-gradient fixed inset-y-0 left-0 z-50 flex w-64 flex-col shadow-xl transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 md:shadow-none ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebar}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--oppa-border)] bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <button onClick={() => setMobileOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm font-medium"><Menu size={17} /> Menu</button>
          <div className="flex items-center gap-2"><img src={oppaDruLogo} alt="" className="h-7 w-7 rounded-full object-cover" /><span className="max-w-40 truncate text-sm font-semibold">{branchName}</span></div>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
};

export default FranchiseLayout;

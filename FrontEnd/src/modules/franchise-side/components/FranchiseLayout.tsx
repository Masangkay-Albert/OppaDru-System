import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronDown, ChevronsLeft, ChevronsRight, CircleHelp, ClipboardList, LayoutDashboard, LogOut, Menu, Megaphone, Moon, PackageCheck, Settings, Store, Sun, Users, WalletCards, X } from 'lucide-react';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';
import '../pages/FranchisePortalDesign.css';
import { RoleBadge } from './FranchisePortalUI';
import SearchInput from '../../../components/ui/SearchInput';

type Role = 'owner' | 'manager' | 'staff' | 'cashier';
type Item = { to: string; label: string; icon: React.ElementType; roles: Role[]; feature?: 'fees_enabled'; badge?: 'announcements' | 'stock' };
type Section = { title: string; items: Item[] };

const sections: Section[] = [
  { title: 'Overview', items: [{ to: '/franchise/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner', 'manager', 'staff', 'cashier'] }] },
  { title: 'Operations', items: [{ to: '/franchise/orders', label: 'Orders', icon: ClipboardList, roles: ['owner', 'manager', 'staff', 'cashier'] }, { to: '/franchise/menu-availability', label: 'Products', icon: PackageCheck, roles: ['owner', 'manager'] }] },
  { title: 'Business', items: [{ to: '/franchise/reports', label: 'Reports', icon: BarChart3, roles: ['owner', 'manager'] }, { to: '/franchise/fees-payments', label: 'Fees & Payments', icon: WalletCards, roles: ['owner'], feature: 'fees_enabled' }] },
  { title: 'My Franchise', items: [{ to: '/franchise/profile', label: 'Franchise Profile', icon: Store, roles: ['owner'] }, { to: '/franchise/users', label: 'Branch Users', icon: Users, roles: ['owner', 'manager'] }, { to: '/franchise/settings', label: 'Settings', icon: Settings, roles: ['owner'] }] },
  { title: 'Communication', items: [{ to: '/franchise/announcements', label: 'Announcements', icon: Megaphone, roles: ['owner', 'manager', 'staff', 'cashier'], badge: 'announcements' }, { to: '/franchise/support', label: 'Support & Resources', icon: CircleHelp, roles: ['owner', 'manager', 'staff', 'cashier'] }] },
];

const FRANCHISE_THEME_STORAGE_KEY = 'oppa-franchise-theme';

const roleOf = (value?: string, canPos?: boolean): Role => { const role = (value || (canPos ? 'owner' : 'staff')).toLowerCase(); return role.includes('owner') ? 'owner' : role.includes('manager') ? 'manager' : role.includes('cashier') ? 'cashier' : 'staff'; };

const FranchiseLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { franchiseUser, logout } = useFranchiseAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState<'profile' | null>(null);
  const [dark, setDark] = useState(() => localStorage.getItem(FRANCHISE_THEME_STORAGE_KEY) === 'dark');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const role = roleOf(franchiseUser?.role, franchiseUser?.can_process_pos);
  const branch = franchiseUser?.branch || franchiseUser?.franchise;
  const branchName = branch?.name || 'Franchise Branch';
  const feesEnabled = Boolean(branch?.fees_enabled);
  const visibleSections = useMemo(() => sections.map((section) => ({ ...section, items: section.items.filter((item) => item.roles.includes(role) && (!item.feature || feesEnabled)) })).filter((section) => section.items.length), [role, feesEnabled]);
  const visibleItems = useMemo(() => visibleSections.flatMap((section) => section.items), [visibleSections]);
  const matches = visibleItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  const pageName = visibleItems.find((item) => item.to === location.pathname)?.label || 'Franchise Portal';
  const userName = franchiseUser?.full_name || franchiseUser?.email || 'Franchise user';
  const count = (badge?: Item['badge']) => badge === 'announcements' ? 3 : null;
  const signOut = () => { void logout().finally(() => navigate('/franchise/login')); };
  useEffect(() => {
    const theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(FRANCHISE_THEME_STORAGE_KEY, theme);
  }, [dark]);
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);
  return <div className="franchise-shell flex min-h-dvh bg-[var(--oppa-cream)]">
    <button aria-label="Close navigation" tabIndex={mobileOpen ? 0 : -1} className={`fixed inset-0 z-40 bg-black/50 md:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setMobileOpen(false)} />
    <aside className={`bg-oppa-gradient fixed inset-y-0 left-0 z-50 flex w-72 flex-col shadow-xl transition-all md:sticky md:top-0 md:h-dvh md:translate-x-0 md:shadow-none ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[76px]' : 'md:w-64'}`}>
      <div className={`flex min-h-[76px] items-center gap-3 border-b border-white/15 px-4 ${collapsed ? 'md:justify-center md:px-2' : ''}`}><img src={oppaDruLogo} alt="Oppa Dru" className="size-10 shrink-0 rounded-full border-2 border-white/30 object-cover" /><div className={`min-w-0 leading-tight ${collapsed ? 'md:hidden' : ''}`}><span className="block font-serif text-base font-bold text-white">Oppa Dru</span><span className="block text-xs text-white/75">Franchise Portal</span></div><button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-white hover:bg-white/10 md:hidden"><X size={18} /></button></div>
      <div className={`border-b border-white/10 px-4 py-4 ${collapsed ? 'md:hidden' : ''}`}><div className="flex items-start gap-2"><Store size={15} className="mt-1 shrink-0 text-white/70" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/55">Current branch</p><p className="mt-1 line-clamp-2 text-[13px] font-semibold leading-5 text-white" title={branchName}>{branchName}</p><p className="mt-1 text-[11px] text-white/65"><span className={`mr-1.5 inline-block size-1.5 rounded-full ${branch?.status === 'suspended' ? 'bg-red-300' : 'bg-emerald-300'}`} />{branch?.status === 'suspended' ? 'Suspended' : 'Active'} · {branch?.id || franchiseUser?.branch_id || franchiseUser?.franchise_id || 'Branch ID pending'}</p></div></div></div>
      <nav aria-label="Franchise portal navigation" className="franchise-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-4">{visibleSections.map((section) => <section key={section.title}><h2 className={`mb-1 px-3 text-[11px] font-bold uppercase tracking-[.14em] text-white/70 ${collapsed ? 'md:sr-only' : ''}`}>{section.title}</h2><div className="space-y-1">{section.items.map(({ to, label, icon: Icon, badge }) => { const badgeCount = count(badge); return <NavLink key={to} to={to} end={to === '/franchise/dashboard'} title={collapsed ? label : undefined} onClick={() => { setMobileOpen(false); setMenu(null); }} className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${collapsed ? 'md:justify-center md:px-0' : ''} ${isActive ? 'bg-white text-[var(--oppa-green-dark)] shadow-sm' : 'text-white/85 hover:bg-white/10 hover:text-white'}`}><Icon size={18} aria-hidden="true" /><span className={collapsed ? 'md:sr-only' : ''}>{label}</span>{badgeCount !== null && <span className={`ml-auto rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 ${collapsed ? 'md:absolute md:-right-1 md:-top-1' : ''}`}>{badgeCount}</span>}{collapsed && <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-gray-950 px-2 py-1 text-xs text-white shadow-lg group-hover:block group-focus-visible:block">{label}</span>}</NavLink>; })}</div></section>)}</nav>
      <div className="space-y-1 border-t border-white/15 px-3 py-4"><div className={`mb-2 flex items-center gap-2 px-2 ${collapsed ? 'md:justify-center' : ''}`}><span className="flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">{(franchiseUser?.full_name || franchiseUser?.email || 'U').charAt(0).toUpperCase()}</span><div className={`min-w-0 ${collapsed ? 'md:hidden' : ''}`}><p className="truncate text-xs font-semibold text-white">{franchiseUser?.full_name || 'Franchise user'}</p><RoleBadge role={role} /></div></div><button onClick={signOut} title={collapsed ? 'Sign out' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-red-500/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${collapsed ? 'md:justify-center md:px-0' : ''}`}><LogOut size={18} /><span className={collapsed ? 'md:sr-only' : ''}>Sign out</span></button><button aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)} className="hidden w-full items-center justify-center rounded-xl py-2 text-white/70 hover:bg-white/10 md:flex">{collapsed ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /><span className="ml-2 text-xs">Collapse</span></>}</button></div>
    </aside>
    <main className="flex min-h-dvh min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-30 flex min-h-[68px] items-center gap-2 border-b border-[var(--oppa-border)] bg-[var(--oppa-surface)]/95 px-3 backdrop-blur sm:gap-3 sm:px-4">
        <button aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] md:hidden"><Menu size={20} /></button>
        <div className="hidden min-w-0 text-sm sm:block"><span className="text-[var(--oppa-text-muted)]">Franchise</span><span className="mx-2 text-[var(--oppa-border)]">/</span><span className="font-semibold text-[var(--oppa-text)]">{pageName}</span></div>
        <div className="relative ml-auto w-full max-w-sm">
          <SearchInput
            ref={searchInputRef}
            aria-label="Search franchise pages"
            value={query}
            onChange={(value) => { setQuery(value); setSearchOpen(true); }}
            onValueChange={(value) => { setQuery(value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchOpen(false);
              if (event.key === 'Enter') {
                const match = visibleItems.find((item) => item.label.toLowerCase().includes(event.currentTarget.value.toLowerCase()));
                if (match) { navigate(match.to); setSearchOpen(false); setQuery(''); }
              }
            }}
            placeholder="Search pages..."
          />
          {searchOpen && query && <div className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-1 shadow-xl">
            {matches.length ? matches.map((item) => <Link key={item.to} to={item.to} onClick={() => { setQuery(''); setSearchOpen(false); }} className="block rounded-lg px-3 py-2 text-sm text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]">{item.label}</Link>) : <p className="px-3 py-2 text-sm text-[var(--oppa-text-muted)]">No matching pages.</p>}
          </div>}
        </div>
        <button aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(!dark)} className="rounded-xl p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
        <div className="relative">
          <button aria-label="Open franchise user menu" aria-expanded={menu === 'profile'} onClick={() => setMenu(menu === 'profile' ? null : 'profile')} className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-[var(--oppa-cream)]">
            <span className="flex size-9 items-center justify-center rounded-full bg-[var(--oppa-green)] text-sm font-bold text-white">{userName.trim().charAt(0).toUpperCase()}</span>
            <span className="hidden max-w-40 text-left leading-tight lg:block"><span className="block truncate text-xs font-semibold text-[var(--oppa-text)]">{userName}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--oppa-text-muted)]">{branchName}</span></span>
            <ChevronDown size={15} className="hidden text-[var(--oppa-text-muted)] sm:block" />
          </button>
          {menu === 'profile' && <div className="absolute right-0 top-12 z-40 w-60 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-2 shadow-xl">
            <div className="border-b border-[var(--oppa-border)] px-3 py-2"><p className="truncate text-sm font-semibold text-[var(--oppa-text)]">{userName}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{franchiseUser?.email || 'Franchise account'}</p><RoleBadge role={role} className="mt-2" /></div>
            {role === 'owner' && <Link to="/franchise/profile" onClick={() => setMenu(null)} className="mt-1 block rounded-lg px-3 py-2 text-sm text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">Franchise Profile</Link>}
            <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"><LogOut size={15} />Sign out</button>
          </div>}
        </div>
      </header>
      <div className="min-w-0 flex-1">
        <div className="franchise-admin admin-page-enter mx-auto min-h-full w-full max-w-[1600px]">{children}</div>
      </div>
    </main>
  </div>;
};
export default FranchiseLayout;

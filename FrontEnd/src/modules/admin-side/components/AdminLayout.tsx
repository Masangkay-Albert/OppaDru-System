import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BadgeCheck, Bell, Briefcase, Car, ChevronDown, ChevronsLeft, ChevronsRight,
  FileBarChart, Home, LayoutDashboard, LogOut, Megaphone, Menu, Moon, Package,
  Search, SlidersHorizontal, ShoppingBag, Store, Sun, Tag, Users, X,
} from 'lucide-react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';
import { applyTheme, getSavedTheme } from '../../../services/theme';

interface AdminErrorBoundaryState { hasError: boolean }

class AdminErrorBoundary extends React.Component<React.PropsWithChildren, AdminErrorBoundaryState> {
  state: AdminErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError(): AdminErrorBoundaryState { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error('Admin page failed to render:', error); }
  render() {
    if (this.state.hasError) return (
      <div className="admin-card p-8 text-center">
        <h2 className="font-serif text-xl font-semibold text-[var(--oppa-text)]">This section is temporarily unavailable.</h2>
        <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">The rest of the admin panel is still available.</p>
        <button type="button" onClick={() => this.setState({ hasError: false })} className="mt-4 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white">Try again</button>
      </div>
    );
    return this.props.children;
  }
}

const navGroups = [
  { title: 'Overview', items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { title: 'Catalog', items: [{ to: '/admin/products', label: 'Products', icon: Package }, { to: '/admin/addons', label: 'Add-ons', icon: SlidersHorizontal }] },
  { title: 'Sales & Marketing', items: [{ to: '/admin/orders', label: 'Orders', icon: ShoppingBag }, { to: '/admin/promos', label: 'Promos', icon: Tag }, { to: '/admin/discount-approvals', label: 'Discount Approvals', icon: BadgeCheck }, { to: '/admin/reports', label: 'Reports', icon: FileBarChart }] },
  { title: 'Communication', items: [{ to: '/admin/announcements', label: 'Announcements', icon: Megaphone }] },
  { title: 'People', items: [{ to: '/admin/customers', label: 'Customers', icon: Users }, { to: '/admin/admins', label: 'Admins', icon: Users }, { to: '/admin/employees', label: 'Employees', icon: Briefcase }] },
  { title: 'Operations', items: [{ to: '/admin/franchises', label: 'Franchises', icon: Store }, { to: '/admin/franchise-applications', label: 'Franchise Apps', icon: BadgeCheck }, { to: '/admin/delivery', label: 'Delivery', icon: Car }] },
];

let adminSidebarScrollTop = 0;

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout, admin } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState<'notifications' | 'profile' | null>(null);
  const [dark, setDark] = useState(() => getSavedTheme() === 'dark');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = adminSidebarScrollTop;
  }, []);

  useEffect(() => {
    applyTheme(dark ? 'dark' : 'light');
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

  const allNav = useMemo(() => navGroups.flatMap((group) => group.items), []);
  const matches = allNav.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  const pageName = allNav.find((item) => item.to === location.pathname)?.label || 'Admin';
  const adminInitial = (admin?.fullName || 'A').trim().charAt(0).toUpperCase();
  const handleExit = () => { logout(); navigate('/admin/login'); };

  return (
    <div className="flex min-h-dvh bg-[var(--oppa-cream)]">
      <button aria-label="Close navigation" tabIndex={mobileOpen ? 0 : -1} className={`fixed inset-0 z-40 bg-black/55 transition-opacity md:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setMobileOpen(false)} />
      <aside className={`bg-oppa-gradient fixed inset-y-0 left-0 z-50 flex w-72 flex-col shadow-xl transition-all duration-200 md:sticky md:top-0 md:h-dvh md:shrink-0 md:translate-x-0 md:shadow-none ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[76px]' : 'md:w-64'}`}>
        <div className={`flex h-[76px] items-center gap-3 border-b border-white/15 px-4 ${collapsed ? 'md:justify-center md:px-2' : ''}`}>
          <img src={oppaDruLogo} alt="Oppa Dru" className="size-10 shrink-0 rounded-full border-2 border-white/30 object-cover" />
          <div className={`min-w-0 leading-tight ${collapsed ? 'md:hidden' : ''}`}>
            <span className="block truncate font-serif text-base font-bold text-white">Oppa Dru</span>
            <span className="block text-xs font-medium text-white/75">Admin Panel</span>
          </div>
          <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-white hover:bg-white/10 md:hidden"><X size={18} /></button>
        </div>
        <nav ref={navRef} aria-label="Admin navigation" onScroll={(event) => { adminSidebarScrollTop = event.currentTarget.scrollTop; }} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <section key={group.title}>
              <h2 className={`mb-1 px-3 text-[11px] font-bold uppercase tracking-[.14em] text-white/70 ${collapsed ? 'md:sr-only' : ''}`}>{group.title}</h2>
              <div className="space-y-1">
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} title={collapsed ? label : undefined} onClick={() => { setMobileOpen(false); setMenu(null); }}
                    className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${collapsed ? 'md:justify-center md:px-0' : ''} ${isActive ? 'bg-white text-[var(--oppa-green-dark)] shadow-sm' : 'text-white/85 hover:bg-white/10 hover:text-white'}`}>
                    <Icon size={18} aria-hidden="true" />
                    <span className={collapsed ? 'md:sr-only' : ''}>{label}</span>
                    {collapsed && <span role="tooltip" className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-md bg-gray-950 px-2 py-1 text-xs text-white shadow-lg group-hover:block group-focus-visible:block">{label}</span>}
                  </NavLink>
                ))}
              </div>
            </section>
          ))}
        </nav>
        <div className="space-y-1 border-t border-white/15 px-3 py-4">
          <button title={collapsed ? 'Back to Landing' : undefined} onClick={() => navigate('/')} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white ${collapsed ? 'md:justify-center md:px-0' : ''}`}><Home size={18} /><span className={collapsed ? 'md:sr-only' : ''}>Back to Landing</span></button>
          <button title={collapsed ? 'Exit' : undefined} onClick={handleExit} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-red-500/20 hover:text-white ${collapsed ? 'md:justify-center md:px-0' : ''}`}><LogOut size={18} /><span className={collapsed ? 'md:sr-only' : ''}>Exit</span></button>
          <button aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(!collapsed)} className="hidden w-full items-center justify-center rounded-xl py-2 text-white/70 hover:bg-white/10 md:flex">
            {collapsed ? <ChevronsRight size={18} /> : <><ChevronsLeft size={18} /><span className="ml-2 text-xs">Collapse</span></>}
          </button>
        </div>
      </aside>

      <main className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-[68px] items-center gap-3 border-b border-[var(--oppa-border)] bg-[var(--oppa-surface)]/95 px-4 backdrop-blur sm:px-6">
          <button aria-label="Open navigation" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] md:hidden"><Menu size={20} /></button>
          <div className="hidden min-w-0 text-sm md:block"><span className="text-[var(--oppa-text-muted)]">Admin</span><span className="mx-2 text-[var(--oppa-border)]">/</span><span className="font-semibold text-[var(--oppa-text)]">{pageName}</span></div>
          <div className="relative ml-auto w-full max-w-sm">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 text-[var(--oppa-text-muted)] focus-within:border-[var(--oppa-green)]">
              <Search size={16} aria-hidden="true" />
              <input ref={searchInputRef} aria-label="Search admin pages" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); if (event.key === 'Enter' && matches[0]) { navigate(matches[0].to); setSearchOpen(false); setQuery(''); } }} placeholder="Search pages..." className="admin-global-search-input w-full bg-transparent text-sm text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)]" />
              <kbd className="hidden shrink-0 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2 py-1 text-[10px] font-semibold text-[var(--oppa-text-muted)] sm:inline">Ctrl K</kbd>
            </label>
            {searchOpen && query && <div className="absolute left-0 right-0 top-12 overflow-hidden rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-1 shadow-xl">
              {matches.length ? matches.map((item) => <Link key={item.to} to={item.to} onClick={() => { setQuery(''); setSearchOpen(false); }} className="block rounded-lg px-3 py-2 text-sm text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]">{item.label}</Link>) : <p className="px-3 py-2 text-sm text-[var(--oppa-text-muted)]">No matching pages.</p>}
            </div>}
          </div>
          <button aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(!dark)} className="rounded-xl p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
          <div className="relative">
            <button aria-label="Notifications" aria-expanded={menu === 'notifications'} onClick={() => setMenu(menu === 'notifications' ? null : 'notifications')} className="relative rounded-xl p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]"><Bell size={19} /><span className="absolute right-1.5 top-1.5 size-2 rounded-full border-2 border-[var(--oppa-surface)] bg-[var(--oppa-yellow)]" /></button>
            {menu === 'notifications' && <div className="absolute right-0 top-12 w-64 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-xl"><p className="font-semibold text-[var(--oppa-text)]">Notifications</p><p className="mt-2 text-sm text-[var(--oppa-text-muted)]">You're all caught up.</p></div>}
          </div>
          <div className="relative">
            <button aria-label="Open admin profile menu" aria-expanded={menu === 'profile'} onClick={() => setMenu(menu === 'profile' ? null : 'profile')} className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-[var(--oppa-cream)]">
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--oppa-green)] text-sm font-bold text-white">{adminInitial}</span>
              <span className="hidden max-w-28 text-left leading-tight lg:block"><span className="block truncate text-xs font-semibold text-[var(--oppa-text)]">{admin?.fullName || 'Administrator'}</span><span className="block truncate text-[10px] capitalize text-[var(--oppa-text-muted)]">{admin?.role || 'Admin'}</span></span>
              <ChevronDown size={15} className="hidden text-[var(--oppa-text-muted)] sm:block" />
            </button>
            {menu === 'profile' && <div className="absolute right-0 top-12 w-60 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-2 shadow-xl">
              <div className="border-b border-[var(--oppa-border)] px-3 py-2"><p className="truncate text-sm font-semibold text-[var(--oppa-text)]">{admin?.fullName || 'Administrator'}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{admin?.email || 'Admin account'}</p></div>
              <Link to="/admin/admins" onClick={() => setMenu(null)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">Profile</Link>
              <Link to="/admin/settings/pricing" onClick={() => setMenu(null)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">Settings</Link>
              <button onClick={handleExit} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"><LogOut size={15} />Exit</button>
            </div>}
          </div>
        </header>
        <div className="px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8">
          <div className="admin-page-enter mx-auto w-full max-w-[1600px]">
            <AdminErrorBoundary>{children}</AdminErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;

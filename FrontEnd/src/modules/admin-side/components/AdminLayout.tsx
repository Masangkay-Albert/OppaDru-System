import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BadgeCheck, Boxes, Briefcase, Car, ChevronDown, ChevronsLeft, ChevronsRight,
  FileBarChart, Home, LayoutDashboard, LogOut, Megaphone, Menu, Moon, Package,
  SlidersHorizontal, ShoppingBag, Store, Sun, Tag, Users, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';
import { applyTheme, getSavedTheme } from '../../../services/theme';
import SearchInput from '../../../components/ui/SearchInput';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithAdminAuth, getStoredAdminToken } from '../../../services/adminAuthService';

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

interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: 'inventory' | 'replacements';
}

const navGroups: Array<{ title: string; items: AdminNavItem[] }> = [
  { title: 'Overview', items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard }] },
  { title: 'Catalog', items: [{ to: '/admin/products', label: 'Products', icon: Package }, { to: '/admin/addons', label: 'Add-ons', icon: SlidersHorizontal }] },
  { title: 'Sales & Marketing', items: [{ to: '/admin/orders', label: 'Orders', icon: ShoppingBag, badge: 'replacements' }, { to: '/admin/promos', label: 'Promos', icon: Tag }, { to: '/admin/discount-approvals', label: 'Discount Approvals', icon: BadgeCheck }, { to: '/admin/reports', label: 'Reports', icon: FileBarChart }] },
  { title: 'Communication', items: [{ to: '/admin/announcements', label: 'Announcements', icon: Megaphone }] },
  { title: 'People', items: [{ to: '/admin/customers', label: 'Customers', icon: Users }, { to: '/admin/admins', label: 'Admins', icon: Users }, { to: '/admin/employees', label: 'Employees', icon: Briefcase }] },
  { title: 'Operations', items: [{ to: '/admin/inventory', label: 'Inventory', icon: Boxes, badge: 'inventory' }, { to: '/admin/franchises', label: 'Franchises', icon: Store }, { to: '/admin/franchise-applications', label: 'Franchise Apps', icon: BadgeCheck }, { to: '/admin/delivery', label: 'Delivery', icon: Car }] },
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
  const [menu, setMenu] = useState<'profile' | null>(null);
  const [dark, setDark] = useState(() => getSavedTheme() === 'dark');
  const [inventoryAttentionCount, setInventoryAttentionCount] = useState(0);
  const [replacementWaitingCount, setReplacementWaitingCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    const loadInventoryAttention = async () => {
      try {
        if (!getStoredAdminToken()) {
          if (active) setInventoryAttentionCount(0);
          return;
        }

        const response = await fetchWithAdminAuth(`${API_URL}/admin/inventory/summary`);
        if (response.status === 401) {
          if (active) setInventoryAttentionCount(0);
          return;
        }

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Could not load inventory alert count.');
        if (active) setInventoryAttentionCount(Number(payload.data?.needs_restocking || 0));
      } catch {
        if (active) setInventoryAttentionCount(0);
      }
    };
    const refreshOnFocus = () => { void loadInventoryAttention(); };
    void loadInventoryAttention();
    window.addEventListener('inventory-updated', refreshOnFocus);
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      active = false;
      window.removeEventListener('inventory-updated', refreshOnFocus);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [location.pathname]);

  useEffect(() => {
    let active = true;
    const loadReplacementCount = async () => {
      try {
        if (!getStoredAdminToken()) {
          if (active) setReplacementWaitingCount(0);
          return;
        }
        const response = await fetchWithAdminAuth(`${API_URL}/admin/replacement-requests?status=pending`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Could not load replacement request count.');
        if (active) setReplacementWaitingCount(Number(payload.waiting_count || 0));
      } catch (error) {
        console.error('Could not load admin replacement request count:', error);
      }
    };
    const refresh = () => { void loadReplacementCount(); };
    void loadReplacementCount();
    window.addEventListener('focus', refresh);
    window.addEventListener('replacement-requests-updated', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('replacement-requests-updated', refresh);
    };
  }, [location.pathname]);

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

  const visibleNavGroups = useMemo(() => navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.to !== '/admin/admins' || admin?.role === 'system_administrator'),
    }))
    .filter((group) => group.items.length > 0), [admin?.role]);
  const allNav = useMemo(() => visibleNavGroups.flatMap((group) => group.items), [visibleNavGroups]);
  const matches = allNav.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  const pageName = allNav.find((item) => item.to === location.pathname || (item.to === '/admin/inventory' && location.pathname.startsWith('/admin/inventory/')))?.label || 'Admin';
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
          {visibleNavGroups.map((group) => (
            <section key={group.title}>
              <h2 className={`mb-1 px-3 text-[11px] font-bold uppercase tracking-[.14em] text-white/70 ${collapsed ? 'md:sr-only' : ''}`}>{group.title}</h2>
              <div className="space-y-1">
                {group.items.map(({ to, label, icon: Icon, badge }) => (
                  <NavLink key={to} to={to} title={collapsed ? label : undefined} onClick={() => { setMobileOpen(false); setMenu(null); }}
                    className={({ isActive }) => `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${collapsed ? 'md:justify-center md:px-0' : ''} ${isActive ? 'bg-white text-[var(--oppa-green-dark)] shadow-sm' : 'text-white/85 hover:bg-white/10 hover:text-white'}`}>
                    <Icon size={18} aria-hidden="true" />
                    <span className={collapsed ? 'md:sr-only' : ''}>{label}</span>
                    {badge === 'inventory' && inventoryAttentionCount > 0 && <span aria-label={`${inventoryAttentionCount} ingredients need restocking`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-950">{inventoryAttentionCount > 99 ? '99+' : inventoryAttentionCount}</span>}
                    {badge === 'replacements' && replacementWaitingCount > 0 && <span aria-label={`${replacementWaitingCount} replacement requests waiting`} className={`ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-amber-300 px-1.5 py-0.5 text-xs font-bold leading-none text-amber-950 ${collapsed ? 'md:absolute md:-right-1 md:-top-1' : ''}`}>{replacementWaitingCount > 99 ? '99+' : replacementWaitingCount}</span>}
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
            <SearchInput
              ref={searchInputRef}
              aria-label="Search admin pages"
              value={query}
              onChange={(value) => { setQuery(value); setSearchOpen(true); }}
              onValueChange={(value) => { setQuery(value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setSearchOpen(false);
                if (event.key === 'Enter') {
                  const match = allNav.find((item) => item.label.toLowerCase().includes(event.currentTarget.value.toLowerCase()));
                  if (match) { navigate(match.to); setSearchOpen(false); setQuery(''); }
                }
              }}
              placeholder="Search pages..."
            />
            {searchOpen && query && <div className="absolute left-0 right-0 top-12 overflow-hidden rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-1 shadow-xl">
              {matches.length ? matches.map((item) => <Link key={item.to} to={item.to} onClick={() => { setQuery(''); setSearchOpen(false); }} className="block rounded-lg px-3 py-2 text-sm text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]">{item.label}</Link>) : <p className="px-3 py-2 text-sm text-[var(--oppa-text-muted)]">No matching pages.</p>}
            </div>}
          </div>
          <button aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(!dark)} className="rounded-xl p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
          <div className="relative">
            <button aria-label="Open admin profile menu" aria-expanded={menu === 'profile'} onClick={() => setMenu(menu === 'profile' ? null : 'profile')} className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-[var(--oppa-cream)]">
              <span className="flex size-9 items-center justify-center rounded-full bg-[var(--oppa-green)] text-sm font-bold text-white">{adminInitial}</span>
              <span className="hidden max-w-36 text-left leading-tight lg:block"><span className="block truncate text-xs font-semibold text-[var(--oppa-text)]">{admin?.fullName || 'Administrator'}</span><span className="block truncate text-[10px] text-[var(--oppa-text-muted)]">{admin?.role === 'system_administrator' ? 'System Administrator' : 'Admin'}</span></span>
              <ChevronDown size={15} className="hidden text-[var(--oppa-text-muted)] sm:block" />
            </button>
            {menu === 'profile' && <div className="absolute right-0 top-12 w-60 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-2 shadow-xl">
              <div className="border-b border-[var(--oppa-border)] px-3 py-2"><p className="truncate text-sm font-semibold text-[var(--oppa-text)]">{admin?.fullName || 'Administrator'}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{admin?.email || 'Admin account'}</p></div>
              {admin?.role === 'system_administrator' && <Link to="/admin/admins" onClick={() => setMenu(null)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">Registered Admins</Link>}
              <button onClick={handleExit} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"><LogOut size={15} />Logout</button>
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

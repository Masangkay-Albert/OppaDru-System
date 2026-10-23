import React, { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { ClipboardList, Heart, LogOut, ShoppingBag, Trophy, UserRound } from 'lucide-react';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';
import { employeeAuth } from '../../../services/employeeAuth';
import { getEmployeePosBrowserSessionId, loadEmployeePosDraft } from '../../../services/employeePosDraft';
import { formatPeso } from '../../../utils/formatters';
import { CashierStatusContext } from './CashierLayoutContext';
import '../../../styles/cashier-pos.css';

interface CashierEmployee {
  fullName?: string;
  franchise?: { name?: string };
}

interface CashierCartLine {
  product?: { price?: number };
  quantity?: number;
  selectedAddons?: Array<{ price?: number; quantity?: number }>;
}

interface CashierLayoutProps {
  children: React.ReactNode;
}

const readEmployee = (): CashierEmployee | null => {
  try {
    return JSON.parse(sessionStorage.getItem('employee_auth') || 'null') as CashierEmployee | null;
  } catch {
    return null;
  }
};

const CashierLayout: React.FC<CashierLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [employee] = useState(readEmployee);
  const [headerStatus, setHeaderStatus] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, CashierCartLine>>({});
  const pathname = location.pathname;
  const favoritesActive = pathname === '/cashier/pos' && new URLSearchParams(location.search).get('filter') === 'favorites';
  const showCartPill = location.pathname === '/cashier/top-products'
    || location.pathname === '/employee/pos/top-products'
    || location.pathname === '/cashier/branch-orders'
    || location.pathname === '/cashier/popular'
    || favoritesActive;

  useEffect(() => {
    if (!showCartPill) return;
    let active = true;
    const sessionId = getEmployeePosBrowserSessionId();
    void loadEmployeePosDraft(sessionId).then((draft) => {
      if (active) setCart(draft.cart as Record<string, CashierCartLine>);
    }).catch((error: unknown) => {
      console.error('Could not load the cashier cart summary.', error);
    });
    return () => {
      active = false;
    };
  }, [location.key, showCartPill]);

  const cartLines = Object.values(cart);
  const cartCount = cartLines.reduce((total, line) => total + Number(line.quantity || 0), 0);
  const cartTotal = cartLines.reduce((total, line) => {
    const base = Number(line.product?.price || 0);
    const addons = (line.selectedAddons || []).reduce(
      (sum, addon) => sum + Number(addon.price || 0) * Math.max(1, Number(addon.quantity || 1)),
      0,
    );
    return total + (base + addons) * Number(line.quantity || 0);
  }, 0);
  const activeTab = pathname.includes('top-products') || pathname === '/cashier/popular' ? 'top-products'
    : pathname.includes('branch-orders') ? 'orders'
      : favoritesActive ? 'favorites' : 'register';
  const branchName = employee?.franchise?.name || 'Cavite Branch';
  const staffName = employee?.fullName?.trim().split(/\s+/)[0] || 'Cashier';
  const tabs = [
    { id: 'register', label: 'Register', to: '/cashier/pos?filter=all', icon: ShoppingBag },
    { id: 'orders', label: 'Orders', to: '/cashier/branch-orders', icon: ClipboardList },
    { id: 'top-products', label: 'Top Products', to: '/cashier/top-products', icon: Trophy },
    { id: 'favorites', label: 'Favorites', to: '/cashier/pos?filter=favorites', icon: Heart },
  ];

  const logout = () => {
    employeeAuth.logout();
    navigate('/cashier/login');
  };

  return (
    <CashierStatusContext.Provider value={setHeaderStatus}>
    <div className="cashier-app-shell">
      <header className="cashier-header cashier-app-header">
        <Link to="/cashier/pos?filter=all" className="cashier-app-brand">
          <img src={oppaDruLogo} alt="" />
          <span className="cashier-app-brand-copy">
            <strong><span className="cashier-brand-short">Oppa Dru</span><span className="cashier-brand-long">Oppa Dru Korean Fried Chicken</span></strong>
            <small>POS Register · Cashier · {branchName}</small>
          </span>
        </Link>
        <nav className="cashier-app-nav" aria-label="Cashier navigation">
          {tabs.map(({ id, label, to, icon: Icon }) => (
            <Link
              key={id}
              to={to}
              aria-label={label}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`cashier-app-nav-link ${activeTab === id ? 'is-active' : ''}`}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="cashier-app-user-area">
          {pathname === '/cashier/branch-orders' && headerStatus && <span className="cashier-app-update" aria-live="polite">{headerStatus}</span>}
          <div className="cashier-app-profile-wrap">
          <button
            type="button"
            className="cashier-app-profile"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="cashier-app-avatar"><UserRound size={17} /></span>
            <span>{staffName}</span>
          </button>
          {profileOpen && (
            <div className="cashier-app-profile-menu" role="menu">
              <Link to="/cashier/settings" role="menuitem" onClick={() => setProfileOpen(false)}>
                <UserRound size={16} /> Profile
              </Link>
              <button type="button" role="menuitem" onClick={logout}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          )}
          </div>
        </div>
      </header>
      <div className={`cashier-app-page ${pathname === '/cashier/pos' ? 'is-register-page' : ''} ${showCartPill && cartCount > 0 ? 'has-cart-pill' : ''}`}>
        {children}
      </div>
      {showCartPill && cartCount > 0 && (
        <Link to="/cashier/pos?view_order=1" className={`cashier-order-pill cashier-app-cart-pill ${favoritesActive ? 'cashier-favorite-cart-pill' : ''}`} aria-label={`View order, ${cartCount} items, ${formatPeso(cartTotal)}`}>
          <ShoppingBag size={17} aria-hidden="true" />
          <span>View Order ({cartCount})</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formatPeso(cartTotal)}</span>
        </Link>
      )}
    </div>
    </CashierStatusContext.Provider>
  );
};

export default CashierLayout;

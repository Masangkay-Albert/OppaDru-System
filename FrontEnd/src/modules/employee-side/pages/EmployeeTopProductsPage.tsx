import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Heart, Plus, Trophy, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithEmployeeAuth } from '../../../services/employeeAuth';
import { getEmployeePosBrowserSessionId, loadEmployeePosDraft } from '../../../services/employeePosDraft';
import { getProductImage } from '../../../data/productImages';
import { formatPeso } from '../../../utils/formatters';
import '../../../styles/cashier-pos.css';

interface TopProduct {
  productId: string;
  name: string;
  image: string | null;
  category: string | null;
  price: number;
  qtySold: number;
  revenue: number;
  rank: number;
}

interface CartLine {
  product?: { price?: number };
  quantity?: number;
  selectedAddons?: Array<{ price?: number; quantity?: number }>;
}

const getManilaMonth = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  return `${year}-${month}`;
};

const getPreviousMonth = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
};

const readEmployee = () => {
  try {
    return JSON.parse(sessionStorage.getItem('employee_auth') || 'null') as {
      id?: string;
      fullName?: string;
      franchise_id?: string | null;
      franchise?: { name?: string };
    } | null;
  } catch {
    return null;
  }
};

const EmployeeTopProductsPage: React.FC = () => {
  const [employee] = useState(() => readEmployee());
  const [browserSessionId] = useState(() => getEmployeePosBrowserSessionId());
  const [selectedMonth, setSelectedMonth] = useState(() => getManilaMonth());
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [monthProducts, setMonthProducts] = useState<TopProduct[]>([]);
  const [lastMonthProducts, setLastMonthProducts] = useState<TopProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [draftError, setDraftError] = useState('');
  const registerPath = '/cashier/pos';

  const loadProducts = useCallback(async (month: string, signal?: AbortSignal) => {
    setIsLoading(true);
    setError('');
    try {
      const previousMonth = getPreviousMonth(month);
      const query = (value: string) => `${API_URL}/employee/pos/top-products?month=${value}&limit=100`;
      const dataByMonth = new Map<string, TopProduct[]>();
      await Promise.all([month, previousMonth].map(async (requestedMonth) => {
        const response = await fetchWithEmployeeAuth(query(requestedMonth), { signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || 'Could not load top products.');
        }
        const payload = await response.json() as TopProduct[];
        dataByMonth.set(requestedMonth, Array.isArray(payload) ? payload : []);
      }));
      const selectedData = dataByMonth.get(month) || [];
      const lastMonthData = dataByMonth.get(previousMonth) || [];
      setProducts(selectedData);
      setMonthProducts(selectedData);
      setLastMonthProducts(lastMonthData);
      setActiveCategory('all');
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load top products.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => void loadProducts(selectedMonth, controller.signal), 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadProducts, selectedMonth]);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      void loadEmployeePosDraft(browserSessionId).then((draft) => {
        if (!active) return;
        setCart((draft.cart || {}) as Record<string, CartLine>);
        setDraftError('');
      }).catch((loadError: unknown) => {
        if (active) setDraftError(loadError instanceof Error ? loadError.message : 'Could not load the saved cashier order.');
      });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [browserSessionId]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter((category): category is string => Boolean(category)))],
    [products],
  );
  const visibleProducts = useMemo(
    () => activeCategory === 'all' ? products : products.filter((product) => product.category === activeCategory),
    [activeCategory, products],
  );
  const categoryTotals = useMemo(() => products.reduce<Record<string, number>>((totals, product) => {
    const category = product.category || 'Other';
    totals[category] = (totals[category] || 0) + product.qtySold;
    return totals;
  }, {}), [products]);
  const bestCategory = Object.entries(categoryTotals).sort((left, right) => right[1] - left[1])[0]?.[0] || '—';
  const totalUnits = products.reduce((sum, product) => sum + product.qtySold, 0);
  const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0);
  const monthRevenue = monthProducts.reduce((sum, product) => sum + product.revenue, 0);
  const lastMonthRevenue = lastMonthProducts.reduce((sum, product) => sum + product.revenue, 0);
  const monthChange = lastMonthRevenue > 0
    ? Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : monthRevenue > 0 ? 100 : 0;
  const lines = Object.values(cart);
  const cartCount = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
  const cartTotal = lines.reduce((sum, line) => {
    const base = Number(line.product?.price || 0);
    const addons = (line.selectedAddons || []).reduce(
      (addonSum, addon) => addonSum + Number(addon.price || 0) * Math.max(1, Number(addon.quantity || 1)),
      0,
    );
    return sum + (base + addons) * Number(line.quantity || 0);
  }, 0);
  const podiumProducts = [products[1], products[0], products[2]].filter(Boolean);
  const rankedProducts = visibleProducts.filter((product) => product.rank > 3 && product.rank <= 10);
  const topQuantity = products[0]?.qtySold || 1;
  const [selectedYear, selectedMonthNumber] = selectedMonth.split('-').map(Number);
  const monthBase = new Date(Date.UTC(selectedYear, selectedMonthNumber - 1, 1));
  const monthLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(monthBase);
  const title = `Top Products for ${monthLabel}`;

  return (
    <div className="cashier-workspace min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)]">
      <header className="cashier-header sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 px-4 text-white sm:px-6">
        <Link to={registerPath} className="flex min-w-0 items-center gap-3">
          <img src={oppaDruLogo} alt="" className="size-9 rounded-full border border-white/30 object-cover" />
          <span className="min-w-0">
            <strong className="block truncate font-serif text-sm sm:text-base">Oppa Dru Korean Fried Chicken</strong>
            <small className="hidden truncate text-[9px] font-semibold uppercase tracking-wide text-white/75 sm:block">
              Onsite POS Register · Cashier · {employee?.franchise?.name || 'Branch'}
            </small>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-1 sm:gap-2" aria-label="Cashier navigation">
          <Link to="/cashier/branch-orders" className="cashier-nav-link"><ClipboardList size={16} /><span className="hidden sm:inline">Orders</span></Link>
          <Link to="/cashier/top-products" aria-current="page" className="cashier-nav-link cashier-nav-link-active"><Trophy size={16} /><span className="hidden sm:inline">Top Products</span></Link>
          <Link to={`${registerPath}?filter=favorites`} className="cashier-nav-link"><Heart size={16} /><span className="hidden sm:inline">Favorites</span></Link>
          <span className="flex items-center gap-1.5 border-l border-white/20 pl-2 sm:pl-4"><span className="flex size-7 items-center justify-center rounded-full bg-white/15"><UserRound size={15} /></span><span className="hidden sm:inline">{employee?.fullName?.trim().split(/\s+/)[0] || 'Cashier'}</span></span>
        </nav>
      </header>

      <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 pb-28 sm:px-6 lg:px-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <Link to={registerPath} className="mb-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d9e6dc] bg-white px-3 text-sm font-semibold text-[#216b49] shadow-sm hover:bg-[#edf5ef]"><ArrowLeft size={16} /> Back to Register</Link>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b77b16]">Branch performance</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1c3d2e] sm:text-3xl">{title}</h1>
            <p className="mt-1 text-sm text-gray-600">{monthLabel} · Onsite orders at this branch</p>
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[#e7dfd2] bg-white px-3 text-sm font-semibold text-[#1c3d2e] shadow-sm">
            <span>Choose month</span>
            <input type="month" value={selectedMonth} max={getManilaMonth()} onChange={(event) => {
              if (event.target.value) setSelectedMonth(event.target.value);
            }} aria-label="Choose month for top products" className="min-h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm" />
          </label>
        </section>

        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => void loadProducts(selectedMonth)} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold">Retry</button></div>}

        {isLoading ? (
          <div className="space-y-6" aria-label="Loading top products">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-white shadow-sm" />)}</div>
            <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
            <div className="h-64 animate-pulse rounded-2xl bg-white shadow-sm" />
          </div>
        ) : error ? null : products.length === 0 ? (
          <section className="cashier-surface flex min-h-72 flex-col items-center justify-center rounded-2xl p-8 text-center">
            <Trophy size={34} className="text-[#b77b16]" aria-hidden="true" />
            <h2 className="mt-3 font-serif text-xl font-bold text-[#1c3d2e]">No onsite sales for {monthLabel}</h2>
            <p className="mt-1 text-sm text-gray-600">Top products will appear here as completed orders come in.</p>
            <Link to={registerPath} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#216b49] px-5 font-semibold text-white">Back to Register</Link>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <article className="cashier-surface rounded-2xl p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Units Sold</p><p className="mt-2 text-2xl font-extrabold tabular-nums text-[#1c3d2e]">{totalUnits.toLocaleString()}</p><p className="mt-1 text-xs text-gray-500">For the selected period</p></article>
              <article className="cashier-surface rounded-2xl p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Revenue</p><p className="mt-2 text-2xl font-extrabold tabular-nums text-[#1c3d2e]">{formatPeso(totalRevenue)}</p><p className="mt-1 text-xs text-gray-500">For the selected period</p></article>
              <article className="cashier-surface rounded-2xl p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Best Category</p><p className="mt-2 truncate text-2xl font-extrabold capitalize text-[#1c3d2e]">{bestCategory.replaceAll('-', ' ')}</p><p className="mt-1 text-xs text-gray-500">By units sold</p></article>
              <article className="cashier-surface rounded-2xl p-4 sm:p-5"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">% vs previous month</p><p className={`mt-2 text-2xl font-extrabold tabular-nums ${monthChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{monthChange > 0 && lastMonthRevenue === 0 ? 'New' : `${monthChange > 0 ? '+' : ''}${monthChange}%`}</p><p className="mt-1 text-xs text-gray-500">Onsite revenue · selected month</p></article>
            </section>

            <section className="cashier-surface rounded-2xl p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div><h2 className="font-serif text-xl font-bold text-[#1c3d2e]">Top 3 Products</h2><p className="mt-1 text-sm text-gray-600">Onsite product sales for {monthLabel}</p></div>
                <Trophy className="text-[#b77b16]" size={22} aria-hidden="true" />
              </div>
              <div className="grid grid-cols-3 items-end gap-2 sm:gap-5">
                {podiumProducts.map((product) => (
                  <article key={product.productId} className={`cashier-podium-card relative flex flex-col items-center overflow-hidden rounded-2xl border p-3 text-center sm:p-5 ${product.rank === 1 ? 'cashier-podium-first' : ''}`}>
                    <span className={`absolute left-2 top-2 flex size-8 items-center justify-center rounded-full text-xs font-extrabold shadow ${product.rank === 1 ? 'bg-amber-400 text-amber-950' : product.rank === 2 ? 'bg-slate-300 text-slate-800' : 'bg-orange-300 text-orange-950'}`}>#{product.rank}</span>
                    {product.image && <img src={getProductImage(product.image)} alt="" className="mt-2 size-16 rounded-xl object-cover sm:size-24" />}
                    <h3 className="mt-2 line-clamp-2 min-h-10 text-xs font-bold text-[#1c3d2e] sm:text-base">{product.name}</h3>
                    <p className="mt-1 text-[11px] text-gray-600 sm:text-sm">{product.qtySold.toLocaleString()} units · {formatPeso(product.revenue)}</p>
                    <Link to={`${registerPath}?add_product=${encodeURIComponent(product.productId)}`} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-lg bg-[#216b49] px-2 text-xs font-bold text-white transition hover:bg-[#174d35] sm:text-sm"><Plus size={15} /> Add</Link>
                  </article>
                ))}
              </div>
            </section>

            <section className="cashier-surface rounded-2xl p-4 sm:p-6">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div><h2 className="font-serif text-xl font-bold text-[#1c3d2e]">Ranked Products</h2><p className="mt-1 text-sm text-gray-600">Ranks 4–10 · progress relative to the #1 product</p></div>
                <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter top products by category">
                  {['all', ...categories].map((category) => <button key={category} type="button" aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)} className={`min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold capitalize ${activeCategory === category ? 'border-[#216b49] bg-[#e3efe7] text-[#1c3d2e]' : 'border-gray-200 bg-white text-gray-600 hover:border-[#216b49]'}`}>{category === 'all' ? 'All categories' : category.replaceAll('-', ' ')}</button>)}
                </div>
              </div>
              {rankedProducts.length === 0 ? <p className="rounded-xl bg-[#fbf8f1] p-5 text-center text-sm text-gray-600">No ranked products in this category.</p> : (
                <div className="divide-y divide-[#ece8df]">
                  {rankedProducts.map((product) => <article key={product.productId} className="grid grid-cols-[32px_44px_minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[40px_52px_minmax(0,1fr)_100px_100px_44px]">
                    <span className="text-center text-sm font-extrabold tabular-nums text-gray-500">#{product.rank}</span>
                    {product.image ? <img src={getProductImage(product.image)} alt="" className="size-11 rounded-lg object-cover sm:size-12" /> : <span aria-hidden="true" className="size-11 rounded-lg bg-[#f2eee5] sm:size-12" />}
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-gray-900" title={product.name}>{product.name}</h3>
                      <span className="mt-0.5 inline-flex max-w-full truncate rounded-full bg-[#f5f1e7] px-2 py-0.5 text-[10px] capitalize text-gray-600">{product.category?.replaceAll('-', ' ') || 'Other'}</span>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 sm:max-w-64"><span className="block h-full rounded-full bg-[#d6a33f]" style={{ width: `${Math.max(4, Math.min(100, (product.qtySold / topQuantity) * 100))}%` }} /></div>
                    </div>
                    <span className="hidden text-right text-sm font-semibold tabular-nums sm:block">{product.qtySold.toLocaleString()} sold</span>
                    <span className="hidden text-right text-sm font-semibold tabular-nums sm:block">{formatPeso(product.revenue)}</span>
                    <Link to={`${registerPath}?add_product=${encodeURIComponent(product.productId)}`} aria-label={`Add ${product.name} to order`} className="flex size-11 items-center justify-center rounded-lg bg-[#e3efe7] text-[#1c3d2e] hover:bg-[#cfe4d5]"><Plus size={19} /></Link>
                    <span className="col-span-4 pl-[88px] text-xs text-gray-600 sm:hidden">{product.qtySold.toLocaleString()} sold · {formatPeso(product.revenue)}</span>
                  </article>)}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <Link to={`${registerPath}?view_order=1`} className="cashier-order-pill fixed bottom-4 left-1/2 z-40 flex min-h-12 -translate-x-1/2 items-center gap-2 rounded-full px-5 text-sm font-bold text-white shadow-xl">
        <span className="sr-only">{draftError ? `Saved order could not be restored: ${draftError}. ` : ''}</span>
        <span>View Order ({cartCount})</span><span aria-hidden="true">·</span><span className="tabular-nums">{formatPeso(cartTotal)}</span>
      </Link>
    </div>
  );
};

export default EmployeeTopProductsPage;

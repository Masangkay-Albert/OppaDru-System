import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Layers3, Plus, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithEmployeeAuth } from '../../../services/employeeAuth';
import { getProductImage } from '../../../data/productImages';
import { formatPeso } from '../../../utils/formatters';
import { CashierPageHeader, CashierStatCard } from '../components/CashierUi';
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

type ProductPeriod = 'month' | 'week' | 'today';

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

const EmployeeTopProductsPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(() => getManilaMonth());
  const [period, setPeriod] = useState<ProductPeriod>('month');
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [monthProducts, setMonthProducts] = useState<TopProduct[]>([]);
  const [lastMonthProducts, setLastMonthProducts] = useState<TopProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const registerPath = '/cashier/pos';

  const loadProducts = useCallback(async (month: string, requestedPeriod: ProductPeriod, signal?: AbortSignal) => {
    setIsLoading(true);
    setError('');
    try {
      const previousMonth = getPreviousMonth(month);
      const monthQuery = (value: string) => `${API_URL}/employee/pos/top-products?month=${value}&limit=100`;
      const activeQuery = requestedPeriod === 'month'
        ? monthQuery(month)
        : `${API_URL}/employee/pos/top-products?period=${requestedPeriod}&limit=100`;
      const queryUrls = [...new Set([activeQuery, monthQuery(month), monthQuery(previousMonth)])];
      const dataByMonth = new Map<string, TopProduct[]>();
      await Promise.all(queryUrls.map(async (url) => {
        const response = await fetchWithEmployeeAuth(url, { signal });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || 'Could not load top products.');
        }
        const payload = await response.json() as TopProduct[];
        dataByMonth.set(url, Array.isArray(payload) ? payload : []);
      }));
      const selectedData = dataByMonth.get(activeQuery) || [];
      const selectedMonthData = dataByMonth.get(monthQuery(month)) || [];
      const lastMonthData = dataByMonth.get(monthQuery(previousMonth)) || [];
      setProducts(selectedData);
      setMonthProducts(selectedMonthData);
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
    const timeout = window.setTimeout(() => void loadProducts(selectedMonth, period, controller.signal), 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadProducts, period, selectedMonth]);

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
  const podiumProducts = products.length >= 3 ? [products[1], products[0], products[2]] : products.slice(0, 2);
  const rankedProducts = visibleProducts.filter((product) => product.rank > 3 && product.rank <= 10);
  const topQuantity = products[0]?.qtySold || 1;
  const [selectedYear, selectedMonthNumber] = selectedMonth.split('-').map(Number);
  const monthBase = new Date(Date.UTC(selectedYear, selectedMonthNumber - 1, 1));
  const monthLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(monthBase);
  const title = period === 'week' ? 'Top Products This Week'
    : period === 'today' ? 'Top Products Today'
      : 'Top Products of the Month';
  const stepMonth = (offset: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextMonth = new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7);
    if (nextMonth <= getManilaMonth()) {
      setSelectedMonth(nextMonth);
      setPeriod('month');
    }
  };

  return (
    <div className="cashier-workspace cashier-page-workspace min-h-screen text-[var(--oppa-text)]">
      <main className="cashier-page-content space-y-6">
        <CashierPageHeader
          eyebrow="Branch performance"
          title={title}
          subtitle={`${period === 'month' ? monthLabel : period === 'week' ? 'Current calendar week' : 'Today'} · Onsite orders at this branch`}
          actions={(
            <div className="cashier-month-stepper" aria-label="Select reporting month">
              <button type="button" aria-label="Previous month" onClick={() => stepMonth(-1)}><ChevronLeft size={18} /></button>
              <strong>{monthLabel}</strong>
              <button type="button" aria-label="Next month" disabled={selectedMonth >= getManilaMonth()} onClick={() => stepMonth(1)}><ChevronRight size={18} /></button>
              <details className="cashier-month-picker">
                <summary aria-label="Pick a month"><CalendarDays size={17} /><span className="sr-only">Pick a month</span></summary>
                <label><span>Choose month</span><input type="month" value={selectedMonth} data-max={getManilaMonth()} onChange={(event) => {
                  if (event.target.value) {
                    setSelectedMonth(event.target.value);
                    setPeriod('month');
                  }
                }} aria-label="Choose month for top products" /></label>
              </details>
            </div>
          )}
        >
          <div className="cashier-period-toggle" role="group" aria-label="Reporting period">
            <button type="button" aria-pressed={period === 'month' && selectedMonth === getManilaMonth()} onClick={() => {
              setSelectedMonth(getManilaMonth());
              setPeriod('month');
            }}>This Month</button>
            <button type="button" aria-pressed={period === 'month' && selectedMonth === getPreviousMonth(getManilaMonth())} onClick={() => {
              setSelectedMonth(getPreviousMonth(getManilaMonth()));
              setPeriod('month');
            }}>Last Month</button>
            <button type="button" aria-pressed={period === 'week'} onClick={() => {
              setSelectedMonth(getManilaMonth());
              setPeriod('week');
            }}>This Week</button>
            <button type="button" aria-pressed={period === 'today'} onClick={() => {
              setSelectedMonth(getManilaMonth());
              setPeriod('today');
            }}>Today</button>
          </div>
        </CashierPageHeader>

        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => void loadProducts(selectedMonth, period)} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold">Retry</button></div>}

        {isLoading ? (
          <div className="space-y-6" aria-label="Loading top products">
            <section className="cashier-stats-grid" aria-label="Loading top product statistics">
              {[ClipboardList, Banknote, Layers3, Trophy].map((Icon, index) => <CashierStatCard key={index} icon={Icon} label="Loading" value="" loading />)}
            </section>
            <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
            <div className="h-64 animate-pulse rounded-2xl bg-white shadow-sm" />
          </div>
        ) : error ? null : products.length === 0 ? (
          <section className="cashier-surface flex min-h-72 flex-col items-center justify-center rounded-2xl p-8 text-center">
            <Trophy size={34} className="text-[#b77b16]" aria-hidden="true" />
            <h2 className="mt-3 font-serif text-xl font-bold text-[#1c3d2e]">No sales yet {period === 'month' ? `for ${monthLabel}` : period === 'week' ? 'this week' : 'today'}</h2>
            <p className="mt-1 text-sm text-gray-600">Top products will appear here as completed orders come in.</p>
            <Link to={registerPath} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#216b49] px-5 font-semibold text-white">Back to Register</Link>
          </section>
        ) : (
          <>
            <section className="cashier-stats-grid" aria-label="Top product statistics">
              <CashierStatCard icon={ClipboardList} label="Total Units Sold" value={totalUnits.toLocaleString()} detail="For the selected period" />
              <CashierStatCard icon={Banknote} label="Total Revenue" value={formatPeso(totalRevenue)} detail="For the selected period" />
              <CashierStatCard icon={Layers3} label="Best Category" value={bestCategory.replaceAll('-', ' ')} detail="By units sold" />
              <CashierStatCard
                icon={Trophy}
                label="% vs previous month"
                value={<span className={monthChange >= 0 ? 'text-emerald-700' : 'text-red-700'}>{monthChange > 0 && lastMonthRevenue === 0 ? 'New' : `${monthChange > 0 ? '+' : ''}${monthChange}%`}</span>}
                detail={<span title={lastMonthRevenue === 0 ? 'No previous-month revenue was recorded for comparison.' : 'Revenue compared with the previous calendar month.'}>Onsite revenue · selected month</span>}
              />
            </section>

            <section className="cashier-surface rounded-2xl p-4 sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div><h2 className="font-serif text-xl font-bold text-[#1c3d2e]">{products.length < 3 ? `Top ${products.length} Product${products.length === 1 ? '' : 's'}` : 'Top 3 Products'}</h2><p className="mt-1 text-sm text-gray-600">Onsite product sales · {period === 'month' ? monthLabel : period === 'week' ? 'this week' : 'today'}</p></div>
                <Trophy className="text-[#b77b16]" size={22} aria-hidden="true" />
              </div>
              <div className={`cashier-podium-grid cashier-podium-count-${podiumProducts.length}`}>
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

    </div>
  );
};

export default EmployeeTopProductsPage;

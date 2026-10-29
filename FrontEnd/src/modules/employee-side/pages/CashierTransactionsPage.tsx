import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownWideNarrow,
  Banknote,
  Check,
  ClipboardList,
  Copy,
  CreditCard,
  ListFilter,
  MoreHorizontal,
  PackageCheck,
  Printer,
  ShoppingBag,
  Store,
  Trophy,
  Wallet,
  X,
} from 'lucide-react';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithEmployeeAuth } from '../../../services/employeeAuth';
import { formatPeso } from '../../../utils/formatters';
import { useCashierLayoutStatus } from '../components/CashierLayoutContext';
import { CashierPageHeader, CashierStatCard } from '../components/CashierUi';
import StaffBranchBadge from '../../shared/components/StaffBranchBadge';
import SearchInput from '../../../components/ui/SearchInput';
import Select from '../../../components/ui/Select';
import '../../../styles/cashier-pos.css';

interface CashierOrderItem {
  id: number | string;
  product_name: string;
  product_price: number | string;
  quantity: number;
  special_instructions?: string | null;
  addons?: Array<{ addon_name: string; unit_price: number | string; quantity: number }>;
}

type CashierOrderLine = CashierOrderItem | NonNullable<CashierOrder['items']>[number];

const isExpandedOrderItem = (item: CashierOrderLine): item is CashierOrderItem =>
  'addons' in item || 'special_instructions' in item;

interface CashierOrder {
  id: string;
  order_number?: string | null;
  branch_name?: string | null;
  total: number | string;
  cash_tendered?: number | string | null;
  change_due?: number | string | null;
  payment_method: string;
  payment_status?: string | null;
  payment_reference?: string | null;
  status: string;
  status_history?: Array<{ status?: string; changed_at?: string; created_at?: string; note?: string }>;
  created_at: string;
  delivery_type?: string | null;
  delivery_address?: string | null;
  items?: Array<{ name?: string; product_name?: string; price?: number; product_price?: number; quantity?: number }>;
  order_items?: CashierOrderItem[];
  discount_type?: string | null;
  discount_amount?: number | string | null;
  vat?: number | string | null;
  special_instructions?: string | null;
  include_cutlery?: boolean;
}

type DateFilter = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type SortOption = 'newest' | 'oldest' | 'highest' | 'lowest';

interface EmployeeData {
  fullName?: string;
  franchise_id?: string | null;
  franchise?: { id?: string; name?: string } | null;
}

const formatDateInput = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const manilaDate = (value: string | Date) => formatDateInput(new Date(value));

const getWeekStart = (date: Date) => {
  const today = new Date(`${formatDateInput(date)}T12:00:00Z`);
  const day = new Date(today).getUTCDay();
  today.setUTCDate(today.getUTCDate() - (day === 0 ? 6 : day - 1));
  return today.toISOString().slice(0, 10);
};

const orderCustomer = (order: CashierOrder) => {
  const match = order.delivery_address?.match(/Customer:\s*([^)|]+)/i);
  return match?.[1]?.trim() || 'Walk-in Customer';
};

const orderType = (order: CashierOrder) => {
  const address = order.delivery_address || '';
  if (/dine[\s-]?in/i.test(address)) return 'Dine-in';
  if (/takeout/i.test(address)) return 'Takeout';
  return order.delivery_type === 'onsite' ? 'Onsite' : '—';
};

const calculateOrderSubtotal = (items: CashierOrderLine[]) => items.reduce((sum, item) => {
  const unitPrice = Number(item.product_price ?? ('price' in item ? item.price : 0) ?? 0);
  const quantity = Number(item.quantity || 1);
  const addonTotal = isExpandedOrderItem(item)
    ? (item.addons || []).reduce((addonSum, addon) => addonSum + Number(addon.unit_price) * Number(addon.quantity || 1), 0)
    : 0;
  return sum + (unitPrice + addonTotal) * quantity;
}, 0);

const statusClass: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  preparing: 'border-blue-200 bg-blue-50 text-blue-800',
  ready: 'border-purple-200 bg-purple-50 text-purple-800',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  cancelled: 'border-red-200 bg-red-50 text-red-800',
  voided: 'border-red-200 bg-red-50 text-red-800',
};

const CashierTransactionsPage: React.FC = () => {
  const setHeaderStatus = useCashierLayoutStatus();
  const [orders, setOrders] = useState<CashierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [employee] = useState<EmployeeData | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('employee_auth') || 'null') as EmployeeData | null;
    } catch {
      return null;
    }
  });
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<CashierOrder | null>(null);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const branchName = employee?.franchise?.name || 'Main system';
  const branchId = employee?.franchise?.id || employee?.franchise_id || null;

  const loadOrders = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await fetchWithEmployeeAuth(`${API_URL}/employee/pos/orders`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load your orders.');
      setOrders(Array.isArray(payload.data) ? payload.data : []);
      setUpdatedAt(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    document.title = `${branchName} | My Orders | Oppa Dru`;
  }, [branchName]);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setClock(new Date()), 60_000);
    const initial = window.setTimeout(() => void loadOrders(), 0);
    const refreshOnFocus = () => {
      if (document.visibilityState === 'visible') void loadOrders(true);
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadOrders(true);
    }, 45_000);
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('cashier-pos-orders');
    const onOrder = () => void loadOrders(true);
    channel?.addEventListener('message', onOrder);
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.clearInterval(clockTimer);
      channel?.removeEventListener('message', onOrder);
      channel?.close();
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [loadOrders]);

  const dateFilteredOrders = useMemo(() => {
    const today = formatDateInput(clock);
    const yesterdayDate = new Date(clock.getTime() - 24 * 60 * 60 * 1000);
    const yesterday = formatDateInput(yesterdayDate);
    const weekStart = getWeekStart(clock);
    const month = today.slice(0, 7);
    return orders.filter((order) => {
      const orderDay = manilaDate(order.created_at);
      if (dateFilter === 'today') return orderDay === today;
      if (dateFilter === 'yesterday') return orderDay === yesterday;
      if (dateFilter === 'week') return orderDay >= weekStart && orderDay <= today;
      if (dateFilter === 'month') return orderDay.slice(0, 7) === month;
      if (dateFilter === 'custom') return (!customFrom || orderDay >= customFrom) && (!customTo || orderDay <= customTo);
      return true;
    });
  }, [clock, customFrom, customTo, dateFilter, orders]);

  const statusCounts = useMemo(() => dateFilteredOrders.reduce<Record<string, number>>((counts, order) => {
    const normalized = (order.status || 'pending').toLowerCase();
    const statusKey = normalized === 'completed' ? 'delivered' : normalized === 'voided' ? 'cancelled' : normalized;
    counts[statusKey] = (counts[statusKey] || 0) + 1;
    return counts;
  }, {}), [dateFilteredOrders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = dateFilteredOrders.filter((order) => {
      const matchesSearch = !query || `${order.order_number || ''} ${orderCustomer(order)}`.toLowerCase().includes(query);
      const normalizedStatus = order.status.toLowerCase();
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'delivered' && ['delivered', 'completed'].includes(normalizedStatus))
        || (statusFilter === 'cancelled' && ['cancelled', 'voided'].includes(normalizedStatus))
        || normalizedStatus === statusFilter;
      const method = order.payment_method.toLowerCase();
      const matchesPayment = paymentFilter === 'all'
        || (paymentFilter === 'cash' && method.includes('cash'))
        || (paymentFilter === 'gcash' && (method.includes('gcash') || method.includes('wallet')))
        || (paymentFilter === 'card' && (method.includes('card') || method.includes('credit')));
      return matchesSearch && matchesStatus && matchesPayment;
    });
    return filtered.sort((left, right) => {
      if (sort === 'oldest') return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      if (sort === 'highest') return Number(right.total) - Number(left.total);
      if (sort === 'lowest') return Number(left.total) - Number(right.total);
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [dateFilteredOrders, paymentFilter, search, sort, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const effectivePage = Math.min(page, pageCount);
  const pageOrders = filteredOrders.slice((effectivePage - 1) * pageSize, effectivePage * pageSize);
  const todayKey = formatDateInput(clock);
  const ordersToday = orders.filter((order) => manilaDate(order.created_at) === todayKey);
  const salesToday = ordersToday.reduce((sum, order) => sum + Number(order.total), 0);
  const averageToday = ordersToday.length ? salesToday / ordersToday.length : 0;
  const totalSales = dateFilteredOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const averageOrder = dateFilteredOrders.length ? totalSales / dateFilteredOrders.length : 0;
  const previousRange = (() => {
    if (dateFilter === 'today' || dateFilter === 'yesterday') {
      const offset = dateFilter === 'today' ? 1 : 2;
      const previous = new Date(clock.getTime() - offset * 24 * 60 * 60 * 1000);
      const day = formatDateInput(previous);
      return { from: day, to: day };
    }
    if (dateFilter === 'week') {
      const currentWeekStart = getWeekStart(clock);
      const end = new Date(`${currentWeekStart}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() - 1);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 6);
      return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    }
    if (dateFilter === 'month') {
      const [year, month] = formatDateInput(clock).slice(0, 7).split('-').map(Number);
      const previous = new Date(Date.UTC(year, month - 2, 1));
      const key = previous.toISOString().slice(0, 7);
      return { from: `${key}-01`, to: `${key}-${new Date(Date.UTC(previous.getUTCFullYear(), previous.getUTCMonth() + 1, 0)).getUTCDate().toString().padStart(2, '0')}` };
    }
    if (dateFilter === 'custom' && customFrom && customTo) {
      const start = new Date(`${customFrom}T12:00:00Z`);
      const selectedEnd = new Date(`${customTo}T12:00:00Z`);
      const span = Math.max(0, Math.round((selectedEnd.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() - 1);
      const previousStart = new Date(end);
      previousStart.setUTCDate(previousStart.getUTCDate() - span);
      return { from: previousStart.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
    }
    return null;
  })();
  const previousOrders = previousRange
    ? orders.filter((order) => {
      const day = manilaDate(order.created_at);
      return day >= previousRange.from && day <= previousRange.to;
    })
    : [];
  const previousSales = previousOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const trendLabel = (current: number, previous: number) => {
    if (!previousRange) return 'No previous period comparison';
    if (!previous) return current ? 'New vs previous period' : 'No change vs previous period';
    const change = Math.round(((current - previous) / previous) * 100);
    return `${change > 0 ? '+' : ''}${change}% vs previous period`;
  };
  const cashCount = dateFilteredOrders.filter((order) => order.payment_method.toLowerCase().includes('cash')).length;
  const otherPaymentCount = dateFilteredOrders.length - cashCount;
  const paymentTotal = cashCount + otherPaymentCount;
  const paymentPercent = paymentTotal ? Math.round((cashCount / paymentTotal) * 100) : 0;
  const otherPaymentPercent = paymentTotal ? 100 - paymentPercent : 0;
  const recentOrders = [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
  const hasFilters = Boolean(search || dateFilter !== 'all' || statusFilter !== 'all' || paymentFilter !== 'all' || sort !== 'newest');

  const clearFilters = () => {
    setSearch('');
    setDateFilter('all');
    setCustomFrom('');
    setCustomTo('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setSort('newest');
    setPage(1);
  };

  const copyBranchCode = async () => {
    if (!branchId) return;
    try {
      await navigator.clipboard.writeText(branchId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('Could not copy the branch code. Select and copy it from the branch badge.');
    }
  };

  const printOrder = (order: CashierOrder) => {
    setSelectedOrder(order);
    setOpenActionMenu(null);
    window.setTimeout(() => window.print(), 150);
  };

  const friendlyDate = (value: string) => {
    const date = new Date(value);
    const day = manilaDate(value);
    const today = formatDateInput(clock);
    const yesterday = formatDateInput(new Date(clock.getTime() - 24 * 60 * 60 * 1000));
    const prefix = day === today ? 'Today' : day === yesterday
      ? 'Yesterday'
      : new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' }).format(date);
    const time = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(date);
    return `${prefix}, ${time}`;
  };

  const updatedLabel = updatedAt
    ? clock.getTime() - updatedAt.getTime() < 60_000
      ? 'Updated just now'
      : clock.getTime() - updatedAt.getTime() < 3_600_000
        ? `Updated ${Math.floor((clock.getTime() - updatedAt.getTime()) / 60_000)}m ago`
        : `Updated ${friendlyDate(updatedAt.toISOString())}`
    : 'Loading orders…';

  useEffect(() => {
    setHeaderStatus(refreshing ? 'Updating…' : updatedLabel);
  }, [refreshing, setHeaderStatus, updatedLabel]);

  const paymentIcon = (method: string) => {
    const normalized = method.toLowerCase();
    if (normalized.includes('cash')) return <Banknote size={14} aria-hidden="true" />;
    if (normalized.includes('card') || normalized.includes('credit')) return <CreditCard size={14} aria-hidden="true" />;
    return <Wallet size={14} aria-hidden="true" />;
  };

  const paymentLabel = (method: string) => method.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="cashier-workspace cashier-orders-workspace min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)]">
      <div className="cashier-orders-main">
        <main className="cashier-orders-content">
          <CashierPageHeader
            eyebrow="Branch cashier"
            title="My Orders"
            subtitle="Orders placed using your cashier account at your assigned branch."
          >
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <StaffBranchBadge name={branchName} id={branchId} />
                {branchId && <button type="button" onClick={() => void copyBranchCode()} aria-label="Copy branch code" className="flex min-h-9 items-center gap-1.5 rounded-full border border-[#e7e1d6] bg-white px-3 text-xs font-semibold text-[#1c3d2e]">{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied' : 'Copy code'}</button>}
            </div>
          </CashierPageHeader>

          <section className="cashier-orders-stats" aria-label="Order summary">
            {loading ? (
              <>
                <CashierStatCard icon={ClipboardList} label="Total Orders" value="" loading />
                <CashierStatCard icon={Banknote} label="Total Sales" value="" loading />
                <CashierStatCard icon={Wallet} label="Average Order" value="" loading />
                <CashierStatCard icon={CreditCard} label="Cash vs E-wallet / Card" value="" loading />
              </>
            ) : (
              <>
                <CashierStatCard icon={ClipboardList} label="Total Orders" value={dateFilteredOrders.length.toLocaleString()} detail={trendLabel(dateFilteredOrders.length, previousOrders.length)} />
                <CashierStatCard icon={Banknote} label="Total Sales" value={formatPeso(totalSales)} detail={trendLabel(totalSales, previousSales)} />
                <CashierStatCard icon={Wallet} label="Average Order" value={formatPeso(averageOrder)} detail={`Today: ${formatPeso(averageToday)}`} />
                <CashierStatCard
                  icon={CreditCard}
                  label="Cash vs E-wallet / Card"
                  className="cashier-payment-split-stat"
                  value={<span className="cashier-payment-split-value"><span>{cashCount} cash</span><span>{otherPaymentCount} other</span></span>}
                  detail={<span className="cashier-payment-bar"><i style={{ width: `${paymentPercent}%` }} /></span>}
                />
              </>
            )}
          </section>

          <section className="cashier-orders-filters cashier-surface" aria-label="Filter orders">
            <SearchInput aria-label="Search by order number or customer" value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search order number or customer…" />
            <div className="cashier-orders-filter-row">
              <div className="cashier-orders-chips" role="group" aria-label="Date range">
                {([['all', 'All dates'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This Week'], ['month', 'This Month'], ['custom', 'Custom']] as Array<[DateFilter, string]>).map(([value, label]) => <button type="button" key={value} aria-pressed={dateFilter === value} onClick={() => { setDateFilter(value); setPage(1); }}>{label}</button>)}
              </div>
              <Select aria-label="Filter payment method" value={paymentFilter} onChange={(value) => { setPaymentFilter(value); setPage(1); }} icon={<ListFilter size={15} aria-hidden="true" />} options={[{ value: 'all', label: 'All payments' }, { value: 'cash', label: 'Cash' }, { value: 'gcash', label: 'GCash / E-wallet' }, { value: 'card', label: 'Card' }]} className="min-w-44" />
              <Select aria-label="Sort orders" value={sort} onChange={(value) => { setSort(value as SortOption); setPage(1); }} icon={<ArrowDownWideNarrow size={15} aria-hidden="true" />} options={[{ value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'highest', label: 'Highest total' }, { value: 'lowest', label: 'Lowest total' }]} className="min-w-40" />
            </div>
            {dateFilter === 'custom' && <div className="flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-gray-600">From <input type="date" value={customFrom} onChange={(event) => { setCustomFrom(event.target.value); setPage(1); }} className="ml-1 min-h-10 rounded-lg border border-gray-200 px-2" /></label><label className="text-xs font-semibold text-gray-600">To <input type="date" value={customTo} onChange={(event) => { setCustomTo(event.target.value); setPage(1); }} className="ml-1 min-h-10 rounded-lg border border-gray-200 px-2" /></label></div>}
            <div className="cashier-orders-filter-row cashier-orders-statuses" role="group" aria-label="Filter by order status">
              {['all', 'pending', 'preparing', 'ready', 'delivered', 'cancelled'].map((status) => <button type="button" key={status} aria-pressed={statusFilter === status} onClick={() => { setStatusFilter(status); setPage(1); }}>{status === 'all' ? 'All' : status.replace(/^./, (letter) => letter.toUpperCase())}<span>{status === 'all' ? dateFilteredOrders.length : statusCounts[status] || 0}</span></button>)}
              {hasFilters && <button type="button" className="cashier-orders-clear" onClick={() => { clearFilters(); setPage(1); }}>Clear filters</button>}
            </div>
          </section>

          {error && orders.length > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => void loadOrders()} className="min-h-11 rounded-lg border border-red-300 bg-white px-4 font-semibold">Retry</button></div>}

          <section className="cashier-orders-table-shell cashier-surface" aria-label="Orders">
            {loading ? <div className="space-y-3 p-5" aria-label="Loading orders">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-[#f2eee5]" />)}</div>
              : pageOrders.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><span className="mb-3 flex size-14 items-center justify-center rounded-full bg-[#e3efe7] text-[#216b49]"><PackageCheck size={26} /></span><h2 className="font-serif text-xl font-bold text-[#1c3d2e]">{error && !orders.length ? 'Could not load orders' : orders.length ? 'No matching orders' : 'No orders yet'}</h2><p className="mt-1 max-w-md text-sm text-gray-600">{error && !orders.length ? error : orders.length ? 'Try changing or clearing your filters.' : 'Orders you place will appear here.'}</p>{error && !orders.length ? <button type="button" onClick={() => void loadOrders()} className="mt-4 min-h-11 rounded-xl border border-[#216b49] px-4 text-sm font-semibold text-[#216b49]">Retry</button> : orders.length ? <button type="button" onClick={clearFilters} className="mt-4 min-h-11 rounded-xl border border-[#216b49] px-4 text-sm font-semibold text-[#216b49]">Clear filters</button> : <Link to="/cashier/pos" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#216b49] px-4 text-sm font-semibold text-white">Back to Register</Link>}</div>
              : <>
                <div className="cashier-orders-table-scroll">
                  <table className="cashier-orders-table">
                    <thead><tr><th>Order</th><th>Type</th><th className="text-right">Total</th><th>Payment</th><th>Status</th><th>Date</th><th className="text-right">Actions</th></tr></thead>
                    <tbody>{pageOrders.map((order) => <tr key={order.id} onClick={() => setSelectedOrder(order)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') setSelectedOrder(order); }}>
                      <td><strong className="block font-mono text-xs sm:text-sm">{order.order_number || order.id}</strong><span className="mt-1 block text-xs text-gray-500">{orderCustomer(order)} · {order.branch_name || branchName}</span></td>
                      <td><span className="inline-flex items-center gap-1.5 text-xs font-semibold"><Store size={14} />{orderType(order)}</span></td>
                      <td className="text-right font-bold tabular-nums">{formatPeso(Number(order.total))}</td>
                      <td><span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f1e7] px-2.5 py-1 text-xs font-semibold">{paymentIcon(order.payment_method)}{paymentLabel(order.payment_method)}</span></td>
                      <td><span className={`cashier-order-status ${statusClass[order.status.toLowerCase()] || 'border-gray-200 bg-gray-50 text-gray-700'}`}><i />{order.status.replaceAll('_', ' ')}</span></td>
                      <td title={new Date(order.created_at).toLocaleString()} className="whitespace-nowrap text-xs text-gray-600">{friendlyDate(order.created_at)}</td>
                      <td className="text-right"><div className="cashier-orders-row-actions"><button type="button" onClick={(event) => { event.stopPropagation(); setSelectedOrder(order); }} className="min-h-10 rounded-lg border border-[#d9e6dc] px-3 text-xs font-bold text-[#216b49] hover:bg-[#edf5ef]">View</button><button type="button" onClick={(event) => { event.stopPropagation(); setOpenActionMenu((current) => current === order.id ? null : order.id); }} aria-label={`More actions for ${order.order_number || order.id}`} className="grid size-10 place-items-center rounded-lg border border-[#e7e1d6]"><MoreHorizontal size={17} /></button>{openActionMenu === order.id && <div className="cashier-orders-row-menu"><button type="button" onClick={(event) => { event.stopPropagation(); printOrder(order); }}><Printer size={14} /> Print receipt</button></div>}</div></td>
                    </tr>)}</tbody>
                  </table>
                </div>
                <footer className="cashier-orders-pagination"><span>Showing {(effectivePage - 1) * pageSize + 1}–{Math.min(effectivePage * pageSize, filteredOrders.length)} of {filteredOrders.length}</span><div className="flex items-center gap-2"><span>Rows</span><Select aria-label="Rows per page" value={pageSize} onChange={(value) => { setPageSize(Number(value)); setPage(1); }} options={[{ value: 10, label: '10' }, { value: 20, label: '20' }, { value: 50, label: '50' }]} className="w-24" /></div><div><button type="button" disabled={effectivePage <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} aria-label="Previous page">‹</button><span>{effectivePage} / {pageCount}</span><button type="button" disabled={effectivePage >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} aria-label="Next page">›</button></div></footer>
              </>}
          </section>
        </main>

        <aside className="cashier-orders-insights" aria-label="Branch insights">
          <section className="cashier-surface rounded-2xl p-5"><h2 className="font-serif text-lg font-bold text-[#1c3d2e]">Today at a glance</h2><div className="mt-4 grid grid-cols-2 gap-3"><div><small>Orders</small><strong>{ordersToday.length}</strong></div><div><small>Sales</small><strong>{formatPeso(salesToday)}</strong></div><div className="col-span-2"><small>Average order</small><strong>{formatPeso(averageToday)}</strong></div></div></section>
          <section className="cashier-surface rounded-2xl p-5"><h2 className="font-serif text-lg font-bold text-[#1c3d2e]">Payment mix</h2><div className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><span>Cash</span><strong>{cashCount} ({paymentPercent}%)</strong></div><div className="cashier-payment-bar"><i style={{ width: `${paymentPercent}%` }} /></div><div className="flex justify-between"><span>E-wallet / Card</span><strong>{otherPaymentCount} ({otherPaymentPercent}%)</strong></div></div></section>
          <section className="cashier-surface rounded-2xl p-5"><h2 className="font-serif text-lg font-bold text-[#1c3d2e]">Status breakdown</h2><div className="mt-3 space-y-2">{['pending', 'preparing', 'ready', 'delivered', 'cancelled'].map((status) => <div key={status} className="flex justify-between text-sm capitalize text-gray-600"><span>{status}</span><strong className="text-[#1c3d2e]">{statusCounts[status] || 0}</strong></div>)}</div></section>
          <section className="cashier-surface rounded-2xl p-5"><h2 className="font-serif text-lg font-bold text-[#1c3d2e]">Recent activity</h2><div className="mt-3 space-y-3">{recentOrders.length ? recentOrders.map((order) => <button type="button" key={order.id} onClick={() => setSelectedOrder(order)} className="flex w-full items-center justify-between gap-2 text-left"><span className="min-w-0"><strong className="block truncate text-xs">{order.order_number || order.id}</strong><small className="text-gray-500">{friendlyDate(order.created_at)}</small></span><strong className="shrink-0 text-xs tabular-nums">{formatPeso(Number(order.total))}</strong></button>) : <p className="text-sm text-gray-500">No recent orders.</p>}</div></section>
          <section className="cashier-surface rounded-2xl p-5"><h2 className="font-serif text-lg font-bold text-[#1c3d2e]">Quick links</h2><div className="mt-3 grid gap-2"><Link to="/cashier/pos" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#216b49] px-3 text-sm font-bold text-white"><ShoppingBag size={16} /> Open Register</Link><Link to="/cashier/top-products" className="flex min-h-11 items-center gap-2 rounded-xl border border-[#d9e6dc] px-3 text-sm font-bold text-[#1c3d2e]"><Trophy size={16} /> Top Products</Link></div></section>
        </aside>
      </div>

      {selectedOrder && <div className="cashier-order-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}><aside className="cashier-order-drawer" role="dialog" aria-modal="true" aria-labelledby="cashier-order-drawer-title">
        <header><div><p className="text-xs font-bold uppercase tracking-wider text-[#b77b16]">Order details</p><h2 id="cashier-order-drawer-title" className="mt-1 font-mono text-base font-bold">{selectedOrder.order_number || selectedOrder.id}</h2></div><button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close order details"><X size={20} /></button></header>
        <div className="cashier-order-drawer-body">
          <div className="flex items-center justify-between"><span className={`cashier-order-status ${statusClass[selectedOrder.status.toLowerCase()] || 'border-gray-200 bg-gray-50 text-gray-700'}`}><i />{selectedOrder.status.replaceAll('_', ' ')}</span><span className="text-xs text-gray-500">{friendlyDate(selectedOrder.created_at)}</span></div>
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#fbf8f1] p-4 text-sm"><div><small className="block text-xs uppercase text-gray-500">Customer</small><strong>{orderCustomer(selectedOrder)}</strong></div><div><small className="block text-xs uppercase text-gray-500">Type</small><strong>{orderType(selectedOrder)}</strong></div><div><small className="block text-xs uppercase text-gray-500">Payment</small><strong className="inline-flex items-center gap-1">{paymentIcon(selectedOrder.payment_method)}{paymentLabel(selectedOrder.payment_method)}</strong></div><div><small className="block text-xs uppercase text-gray-500">Payment status</small><strong>{(selectedOrder.payment_status || '—').replaceAll('_', ' ')}</strong></div></div>
          {selectedOrder.status_history?.length ? <section><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Status timeline</h3><ol className="space-y-2 border-l-2 border-[#d9e6dc] pl-4">{selectedOrder.status_history.map((entry, index) => <li key={`${entry.status}-${index}`} className="text-sm"><strong className="capitalize">{entry.status?.replaceAll('_', ' ') || 'Updated'}</strong><small className="ml-2 text-gray-500">{entry.changed_at || entry.created_at ? friendlyDate(entry.changed_at || entry.created_at || '') : ''}</small>{entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}</li>)}</ol></section> : null}
          <section><h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Items</h3><div className="divide-y divide-[#eee9de] rounded-xl bg-[#fbf8f1] px-4">{(selectedOrder.order_items || selectedOrder.items || []).map((item, index) => {
            const name = 'product_name' in item ? item.product_name : item.name || 'Item';
            const unitPrice = Number('product_price' in item ? item.product_price : item.price || 0);
            const quantity = Number(item.quantity || 1);
            return <div key={`${name}-${index}`} className="py-3"><div className="flex justify-between gap-3 text-sm"><span className="font-semibold">{quantity} × {name}</span><strong className="tabular-nums">{formatPeso(quantity * unitPrice)}</strong></div>{'special_instructions' in item && item.special_instructions && <p className="mt-1 text-xs text-gray-500">Note: {item.special_instructions}</p>}{'addons' in item && item.addons?.map((addon, addonIndex) => <p key={`${addon.addon_name}-${addonIndex}`} className="mt-1 text-xs text-gray-600">+ {addon.addon_name} × {addon.quantity} · {formatPeso(Number(addon.unit_price) * Number(addon.quantity || 1) * quantity)}</p>)}</div>;
          })}</div></section>
          {selectedOrder.delivery_address && <p className="text-sm text-gray-600">{selectedOrder.delivery_address}</p>}
          {selectedOrder.special_instructions && <p className="rounded-xl border border-[#e7e1d6] p-3 text-sm"><strong>Order notes</strong><span className="mt-1 block text-gray-600">{selectedOrder.special_instructions}</span></p>}
          <div className="space-y-2 border-t border-[#e7e1d6] pt-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{formatPeso(calculateOrderSubtotal(selectedOrder.order_items || selectedOrder.items || []))}</strong></div>{selectedOrder.discount_type && <div className="flex justify-between text-emerald-700"><span>{selectedOrder.discount_type} discount</span><strong>−{formatPeso(Number(selectedOrder.discount_amount || 0))}</strong></div>}<div className="flex justify-between"><span>VAT</span><strong>{formatPeso(Number(selectedOrder.vat || 0))}</strong></div><div className="flex justify-between border-t border-[#e7e1d6] pt-3 text-lg font-bold"><span>Total</span><strong>{formatPeso(Number(selectedOrder.total))}</strong></div>{selectedOrder.payment_method.toLowerCase().includes('cash') && selectedOrder.cash_tendered !== null && selectedOrder.cash_tendered !== undefined && <><div className="flex justify-between text-xs text-gray-600"><span>Cash tendered</span><strong>{formatPeso(Number(selectedOrder.cash_tendered))}</strong></div><div className="flex justify-between text-xs text-gray-600"><span>Change due</span><strong>{formatPeso(Number(selectedOrder.change_due || 0))}</strong></div></>}{selectedOrder.payment_reference && <div className="flex justify-between gap-3 text-xs text-gray-500"><span>Reference</span><span className="break-all text-right">{selectedOrder.payment_reference}</span></div>}</div>
        </div>
        <footer><button type="button" onClick={() => window.print()} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#d9e6dc] font-semibold text-[#1c3d2e]"><Printer size={16} /> Print Receipt</button><button type="button" onClick={() => setSelectedOrder(null)} className="min-h-11 flex-1 rounded-xl bg-[#216b49] font-semibold text-white">Close</button></footer>
      </aside></div>}
    </div>
  );
};

export default CashierTransactionsPage;

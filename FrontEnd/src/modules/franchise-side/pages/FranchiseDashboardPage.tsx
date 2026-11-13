import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Boxes, ShoppingCart, Store, Users, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { formatCurrency } from '../../../utils/formatters';
import { AdminDate, Avatar, DataTable, PageHeader, StatusBadge } from '../../admin-side/components/AdminUI';

interface BranchOrder {
  id: string | number;
  order_number?: string;
  email?: string;
  customer_name?: string;
  user?: { full_name?: string };
  delivery_type?: string | null;
  status?: string;
  total?: number | string;
  payment_method?: string | null;
  payment_status?: string | null;
  created_at?: string;
}

interface BranchUser {
  status?: string;
}

interface DashboardState {
  franchise_id?: string;
  franchise_name?: string;
  branch_address?: string;
  branch_status?: string;
  inventory_items?: number;
  ingredient_inventory_items?: number;
  ingredient_low_stock_items?: number;
  ingredient_out_of_stock_items?: number;
  total_orders?: number;
  total_revenue?: number;
  pos_activity_count?: number;
  pos_sales?: number;
}

interface SectionErrors {
  dashboard?: string;
  orders?: string;
  users?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const money = { format: formatCurrency };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const getRevenueOrders = (orders: BranchOrder[]) => orders.filter((order) => {
  const status = String(order.status || '').trim().toLowerCase();
  const paymentStatus = String(order.payment_status || '').trim().toLowerCase();
  const paymentMethod = String(order.payment_method || '').trim().toLowerCase();
  if (['cancelled', 'failed'].includes(status) || ['failed', 'cancelled', 'expired'].includes(paymentStatus)) return false;
  return paymentStatus === 'paid'
    || (paymentMethod === 'cash_on_delivery' && status === 'delivered' && ['pending', 'unpaid', ''].includes(paymentStatus))
    || (order.delivery_type === 'onsite' && paymentStatus === '');
});

const getOrderDate = (order: BranchOrder) => {
  const date = order.created_at ? new Date(order.created_at) : null;
  return date && !Number.isNaN(date.getTime()) ? startOfDay(date) : null;
};

const fetchData = async (path: string): Promise<unknown> => {
  const response = await fetchWithFranchiseAuth(`${API_URL}${path}`, {
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({})) as { data?: unknown; message?: string };
  if (!response.ok) throw new Error(payload.message || 'Unable to load branch dashboard data.');
  return payload.data;
};

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.name === 'TimeoutError'
    ? 'This section is taking too long to respond. Please retry.'
    : error instanceof Error ? error.message : fallback;

const FranchiseDashboardPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const [dashboard, setDashboard] = useState<DashboardState>({});
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [users, setUsers] = useState<BranchUser[]>([]);
  const [errors, setErrors] = useState<SectionErrors>({});
  const [loading, setLoading] = useState({ dashboard: true, orders: true, users: true });
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadSection = async <T,>(
      section: keyof SectionErrors,
      path: string,
      onSuccess: (data: T) => void,
      fallback: string,
    ) => {
      try {
        const data = await fetchData(path);
        if (!isMounted) return;
        onSuccess(data as T);
        setErrors((current) => ({ ...current, [section]: undefined }));
      } catch (error) {
        if (isMounted) setErrors((current) => ({ ...current, [section]: errorMessage(error, fallback) }));
      } finally {
        if (isMounted) setLoading((current) => ({ ...current, [section]: false }));
      }
    };

    setLoading({ dashboard: true, orders: true, users: true });
    setErrors({});
    void Promise.all([
      loadSection<DashboardState>('dashboard', '/franchise/dashboard', (data) => setDashboard(data), 'Unable to load this branch dashboard.'),
      loadSection<BranchOrder[]>('orders', '/franchise/orders', (data) => setOrders(Array.isArray(data) ? data : []), 'Unable to load this branch’s orders.'),
      loadSection<BranchUser[]>('users', '/franchise/users', (data) => setUsers(Array.isArray(data) ? data : []), 'Unable to load this branch’s staff.'),
    ]);

    return () => { isMounted = false; };
  }, [retryCount]);

  const todayStart = startOfDay(new Date());
  const { weeklySales, currentWeekOrders, previousWeekOrders, currentWeekRevenue, previousWeekRevenue } = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const dayStart = startOfDay(date);
      const dayOrders = orders.filter((order) => getOrderDate(order) === dayStart);
      const revenueOrders = getRevenueOrders(dayOrders);
      return {
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        orders: dayOrders.length,
        total: revenueOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      };
    });
    const currentOrders = orders.filter((order) => {
      const date = getOrderDate(order);
      return date !== null && date >= todayStart - 6 * DAY_MS && date <= todayStart;
    });
    const previousOrders = orders.filter((order) => {
      const date = getOrderDate(order);
      return date !== null && date >= todayStart - 13 * DAY_MS && date < todayStart - 6 * DAY_MS;
    });
    const revenueOrders = getRevenueOrders(orders);
    const revenueInRange = (from: number, through: number) => revenueOrders.reduce((sum, order) => {
      const date = getOrderDate(order);
      return date !== null && date >= from && date <= through ? sum + Number(order.total || 0) : sum;
    }, 0);
    return {
      weeklySales: days,
      currentWeekOrders: currentOrders,
      previousWeekOrders: previousOrders,
      currentWeekRevenue: revenueInRange(todayStart - 6 * DAY_MS, todayStart),
      previousWeekRevenue: revenueInRange(todayStart - 13 * DAY_MS, todayStart - 7 * DAY_MS),
    };
  }, [orders, todayStart]);

  const statusCounts = useMemo(() => {
    const counts = { delivered: 0, pending: 0, preparing: 0, ready: 0, cancelled: 0 };
    orders.forEach((order) => {
      const status = String(order.status || 'pending').toLowerCase();
      if (status === 'delivered' || status === 'completed') counts.delivered += 1;
      else if (status === 'confirmed' || status === 'preparing') counts.preparing += 1;
      else if (status === 'prepared' || status === 'ready') counts.ready += 1;
      else if (status === 'cancelled') counts.cancelled += 1;
      else counts.pending += 1;
    });
    return [
      { key: 'delivered', label: 'Delivered', count: counts.delivered, color: '#15803d' },
      { key: 'pending', label: 'Pending', count: counts.pending, color: '#d97706' },
      { key: 'preparing', label: 'Preparing', count: counts.preparing, color: '#0284c7' },
      { key: 'ready', label: 'Ready', count: counts.ready, color: '#7c3aed' },
      { key: 'cancelled', label: 'Cancelled', count: counts.cancelled, color: '#dc2626' },
    ];
  }, [orders]);

  const branchName = dashboard.franchise_name || franchiseUser?.branch?.name || franchiseUser?.franchise?.name || 'Your branch';
  const branchAddress = dashboard.branch_address || franchiseUser?.branch?.address || franchiseUser?.franchise?.address || 'Branch address not provided';
  const branchId = dashboard.franchise_id || franchiseUser?.franchise_id || franchiseUser?.branch_id || '—';
  const ownerName = franchiseUser?.full_name || franchiseUser?.name || 'there';
  const recentOrders = orders.slice(0, 6);
  const ingredientAlerts = (dashboard.ingredient_low_stock_items || 0) + (dashboard.ingredient_out_of_stock_items || 0);
  const activeUsers = users.filter((user) => String(user.status || '').toLowerCase() === 'active').length;
  const orderSparkline = Array.from({ length: 7 }, (_, index) => {
    const date = todayStart - (6 - index) * DAY_MS;
    return orders.filter((order) => getOrderDate(order) === date).length;
  });

  const retryDashboard = () => setRetryCount((current) => current + 1);

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] px-4 py-4 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader title={`Welcome back, ${ownerName}`} subtitle={`Here’s what’s happening at ${branchName} today.`} />
        <section aria-label="Franchise branch" className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <Store size={13} aria-hidden="true" /> Franchise
          </span>
          <span className="font-semibold text-[var(--oppa-text)]">{branchName}</span>
          <span className="text-[var(--oppa-text-muted)]" aria-hidden="true">·</span>
          <span className="text-[var(--oppa-text-muted)]">{branchAddress}</span>
          <StatusBadge status={dashboard.branch_status || franchiseUser?.franchise?.status || 'active'} />
          <span className="text-xs text-[var(--oppa-text-muted)]">Branch ID: {branchId}</span>
        </section>

        {(Object.keys(errors) as Array<keyof SectionErrors>).some((section) => errors[section]) && (
          <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{errors.dashboard || 'Some branch dashboard information could not be loaded.'}</span>
            <button type="button" onClick={retryDashboard} className="rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">Retry</button>
          </div>
        )}

        <section aria-label="Branch key figures" className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            to="/franchise/orders"
            label="Orders"
            value={loading.dashboard ? '…' : dashboard.total_orders ?? orders.length}
            icon={ShoppingCart}
            trend={loading.orders ? 'Loading…' : errors.orders ? 'Unavailable' : getTrend(currentWeekOrders.length, previousWeekOrders.length)}
            sparkline={orderSparkline}
            loading={loading.orders}
          />
          <KpiCard
            to="/franchise/pos/activity"
            label="Revenue"
            value={loading.dashboard ? '…' : money.format(dashboard.total_revenue ?? 0)}
            symbol="₱"
            trend={loading.orders ? 'Loading…' : errors.orders ? 'Unavailable' : getTrend(currentWeekRevenue, previousWeekRevenue)}
            sparkline={weeklySales.map((day) => day.total)}
            subline={loading.dashboard ? 'Loading POS sales…' : `POS ${money.format(dashboard.pos_sales ?? 0)}`}
            loading={loading.dashboard || loading.orders}
          />
          <KpiCard
            to="/franchise/inventory/ingredients"
            label="Ingredients tracked"
            value={loading.dashboard ? '…' : dashboard.ingredient_inventory_items ?? 0}
            icon={Boxes}
            subline={loading.dashboard ? 'Loading stock status…' : errors.dashboard ? 'Stock status unavailable' : ingredientAlerts > 0 ? `${ingredientAlerts} low or out of stock` : 'All items available'}
            sublineTone={!loading.dashboard && !errors.dashboard && ingredientAlerts === 0 ? 'green' : ingredientAlerts > 0 ? 'warning' : 'muted'}
            loading={loading.dashboard}
          />
          <KpiCard
            to="/franchise/users"
            label="Branch staff"
            value={loading.dashboard ? '…' : activeUsers}
            icon={Users}
            subline={loading.users ? 'Loading accounts…' : errors.users ? 'Account status unavailable' : 'Active accounts'}
            loading={loading.dashboard || loading.users}
          />
        </section>

        <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
          <section aria-labelledby="franchise-recent-orders-title" className="admin-card flex min-h-[530px] flex-col overflow-hidden p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 id="franchise-recent-orders-title" className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Recent Orders</h2>
                <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Latest orders from this branch</p>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--oppa-cream)] px-2.5 py-1 text-[10px] font-semibold text-[var(--oppa-text-muted)]">This branch</span>
            </div>
            {errors.orders ? (
              <p role="status" className="flex flex-1 items-center justify-center py-10 text-center text-sm text-red-700">Orders could not be loaded. Use Retry above to try again.</p>
            ) : loading.orders ? (
              <div role="status" aria-busy="true" aria-label="Loading recent branch orders" className="min-h-64 flex-1" />
            ) : orders.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-10 text-center">
                <p className="max-w-sm text-sm text-[var(--oppa-text-muted)]">No orders yet. Orders from this branch will appear here.</p>
              </div>
            ) : (
              <DataTable
                className="flex-1 [&>div]:overflow-x-auto [&_.admin-table]:min-w-[760px]"
                headers={['Order ID', 'Customer', 'Type', 'Total', 'Status', 'Date']}
                caption="Latest six orders for this branch"
              >
                {recentOrders.map((order) => {
                  const fullOrderId = order.order_number || String(order.id);
                  const visibleOrderId = fullOrderId.length > 8 ? fullOrderId.slice(-8) : fullOrderId;
                  const customerName = order.user?.full_name || order.customer_name || order.email || 'Walk-in customer';
                  return (
                    <tr key={order.id} className="border-b border-[var(--oppa-border)]/70 last:border-0 hover:bg-[var(--oppa-cream)]">
                      <td title={fullOrderId} className="px-4 py-3 font-mono text-xs font-semibold">#{visibleOrderId}</td>
                      <td title={order.email || undefined} className="px-4 py-3">
                        <div className="flex items-center gap-3"><Avatar name={customerName} /><span className="truncate">{customerName}</span></div>
                      </td>
                      <td className="px-4 py-3">{order.delivery_type === 'onsite' ? 'In person' : 'Online'}</td>
                      <td className="px-4 py-3 font-semibold">{money.format(Number(order.total ?? 0))}</td>
                      <td className="px-4 py-3"><StatusBadge status={order.status || 'pending'} /></td>
                      <td className="px-4 py-3"><AdminDate value={order.created_at} /></td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
            <Link to="/franchise/orders" className="mt-auto inline-flex items-center gap-1 self-start pt-4 text-sm font-semibold text-[var(--oppa-green)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]">
              View all <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </section>

          <div className="grid content-start gap-4">
            <SalesCard
              data={weeklySales}
              loading={loading.orders}
              unavailable={Boolean(errors.orders)}
              total={currentWeekRevenue}
              previousTotal={previousWeekRevenue}
            />
            <OrdersByStatusCard
              statuses={statusCounts}
              total={orders.length}
              loading={loading.orders}
              unavailable={Boolean(errors.orders)}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

const getTrend = (current: number, previous: number) => {
  if (current === 0 && previous === 0) return 'No data yet';
  if (previous === 0) return 'New this week';
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? '+' : ''}${change}% vs last week`;
};

const KpiCard: React.FC<{
  to: string;
  label: string;
  value: string | number;
  icon?: LucideIcon;
  symbol?: string;
  trend?: string;
  sparkline?: number[];
  subline?: string;
  sublineTone?: 'green' | 'warning' | 'muted';
  loading?: boolean;
}> = ({ to, label, value, icon: Icon, symbol, trend, sparkline, subline, sublineTone = 'muted', loading }) => {
  const trendValue = trend || 'No data yet';
  const trendIsDown = trendValue.startsWith('-');
  const trendHasChange = trendValue.includes('%');
  const points = sparkline && sparkline.some((item) => item > 0)
    ? sparkline.map((item, index) => {
      const max = Math.max(...sparkline, 1);
      return `${2 + index * 10},${20 - (item / max) * 16}`;
    }).join(' ')
    : '';
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value}${subline ? `. ${subline}` : ''}${trend ? `. ${trendValue}` : ''}`}
      aria-busy={loading}
      className="group flex min-h-[132px] min-w-0 flex-col justify-between rounded-2xl border border-[var(--oppa-border)] bg-white px-4 py-3 shadow-[var(--shadow-card)] transition hover:border-[var(--oppa-green)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
    >
      <span className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-xl font-bold leading-tight text-[var(--oppa-text)] sm:text-2xl">{value}</span>
          <span className="mt-1 block text-xs font-medium text-[var(--oppa-text-muted)]">{label}</span>
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-[var(--oppa-green)]" aria-hidden="true">
          {Icon ? <Icon size={18} /> : <span className="text-xl font-semibold leading-none">{symbol}</span>}
        </span>
      </span>
      <span className="mt-3 flex min-h-6 items-center justify-between gap-2">
        {trend && (
          <span className={`truncate rounded-full px-2 py-1 text-[10px] font-semibold ${trendIsDown ? 'bg-red-50 text-red-700' : trendHasChange ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-[var(--oppa-text-muted)]'}`}>
            {trendValue}
          </span>
        )}
        {points && <svg aria-hidden="true" viewBox="0 0 64 24" className="h-6 w-16 shrink-0"><polyline points={points} fill="none" stroke={trendIsDown ? '#dc2626' : '#267a43'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      {subline && (
        <span className={`mt-1 block truncate text-[11px] leading-4 ${sublineTone === 'green' ? 'font-medium text-emerald-700' : sublineTone === 'warning' ? 'font-medium text-amber-700' : 'text-[var(--oppa-text-muted)]'}`}>
          {subline}
        </span>
      )}
    </Link>
  );
};

interface SalesDay {
  label: string;
  date: string;
  orders: number;
  total: number;
}

const SalesCard: React.FC<{
  data: SalesDay[];
  loading: boolean;
  unavailable: boolean;
  total: number;
  previousTotal: number;
}> = ({ data, loading, unavailable, total, previousTotal }) => {
  const maxSales = Math.max(...data.map((item) => item.total), 1);
  const points = data.map((item, index) => `${42 + (index * 514) / 6},${146 - (item.total / maxSales) * 106}`).join(' ');
  const areaPoints = `42,148 ${points} 556,148`;
  const trend = loading ? 'Loading…' : unavailable ? 'Unavailable' : getTrend(total, previousTotal);
  const trendIsDown = trend.startsWith('-');
  const best = data.reduce((current, day) => day.total > current.total ? day : current, data[0]);
  return (
    <section className="admin-card flex min-h-[300px] flex-col p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Sales last 7 days</h2>
          <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Daily revenue · This branch</p>
        </div>
        <div className="text-right">
          <p className="tabular-nums text-lg font-bold text-[var(--oppa-text)]">{money.format(total)} <span className="text-xs font-medium text-[var(--oppa-text-muted)]">this week</span></p>
          <span className={`text-xs font-semibold ${trendIsDown ? 'text-red-700' : trend.includes('%') ? 'text-emerald-800' : 'text-[var(--oppa-text-muted)]'}`}>{trend}</span>
        </div>
      </div>
      {loading ? <div role="status" aria-busy="true" aria-label="Loading branch sales chart" className="my-4 min-h-48 flex-1" /> : unavailable ? (
        <p role="status" className="mt-4 text-sm text-red-700">Branch sales data could not be loaded.</p>
      ) : (
        <div className="relative mt-2 flex-1">
          <svg role="img" aria-label="Area chart of this branch’s sales in the last seven days" viewBox="0 0 600 190" className="h-full min-h-[190px] w-full overflow-visible">
            <defs><linearGradient id="franchise-sales-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#267a43" stopOpacity=".22" /><stop offset="100%" stopColor="#267a43" stopOpacity=".01" /></linearGradient></defs>
            {[40, 76, 112, 148].map((y, index) => <g key={y}><line x1="40" x2="574" y1={y} y2={y} stroke="var(--oppa-border)" strokeDasharray="4 5" /><text x="34" y={y + 4} textAnchor="end" fill="var(--oppa-text-muted)" fontSize="11">{money.format(maxSales * (3 - index) / 3).replace(/\.00$/, '')}</text></g>)}
            <polygon points={areaPoints} fill="url(#franchise-sales-area)" />
            <polyline points={points} fill="none" stroke="#267a43" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((item, index) => {
              const x = 42 + (index * 514) / 6;
              const y = 146 - (item.total / maxSales) * 106;
              return <g key={`${item.label}-${item.date}`}><circle cx={x} cy={y} r="3.5" fill="#267a43" stroke="white" strokeWidth="1.5" /><text x={x} y="174" textAnchor="middle" fill="var(--oppa-text-muted)" fontSize="12">{item.label}</text></g>;
            })}
          </svg>
          {total === 0 && <p className="mt-1 text-center text-xs text-[var(--oppa-text-muted)]">No sales yet this week.</p>}
          <p className="mt-1 text-right text-xs text-[var(--oppa-text-muted)]">Best day: <strong className="text-[var(--oppa-text)]">{best.total > 0 ? best.label : '—'}</strong></p>
        </div>
      )}
    </section>
  );
};

interface OrderStatusSummary {
  key: string;
  label: string;
  count: number;
  color: string;
}

const OrdersByStatusCard: React.FC<{
  statuses: OrderStatusSummary[];
  total: number;
  loading: boolean;
  unavailable: boolean;
}> = ({ statuses, total, loading, unavailable }) => {
  let cumulative = 0;
  const gradient = total > 0
    ? statuses.map((status) => {
      const from = cumulative;
      cumulative += (status.count / total) * 100;
      return `${status.color} ${from}% ${cumulative}%`;
    }).join(', ')
    : '#e7ebe7 0% 100%';
  return (
    <section className="admin-card flex min-h-[220px] flex-col p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Orders by status</h2><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">This branch</p></div>
      </div>
      {loading ? <div role="status" aria-busy="true" aria-label="Loading branch order status chart" className="mt-4 h-36" /> : unavailable ? (
        <p role="status" className="mt-4 text-sm text-red-700">Branch order status could not be loaded.</p>
      ) : (
        <div className="mt-4 flex min-h-0 flex-1 items-center gap-4 sm:gap-6">
          <div aria-label={`${total} branch orders by status`} role="img" className="relative size-32 shrink-0 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
            <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-white text-center">
              <span className="tabular-nums text-xl font-bold text-[var(--oppa-text)]">{total > 0 ? total : <span className="text-xs font-medium text-[var(--oppa-text-muted)]">No orders yet</span>}</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1 text-xs">
            {statuses.map((status) => (
              <li key={status.key} className="flex items-center gap-2 rounded-md px-1 py-1 text-[var(--oppa-text-muted)]">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="min-w-0 flex-1 truncate">{status.label}</span>
                <strong className="tabular-nums text-[var(--oppa-text)]">{status.count}</strong>
                <span className="w-10 text-right tabular-nums text-[var(--oppa-text-muted)]">{total ? Math.round(status.count / total * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default FranchiseDashboardPage;

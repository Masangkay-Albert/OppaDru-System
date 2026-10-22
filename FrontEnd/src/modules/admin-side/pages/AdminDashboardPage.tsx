import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Users, Package, AlertTriangle, ArrowRight, Copy } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import StatCard from '../components/StatCard';
import { Avatar, DataTable, EmptyState, PageHeader, StatusBadge, Toast } from '../components/AdminUI';
import { getAllOrders, isRevenueOrder, type AdminOrder, getAllCustomers } from '../../../services/adminOrderService';
import { apiGetAdminCount } from '../../../services/adminAuthService';
import { getAllProducts } from '../../../services/adminProductService';
import { formatCurrency } from '../../../utils/formatters';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const DashboardCharts: React.FC<{ orders: AdminOrder[]; loading: boolean; unavailable: boolean }> = ({ orders, loading, unavailable }) => {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const data = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (6 - index));
      const dayStart = startOfDay(day);
      const dayOrders = orders.filter((order) => {
        const raw = order.created_at || order.timestamp;
        const date = raw ? new Date(raw) : null;
        return date && !Number.isNaN(date.getTime()) && startOfDay(date) === dayStart && isRevenueOrder(order);
      });
      return { label: day.toLocaleDateString('en-US', { weekday: 'short' }), date: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), total: dayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0), orders: dayOrders.length };
    });
  }, [orders]);

  const statuses = useMemo(() => {
    const counts = new Map<string, number>();
    orders.forEach((order) => {
      const key = String(order.status || 'pending').toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [orders]);
  const statusMeta: Record<string, { label: string; color: string }> = {
    delivered: { label: 'Delivered', color: '#15803d' },
    pending: { label: 'Pending', color: '#d97706' },
    on_the_way: { label: 'On the way', color: '#0284c7' },
    completed: { label: 'Completed', color: '#0f766e' },
    arrived: { label: 'Arrived', color: '#7c3aed' },
    cancelled: { label: 'Cancelled', color: '#dc2626' },
    preparing: { label: 'Preparing', color: '#0f766e' },
    ready: { label: 'Ready', color: '#7c3aed' },
    scheduled: { label: 'Scheduled', color: '#d97706' },
  };
  const totalSales = data.reduce((sum, day) => sum + day.total, 0);
  const previousWeekSales = useMemo(() => {
    const start = startOfDay(new Date()) - 13 * 86400000;
    const end = startOfDay(new Date()) - 6 * 86400000;
    return orders.reduce((sum, order) => {
      const raw = order.created_at || order.timestamp;
      const date = raw ? new Date(raw) : null;
      return date && startOfDay(date) >= start && startOfDay(date) < end && isRevenueOrder(order) ? sum + Number(order.total || 0) : sum;
    }, 0);
  }, [orders]);
  const trend = previousWeekSales > 0 ? Math.round(((totalSales - previousWeekSales) / previousWeekSales) * 100) : 0;
  const bestDay = data.reduce((best, day) => day.total > best.total ? day : best, data[0]);
  const maxSales = Math.max(...data.map((item) => item.total), 1);
  const points = data.map((item, index) => `${42 + (index * 514) / 6},${146 - (item.total / maxSales) * 106}`).join(' ');
  const total = statuses.reduce((sum, [, count]) => sum + count, 0);
  let cumulative = 0;
  const gradient = statuses.length ? statuses.map(([status, count]) => {
    const from = cumulative;
    cumulative += (count / total) * 100;
    return `${statusMeta[status]?.color || '#64748b'} ${from}% ${cumulative}%`;
  }).join(', ') : '#e7ebe7 0% 100%';
  const highestDayIndex = data.reduce((best, day, index) => day.total > data[best].total ? index : best, 0);

  return (
    <div className="grid h-full content-start gap-4">
      <section className="admin-card flex h-full min-h-[300px] flex-col p-5">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div><h2 className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Sales last 7 days</h2><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Daily order revenue</p></div>
          <div className="text-right"><p className="tabular-nums text-lg font-bold text-[var(--oppa-text)]">{formatCurrency(totalSales)} <span className="text-xs font-medium text-[var(--oppa-text-muted)]">this week</span></p><span className={`text-[11px] font-semibold ${trend >= 0 ? 'text-green-800' : 'text-red-700'}`}>{trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last week</span></div>
        </div>
        {loading ? <div aria-busy="true" className="admin-skeleton my-4 min-h-48 flex-1 animate-pulse rounded-xl" /> : unavailable ? <p className="mt-4 text-sm text-red-700">Sales data could not be loaded.</p> : <div className="relative mt-2 flex-1">
          <svg role="img" aria-label="Area chart of sales in the last seven days" viewBox="0 0 600 190" className="h-full min-h-[210px] w-full overflow-visible">
            <defs><linearGradient id="sales-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#267a43" stopOpacity=".22" /><stop offset="100%" stopColor="#267a43" stopOpacity=".01" /></linearGradient></defs>
            {[40, 76, 112, 148].map((y, index) => <g key={y}><line x1="40" x2="574" y1={y} y2={y} stroke="var(--oppa-border)" strokeDasharray="4 5" /><text x="34" y={y + 3} textAnchor="end" fill="var(--oppa-text-muted)" fontSize="9">{formatCurrency(maxSales * (3 - index) / 3).replace(/\.00$/, '')}</text></g>)}
            <polygon points={`42,148 ${points} 556,148`} fill="url(#sales-area)" />
            <polyline className="admin-chart-line" points={points} fill="none" stroke="#267a43" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {data.map((item, index) => {
              const x = 42 + (index * 514) / 6;
              const y = 146 - (item.total / maxSales) * 106;
              const isPeak = index === highestDayIndex && item.total > 0;
              return <g key={item.label} onMouseEnter={() => setHoveredDay(index)} onMouseLeave={() => setHoveredDay(null)} className="cursor-pointer">
                <circle cx={x} cy={y} r="12" fill="transparent" />
                <circle cx={x} cy={y} r={hoveredDay === index ? 4 : 3} fill={isPeak ? '#d97706' : '#267a43'} stroke="white" strokeWidth="1.5" className="transition-all duration-150" />
                <text x={x} y="174" textAnchor="middle" fill="var(--oppa-text-muted)" fontSize="10">{item.label}</text>
              </g>;
            })}
          </svg>
          {hoveredDay !== null && <div className="pointer-events-none absolute top-2 z-10 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 py-2 text-xs shadow-lg" style={{ left: `${Math.min(76, Math.max(3, hoveredDay * 13))}%` }}>
            <p className="font-semibold text-[var(--oppa-text)]">{data[hoveredDay].date}</p><p className="mt-1 tabular-nums text-[var(--oppa-green-dark)]">{formatCurrency(data[hoveredDay].total)}</p><p className="text-[var(--oppa-text-muted)]">{data[hoveredDay].orders} orders</p>
          </div>}
          <p className="mt-1 text-right text-[10px] text-[var(--oppa-text-muted)]">Best day: <strong className="text-[var(--oppa-text)]">{bestDay.label}</strong></p>
        </div>}
      </section>
      <section className="admin-card flex min-h-[220px] flex-col p-5">
        <div><h2 className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Orders by status</h2><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{total} total orders</p></div>
        {loading ? <div aria-busy="true" className="admin-skeleton mt-4 h-36 animate-pulse rounded-xl" /> : unavailable ? <p className="mt-4 text-sm text-red-700">Order status data could not be loaded.</p> : <div className="mt-4 flex min-h-0 flex-1 items-center gap-4 sm:gap-6">
          <div aria-label={`${total} orders by status`} role="img" className="relative size-32 shrink-0 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
            <div className="absolute inset-[18px] flex items-center justify-center rounded-full bg-[var(--oppa-surface)] text-center"><span className="tabular-nums text-xl font-bold text-[var(--oppa-text)]">{total}<small className="block text-[10px] font-medium text-[var(--oppa-text-muted)]">Orders</small></span></div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
            {statuses.map(([status, count]) => {
              const meta = statusMeta[status] || { label: status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()), color: '#64748b' };
              return <li key={status} onMouseEnter={() => setHoveredStatus(status)} onMouseLeave={() => setHoveredStatus(null)} className={`flex items-center gap-2 rounded-md px-1 py-1 text-[var(--oppa-text-muted)] transition ${hoveredStatus === status ? 'bg-[var(--oppa-green-soft)]' : ''}`}><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} /><span className="min-w-0 flex-1 truncate">{meta.label}</span><strong className="tabular-nums text-[var(--oppa-text)]">{count}</strong><span className="w-10 text-right tabular-nums text-[var(--oppa-text-muted)]">{total ? Math.round(count / total * 100) : 0}%</span></li>;
            })}
            {!statuses.length && <li className="text-[var(--oppa-text-muted)]">No orders yet.</li>}
          </ul>
        </div>}
      </section>
    </div>
  );
};

const formatRelativeDate = (raw?: string) => {
  if (!raw) return { relative: 'N/A', full: 'Date unavailable' };
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return { relative: raw, full: raw };
  const days = Math.floor((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  const relative = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 7 ? `${days} days ago` : date.toLocaleDateString();
  return { relative, full: date.toLocaleString() };
};

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { admin } = useAdminAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [outOfStock, setOutOfStock] = useState(0);
  const [totalAdmins, setTotalAdmins] = useState(0);
  type DashboardSection = 'orders' | 'customers' | 'products' | 'admins';
  const [sectionLoading, setSectionLoading] = useState<Record<DashboardSection, boolean>>({
    orders: true,
    customers: true,
    products: true,
    admins: true,
  });
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<DashboardSection, string>>>({});
  const [notice, setNotice] = useState('');

  const loadDashboard = useCallback(async () => {
    const loadSection = async <T,>(
      section: DashboardSection,
      load: () => Promise<T>,
      onSuccess: (result: T) => void,
    ) => {
      setSectionLoading((current) => ({ ...current, [section]: true }));
      setSectionErrors((current) => ({ ...current, [section]: undefined }));
      try {
        onSuccess(await load());
      } catch (error) {
        console.error(`Failed to load dashboard ${section}.`, error);
        setSectionErrors((current) => ({ ...current, [section]: 'Unable to load this section.' }));
      } finally {
        setSectionLoading((current) => ({ ...current, [section]: false }));
      }
    };

    await Promise.all([
      loadSection('orders', () => getAllOrders(true), (result) => setOrders(result)),
      loadSection('customers', getAllCustomers, (result) => setTotalUsers(result.length)),
      loadSection('products', getAllProducts, (result) => {
        setTotalProducts(result.length);
        setOutOfStock(result.filter((product) => !(product.isAvailable ?? product.is_available)).length);
      }),
      loadSection('admins', apiGetAdminCount, setTotalAdmins),
    ]);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboard(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const recentOrders = Array.isArray(orders) ? orders.slice(0, 6) : [];
  const ordersTrend = useMemo(() => {
    const today = startOfDay(new Date());
    const current = Array(7).fill(0) as number[];
    let previousTotal = 0;
    orders.forEach((order) => {
      const raw = order.created_at || order.timestamp;
      const date = raw ? new Date(raw) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const offset = Math.floor((today - startOfDay(date)) / 86400000);
      if (offset >= 0 && offset < 7) current[6 - offset] += 1;
      else if (offset >= 7 && offset < 14) previousTotal += 1;
    });
    const currentTotal = current.reduce((sum, count) => sum + count, 0);
    return {
      sparkline: current,
      trend: previousTotal > 0 ? `${Math.round(((currentTotal - previousTotal) / previousTotal) * 100)}%` : undefined,
      direction: currentTotal >= previousTotal ? 'up' as const : 'down' as const,
    };
  }, [orders]);

  const copyOrderId = (orderId: string) => {
    if (!navigator.clipboard) {
      setNotice('Copying order IDs is not supported by this browser.');
      return;
    }
    void navigator.clipboard.writeText(orderId).then(() => setNotice('Order ID copied.')).catch((error: unknown) => {
      console.error('Could not copy order ID:', error);
      setNotice('Could not copy order ID.');
    });
  };

  const titleCase = (value: string) => value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <AdminLayout>
      {notice && <Toast message={notice} tone="error" onDismiss={() => setNotice('')} />}
      <PageHeader title={`Welcome back, ${admin?.fullName || 'Admin'}`} subtitle="Here’s what’s happening today." />
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total Orders" value={orders.length} icon={ShoppingBag} accent="green" trend={ordersTrend.trend} trendDirection={ordersTrend.direction} sparkline={ordersTrend.sparkline} context={sectionErrors.orders || 'Orders to date'} loading={sectionLoading.orders} unavailable={!!sectionErrors.orders} />
        <StatCard label="Total Users" value={totalUsers} icon={Users} accent="amber" context={sectionErrors.customers || 'Registered customers'} loading={sectionLoading.customers} unavailable={!!sectionErrors.customers} />
        <StatCard label="Total Products" value={totalProducts} icon={Package} accent="green" context={sectionErrors.products || 'Menu items'} loading={sectionLoading.products} unavailable={!!sectionErrors.products} />
        <StatCard label="Total Admins" value={totalAdmins} icon={Users} accent="amber" context={sectionErrors.admins || 'Admin accounts'} loading={sectionLoading.admins} unavailable={!!sectionErrors.admins} />
        <StatCard label="Out of Stock" value={outOfStock} icon={AlertTriangle} tone="warning" accent="red" context={sectionErrors.products || (outOfStock > 0 ? `${outOfStock} item${outOfStock === 1 ? '' : 's'} need attention` : 'All items available')} loading={sectionLoading.products} unavailable={!!sectionErrors.products} />
      </div>
      <div className="mb-6 grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
      <section className="admin-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-5 py-4">
          <div><h2 className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Recent Orders</h2><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Latest customer activity</p></div>
        </div>
        {sectionLoading.orders ? <div aria-label="Loading recent orders" aria-busy="true" className="admin-skeleton m-4 h-72 animate-pulse rounded-xl" /> : <DataTable className="dashboard-orders-table" columnWidths={['240px', 'calc(100% - 630px)', '120px', '140px', '130px']} columnAlignments={['left', 'left', 'right', 'left', 'right']} caption="Recent orders" headers={['Order ID', 'Customer', 'Total', 'Status', 'Date']}>
          {sectionErrors.orders ? <tr><td colSpan={5} className="p-4 text-center text-sm text-red-700">{sectionErrors.orders}</td></tr> : recentOrders.length === 0 ? <tr><td colSpan={5} className="p-2"><EmptyState title="No orders yet" description="New orders will show up here as soon as customers place them." action={<button type="button" onClick={() => navigate('/admin/orders')} className="mt-2 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]">Open orders</button>} /></td></tr> :
            recentOrders.map((order) => {
              const date = formatRelativeDate(order.created_at || order.timestamp);
              const fullOrderId = String(order.order_number || order.id || '');
              const customerName = titleCase(order.customerName || order.email || 'Customer');
              return <tr key={order.id} tabIndex={0} role="link" aria-label={`Open order ${order.order_number || order.id}`} onClick={() => navigate('/admin/orders', { state: { orderId: order.id } })} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate('/admin/orders', { state: { orderId: order.id } }); } }} className="cursor-pointer border-b border-[var(--oppa-border)]/70 last:border-0 hover:bg-[var(--oppa-cream)] focus-visible:bg-[var(--oppa-cream)]">
                <td data-label="Order ID" className="col-left group/orderid"><div className="flex min-w-0 items-center gap-1.5"><span className="truncate whitespace-nowrap font-mono text-xs text-[var(--oppa-text-muted)]" title={fullOrderId}>{fullOrderId}</span><button type="button" aria-label={`Copy order ID ${fullOrderId}`} title="Copy order ID" onClick={(event) => { event.stopPropagation(); copyOrderId(fullOrderId); }} className="rounded p-1 text-[var(--oppa-text-muted)] opacity-0 transition-opacity hover:bg-[var(--oppa-green-soft)] group-hover/orderid:opacity-100 group-focus-within/orderid:opacity-100"><Copy size={13} /></button></div></td>
                <td data-label="Customer" className="col-left"><div className="flex min-w-0 items-center gap-2.5"><Avatar name={customerName} className="size-8" /><div className="min-w-0"><p className="truncate font-medium text-[var(--oppa-text)]">{customerName}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{order.email}</p></div></div></td>
                <td data-label="Total" className="col-right tabular-nums whitespace-nowrap font-semibold text-[var(--oppa-text)]">{formatCurrency(order.total || 0)}</td>
                <td data-label="Status" className="col-left whitespace-nowrap"><StatusBadge status={String(order.status || 'pending')} /></td>
                <td data-label="Date" className="col-right whitespace-nowrap text-xs text-[var(--oppa-text-muted)]"><time dateTime={order.created_at || order.timestamp || undefined} title={date.full}>{date.relative}</time></td>
              </tr>;
            })}
        </DataTable>}
        <footer className="flex justify-end border-t border-[var(--oppa-border)] px-4 py-3"><button type="button" onClick={() => navigate('/admin/orders')} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]">View All <ArrowRight size={15} /></button></footer>
      </section>
      <DashboardCharts orders={orders} loading={sectionLoading.orders} unavailable={!!sectionErrors.orders} />
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, ClipboardList, Download, IndianRupee, Package,
  Printer, Store, TrendingUp, Users, X,
} from 'lucide-react';
import { getFranchiseAccountDetailedReport } from '../../../services/franchiseAdminService';
import type { FranchiseAccountDetailedReport } from '../../../services/franchiseAdminService';
import '../styles/franchise-account-detail.css';

type DatePreset = 'today' | 'last-7' | 'last-30' | 'month' | 'last-month' | 'year' | 'custom';
type Location = { id: string; name: string };
type ReportOrder = FranchiseAccountDetailedReport['recent_orders'][number];
type LocationSortKey = 'location_name' | 'orders' | 'sales' | 'average_order_value' | 'completed_rate' | 'cancelled' | 'share';

const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
const integer = new Intl.NumberFormat('en-PH');
const money = (value: number) => peso.format(Number.isFinite(value) ? value : 0);

const manilaDate = (date: Date) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(date);

const monthRange = (date: Date) => {
  const [, year, month] = manilaDate(date).match(/^(\d{4})-(\d{2})-/) || [];
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay).padStart(2, '0')}` };
};

const rangeFor = (preset: Exclude<DatePreset, 'custom'>) => {
  const today = manilaDate(new Date());
  if (preset === 'today') return { from: today, to: today };
  if (preset === 'month') return monthRange(new Date());
  if (preset === 'last-month') {
    const [year, month] = today.split('-').map(Number);
    return monthRange(new Date(Date.UTC(year, month - 2, 1, 12)));
  }
  if (preset === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today };
  const end = new Date(`${today}T00:00:00Z`);
  const offset = preset === 'last-7' ? 6 : 29;
  const start = new Date(end.getTime() - offset * 86400000);
  return { from: manilaDate(start), to: today };
};

const percentageChange = (current: number, previous: number) => {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / Math.abs(previous) * 100;
};

const Trend: React.FC<{ current: number; previous: number; inverse?: boolean }> = ({ current, previous, inverse = false }) => {
  const value = percentageChange(current, previous);
  if (value === null) return <span className="franchise-trend franchise-trend-neutral">New</span>;
  const favorable = inverse ? value <= 0 : value >= 0;
  return <span className={`franchise-trend ${value === 0 ? 'franchise-trend-neutral' : favorable ? 'franchise-trend-up' : 'franchise-trend-down'}`} aria-label={`${value >= 0 ? 'Up' : 'Down'} ${Math.abs(value).toFixed(1)} percent versus previous period`}>
    {value >= 0 ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
  </span>;
};

const Kpi: React.FC<{
  title: string;
  value: string;
  Icon: React.ComponentType<{ size?: number }>;
  tone: string;
  current?: number;
  previous?: number;
  secondaryCurrent?: number;
  secondaryPrevious?: number;
  secondaryLabel?: string;
  inverse?: boolean;
  detail?: string;
}> = ({ title, value, Icon, tone, current, previous, secondaryCurrent, secondaryPrevious, secondaryLabel, inverse, detail }) => (
  <article className="franchise-kpi-card">
    <span className={`franchise-kpi-icon ${tone}`}><Icon size={18} aria-hidden="true" /></span>
    <div className="min-w-0"><p className="text-xs text-[var(--oppa-text-muted)]">{title}</p><strong className="mt-1 block truncate text-xl tabular-nums">{value}</strong>{detail && <span className="mt-1 block truncate text-[10px] text-[var(--oppa-text-muted)]">{detail}</span>}{secondaryCurrent !== undefined && secondaryPrevious !== undefined && <span className="mt-1 flex items-center gap-1 text-[10px] text-[var(--oppa-text-muted)]">{secondaryLabel}<Trend current={secondaryCurrent} previous={secondaryPrevious} inverse={inverse} /></span>}</div>
    {current !== undefined && previous !== undefined && <Trend current={current} previous={previous} inverse={inverse} />}
  </article>
);

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
  <section className={`franchise-report-card ${className}`}><div className="mb-4"><h3 className="font-serif text-base font-semibold">{title}</h3>{subtitle && <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{subtitle}</p>}</div>{children}</section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl bg-[var(--oppa-cream)] p-4 text-center text-sm text-[var(--oppa-text-muted)]"><BarChart3 size={22} className="text-[var(--oppa-green)]" aria-hidden="true" /><span>{text}</span></div>
);

const statusClass = (status: string) => {
  const value = status.toLowerCase();
  if (['completed', 'delivered', 'active'].includes(value)) return 'status-active';
  if (['cancelled', 'failed', 'refunded', 'inactive'].includes(value)) return value === 'inactive' ? 'status-inactive' : 'status-cancelled';
  return 'status-pending';
};

const dateTime = (value: string) => new Date(value).toLocaleString('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
});
const hourLabel = (hour: number) => `${hour % 12 || 12}${hour < 12 ? ' AM' : ' PM'}`;

const FranchiseAccountReportView: React.FC<{
  accountId: string;
  locations: Location[];
  managers: number;
  staff: number;
  allOrders: number;
  allSales: number;
  onData?: (report: FranchiseAccountDetailedReport) => void;
}> = ({ accountId, locations, managers, staff, allOrders, allSales, onData }) => {
  const [preset, setPreset] = useState<DatePreset>('month');
  const [range, setRange] = useState(() => rangeFor('month'));
  const [locationId, setLocationId] = useState('');
  const [report, setReport] = useState<FranchiseAccountDetailedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<ReportOrder | null>(null);
  const [sort, setSort] = useState<{ key: LocationSortKey; direction: 'asc' | 'desc' }>({ key: 'sales', direction: 'desc' });

  useEffect(() => {
    let mounted = true;
    void getFranchiseAccountDetailedReport(accountId, { ...range, locationId })
      .then((value) => {
        if (mounted) {
          setReport(value);
          onData?.(value);
        }
      })
      .catch((loadError: unknown) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load franchise report.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [accountId, range, locationId, onData, refreshKey]);

  useEffect(() => {
    if (!selectedOrder) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedOrder(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedOrder]);

  const products = useMemo(() => [...(report?.top_products || [])].sort((a, b) => b.units_sold - a.units_sold), [report?.top_products]);
  const locationsSorted = useMemo(() => {
    const rows = [...(report?.sales_by_location || [])];
    const { key, direction } = sort;
    rows.sort((a, b) => {
      const left = a[key];
      const right = b[key];
      const comparison = typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right)
        : Number(left) - Number(right);
      return direction === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [report?.sales_by_location, sort]);

  const summary = report?.summary;
  const previous = report?.previous;
  const staffRows = [...(report?.staff_performance || []), ...(report?.franchise_user_performance || [])];
  const completedRate = summary?.total_orders ? summary.completed_orders / summary.total_orders * 100 : 0;
  const previousCompletedRate = previous?.total_orders ? previous.completed_orders / previous.total_orders * 100 : 0;
  const orderTypeCount = report?.order_types.reduce((total, row) => total + row.count, 0) ?? 0;
  const deliveryCount = report?.order_types.find((row) => row.type === 'delivery')?.count ?? 0;
  const previousTypeCount = report?.previous_order_types.reduce((total, row) => total + row.count, 0) ?? 0;
  const previousDeliveryCount = report?.previous_order_types.find((row) => row.type === 'delivery')?.count ?? 0;
  const deliveryShare = orderTypeCount ? deliveryCount / orderTypeCount * 100 : 0;
  const previousDeliveryShare = previousTypeCount ? previousDeliveryCount / previousTypeCount * 100 : 0;
  const maxCategorySales = Math.max(1, ...(report?.categories || []).map((category) => category.sales));
  const maxHourCount = Math.max(1, ...(report?.peak_hours || []).map((hour) => hour.orders));
  const maxWeekdayCount = Math.max(1, ...(report?.orders_by_weekday || []).map((day) => day.orders));
  const topProduct = products[0];
  const peakHour = report?.peak_hours.reduce<FranchiseAccountDetailedReport['peak_hours'][number] | null>((best, row) => !best || row.orders > best.orders ? row : best, null);
  const busiestDay = report?.orders_by_weekday[0];
  const cancellationRate = summary?.total_orders ? summary.cancelled_refunded_orders / summary.total_orders * 100 : 0;
  const insights = [
    summary && previous && percentageChange(summary.total_sales, previous.total_sales) !== null
      ? `Sales ${summary.total_sales >= previous.total_sales ? 'up' : 'down'} ${Math.abs(percentageChange(summary.total_sales, previous.total_sales) || 0).toFixed(1)}% vs previous period`
      : null,
    peakHour && peakHour.orders ? `Peak hour: ${hourLabel(peakHour.hour)}–${hourLabel((peakHour.hour + 1) % 24)}`
      : null,
    topProduct ? `Best seller: ${topProduct.name} (${integer.format(topProduct.units_sold)} sold)` : null,
    summary && summary.total_orders ? cancellationRate > 10
      ? `Cancelled/refunded rate is above 10% (${cancellationRate.toFixed(1)}%)`
      : `Cancelled/refunded rate: ${cancellationRate.toFixed(1)}%` : null,
    busiestDay?.orders ? `Busiest day: ${busiestDay.day} (${integer.format(busiestDay.orders)} orders)` : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 4);

  const retry = () => {
    setLoading(true);
    setError('');
    setRefreshKey((key) => key + 1);
  };
  const selectPreset = (value: DatePreset) => {
    setLoading(true);
    setError('');
    setPreset(value);
    if (value !== 'custom') setRange(rangeFor(value));
  };
  const changeRange = (key: 'from' | 'to', value: string) => {
    setLoading(true);
    setError('');
    setRange((current) => ({ ...current, [key]: value }));
  };
  const changeLocation = (value: string) => {
    setLoading(true);
    setError('');
    setLocationId(value);
  };
  const changeSort = (key: LocationSortKey) => setSort((current) => ({
    key,
    direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
  }));
  const exportCsv = () => {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      ['Franchise report', report.range.from, report.range.to],
      ['Location', locations.find((item) => item.id === locationId)?.name || 'All locations'],
      [],
      ['Metric', 'Value'],
      ['Total sales', report.summary.total_sales],
      ['Total orders', report.summary.total_orders],
      ['Average order value', report.summary.average_order_value],
      ['Completed orders', report.summary.completed_orders],
      ['Cancelled/refunded orders', report.summary.cancelled_refunded_orders],
      ['Cancelled/refunded order value', report.summary.cancelled_refunded_order_value],
      ['Discounts', report.summary.discounts],
      [],
      ['Top products', 'Category', 'Units sold', 'Gross sales', 'Percent of franchise sales'],
      ...report.top_products.map((row) => [row.name, row.category, row.units_sold, row.revenue, report.summary.total_sales ? row.revenue / report.summary.total_sales * 100 : 0]),
      [],
      ['Category', 'Units sold', 'Sales'],
      ...report.categories.map((row) => [row.name, row.units_sold, row.sales]),
      [],
      ['Sales by location', 'Orders', 'Sales', 'Average order value', 'Completed %', 'Cancelled', 'Sales share %'],
      ...report.sales_by_location.map((row) => [row.location_name, row.orders, row.sales, row.average_order_value, row.completed_rate, row.cancelled, row.share]),
      [],
      ['Staff', 'Role', 'Orders handled', 'Sales handled', 'Location'],
      ...staffRows.map((row) => [row.name, row.role, row.orders_handled, row.sales, locations.find((item) => item.id === row.location_id)?.name || 'Not assigned']),
      [],
      ['Driver', 'Deliveries completed', 'Cancelled deliveries', 'Average delivery minutes'],
      ...report.driver_performance.map((row) => [row.name, row.deliveries_completed, row.cancelled_deliveries, row.average_delivery_minutes ?? '']),
      [],
      ['Orders', 'Date/time', 'Location', 'Customer', 'Type', 'Payment', 'Status', 'Total'],
      ...report.recent_orders.map((row) => [row.order_number, row.created_at, row.location_name || '', row.customer, row.type, row.payment_method, row.status, row.total]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `franchise-report-${range.from}-${range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const locationTotals = (report?.sales_by_location || []).reduce((totals, row) => ({
    orders: totals.orders + row.orders,
    sales: totals.sales + row.sales,
    revenueOrders: totals.revenueOrders + row.revenue_orders,
    completed: totals.completed + row.completed_orders,
    cancelled: totals.cancelled + row.cancelled,
    share: totals.share + row.share,
  }), { orders: 0, sales: 0, revenueOrders: 0, completed: 0, cancelled: 0, share: 0 });

  return (
    <section id="franchise-report" className="space-y-4 scroll-mt-32">
      <div className="franchise-kpi-grid">
        <Kpi title="Locations" value={integer.format(locations.length)} Icon={Store} tone="tone-green" />
        <Kpi title="Managers" value={integer.format(managers)} Icon={Users} tone="tone-gold" />
        <Kpi title="Staff" value={integer.format(staff)} Icon={Users} tone="tone-blue" />
        <Kpi title="Orders" value={integer.format(summary?.total_orders ?? allOrders)} Icon={ClipboardList} tone="tone-orange" current={summary?.total_orders} previous={previous?.total_orders} />
        <Kpi title="Sales" value={money(summary?.total_sales ?? allSales)} Icon={IndianRupee} tone="tone-green" current={summary?.total_sales} previous={previous?.total_sales} />
      </div>

      <div className="franchise-report-toolbar">
        <div className="min-w-52"><h2 className="font-serif text-lg font-semibold">Franchise Report</h2><p className="text-xs text-[var(--oppa-text-muted)]">{report?.revenue_rules || 'Sales include orders counted as revenue by the existing order rules.'}</p></div>
        <div className="franchise-report-controls">
          <div className="franchise-date-chips" role="group" aria-label="Report date range">
            {([
              ['today', 'Today'], ['last-7', 'Last 7 days'], ['last-30', 'Last 30 days'],
              ['month', 'This month'], ['last-month', 'Last month'], ['year', 'This year'], ['custom', 'Custom range'],
            ] as Array<[DatePreset, string]>).map(([value, label]) => <button type="button" key={value} aria-pressed={preset === value} className={`franchise-date-chip ${preset === value ? 'active' : ''}`} onClick={() => selectPreset(value)}>{label}</button>)}
          </div>
          {preset === 'custom' && <div className="flex items-center gap-2"><label className="sr-only" htmlFor="report-from">From date</label><input id="report-from" type="date" value={range.from} onChange={(event) => changeRange('from', event.target.value)} className="franchise-report-select" /><span aria-hidden="true">–</span><label className="sr-only" htmlFor="report-to">To date</label><input id="report-to" type="date" value={range.to} onChange={(event) => changeRange('to', event.target.value)} className="franchise-report-select" /></div>}
          <label className="sr-only" htmlFor="report-location">Filter by location</label><select id="report-location" aria-label="Filter by location" value={locationId} onChange={(event) => changeLocation(event.target.value)} className="franchise-report-select"><option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
          <button id="franchise-report-export" type="button" disabled={!report || loading} onClick={exportCsv} className="franchise-action-button"><Download size={15} aria-hidden="true" /> Export CSV</button>
          <button type="button" onClick={() => window.print()} className="franchise-secondary-button"><Printer size={15} aria-hidden="true" /> Print / Save as PDF</button>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--oppa-text-muted)]"><span>{error ? <span role="alert" className="text-red-700">{error} <button type="button" onClick={retry} className="underline">Retry</button></span> : `${range.from} – ${range.to}`}</span><span>Last updated: {report?.last_updated ? dateTime(report.last_updated) : '—'}</span></div>

      {loading ? <div role="status" aria-label="Loading franchise report" aria-busy="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 9 }, (_, index) => <div key={index} className="franchise-report-card h-40 animate-pulse bg-[var(--oppa-cream)]" />)}</div>
        : error && !report ? <Card title="Report unavailable"><Empty text="We couldn't load this report." /><button type="button" className="franchise-action-button mt-3" onClick={retry}>Retry</button></Card>
          : report && summary && <>
            <div className="franchise-kpi-grid franchise-report-kpis">
              <Kpi title="Total Sales" value={money(summary.total_sales)} Icon={IndianRupee} tone="tone-green" current={summary.total_sales} previous={previous?.total_sales ?? 0} />
              <Kpi title="Total Orders" value={integer.format(summary.total_orders)} Icon={ClipboardList} tone="tone-blue" current={summary.total_orders} previous={previous?.total_orders ?? 0} />
              <Kpi title="Average Order Value" value={money(summary.average_order_value)} Icon={TrendingUp} tone="tone-gold" current={summary.average_order_value} previous={previous?.average_order_value ?? 0} />
              <Kpi title="Completed Orders" value={`${completedRate.toFixed(1)}%`} Icon={Package} tone="tone-green" current={completedRate} previous={previousCompletedRate} detail={`${integer.format(summary.completed_orders)} completed`} />
              <Kpi title="Cancelled / Refunded" value={integer.format(summary.cancelled_refunded_orders)} Icon={ClipboardList} tone="tone-orange" current={summary.cancelled_refunded_orders} previous={previous?.cancelled_refunded_orders ?? 0} secondaryCurrent={summary.cancelled_refunded_order_value} secondaryPrevious={previous?.cancelled_refunded_order_value ?? 0} secondaryLabel="Order value" inverse detail="Actual refund amounts are not recorded" />
              <Kpi title="Total Discounts" value={money(summary.discounts)} Icon={IndianRupee} tone="tone-gold" current={summary.discounts} previous={previous?.discounts ?? 0} />
              <Kpi title="Delivery vs Pickup / Dine-in" value={orderTypeCount ? `${deliveryShare.toFixed(1)}% delivery` : 'No type data'} Icon={Store} tone="tone-blue" current={deliveryShare} previous={previousDeliveryShare} detail={report.order_types.map((row) => `${row.type.replaceAll('_', ' ')} ${row.count}`).join(' · ') || 'No order type data'} />
              <Kpi title="Top-selling Product" value={topProduct?.name || 'No product data'} Icon={Package} tone="tone-orange" current={topProduct?.units_sold} previous={topProduct ? report.previous_top_product?.units_sold ?? 0 : undefined} detail={topProduct ? `${integer.format(topProduct.units_sold)} units · previous top: ${report.previous_top_product?.name || 'none'}` : 'No product sales in this period'} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Sales trend" subtitle={preset === 'today' ? 'By hour · Asia/Manila · Orders shown as secondary series' : 'By day · Asia/Manila · Orders shown as secondary series'} className="lg:col-span-2">
                {report.sales_series.length ? (() => {
                  const points = report.sales_series;
                  const maxSales = Math.max(1, ...points.map((point) => point.sales));
                  const maxOrders = Math.max(1, ...points.map((point) => point.orders));
                  const x = (index: number) => points.length === 1 ? 300 : 20 + index * 560 / (points.length - 1);
                  const y = (value: number, max: number) => 158 - value / max * 130;
                  const salesLine = points.map((point, index) => `${x(index)},${y(point.sales, maxSales)}`).join(' ');
                  const ordersLine = points.map((point, index) => `${x(index)},${y(point.orders, maxOrders)}`).join(' ');
                  return <div>
                    <svg viewBox="0 0 600 180" role="img" aria-label={`Sales and order count trend over ${points.length} time periods`} className="h-48 w-full overflow-visible">
                      <title>Sales trend with order counts, independently scaled</title><path d="M20 160H580" stroke="var(--oppa-border)" />
                      <polyline points={salesLine} fill="none" stroke="var(--oppa-green)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                      <polyline points={ordersLine} fill="none" stroke="#d99436" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
                      {points.map((point, index) => <g key={`${point.period}-${index}`}><circle cx={x(index)} cy={y(point.sales, maxSales)} r="4" fill="var(--oppa-green)"><title>{point.period}: {money(point.sales)}, {integer.format(point.orders)} revenue orders</title></circle><circle cx={x(index)} cy={y(point.orders, maxOrders)} r="3" fill="#d99436"><title>{point.period}: {integer.format(point.orders)} revenue orders</title></circle></g>)}
                    </svg>
                    <div className="flex flex-wrap justify-between gap-3 text-[10px] text-[var(--oppa-text-muted)]"><span>{points[0].period} – {points.at(-1)?.period}</span><span className="flex gap-4"><span className="text-[var(--oppa-green)]">● Sales</span><span className="text-amber-700">● Revenue orders</span></span></div>
                  </div>;
                })() : <Empty text="No sales recorded for these dates." />}
              </Card>
              <Card title="Orders by status" subtitle="Includes all recorded order statuses">
                {report.statuses.length ? <div className="grid items-center gap-4 sm:grid-cols-[150px_1fr]">
                  <div className="franchise-status-donut" role="img" aria-label={report.statuses.map((row) => `${row.status}: ${row.count}`).join(', ')} style={{ background: `conic-gradient(${report.statuses.map((_, index) => `${['#187a44', '#d99436', '#5487ae', '#70aa7c', '#d65f5f', '#9270aa'][index % 6]} ${report.statuses.slice(0, index).reduce((sum, item) => sum + item.count, 0) / Math.max(1, summary.total_orders) * 100}% ${report.statuses.slice(0, index + 1).reduce((sum, item) => sum + item.count, 0) / Math.max(1, summary.total_orders) * 100}%`).join(', ')})` }}><span>{integer.format(summary.total_orders)}<small>orders</small></span></div>
                  <ul className="space-y-2">{report.statuses.map((row, index) => <li key={row.status} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 capitalize"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ['#187a44', '#d99436', '#5487ae', '#70aa7c', '#d65f5f', '#9270aa'][index % 6] }} />{row.status.replaceAll('_', ' ')}</span><strong>{integer.format(row.count)}</strong></li>)}</ul>
                </div> : <Empty text="No order statuses available for this period." />}
              </Card>
              <Card title="Order type distribution">
                {report.order_types.length ? <div className="space-y-3">{report.order_types.map((row) => { const total = report.order_types.reduce((sum, item) => sum + item.count, 0); return <div key={row.type} className="grid grid-cols-[100px_1fr_55px] items-center gap-2 text-sm"><span className="capitalize">{row.type.replaceAll('_', ' ')}</span><span className="h-2 overflow-hidden rounded-full bg-[var(--oppa-cream)]"><span className="block h-full rounded-full bg-[var(--oppa-green)]" style={{ width: `${total ? row.count / total * 100 : 0}%` }} /></span><span className="text-right tabular-nums">{integer.format(row.count)}</span></div>; })}</div> : <Empty text="Order type data is not available." />}
              </Card>
              <Card title="Payment methods">
                {report.payment_mix.length ? <div className="space-y-3">{report.payment_mix.map((row) => { const max = Math.max(1, ...report.payment_mix.map((entry) => entry.sales)); return <div key={row.method}><div className="mb-1 flex justify-between gap-2 text-sm"><span className="capitalize">{(row.method || 'unknown').replaceAll('_', ' ')}</span><span>{integer.format(row.count)} · {money(row.sales)}</span></div><span className="block h-2 overflow-hidden rounded-full bg-[var(--oppa-cream)]"><span className="block h-full rounded-full bg-sky-600" style={{ width: `${row.sales / max * 100}%` }} /></span></div>; })}</div> : <Empty text="No payment method data is available." />}
              </Card>
              <Card title="Peak hours" subtitle="Orders by hour · Philippine time">
                {report.peak_hours.length ? <><div className="flex h-32 items-end gap-1 border-b border-[var(--oppa-border)]">{Array.from({ length: 24 }, (_, hour) => { const count = report.peak_hours.find((row) => row.hour === hour)?.orders ?? 0; return <span key={hour} aria-label={`${hour}:00, ${count} orders`} title={`${hour}:00 — ${integer.format(count)} orders`} className="flex-1 rounded-t bg-[var(--oppa-green)]/80 transition-colors hover:bg-[var(--oppa-green)]" style={{ height: `${count ? Math.max(4, count / maxHourCount * 100) : 0}%` }} />; })}</div><div className="mt-1 flex justify-between text-[10px] text-[var(--oppa-text-muted)]"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div></> : <Empty text="No hourly order data." />}
              </Card>
              <Card title="Busiest day of the week" subtitle="Orders by weekday">
                {report.orders_by_weekday.length ? <div className="space-y-2">{report.orders_by_weekday.map((row) => <div key={row.day} className="grid grid-cols-[85px_1fr_40px] items-center gap-2 text-sm"><span>{row.day}</span><span className="h-2 overflow-hidden rounded-full bg-[var(--oppa-cream)]"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${row.orders / maxWeekdayCount * 100}%` }} /></span><span className="text-right tabular-nums">{row.orders}</span></div>)}</div> : <Empty text="No weekday order data." />}
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Top 10 products" subtitle="Ranked by quantity sold · gross item sales">
                {products.length ? <div className="overflow-x-auto"><table className="franchise-soft-table min-w-[580px]"><thead><tr><th>Rank</th><th>Product</th><th>Qty sold</th><th>Gross sales</th><th>% of total sales</th></tr></thead><tbody>{products.map((row, index) => { const share = summary.total_sales ? row.revenue / summary.total_sales * 100 : 0; return <tr key={`${row.product_id}-${index}`}><td>#{index + 1}</td><td><strong>{row.name}</strong><small className="block text-[var(--oppa-text-muted)]">{row.category}</small></td><td>{integer.format(row.units_sold)}</td><td>{money(row.revenue)}</td><td><span>{share.toFixed(1)}%</span><span className="mt-1 block h-1.5 min-w-20 rounded-full bg-[var(--oppa-cream)]"><span className="block h-full rounded-full bg-[var(--oppa-green)]" style={{ width: `${Math.min(100, share)}%` }} /></span></td></tr>; })}</tbody></table></div> : <Empty text="No product sales in this period." />}
              </Card>
              <Card title="Category sales">
                {report.categories.length ? <div className="space-y-3">{report.categories.map((row) => <div key={row.name}><div className="mb-1 flex justify-between gap-2 text-sm"><span>{row.name}</span><span>{money(row.sales)}</span></div><span className="block h-2 overflow-hidden rounded-full bg-[var(--oppa-cream)]"><span className="block h-full rounded-full bg-[var(--oppa-green)]" style={{ width: `${row.sales / maxCategorySales * 100}%` }} /></span><small className="text-[10px] text-[var(--oppa-text-muted)]">{integer.format(row.units_sold)} products sold</small></div>)}</div> : <Empty text="Category data is not available." />}
              </Card>
              <Card title="Best-selling add-ons" subtitle="Reported only when add-on sales exist">
                {report.top_addons.length ? <div className="space-y-2">{report.top_addons.map((row) => <div key={row.name} className="flex justify-between gap-3 border-b border-[var(--oppa-border)] py-2 text-sm"><span>{row.name}<small className="ml-2 text-[var(--oppa-text-muted)]">{integer.format(row.units_sold)} sold</small></span><strong>{money(row.sales)}</strong></div>)}</div> : <Empty text="No add-on sales are available for this period." />}
              </Card>
              <Card title="Insights" subtitle="Highlights generated from this report's data">
                {insights.length ? <div className="flex flex-wrap gap-2">{insights.map((insight) => <span key={insight} className="franchise-insight-chip">{insight}</span>)}</div> : <Empty text="Insights will appear when this period has report data." />}
              </Card>
            </div>

            <Card title="Per-location performance" subtitle="All figures reflect the selected date range and location filter">
              {report.sales_by_location.length ? <div className="overflow-x-auto"><table className="franchise-soft-table min-w-[850px]"><thead><tr>
                {([
                  ['location_name', 'Location'], ['orders', 'Orders'], ['sales', 'Sales'], ['average_order_value', 'Avg. Order Value'],
                  ['completed_rate', 'Completed %'], ['cancelled', 'Cancelled'], ['share', 'Share of franchise sales'],
                ] as Array<[LocationSortKey, string]>).map(([key, label]) => <th key={key} aria-sort={sort.key === key ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => changeSort(key)} className="franchise-sort-button">{label}{sort.key === key ? sort.direction === 'asc' ? ' ↑' : ' ↓' : ''}</button></th>)}
              </tr></thead><tbody>{locationsSorted.map((row) => <tr key={row.location_id}><td>{row.location_name}</td><td>{integer.format(row.orders)}</td><td>{money(row.sales)}</td><td>{money(row.average_order_value)}</td><td>{row.completed_rate.toFixed(1)}%</td><td>{integer.format(row.cancelled)}</td><td><span>{row.share.toFixed(1)}%</span><span className="mt-1 block h-1.5 min-w-24 rounded-full bg-[var(--oppa-cream)]"><span className="block h-full rounded-full bg-[var(--oppa-green)]" style={{ width: `${Math.min(100, row.share)}%` }} /></span></td></tr>)}
                <tr className="font-bold"><td>Total</td><td>{integer.format(locationTotals.orders)}</td><td>{money(locationTotals.sales)}</td><td>{money(locationTotals.revenueOrders ? locationTotals.sales / locationTotals.revenueOrders : 0)}</td><td>{locationTotals.orders ? (locationTotals.completed / locationTotals.orders * 100).toFixed(1) : '0.0'}%</td><td>{integer.format(locationTotals.cancelled)}</td><td>{Math.min(100, locationTotals.share).toFixed(1)}%</td></tr>
              </tbody></table></div> : <Empty text="No location performance data for these filters." />}
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Staff performance" subtitle="Orders and revenue attributed to cashiers and franchise operators">
                {staffRows.length ? <div className="overflow-x-auto"><table className="franchise-soft-table min-w-[520px]"><thead><tr><th>Staff</th><th>Role</th><th>Location</th><th>Orders handled</th><th>Sales handled</th></tr></thead><tbody>{staffRows.map((row) => <tr key={`${row.role}-${row.id}`}><td><span className="franchise-person-avatar">{row.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="ml-2">{row.name}</span></td><td><span className={`franchise-role-badge ${row.role.toLowerCase().includes('cashier') ? 'role-cashier' : 'role-staff'}`}>{row.role.replaceAll('_', ' ')}</span></td><td>{locations.find((item) => item.id === row.location_id)?.name || 'Not assigned'}</td><td>{integer.format(row.orders_handled)}</td><td>{money(row.sales)}</td></tr>)}</tbody></table></div> : <Empty text="Staff performance data is not available for this period." />}
              </Card>
              <Card title="Driver performance" subtitle="Average delivery time uses order creation to delivery confirmation, when recorded">
                {report.driver_performance.length ? <div className="overflow-x-auto"><table className="franchise-soft-table min-w-[560px]"><thead><tr><th>Driver</th><th>Location</th><th>Completed</th><th>Cancelled</th><th>Avg. delivery time</th></tr></thead><tbody>{report.driver_performance.map((row) => <tr key={row.id}><td><span className="franchise-person-avatar">{row.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span className="ml-2">{row.name}</span></td><td>{locations.find((item) => item.id === row.location_id)?.name || 'Not assigned'}</td><td>{integer.format(row.deliveries_completed)}</td><td>{integer.format(row.cancelled_deliveries)}</td><td>{row.average_delivery_minutes === null ? '—' : `${Math.round(row.average_delivery_minutes)} min`}</td></tr>)}</tbody></table></div> : <Empty text="Driver performance data is not available for this period." />}
              </Card>
            </div>

            <Card title="Recent orders" subtitle="Latest 10 orders in the selected report period">
              {report.recent_orders.length ? <div className="overflow-x-auto"><table className="franchise-soft-table min-w-[920px]"><thead><tr><th>Order #</th><th>Date / time</th><th>Location</th><th>Customer</th><th>Type</th><th>Payment</th><th>Status</th><th>Total</th></tr></thead><tbody>{report.recent_orders.map((row) => <tr key={row.id} className="franchise-clickable-row" role="button" tabIndex={0} aria-label={`Open order ${row.order_number} details`} onClick={() => setSelectedOrder(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedOrder(row); } }}><td className="font-semibold">{row.order_number}</td><td>{dateTime(row.created_at)}</td><td>{row.location_name || '—'}</td><td>{row.customer || 'Guest'}</td><td className="capitalize">{(row.type || '—').replaceAll('_', ' ')}</td><td className="capitalize">{(row.payment_method || '—').replaceAll('_', ' ')}</td><td><span className={`franchise-status-pill ${statusClass(row.status)}`}>{row.status.replaceAll('_', ' ')}</span></td><td>{money(row.total)}</td></tr>)}</tbody></table></div> : <Empty text="No recent orders in the selected period." />}
            </Card>
          </>}

      {selectedOrder && <div className="franchise-order-modal-backdrop" role="presentation" onClick={() => setSelectedOrder(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="franchise-order-modal-title" className="franchise-order-modal" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Escape') setSelectedOrder(null); }}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[var(--oppa-text-muted)]">Order details</p><h2 id="franchise-order-modal-title" className="font-serif text-xl font-semibold">{selectedOrder.order_number}</h2></div><button type="button" aria-label="Close order details" onClick={() => setSelectedOrder(null)} className="franchise-secondary-button"><X size={16} /></button></div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">{[
            ['Date / time', dateTime(selectedOrder.created_at)], ['Location', selectedOrder.location_name || 'Not recorded'],
            ['Customer', selectedOrder.customer || 'Guest'], ['Order type', (selectedOrder.type || 'Not recorded').replaceAll('_', ' ')],
            ['Payment method', (selectedOrder.payment_method || 'Not recorded').replaceAll('_', ' ')], ['Status', selectedOrder.status],
            ['Total', money(selectedOrder.total)], ['Order ID', selectedOrder.id],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--oppa-text-muted)]">{label}</dt><dd className="mt-1 text-sm font-medium capitalize">{value}</dd></div>)}</dl>
        </section>
      </div>}
    </section>
  );
};

export default FranchiseAccountReportView;

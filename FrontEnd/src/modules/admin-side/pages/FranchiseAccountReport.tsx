import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ClipboardList, Download, IndianRupee, Printer, Store, Users } from 'lucide-react';
import { getFranchiseAccountReport } from '../../../services/franchiseAdminService';
import type { FranchiseAccountReport } from '../../../services/franchiseAdminService';
import '../styles/franchise-account-detail.css';

type DatePreset = 'today' | 'week' | 'month' | 'last-month' | 'custom';
type Location = { id: string; name: string };

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
  if (preset === 'last-month') return monthRange(new Date(Date.now() - 33 * 86400000));
  const date = new Date(`${today}T00:00:00+08:00`);
  const monday = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * 86400000);
  return { from: manilaDate(monday), to: today };
};

const trendPercent = (current: number, previous: number) => previous ? (current - previous) / Math.abs(previous) * 100 : null;

const Trend: React.FC<{ current: number; previous: number }> = ({ current, previous }) => {
  const value = trendPercent(current, previous);
  if (value === null) return <span className="franchise-trend franchise-trend-neutral">No data</span>;
  return <span className={`franchise-trend ${value >= 0 ? 'franchise-trend-up' : 'franchise-trend-down'}`}>{value >= 0 ? '↑' : '↓'} {Math.abs(value).toFixed(1)}%</span>;
};

const Kpi: React.FC<{ title: string; value: string; Icon: React.ElementType; tone: string; current?: number; previous?: number }> = ({ title, value, Icon, tone, current, previous }) => (
  <article className="franchise-kpi-card"><span className={`franchise-kpi-icon ${tone}`}><Icon size={18} /></span><div className="min-w-0"><p className="text-xs text-[var(--oppa-text-muted)]">{title}</p><strong className="mt-1 block truncate text-xl tabular-nums">{value}</strong></div><Trend current={current ?? 0} previous={previous ?? 0} /></article>
);

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
  <section className={`franchise-report-card ${className}`}><div className="mb-4"><h3 className="font-serif text-base font-semibold">{title}</h3>{subtitle && <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{subtitle}</p>}</div>{children}</section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => <div className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl bg-[var(--oppa-cream)] p-4 text-center text-sm text-[var(--oppa-text-muted)]"><BarChart3 size={22} className="text-[var(--oppa-green)]" /><span>{text}</span></div>;

const FranchiseAccountReportView: React.FC<{
  accountId: string;
  locations: Location[];
  managers: number;
  staff: number;
  allOrders: number;
  allSales: number;
  onData?: (report: FranchiseAccountReport) => void;
}> = ({ accountId, locations, managers, staff, allOrders, allSales, onData }) => {
  const [preset, setPreset] = useState<DatePreset>('month');
  const [range, setRange] = useState(() => rangeFor('month'));
  const [locationId, setLocationId] = useState('');
  const [report, setReport] = useState<FranchiseAccountReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError('');
    void getFranchiseAccountReport(accountId, { ...range, locationId })
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
  }, [accountId, range.from, range.to, locationId, onData]);

  const products = useMemo(() => [...(report?.top_products || [])].sort((a, b) => b.units_sold - a.units_sold), [report?.top_products]);
  const maxProductRevenue = Math.max(1, ...products.map((product) => product.revenue));
  const maxStatusCount = Math.max(1, ...(report?.statuses || []).map((status) => status.count));
  const maxHourCount = Math.max(1, ...(report?.peak_hours || []).map((hour) => hour.orders));

  const retry = () => setRange((current) => ({ ...current }));
  const selectPreset = (value: DatePreset) => {
    setPreset(value);
    if (value !== 'custom') setRange(rangeFor(value));
  };
  const exportCsv = () => {
    if (!report) return;
    const rows: Array<Array<string | number>> = [
      ['Franchise report', report.range.from, report.range.to],
      ['Location', locations.find((item) => item.id === locationId)?.name || 'All locations'],
      [],
      ['Summary', 'Value'],
      ...Object.entries(report.summary),
      [],
      ['Top products', 'Category', 'Units', 'Revenue'],
      ...report.top_products.map((row) => [row.name, row.category, row.units_sold, row.revenue]),
      [],
      ['Sales by location', 'Orders', 'Sales', 'Average order value', 'Share %'],
      ...report.sales_by_location.map((row) => [row.location_name, row.orders, row.sales, row.average_order_value, row.share]),
      [],
      ['Staff', 'Role', 'Orders', 'Sales', 'Deliveries'],
      ...report.staff_performance.map((row) => [row.name, row.role, row.orders_handled, row.sales, row.deliveries_completed]),
      [],
      ['Orders', 'Customer', 'Type', 'Total', 'Payment', 'Status', 'Created'],
      ...report.recent_orders.map((row) => [row.order_number, row.customer, row.type, row.total, row.payment_method, row.status, row.created_at]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `franchise-report-${range.from}-${range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const summary = report?.summary;
  const previous = report?.previous;

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
        <div className="min-w-52"><h2 className="font-serif text-lg font-semibold">Franchise report</h2><p className="text-xs text-[var(--oppa-text-muted)]">{report?.revenue_rules || 'Revenue follows the existing paid and delivered COD rules.'}</p></div>
        <div className="franchise-report-controls">
          <div className="franchise-date-chips" aria-label="Report date range">
            {(['today', 'week', 'month', 'last-month', 'custom'] as DatePreset[]).map((value) => <button type="button" key={value} aria-pressed={preset === value} className={`franchise-date-chip ${preset === value ? 'active' : ''}`} onClick={() => selectPreset(value)}>{({ today: 'Today', week: 'This Week', month: 'This Month', 'last-month': 'Last Month', custom: 'Custom' })[value]}</button>)}
          </div>
          {preset === 'custom' && <div className="flex items-center gap-2"><label className="sr-only" htmlFor="report-from">From</label><input id="report-from" aria-label="From date" type="date" value={range.from} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} className="franchise-report-select" /><span>–</span><label className="sr-only" htmlFor="report-to">To</label><input id="report-to" aria-label="To date" type="date" value={range.to} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} className="franchise-report-select" /></div>}
          <label className="sr-only" htmlFor="report-location">Location</label><select id="report-location" aria-label="Filter by location" value={locationId} onChange={(event) => setLocationId(event.target.value)} className="franchise-report-select"><option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
          <button id="franchise-report-export" type="button" disabled={!report || loading} onClick={exportCsv} className="franchise-action-button"><Download size={15} /> Export CSV</button>
          <button type="button" onClick={() => window.print()} className="franchise-secondary-button"><Printer size={15} /> Print / PDF</button>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--oppa-text-muted)]"><span>{error ? <span role="alert" className="text-red-700">{error} <button type="button" onClick={retry} className="underline">Retry</button></span> : `${range.from} – ${range.to}`}</span><span>Last updated: {report?.last_updated ? new Date(report.last_updated).toLocaleString() : '—'}</span></div>
      {loading && !report ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="franchise-report-card h-40 animate-pulse bg-[var(--oppa-cream)]" />)}</div>
        : error && !report ? <Card title="Report unavailable"><Empty text="We couldn't load this report." /><button type="button" className="franchise-action-button mt-3" onClick={retry}>Retry</button></Card>
          : !summary || summary.total_orders === 0 ? <Card title="Report"><Empty text="No sales in this period. Try a different date range or location." /></Card>
            : <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Total orders', integer.format(summary.total_orders), summary.total_orders, previous?.total_orders ?? 0],
                  ['Total sales (gross)', money(summary.total_sales), summary.total_sales, previous?.total_sales ?? 0],
                  ['Net sales after discounts', money(summary.net_sales), summary.net_sales, previous?.net_sales ?? 0],
                  ['Average order value', money(summary.average_order_value), summary.average_order_value, previous?.average_order_value ?? 0],
                ].map(([title, value, current, past]) => <article key={String(title)} className="franchise-report-card franchise-report-summary-card"><p>{title}</p><strong>{value}</strong><Trend current={Number(current)} previous={Number(past)} /></article>)}
                <article className="franchise-report-card franchise-report-summary-card"><p>Completed vs cancelled</p><strong>{summary.completed_orders} completed</strong><span className="text-xs text-[var(--oppa-text-muted)]">{summary.cancelled_orders} cancelled · {summary.total_orders ? Math.round(summary.completed_orders / summary.total_orders * 100) : 0}% completed</span><Trend current={summary.completed_orders} previous={previous?.completed_orders ?? 0} /></article>
                <article className="franchise-report-card franchise-report-summary-card"><p>Discounts & VAT</p><strong>{money(summary.discounts)}</strong><span className="text-xs text-[var(--oppa-text-muted)]">Senior {money(summary.senior_discount)} · PWD {money(summary.pwd_discount)} · Promo {money(summary.promo_discount)} · VAT {money(summary.vat_collected)}</span><Trend current={summary.discounts} previous={previous?.discounts ?? 0} /></article>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Sales over time" subtitle={preset === 'today' ? 'Hourly, Asia/Manila' : 'Daily, Asia/Manila'}>
                  {report?.sales_series.length ? <div><svg viewBox="0 0 600 180" role="img" aria-label="Sales over time chart" className="h-44 w-full"><path d="M10 165H590" stroke="var(--oppa-border)" />{(() => { const series = report.sales_series; const max = Math.max(1, ...series.map((point) => point.sales)); const pts = series.map((point, index) => `${series.length === 1 ? 300 : 16 + index * 568 / (series.length - 1)},${165 - point.sales / max * 145}`).join(' '); return <polyline points={pts} fill="none" stroke="var(--oppa-green)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />; })()}</svg><div className="flex justify-between text-[10px] text-[var(--oppa-text-muted)]"><span>{report.sales_series[0].period}</span><span>{report.sales_series.at(-1)?.period}</span></div></div> : <Empty text="No sales recorded for these dates." />}
                </Card>
                <Card title="Orders by status">
                  <div className="space-y-3">{['pending', 'preparing', 'ready', 'delivered', 'cancelled'].map((status) => { const count = report?.statuses.find((row) => row.status === status)?.count ?? 0; return <div key={status} className="grid grid-cols-[85px_1fr_32px] items-center gap-2 text-sm"><span className="capitalize text-[var(--oppa-text-muted)]">{status}</span><span className="h-2 overflow-hidden rounded-full bg-[var(--oppa-cream)]"><span className={`block h-full rounded-full ${status === 'cancelled' ? 'bg-red-400' : 'bg-[var(--oppa-green)]'}`} style={{ width: `${count / maxStatusCount * 100}%` }} /></span><span className="text-right tabular-nums">{count}</span></div>; })}</div>
                </Card>
                <Card title="Payment methods mix"><div className="space-y-2">{report?.payment_mix.map((row) => <div key={row.method} className="flex justify-between gap-2 border-b border-[var(--oppa-border)] py-2 text-sm"><span className="capitalize">{row.method.replaceAll('_', ' ')}</span><span>{row.count} · {money(row.sales)}</span></div>)}</div></Card>
                <Card title="Order type split"><div className="space-y-2">{report?.order_types.map((row) => <div key={row.type} className="flex justify-between rounded-lg bg-[var(--oppa-cream)] px-3 py-2 text-sm"><span className="capitalize">{row.type.replaceAll('_', ' ')}</span><strong>{row.count}</strong></div>)}</div></Card>
                <Card title="Peak hours" subtitle="Orders by hour, Philippine time" className="lg:col-span-2"><div className="flex h-28 items-end gap-1 border-b border-[var(--oppa-border)]">{Array.from({ length: 24 }, (_, hour) => { const count = report?.peak_hours.find((row) => row.hour === hour)?.orders ?? 0; return <span key={hour} title={`${hour}:00 — ${count}`} className="flex-1 rounded-t bg-[var(--oppa-green)]/80" style={{ height: `${count ? Math.max(4, count / maxHourCount * 100) : 0}%` }} />; })}</div><div className="mt-1 flex justify-between text-[10px]"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div></Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card title="Top selling products" subtitle="Ranked by units sold">{products.length ? <div className="space-y-3">{products.map((row, index) => <div key={`${row.product_id}-${index}`} className="grid grid-cols-[22px_1fr_auto] gap-3 text-sm"><span>{index + 1}</span><div className="min-w-0"><strong className="block truncate">{row.name}</strong><span className="text-xs text-[var(--oppa-text-muted)]">{row.category} · {row.units_sold} units</span><span className="mt-1 block h-1.5 rounded-full bg-[var(--oppa-cream)]"><span className="block h-full rounded-full bg-[var(--oppa-green)]" style={{ width: `${row.revenue / maxProductRevenue * 100}%` }} /></span></div><span className="tabular-nums">{money(row.revenue)}</span></div>)}</div> : <Empty text="No product sales in this period." />}</Card>
                <Card title="Sales by location">{report?.sales_by_location.length ? <div className="space-y-3">{report.sales_by_location.map((row) => <div key={row.location_id} className="rounded-lg border border-[var(--oppa-border)] p-3"><div className="flex justify-between gap-2 text-sm"><strong>{row.location_name}</strong><span>{money(row.sales)}</span></div><div className="mt-1 flex justify-between text-xs text-[var(--oppa-text-muted)]"><span>{row.orders} orders · AOV {money(row.average_order_value)}</span><span>{row.share.toFixed(1)}%</span></div><span className="mt-2 block h-1.5 rounded-full bg-[var(--oppa-cream)]"><span className="block h-full rounded-full bg-[var(--oppa-green)]" style={{ width: `${row.share}%` }} /></span></div>)}</div> : <Empty text="No sales by location." />}</Card>
                <Card title="Staff performance">{report?.staff_performance.length ? <div>{report.staff_performance.map((row) => <div key={`${row.role}-${row.id}`} className="flex justify-between gap-3 border-b border-[var(--oppa-border)] py-2 text-sm"><span className="min-w-0"><strong className="block truncate">{row.name}</strong><small className="text-[var(--oppa-text-muted)]">{row.role} · {locations.find((item) => item.id === row.location_id)?.name}</small></span><span className="text-right text-xs">{row.orders_handled} orders · {money(row.sales)}{row.deliveries_completed ? <span className="block">{row.deliveries_completed} deliveries</span> : null}</span></div>)}</div> : <Empty text="No staff activity for this period." />}</Card>
                <Card title="Recent orders" subtitle="Latest 10">{report?.recent_orders.length ? <div className="space-y-2">{report.recent_orders.map((row) => <div key={row.id} className="flex justify-between gap-3 rounded-lg border border-[var(--oppa-border)] p-3 text-sm"><span className="min-w-0"><strong className="block truncate">{row.order_number}</strong><small className="text-[var(--oppa-text-muted)]">{row.customer} · {row.type}</small></span><span className="text-right"><strong className="block">{money(row.total)}</strong><small className="capitalize text-[var(--oppa-text-muted)]">{row.payment_method} · {row.status}</small></span></div>)}</div> : <Empty text="No recent orders." />}</Card>
              </div>
              <p className="text-xs text-[var(--oppa-text-muted)]">Inventory is not included in this report. Total orders include all statuses; sales use the existing paid/COD revenue rule.</p>
            </>}
    </section>
  );
};

export default FranchiseAccountReportView;

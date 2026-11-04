import React, { useEffect, useState } from 'react';
import { BarChart3, ClipboardList, IndianRupee, Package, Store, TrendingUp, Users, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getFranchiseAccountDetailedReport } from '../../../services/franchiseAdminService';
import type { FranchiseAccountDetailedReport } from '../../../services/franchiseAdminService';
import '../styles/franchise-account-detail.css';

type DatePreset = 'today' | 'last-7' | 'last-30' | 'month' | 'last-month' | 'year' | 'custom';
type Location = { id: string; name: string };
type ReportOrder = FranchiseAccountDetailedReport['recent_orders'][number];

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
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - (preset === 'last-7' ? 6 : 29));
  return { from: manilaDate(start), to: today };
};

const percentChange = (current: number, previous: number) => previous === 0
  ? current === 0 ? 0 : null
  : (current - previous) / Math.abs(previous) * 100;

const Trend: React.FC<{ current: number; previous: number; inverse?: boolean }> = ({ current, previous, inverse = false }) => {
  const change = percentChange(current, previous);
  if (change === null) return <span className="franchise-trend franchise-trend-neutral">New</span>;
  const positive = change === 0 || (inverse ? change < 0 : change > 0);
  return <span className={`franchise-trend ${change === 0 ? 'franchise-trend-neutral' : positive ? 'franchise-trend-up' : 'franchise-trend-down'}`}>
    {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
  </span>;
};

const Kpi: React.FC<{
  title: string;
  value: string;
  Icon: React.ComponentType<{ size?: number }>;
  tone: string;
  current?: number;
  previous?: number;
  inverse?: boolean;
  detail?: string;
}> = ({ title, value, Icon, tone, current, previous, inverse, detail }) => (
  <article className="franchise-kpi-card">
    <span className={`franchise-kpi-icon ${tone}`}><Icon size={18} aria-hidden="true" /></span>
    <div className="min-w-0">
      <p className="text-xs text-[var(--oppa-text-muted)]">{title}</p>
      <strong className="mt-1 block truncate text-xl tabular-nums">{value}</strong>
      {detail && <span className="mt-1 block truncate text-[10px] text-[var(--oppa-text-muted)]">{detail}</span>}
    </div>
    {current !== undefined && previous !== undefined && <Trend current={current} previous={previous} inverse={inverse} />}
  </article>
);

const Card: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
  <section className={`franchise-report-card ${className}`}>
    <div className="mb-4"><h3 className="font-serif text-base font-semibold">{title}</h3>{subtitle && <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{subtitle}</p>}</div>
    {children}
  </section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl bg-[var(--oppa-cream)] p-4 text-center text-sm text-[var(--oppa-text-muted)]">
    <BarChart3 size={20} className="text-[var(--oppa-green)]" aria-hidden="true" /><span>{text}</span>
  </div>
);

const dateTime = (value: string) => new Date(value).toLocaleString('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
});

const orderStatusClass = (status: string) => {
  const value = status.toLowerCase();
  if (['completed', 'delivered'].includes(value)) return 'status-active';
  if (['cancelled', 'failed', 'refunded'].includes(value)) return 'status-cancelled';
  return 'status-pending';
};

const FranchiseAccountReportView: React.FC<{
  accountId: string;
  accountName: string;
  locations: Location[];
  managers: number;
  staff: number;
  allOrders: number;
  allSales: number;
  onData?: (report: FranchiseAccountDetailedReport) => void;
}> = ({ accountId, accountName, locations: suppliedLocations, managers, staff, allOrders, allSales, onData }) => {
  const locations = Array.isArray(suppliedLocations) ? suppliedLocations : [];
  const [preset, setPreset] = useState<DatePreset>('month');
  const [range, setRange] = useState(() => rangeFor('month'));
  const [report, setReport] = useState<FranchiseAccountDetailedReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<ReportOrder | null>(null);

  useEffect(() => {
    let mounted = true;
    void getFranchiseAccountDetailedReport(accountId, range)
      .then((value) => {
        if (!mounted) return;
        setReport(value);
        onData?.(value);
      })
      .catch((loadError: unknown) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : 'Unable to load franchise report.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [accountId, range, onData, refreshKey]);

  useEffect(() => {
    if (!selectedOrder) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedOrder(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedOrder]);

  useEffect(() => {
    const handleExportRequest = () => {
      if (!loading && report) void exportPdf();
    };
    window.addEventListener('franchise-export-request', handleExportRequest);
    return () => window.removeEventListener('franchise-export-request', handleExportRequest);
  }, [loading, report]);

  const products = Array.isArray(report?.top_products) ? [...report.top_products].slice(0, 10) : [];
  const locationRows = Array.isArray(report?.sales_by_location) ? report.sales_by_location : [];
  const staffRows = [
    ...(Array.isArray(report?.staff_performance) ? report.staff_performance : []),
    ...(Array.isArray(report?.franchise_user_performance) ? report.franchise_user_performance : []),
  ];
  const orders = Array.isArray(report?.recent_orders) ? report.recent_orders : [];
  const summary = report?.summary;
  const previous = report?.previous;
  const statuses = Array.isArray(report?.statuses) ? report.statuses : [];
  const orderTypes = Array.isArray(report?.order_types) ? report.order_types : [];
  const paymentMix = Array.isArray(report?.payment_mix) ? report.payment_mix : [];
  const completedRate = summary?.total_orders ? summary.completed_orders / summary.total_orders * 100 : 0;
  const previousCompletedRate = previous?.total_orders ? previous.completed_orders / previous.total_orders * 100 : 0;
  const cancellationRate = summary?.total_orders ? summary.cancelled_refunded_orders / summary.total_orders * 100 : 0;
  const topProduct = products[0];
  const maxProductRevenue = Math.max(1, ...products.map((product) => product.revenue));

  const insights = [
    summary && previous ? (() => {
      const salesChange = percentChange(summary.total_sales, previous.total_sales);
      return salesChange === null ? null : `Sales ${salesChange >= 0 ? 'up' : 'down'} ${Math.abs(salesChange).toFixed(1)}% vs previous period`;
    })() : null,
    topProduct ? `Best seller: ${topProduct.name} (${integer.format(topProduct.units_sold)} sold)` : null,
    summary?.total_orders ? cancellationRate > 10 ? `Cancelled/refunded rate is above 10% (${cancellationRate.toFixed(1)}%)` : `Cancelled/refunded rate: ${cancellationRate.toFixed(1)}%` : null,
  ].filter((item): item is string => Boolean(item));

  const beginReload = () => {
    setLoading(true);
    setError('');
  };
  const retry = () => {
    beginReload();
    setRefreshKey((key) => key + 1);
  };
  const selectPreset = (value: DatePreset) => {
    beginReload();
    setPreset(value);
    if (value !== 'custom') setRange(rangeFor(value));
  };
  const changeRange = (key: 'from' | 'to', value: string) => {
    beginReload();
    setRange((current) => ({ ...current, [key]: value }));
  };
  const exportPdf = async () => {
    if (!report || exportingPdf) return;
    setExportingPdf(true);
    setPdfError('');
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const width = doc.internal.pageSize.getWidth();
      doc.setFillColor(27, 67, 50);
      doc.rect(0, 0, width, 3, 'F');
      doc.setTextColor(27, 67, 50);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('OPPA DRU  |  FRANCHISE REPORT', 14, 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(95, 110, 100);
      doc.text(accountName, 14, 22);
      doc.text(`${range.from} to ${range.to}`, 14, 28);
      autoTable(doc, {
        startY: 34,
        head: [['Total sales', 'Orders', 'Average order value', 'Completed', 'Cancelled / refunded', 'Discounts']],
        body: [[
          money(report.summary.total_sales),
          integer.format(report.summary.total_orders),
          money(report.summary.average_order_value),
          `${report.summary.completed_orders} (${completedRate.toFixed(1)}%)`,
          `${report.summary.cancelled_refunded_orders} · ${money(report.summary.cancelled_refunded_order_value)} order value`,
          money(report.summary.discounts),
        ]],
        theme: 'grid',
        headStyles: { fillColor: [45, 106, 79], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3 },
      });
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
          ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7 : 42,
        head: [['Top products', 'Quantity sold', 'Gross sales']],
        body: products.map((product) => [product.name, integer.format(product.units_sold), money(product.revenue)]),
        theme: 'striped',
        headStyles: { fillColor: [45, 106, 79], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3 },
      });
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
          ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7 : 42,
        head: [['Location', 'Orders', 'Sales', 'Avg. order value', 'Completed %', 'Cancelled', 'Sales share']],
        body: locationRows.map((row) => [row.location_name, row.orders, money(row.sales), money(row.average_order_value), `${row.completed_rate.toFixed(1)}%`, row.cancelled, `${row.share.toFixed(1)}%`]),
        theme: 'striped',
        headStyles: { fillColor: [45, 106, 79], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 3 },
      });
      autoTable(doc, {
        startY: (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
          ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7 : 42,
        head: [['Recent order', 'Date', 'Location', 'Customer', 'Type', 'Payment', 'Status', 'Total']],
        body: orders.map((order) => [order.order_number, dateTime(order.created_at), order.location_name || '—', order.customer || 'Guest', order.type, order.payment_method, order.status, money(order.total)]),
        theme: 'striped',
        headStyles: { fillColor: [45, 106, 79], fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2 },
      });
      doc.save(`franchise-report-${range.from}-${range.to}.pdf`);
    } catch (pdfGenerationError) {
      console.error('Failed to generate franchise report PDF:', pdfGenerationError);
      setPdfError('The PDF could not be generated. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

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
              ['month', 'This month'], ['last-month', 'Last month'], ['year', 'This year'], ['custom', 'Custom'],
            ] as Array<[DatePreset, string]>).map(([value, label]) => <button type="button" key={value} aria-pressed={preset === value} className={`franchise-date-chip ${preset === value ? 'active' : ''}`} onClick={() => selectPreset(value)}>{label}</button>)}
          </div>
          {preset === 'custom' && <div className="flex items-center gap-2"><label className="sr-only" htmlFor="report-from">From date</label><input id="report-from" type="date" value={range.from} onChange={(event) => changeRange('from', event.target.value)} className="franchise-report-select" /><label className="sr-only" htmlFor="report-to">To date</label><input id="report-to" type="date" value={range.to} onChange={(event) => changeRange('to', event.target.value)} className="franchise-report-select" /></div>}
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--oppa-text-muted)]"><span>{error ? <span role="alert" className="text-red-700">{error} <button type="button" onClick={retry} className="underline">Retry</button></span> : `${range.from} – ${range.to}`}</span><span>Last updated: {report?.last_updated ? dateTime(report.last_updated) : '—'}</span></div>
      {pdfError && <p role="alert" className="text-sm text-red-700">{pdfError}</p>}

      {loading ? <div role="status" aria-label="Loading franchise report" aria-busy="true" className="grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="franchise-report-card h-36 animate-pulse bg-[var(--oppa-cream)]" />)}</div>
        : error && !report ? <Card title="Report unavailable"><Empty text="We couldn't load this report." /><button type="button" className="franchise-action-button mt-3" onClick={retry}>Retry</button></Card>
          : report && summary ? <>
            <div className="franchise-kpi-grid franchise-report-kpis">
              <Kpi title="Total Sales" value={money(summary.total_sales)} Icon={IndianRupee} tone="tone-green" current={summary.total_sales} previous={previous?.total_sales ?? 0} />
              <Kpi title="Total Orders" value={integer.format(summary.total_orders)} Icon={ClipboardList} tone="tone-blue" current={summary.total_orders} previous={previous?.total_orders ?? 0} />
              <Kpi title="Average Order Value" value={money(summary.average_order_value)} Icon={TrendingUp} tone="tone-gold" current={summary.average_order_value} previous={previous?.average_order_value ?? 0} />
              <Kpi title="Completed Orders" value={`${completedRate.toFixed(1)}%`} Icon={Package} tone="tone-green" current={completedRate} previous={previousCompletedRate} detail={`${integer.format(summary.completed_orders)} completed`} />
              <Kpi title="Cancelled / Refunded" value={integer.format(summary.cancelled_refunded_orders)} Icon={ClipboardList} tone="tone-orange" current={summary.cancelled_refunded_orders} previous={previous?.cancelled_refunded_orders ?? 0} inverse detail={`${money(summary.cancelled_refunded_order_value)} order value`} />
              <Kpi title="Total Discounts" value={money(summary.discounts)} Icon={IndianRupee} tone="tone-gold" current={summary.discounts} previous={previous?.discounts ?? 0} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Orders by status">
                {statuses.length ? <div className="grid items-center gap-4 sm:grid-cols-[130px_1fr]">
                  <div className="franchise-status-donut" role="img" aria-label={statuses.map((row) => `${row.status}: ${row.count}`).join(', ')} style={{ background: `conic-gradient(${statuses.map((_, index) => `${['#187a44', '#d99436', '#5487ae', '#70aa7c', '#d65f5f', '#9270aa'][index % 6]} ${statuses.slice(0, index).reduce((sum, item) => sum + item.count, 0) / Math.max(1, summary.total_orders) * 100}% ${statuses.slice(0, index + 1).reduce((sum, item) => sum + item.count, 0) / Math.max(1, summary.total_orders) * 100}%`).join(', ')})` }}><span>{integer.format(summary.total_orders)}<small>orders</small></span></div>
                  <ul className="space-y-2">{statuses.map((row, index) => <li key={row.status} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 capitalize"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ['#187a44', '#d99436', '#5487ae', '#70aa7c', '#d65f5f', '#9270aa'][index % 6] }} />{row.status}</span><strong>{integer.format(row.count)}</strong></li>)}</ul>
                </div> : <Empty text="No order statuses for this period." />}
              </Card>
              <Card title="Order type and payment mix">
                {orderTypes.length || paymentMix.length ? <div className="grid gap-4 sm:grid-cols-2">
                  <div><h4 className="mb-2 text-xs font-semibold text-[var(--oppa-text-muted)]">ORDER TYPE</h4>{orderTypes.length ? orderTypes.map((row) => <p key={row.type} className="flex justify-between border-b border-[var(--oppa-border)] py-2 text-sm capitalize"><span>{row.type.replaceAll('_', ' ')}</span><strong>{integer.format(row.count)}</strong></p>) : <p className="text-xs text-[var(--oppa-text-muted)]">No type data</p>}</div>
                  <div><h4 className="mb-2 text-xs font-semibold text-[var(--oppa-text-muted)]">PAYMENT</h4>{paymentMix.length ? paymentMix.map((row) => <p key={row.method} className="flex justify-between border-b border-[var(--oppa-border)] py-2 text-sm capitalize"><span>{row.method.replaceAll('_', ' ')}</span><strong>{money(row.sales)}</strong></p>) : <p className="text-xs text-[var(--oppa-text-muted)]">No payment data</p>}</div>
                </div> : <Empty text="Order type and payment details are unavailable." />}
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Top products" subtitle="Ranked by units sold">
                {products.length ? <div className="overflow-x-auto"><table className="franchise-soft-table min-w-[480px]"><thead><tr><th>Product</th><th>Qty</th><th>Gross sales</th><th>Sales share</th></tr></thead><tbody>{products.map((row) => { const share = summary.total_sales ? row.revenue / summary.total_sales * 100 : 0; return <tr key={`${row.product_id}-${row.name}`}><td><strong>{row.name}</strong><small className="block text-[var(--oppa-text-muted)]">{row.category}</small></td><td>{integer.format(row.units_sold)}</td><td>{money(row.revenue)}</td><td><span>{share.toFixed(1)}%</span><span className="mt-1 block h-1.5 min-w-16 rounded-full bg-[var(--oppa-cream)]"><span className="block h-full rounded-full bg-[var(--oppa-green)]" style={{ width: `${Math.min(100, row.revenue / maxProductRevenue * 100)}%` }} /></span></td></tr>; })}</tbody></table></div> : <Empty text="No product sales in this period." />}
              </Card>
              <Card title="Insights">
                {insights.length ? <div className="flex flex-wrap gap-2">{insights.map((insight) => <span key={insight} className="franchise-insight-chip">{insight}</span>)}</div> : <Empty text="Insights appear when this report has order data." />}
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card title="Team performance">
                {staffRows.length ? <div className="overflow-x-auto"><table className="franchise-soft-table min-w-[470px]"><thead><tr><th>Staff</th><th>Role</th><th>Orders handled</th><th>Sales</th></tr></thead><tbody>{staffRows.map((row) => <tr key={`${row.role}-${row.id}`}><td>{row.name}</td><td><span className="franchise-role-badge role-staff">{row.role.replaceAll('_', ' ')}</span></td><td>{integer.format(row.orders_handled)}</td><td>{money(row.sales)}</td></tr>)}</tbody></table></div> : <Empty text="Staff activity is not available for this period." />}
              </Card>
              <Card title="Recent orders" subtitle="Latest 10 · select an order for details">
                {orders.length ? <div className="overflow-x-auto"><table className="franchise-soft-table min-w-[690px]"><thead><tr><th>Order</th><th>Date</th><th>Location</th><th>Status</th><th>Total</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="franchise-clickable-row" role="button" tabIndex={0} aria-label={`Open order ${order.order_number} details`} onClick={() => setSelectedOrder(order)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedOrder(order); } }}><td>{order.order_number}</td><td>{dateTime(order.created_at)}</td><td>{order.location_name || '—'}</td><td><span className={`franchise-status-pill ${orderStatusClass(order.status)}`}>{order.status}</span></td><td>{money(order.total)}</td></tr>)}</tbody></table></div> : <Empty text="No recent orders in this period." />}
              </Card>
            </div>
          </> : null}

      {selectedOrder && <div className="franchise-order-modal-backdrop" role="presentation" onClick={() => setSelectedOrder(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="franchise-order-modal-title" className="franchise-order-modal" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-[var(--oppa-text-muted)]">Order details</p><h2 id="franchise-order-modal-title" className="font-serif text-xl font-semibold">{selectedOrder.order_number}</h2></div><button type="button" aria-label="Close order details" onClick={() => setSelectedOrder(null)} className="franchise-secondary-button"><X size={16} /></button></div>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">{[
            ['Date / time', dateTime(selectedOrder.created_at)], ['Location', selectedOrder.location_name || 'Not recorded'],
            ['Customer', selectedOrder.customer || 'Guest'], ['Order type', selectedOrder.type.replaceAll('_', ' ')],
            ['Payment method', selectedOrder.payment_method.replaceAll('_', ' ')], ['Status', selectedOrder.status],
            ['Total', money(selectedOrder.total)], ['Order ID', selectedOrder.id],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--oppa-text-muted)]">{label}</dt><dd className="mt-1 text-sm font-medium capitalize">{value}</dd></div>)}</dl>
        </section>
      </div>}
    </section>
  );
};

export default FranchiseAccountReportView;

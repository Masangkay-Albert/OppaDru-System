import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, CreditCard, FileText, Loader2, Shield, ShoppingCart, TrendingUp } from 'lucide-react';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { formatCurrency } from '../../../utils/formatters';
import { generateFranchiseReportPdf } from '../../../utils/franchiseReportPdfGenerator';
import { EmptyState, PageHeader, Toast } from '../../admin-side/components/AdminUI';
import { MetricCard, TopProductCard } from '../../shared/components/SalesReportCards';

interface ProductSale {
  product_id: string | null;
  product_name: string;
  quantity: number;
  sales: number;
}

interface Report {
  total_sales: number;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  average_order_value: number;
  product_sales: ProductSale[];
  payment_summary: Record<string, { orders: number; amount: number }>;
  discount_summary: { discounted_orders: number; discount_amount: number };
}

type ReportPeriod = 'today' | '7days' | '30days' | 'month' | 'year' | 'custom';

const money = (amount: number) => formatCurrency(amount);
const formatDateLabel = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeZone: 'UTC',
}).format(new Date(`${value}T00:00:00Z`));
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const REPORT_YEAR_START = `${TODAY.slice(0, 4)}-01-01`;
const REPORT_YEAR_END = `${TODAY.slice(0, 4)}-12-31`;
const PERIOD_OPTIONS: Array<[ReportPeriod, string]> = [
  ['today', 'Today'],
  ['7days', '7 days'],
  ['30days', '30 days'],
  ['month', 'This month'],
  ['year', 'This year'],
  ['custom', 'Custom'],
];

const FranchiseReportsPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const [from, setFrom] = useState(REPORT_YEAR_START);
  const [to, setTo] = useState(REPORT_YEAR_END);
  const [period, setPeriod] = useState<ReportPeriod>('year');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');
  const [reload, setReload] = useState(0);
  const branchName = franchiseUser?.branch?.name || franchiseUser?.franchise?.name || 'Current branch';
  const userName = franchiseUser?.full_name || franchiseUser?.fullName || franchiseUser?.name || 'Franchise user';
  const userEmail = franchiseUser?.email || '';

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const query = params.size ? `?${params}` : '';
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/reports${query}`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch reports.');
      setError('');
      setReport(payload.data as Report);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load branch reports.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void Promise.resolve().then(loadReport); }, [loadReport, reload]);

  const applyPeriod = (value: ReportPeriod) => {
    setPeriod(value);
    if (value === 'custom') return;
    if (value === 'year') {
      setFrom(REPORT_YEAR_START);
      setTo(REPORT_YEAR_END);
      return;
    }
    const end = new Date(`${TODAY}T00:00:00Z`);
    const start = new Date(end);
    if (value === '7days') start.setUTCDate(start.getUTCDate() - 6);
    else if (value === '30days') start.setUTCDate(start.getUTCDate() - 29);
    else if (value === 'month') start.setUTCDate(1);
    setFrom(start.toISOString().slice(0, 10));
    setTo(TODAY);
  };

  const updateFrom = (value: string) => {
    setPeriod('custom');
    setFrom(value);
    if (value && to && value > to) setTo(value);
  };

  const updateTo = (value: string) => {
    setPeriod('custom');
    setTo(value);
    if (value && from && value < from) setFrom(value);
  };

  const clearFilters = () => {
    setPeriod('custom');
    setFrom('');
    setTo('');
  };

  const removePeriodFilter = () => {
    setPeriod('custom');
    setFrom('');
    setTo('');
  };

  const periodLabel = useMemo(() => {
    if (period !== 'custom') return PERIOD_OPTIONS.find(([value]) => value === period)?.[1] || 'Custom';
    if (from && to) return `${formatDateLabel(from)} – ${formatDateLabel(to)}`;
    if (from) return `From ${formatDateLabel(from)}`;
    if (to) return `Through ${formatDateLabel(to)}`;
    return 'All dates';
  }, [from, period, to]);

  const productRows = (report?.product_sales || [])
    .slice()
    .sort((left, right) => Number(right.quantity) - Number(left.quantity))
    .slice(0, 5)
    .map((product) => [
      product.product_name,
      Number(product.quantity) || 0,
      money(Number(product.sales) || 0),
    ] as [string, number, string]);

  const paymentEntries = Object.entries(report?.payment_summary || {});
  const totalPaymentSales = paymentEntries.reduce((sum, [, summary]) => sum + Number(summary.amount || 0), 0);
  const paymentColors = [
    'var(--franchise-chart-1, #267a43)',
    'var(--franchise-chart-2, #6ea983)',
    'var(--franchise-chart-3, #eba943)',
    'var(--franchise-chart-4, #529ca5)',
    'var(--franchise-chart-5, #8b70b5)',
  ];
  let currentAngle = 0;
  const paymentGradient = paymentEntries.map(([, summary], index) => {
    const segment = totalPaymentSales > 0 ? (Number(summary.amount) / totalPaymentSales) * 360 : 0;
    const segmentColor = `${paymentColors[index % paymentColors.length]} ${currentAngle}deg ${currentAngle + segment}deg`;
    currentAngle += segment;
    return segmentColor;
  }).join(', ');
  const hasDiscounts = Boolean(
    report && (report.discount_summary.discounted_orders > 0 || report.discount_summary.discount_amount > 0),
  );
  const noOrders = !loading && !error && report?.total_orders === 0;

  const handleExportPdf = async () => {
    if (!report || exportingPdf) return;
    setExportingPdf(true);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      generateFranchiseReportPdf({
        branchName,
        period: periodLabel,
        generatedBy: { name: userName, email: userEmail },
        metrics: {
          totalSales: Number(report.total_sales) || 0,
          totalOrders: Number(report.total_orders) || 0,
          completedOrders: Number(report.completed_orders) || 0,
          cancelledOrders: Number(report.cancelled_orders) || 0,
          averageOrderValue: Number(report.average_order_value) || 0,
        },
        products: (report.product_sales || []).map((product) => ({
          name: product.product_name,
          quantity: Number(product.quantity) || 0,
          sales: Number(product.sales) || 0,
        })),
        payments: paymentEntries.map(([method, summary]) => ({
          method: method.replaceAll('_', ' '),
          orders: Number(summary.orders) || 0,
          amount: Number(summary.amount) || 0,
        })),
      });
      setNoticeTone('success');
      setNotice('Branch report exported successfully.');
    } catch (exportError) {
      console.error('Failed to generate branch report PDF:', exportError);
      setNoticeTone('error');
      setNotice('The PDF could not be generated. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      {notice && <Toast message={notice} tone={noticeTone} onDismiss={() => setNotice('')} />}
      <div className="mx-auto max-w-[1500px]">
        <PageHeader
          title="Branch Reports"
          subtitle="Sales and order performance for this branch only."
          actions={(
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={loading || !report || exportingPdf}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--oppa-green-dark)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {exportingPdf ? 'Generating PDF...' : 'Export PDF'}
              </button>
              <div className="inline-flex items-center gap-1.5 text-xs text-[var(--oppa-text-muted)]">
                <Shield size={13} className="shrink-0 text-[var(--oppa-green)]" aria-hidden="true" />
                <span>Exporting as: <strong className="font-semibold text-[var(--oppa-text)]">{userName}</strong> ({userEmail})</span>
              </div>
            </div>
          )}
        />

        <section aria-label="Report filters" className="admin-reports-filters admin-card mb-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="franchise-report-periods flex min-w-0 gap-2 overflow-x-auto pb-1" aria-label="Quick date ranges">
              {PERIOD_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={period === value}
                  onClick={() => applyPeriod(value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                    period === value
                      ? 'border-[var(--oppa-green)] bg-[var(--oppa-green)] text-white'
                      : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text-muted)] hover:border-[var(--oppa-green)] hover:text-[var(--oppa-green-dark)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={clearFilters} className="self-end rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--oppa-green-dark)] transition hover:bg-[var(--oppa-green-soft)] sm:self-auto">
              Clear filters
            </button>
          </div>

          {period === 'custom' && (
            <div className="mt-3 grid gap-3 border-t border-[var(--oppa-border)] pt-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-[var(--oppa-text-muted)]">
                From
                <span className="relative mt-1 flex h-11 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)] transition focus-within:border-[var(--oppa-green)] focus-within:ring-2 focus-within:ring-[var(--oppa-green)]/20">
                  <CalendarDays size={16} aria-hidden="true" className="shrink-0 text-[var(--oppa-green)]" />
                  <span className={`min-w-0 flex-1 truncate ${from ? '' : 'text-[var(--oppa-text-muted)]'}`}>{from || 'Select date'}</span>
                  <input aria-label="Report start date" type="date" value={from} max={to || undefined} onChange={(event) => updateFrom(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </span>
              </label>
              <label className="text-xs font-medium text-[var(--oppa-text-muted)]">
                To
                <span className="relative mt-1 flex h-11 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)] transition focus-within:border-[var(--oppa-green)] focus-within:ring-2 focus-within:ring-[var(--oppa-green)]/20">
                  <CalendarDays size={16} aria-hidden="true" className="shrink-0 text-[var(--oppa-green)]" />
                  <span className={`min-w-0 flex-1 truncate ${to ? '' : 'text-[var(--oppa-text-muted)]'}`}>{to || 'Select date'}</span>
                  <input aria-label="Report end date" type="date" value={to} min={from || undefined} onChange={(event) => updateTo(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </span>
              </label>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--oppa-border)] pt-3 text-xs text-[var(--oppa-text-muted)]">
            <span>Showing:</span>
            {periodLabel !== 'All dates' ? (
              <button type="button" onClick={removePeriodFilter} className="rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 font-medium text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]/70">
                {periodLabel} ×
              </button>
            ) : <span className="font-medium text-[var(--oppa-text)]">All dates</span>}
            <span className="font-medium text-[var(--oppa-text)]">{branchName}</span>
          </div>
        </section>

        {error && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => { setError(''); setReload((value) => value + 1); }} className="shrink-0 font-semibold underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div role="status" aria-label="Loading branch reports" aria-busy="true" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }, (_, index) => <div key={index} className="admin-card h-36 animate-pulse bg-[var(--oppa-surface)] p-5"><div className="h-4 w-28 rounded bg-[var(--oppa-green-soft)]" /><div className="mt-6 h-8 w-32 rounded bg-[var(--oppa-green-soft)]" /><div className="mt-3 h-3 w-24 rounded bg-[var(--oppa-green-soft)]" /></div>)}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1].map((item) => <div key={item} className="admin-card h-64 animate-pulse p-5"><div className="h-4 w-36 rounded bg-[var(--oppa-green-soft)]" /><div className="mt-6 space-y-4">{[0, 1, 2, 3].map((row) => <div key={row} className="h-7 rounded bg-[var(--oppa-green-soft)]" />)}</div></div>)}
            </div>
          </div>
        ) : report && noOrders ? (
          <EmptyState title="No sales found for this period" description={`No orders were found for ${branchName} in the selected date range.`} icon={<BarChart3 size={24} aria-hidden="true" />} />
        ) : report && (
          <>
            <section aria-label="Branch sales metrics" className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <div className="admin-card admin-card--brand relative min-h-36 overflow-hidden p-4 text-white sm:p-5">
                <div className="flex items-center justify-between"><p className="text-sm font-medium text-white/85">Net sales</p><TrendingUp size={19} aria-hidden="true" /></div>
                <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{money(Number(report.total_sales) || 0)}</p>
                <p className="mt-1 text-xs text-white/75">Based on selected filters</p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold">Current selection</span>
                  <svg aria-hidden="true" viewBox="0 0 100 25" className="h-6 w-20 text-white/90"><polyline points="0,21 16,18 32,20 48,12 64,15 80,7 100,9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
              <MetricCard icon={<ShoppingCart size={18} />} label="Orders" value={report.total_orders} detail="This period" />
              <MetricCard icon={<BarChart3 size={18} />} label="Completed orders" value={report.completed_orders} detail="This period" />
              <MetricCard icon={<BarChart3 size={18} />} label="Cancelled orders" value={report.cancelled_orders} detail="This period" />
              <MetricCard icon={<CreditCard size={18} />} label="Average order value" value={money(Number(report.average_order_value) || 0)} detail="Per revenue order" />
            </section>

            <section aria-label="Branch product performance" className="mb-5">
              <TopProductCard title="Top 5 products" products={productRows} emptyDescription="No product sales for this period." />
            </section>

            <section aria-label="Branch payment and discount summaries" className={`grid items-stretch gap-4 ${hasDiscounts ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
              <div className="admin-card h-full p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-[var(--oppa-text)]">Payment methods</h2>
                  <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Revenue collected by payment type</p>
                </div>
                {paymentEntries.length && totalPaymentSales > 0 ? (
                  <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                    <div className="relative size-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${paymentGradient})` }} role="img" aria-label="Payment methods sales distribution">
                      <div className="absolute inset-5 grid place-content-center rounded-full bg-[var(--oppa-surface)] text-center"><span className="text-[10px] text-[var(--oppa-text-muted)]">Total</span><strong className="text-sm text-[var(--oppa-text)]">{money(totalPaymentSales)}</strong></div>
                    </div>
                    <div className="w-full space-y-3">
                      {paymentEntries.map(([method, summary], index) => (
                        <div key={method} className="flex min-h-10 items-center gap-2 text-sm">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} aria-hidden="true" />
                          <span className="min-w-0 flex-1 capitalize text-[var(--oppa-text)]">{method.replaceAll('_', ' ')}<span className="block text-xs text-[var(--oppa-text-muted)]">{summary.orders} orders</span></span>
                          <strong className="shrink-0 text-right tabular-nums text-[var(--oppa-text)]">{money(Number(summary.amount) || 0)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <p className="py-8 text-center text-sm text-[var(--oppa-text-muted)]">No payment data in this period.</p>}
              </div>

              {hasDiscounts && <div className="admin-card h-full p-5">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold text-[var(--oppa-text)]">Discount summary</h2>
                  <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Approved discounts for this period</p>
                </div>
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-[var(--oppa-green-soft)] p-4 text-sm text-[var(--oppa-text)]">
                  <span>Discounted orders</span><strong className="text-right">{report.discount_summary.discounted_orders}</strong>
                  <span>Discount amount</span><strong className="text-right">{money(Number(report.discount_summary.discount_amount) || 0)}</strong>
                </div>
                <p className="mt-4 text-xs text-[var(--oppa-text-muted)]">Cancelled orders in range: <strong className="text-[var(--oppa-text)]">{report.cancelled_orders}</strong></p>
              </div>}
            </section>
          </>
        )}
      </div>
    </main>
  );
};

export default FranchiseReportsPage;

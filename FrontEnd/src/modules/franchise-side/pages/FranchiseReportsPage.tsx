import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, CreditCard, FileText, Loader2, Shield, ShoppingCart, TrendingUp } from 'lucide-react';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import ReplacementReportLine from '../../shared/components/ReplacementReportLine';
import { formatCurrency } from '../../../utils/formatters';
import { generateFranchiseReportPdf } from '../../../utils/franchiseReportPdfGenerator';
import { deleteFranchiseSalesTarget, updateFranchiseSalesTarget } from '../../../services/franchiseSalesTargetService';
import { getPaymentMethodLabel } from '../../../constants/thirdPartyPlatforms';
import { EmptyState, PageHeader, Toast } from '../../admin-side/components/AdminUI';
import {
  MetricCard,
  ReportFilterCard,
  SalesChannelCard,
  SalesTargetCard,
  SalesTimelineCard,
  SalesTotalCard,
  type SalesTrendBucket,
  TopProductCard,
} from '../../shared/components/SalesReportCards';

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
  sales_target_amount: number | null;
  product_sales: ProductSale[];
  payment_summary: Record<string, { orders: number; amount: number }>;
  discount_summary: { discounted_orders: number; discount_amount: number };
}

interface BranchReportOrder {
  id: string;
  total: number | string;
  status: string;
  replacement_of_order_id?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  delivery_type?: string | null;
  created_at: string;
  items?: Array<{
    product_id?: string | number | null;
    product_name?: string;
    name?: string;
    quantity?: number | string;
  }>;
}

type ReportPeriod = 'today' | '7days' | '30days' | 'month' | 'year' | 'custom';
type TimelineStyle = 'line' | 'bar';

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
const PAYMENT_COLORS = [
  'var(--oppa-green)',
  '#6ea983',
  '#eba943',
  '#529ca5',
  '#8b70b5',
];

const isRevenueOrder = (order: BranchReportOrder): boolean => {
  const status = String(order.status || '').trim().toLowerCase();
  const paymentStatus = String(order.payment_status || '').trim().toLowerCase();
  const paymentMethod = String(order.payment_method || '').trim().toLowerCase();
  if (order.replacement_of_order_id || ['cancelled', 'failed'].includes(status) || ['failed', 'cancelled', 'expired'].includes(paymentStatus)) return false;
  return paymentStatus === 'paid'
    || (paymentMethod === 'cash_on_delivery' && status === 'delivered' && ['pending', 'unpaid', ''].includes(paymentStatus));
};

const getLocalDateParts = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return null;
  return { year: Number(year), month: Number(month), day: Number(day), date: `${year}-${month}-${day}` };
};

const createTimeline = (
  orders: BranchReportOrder[],
  from: string,
  to: string,
  period: ReportPeriod,
): { buckets: SalesTrendBucket[]; description: string } => {
  const isYear = period === 'year';
  const allDates = !from || !to;
  const rangeDays = from && to
    ? (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1
    : Infinity;
  const groupByMonth = isYear || allDates || rangeDays > 31;
  const buckets: SalesTrendBucket[] = [];

  if (groupByMonth && (isYear || allDates)) {
    const year = Number(TODAY.slice(0, 4));
    for (let month = 1; month <= 12; month += 1) {
      buckets.push({
        label: new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
        sales: 0,
        orders: 0,
      });
    }
  } else if (groupByMonth) {
    const start = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
    const end = new Date(`${to.slice(0, 7)}-01T00:00:00Z`);
    for (const date = new Date(start); date <= end; date.setUTCMonth(date.getUTCMonth() + 1)) {
      buckets.push({
        label: date.toLocaleString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
        sales: 0,
        orders: 0,
      });
    }
  } else {
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
      buckets.push({
        label: date.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
        sales: 0,
        orders: 0,
      });
    }
  }

  const revenueOrders = orders.filter(isRevenueOrder);
  revenueOrders.forEach((order) => {
    const parts = getLocalDateParts(order.created_at);
    if (!parts) return;
    const startMonth = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
    const index = groupByMonth
      ? isYear || allDates
        ? parts.month - 1
        : (parts.year - startMonth.getUTCFullYear()) * 12 + parts.month - 1 - startMonth.getUTCMonth()
      : Math.round((new Date(`${parts.date}T00:00:00Z`).getTime() - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
    if (index < 0 || index >= buckets.length) return;
    buckets[index].sales += Number(order.total) || 0;
    buckets[index].orders += 1;
  });

  const description = groupByMonth ? 'Monthly activity grouped across the selected period.' : 'Daily activity for the selected date range.';
  return { buckets, description };
};

const FranchiseReportsPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const [from, setFrom] = useState(REPORT_YEAR_START);
  const [to, setTo] = useState(REPORT_YEAR_END);
  const [period, setPeriod] = useState<ReportPeriod>('year');
  const [report, setReport] = useState<Report | null>(null);
  const [orders, setOrders] = useState<BranchReportOrder[]>([]);
  const [timelineStyle, setTimelineStyle] = useState<TimelineStyle>('line');
  const [goalInput, setGoalInput] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState('');
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
      const query = params.toString() ? `?${params}` : '';
      const [reportResponse, ordersResponse] = await Promise.all([
        fetchWithFranchiseAuth(`${API_URL}/franchise/reports${query}`, { signal: AbortSignal.timeout(15000) }),
        fetchWithFranchiseAuth(`${API_URL}/franchise/orders${query}`, { signal: AbortSignal.timeout(15000) }),
      ]);
      const [reportPayload, ordersPayload] = await Promise.all([
        reportResponse.json().catch(() => ({})),
        ordersResponse.json().catch(() => ({})),
      ]);
      if (!reportResponse.ok) throw new Error(reportPayload.message || 'Could not load branch reports.');
      if (!ordersResponse.ok) throw new Error(ordersPayload.message || 'Could not load branch sales details.');
      if (!reportPayload.data || typeof reportPayload.data !== 'object' || !Array.isArray(ordersPayload.data)) {
        throw new Error('The branch report data could not be read.');
      }
      setReport(reportPayload.data as Report);
      setOrders(ordersPayload.data as BranchReportOrder[]);
      const savedTarget = Number(reportPayload.data.sales_target_amount) || 0;
      setGoalInput(savedTarget > 0 ? String(savedTarget) : '');
      setEditingGoal(false);
      setGoalError('');
      setError('');
    } catch (loadError) {
      setReport(null);
      setOrders([]);
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

  const periodLabel = useMemo(() => {
    if (period !== 'custom') return PERIOD_OPTIONS.find(([value]) => value === period)?.[1] || 'Custom';
    if (from && to) return `${formatDateLabel(from)} – ${formatDateLabel(to)}`;
    if (from) return `From ${formatDateLabel(from)}`;
    if (to) return `Through ${formatDateLabel(to)}`;
    return 'All dates';
  }, [from, period, to]);

  const revenueOrders = useMemo(() => orders.filter(isRevenueOrder), [orders]);
  const channelMetrics = useMemo(() => {
    const online = revenueOrders.filter((order) => order.delivery_type?.toLowerCase() !== 'onsite');
    const onsite = revenueOrders.filter((order) => order.delivery_type?.toLowerCase() === 'onsite');
    return {
      onlineOrders: online.length,
      onlineSales: online.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
      onsiteOrders: onsite.length,
      onsiteSales: onsite.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
    };
  }, [revenueOrders]);

  const topProducts = useMemo(() => {
    const byChannel = { online: new Map<string, { name: string; quantity: number }>(), onsite: new Map<string, { name: string; quantity: number }>() };
    revenueOrders.forEach((order) => {
      const channel = order.delivery_type?.toLowerCase() === 'onsite' ? 'onsite' : 'online';
      order.items?.forEach((item) => {
        const name = item.product_name || item.name || 'Unnamed item';
        const key = String(item.product_id || name);
        const current = byChannel[channel].get(key) || { name, quantity: 0 };
        current.quantity += Number(item.quantity) || 0;
        byChannel[channel].set(key, current);
      });
    });
    const rows = (channel: 'online' | 'onsite') => [...byChannel[channel].values()]
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5)
      .map(({ name, quantity }) => [name, quantity] as [string, number]);
    return { online: rows('online'), onsite: rows('onsite') };
  }, [revenueOrders]);

  const timeline = useMemo(() => createTimeline(orders, from, to, period), [from, orders, period, to]);
  const paymentEntries = Object.entries(report?.payment_summary || {});
  const totalPaymentSales = paymentEntries.reduce((sum, [, summary]) => sum + Number(summary.amount || 0), 0);
  let currentAngle = 0;
  const paymentGradient = paymentEntries.map(([, summary], index) => {
    const segment = totalPaymentSales > 0 ? (Number(summary.amount) / totalPaymentSales) * 360 : 0;
    const segmentColor = `${PAYMENT_COLORS[index % PAYMENT_COLORS.length]} ${currentAngle}deg ${currentAngle + segment}deg`;
    currentAngle += segment;
    return segmentColor;
  }).join(', ');
  const hasDiscounts = Boolean(
    report && (report.discount_summary.discounted_orders > 0 || report.discount_summary.discount_amount > 0),
  );
  const noOrders = !loading && !error && report?.total_orders === 0;
  const savedGoal = Number(report?.sales_target_amount) || 0;
  const goalSet = savedGoal > 0;
  const goalReached = goalSet && Number(report?.total_sales || 0) >= savedGoal;

  const handleSaveGoal = async () => {
    const targetAmount = Number(goalInput.replaceAll(',', ''));
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setGoalError('Please enter a valid target amount greater than 0.');
      return;
    }
    setGoalSaving(true);
    setGoalError('');
    try {
      const updated = await updateFranchiseSalesTarget(targetAmount);
      setReport((current) => current ? { ...current, sales_target_amount: updated } : current);
      setGoalInput(String(updated));
      setEditingGoal(false);
      setNoticeTone('success');
      setNotice('Branch sales target saved.');
    } catch (saveError) {
      setGoalError(saveError instanceof Error ? saveError.message : 'Sales target could not be saved.');
    } finally {
      setGoalSaving(false);
    }
  };

  const handleClearGoal = async () => {
    setGoalSaving(true);
    setGoalError('');
    try {
      await deleteFranchiseSalesTarget();
      setReport((current) => current ? { ...current, sales_target_amount: null } : current);
      setGoalInput('');
      setEditingGoal(false);
      setNoticeTone('success');
      setNotice('Branch sales target removed.');
    } catch (removeError) {
      setGoalError(removeError instanceof Error ? removeError.message : 'Sales target could not be removed.');
    } finally {
      setGoalSaving(false);
    }
  };

  const handleStartGoalEdit = () => {
    setGoalInput(savedGoal > 0 ? String(savedGoal) : '');
    setEditingGoal(true);
    setGoalError('');
  };

  const handleCancelGoalEdit = () => {
    setGoalInput(savedGoal > 0 ? String(savedGoal) : '');
    setEditingGoal(false);
    setGoalError('');
  };

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
          method: getPaymentMethodLabel(method),
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
    <main className="franchise-report-page min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
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
                className="bg-oppa-gradient inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                {exportingPdf ? 'Generating PDF...' : 'Export PDF'}
              </button>
              <div className="inline-flex items-center gap-1.5 text-xs text-[var(--oppa-text-muted)]">
                <Shield size={13} className="shrink-0 text-[var(--oppa-green)]" aria-hidden="true" />
                <span>Exporting as: <strong className="font-semibold text-[var(--oppa-text)]">{userName}</strong> <span className="text-[11px] text-[var(--oppa-text-muted)]">({userEmail})</span></span>
              </div>
            </div>
          )}
        />

        <ReplacementReportLine endpoint={`${API_URL}/franchise/replacement-requests/report`} fetcher={fetchWithFranchiseAuth} from={from} to={to} />
        <ReportFilterCard className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            <button type="button" onClick={clearFilters} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--oppa-green-dark)] transition hover:bg-[var(--oppa-green-soft)]">
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
                  <input aria-label="Report start date" type="date" value={from} data-max={to || undefined} onChange={(event) => updateFrom(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </span>
              </label>
              <label className="text-xs font-medium text-[var(--oppa-text-muted)]">
                To
                <span className="relative mt-1 flex h-11 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)] transition focus-within:border-[var(--oppa-green)] focus-within:ring-2 focus-within:ring-[var(--oppa-green)]/20">
                  <CalendarDays size={16} aria-hidden="true" className="shrink-0 text-[var(--oppa-green)]" />
                  <span className={`min-w-0 flex-1 truncate ${to ? '' : 'text-[var(--oppa-text-muted)]'}`}>{to || 'Select date'}</span>
                  <input aria-label="Report end date" type="date" value={to} data-min={from || undefined} onChange={(event) => updateTo(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </span>
              </label>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--oppa-border)] pt-3 text-xs text-[var(--oppa-text-muted)]">
            <span>Showing:</span>
            {periodLabel !== 'All dates' ? (
              <button type="button" onClick={clearFilters} className="rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 font-medium text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]/70">
                {periodLabel} ×
              </button>
            ) : <span className="font-medium text-[var(--oppa-text)]">All dates</span>}
            <span className="font-medium text-[var(--oppa-text)]">{branchName}</span>
          </div>
        </ReportFilterCard>

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
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1].map((item) => <div key={item} className="admin-card h-64 animate-pulse p-5"><div className="h-4 w-36 rounded bg-[var(--oppa-green-soft)]" /><div className="mt-6 space-y-4">{[0, 1, 2, 3].map((row) => <div key={row} className="h-7 rounded bg-[var(--oppa-green-soft)]" />)}</div></div>)}
            </div>
            <div className="admin-card h-72 animate-pulse p-5"><div className="h-4 w-40 rounded bg-[var(--oppa-green-soft)]" /><div className="mt-8 h-40 rounded bg-[var(--oppa-green-soft)]" /></div>
          </div>
        ) : report && noOrders ? (
          <EmptyState title="No sales found for this period" description={`No orders were found for ${branchName} in the selected date range.`} icon={<BarChart3 size={24} aria-hidden="true" />} />
        ) : report && (
          <>
            <section aria-label="Branch sales metrics" className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <SalesTotalCard label="Total sales" amount={Number(report.total_sales) || 0} trendBuckets={timeline.buckets} />
              <MetricCard icon={<ShoppingCart size={18} />} label="Orders" value={report.total_orders} detail="This period" />
              <MetricCard icon={<BarChart3 size={18} />} label="Completed orders" value={report.completed_orders} detail="This period" />
              <MetricCard icon={<TrendingUp size={18} />} label="Cancelled orders" value={report.cancelled_orders} detail="This period" />
              <MetricCard icon={<CreditCard size={18} />} label="Average order value" value={money(Number(report.average_order_value) || 0)} detail="Per revenue order" />
            </section>

            <section aria-label="Branch sales target and product performance" className="mb-4 grid gap-4 xl:grid-cols-3">
              <SalesTargetCard
                savedGoal={savedGoal}
                goalInput={goalInput}
                sales={Number(report.total_sales) || 0}
                goalReached={goalReached}
                goalSet={goalSet}
                editing={editingGoal}
                saving={goalSaving}
                error={goalError}
                onGoalChange={setGoalInput}
                onSave={handleSaveGoal}
                onStartEdit={handleStartGoalEdit}
                onCancelEdit={handleCancelGoalEdit}
                onClear={handleClearGoal}
              />
              <TopProductCard title="Top 5 Online products" products={topProducts.online} emptyDescription="No online product sales for this period." />
              <TopProductCard title="Top 5 Onsite products" products={topProducts.onsite} emptyDescription="No onsite product sales for this period." />
            </section>

            {hasDiscounts ? (
              <>
                <div className="mb-4">
                  <SalesChannelCard
                    onlineOrders={channelMetrics.onlineOrders}
                    onlineSales={channelMetrics.onlineSales}
                    onsiteOrders={channelMetrics.onsiteOrders}
                    onsiteSales={channelMetrics.onsiteSales}
                  />
                </div>
                <section aria-label="Branch payment and discount summaries" className="mb-4 grid items-stretch gap-4 lg:grid-cols-2">
                  <PaymentMethodsCard entries={paymentEntries} total={totalPaymentSales} gradient={paymentGradient} />
                  <DiscountSummaryCard report={report} />
                </section>
              </>
            ) : (
              <section aria-label="Branch channel and payment summaries" className="mb-4 grid items-stretch gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <SalesChannelCard
                    onlineOrders={channelMetrics.onlineOrders}
                    onlineSales={channelMetrics.onlineSales}
                    onsiteOrders={channelMetrics.onsiteOrders}
                    onsiteSales={channelMetrics.onsiteSales}
                  />
                </div>
                <PaymentMethodsCard entries={paymentEntries} total={totalPaymentSales} gradient={paymentGradient} />
              </section>
            )}

            <SalesTimelineCard
              buckets={timeline.buckets}
              orderCount={report.total_orders}
              description={timeline.description}
              style={timelineStyle}
              onStyleChange={setTimelineStyle}
            />
          </>
        )}
      </div>
    </main>
  );
};

const PaymentMethodsCard = ({
  entries,
  total,
  gradient,
}: {
  entries: Array<[string, { orders: number; amount: number }]>;
  total: number;
  gradient: string;
}) => (
  <div className="admin-card h-full p-5">
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-[var(--oppa-text)]">Payment methods</h2>
      <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Revenue collected by payment type</p>
    </div>
    {entries.length && total > 0 ? (
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
        <div className="relative size-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${gradient})` }} role="img" aria-label="Payment methods sales distribution">
          <div className="absolute inset-4 grid place-content-center rounded-full bg-[var(--oppa-surface)] text-center">
            <span className="text-[10px] text-[var(--oppa-text-muted)]">Total</span>
            <strong className="text-xs text-[var(--oppa-text)]">{money(total)}</strong>
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          {entries.map(([method, summary], index) => (
            <div key={method} className="flex items-start gap-2 text-sm">
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[index % PAYMENT_COLORS.length] }} aria-hidden="true" />
              <span className="min-w-0 text-[var(--oppa-text)]">
                {getPaymentMethodLabel(method)}
                <span className="block text-xs text-[var(--oppa-text-muted)]">{summary.orders} {summary.orders === 1 ? 'order' : 'orders'}</span>
              </span>
              <strong className="shrink-0 text-xs tabular-nums text-[var(--oppa-text)]">{money(Number(summary.amount) || 0)}</strong>
            </div>
          ))}
        </div>
      </div>
    ) : <p className="py-8 text-center text-sm text-[var(--oppa-text-muted)]">No payment data in this period.</p>}
  </div>
);

const DiscountSummaryCard = ({ report }: { report: Report }) => (
  <div className="admin-card h-full p-5">
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-[var(--oppa-text)]">Discount summary</h2>
      <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Approved discounts for this period</p>
    </div>
    <div className="grid grid-cols-2 gap-4 rounded-xl bg-[var(--oppa-green-soft)] p-4 text-sm text-[var(--oppa-text)]">
      <span>Discounted orders</span><strong className="text-right">{report.discount_summary.discounted_orders}</strong>
      <span>Discount amount</span><strong className="text-right">{money(Number(report.discount_summary.discount_amount) || 0)}</strong>
    </div>
    <p className="mt-4 text-xs text-[var(--oppa-text-muted)]">Cancelled orders in range: <strong className="text-[var(--oppa-text)]">{report.cancelled_orders}</strong></p>
  </div>
);

export default FranchiseReportsPage;

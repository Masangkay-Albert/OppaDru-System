import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Globe2, Loader2, Shield, ShoppingBag, Store, TrendingUp } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllOrders, isRevenueOrder, type AdminOrder } from '../../../services/adminOrderService';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { getCurrentAdmin } from '../../../services/adminAuthService';
import { deleteTargetProfitSale, getTargetProfitSale, updateTargetProfitSale } from '../../../services/targetProfitSaleService';
import { formatCurrency } from '../../../utils/formatters';
import { generateSalesReportPdf } from '../../../utils/reportPdfGenerator';
import { getPaymentMethodLabel } from '../../../constants/thirdPartyPlatforms';
import { PageHeader, Toast } from '../components/AdminUI';
import Select from '../../../components/ui/Select';
import { ReportFilterCard } from '../../shared/components/SalesReportCards';

type ReportRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
type QuickRange = 'custom' | 'today' | '7days' | '30days' | 'month' | 'year';
type SalesChannel = 'online' | 'onsite' | 'foodpanda' | 'grabfood';

const SALES_CHANNELS: Array<{ key: SalesChannel; label: string; color: string; icon: React.ReactNode }> = [
  { key: 'online', label: 'Online', color: 'var(--oppa-green)', icon: <Globe2 size={15} aria-hidden="true" /> },
  { key: 'onsite', label: 'Onsite', color: '#f59e0b', icon: <Store size={15} aria-hidden="true" /> },
  { key: 'foodpanda', label: 'Foodpanda', color: '#e11d48', icon: <ShoppingBag size={15} aria-hidden="true" /> },
  { key: 'grabfood', label: 'GrabFood', color: '#0f766e', icon: <ShoppingBag size={15} aria-hidden="true" /> },
];

const matchesSalesChannel = (order: AdminOrder, channel: string): boolean => {
  if (channel === 'online') return order.channel === 'online' && !order.third_party_platform;
  if (channel === 'onsite') return order.channel === 'onsite';
  return (channel === 'foodpanda' || channel === 'grabfood')
    && order.third_party_platform === channel;
};

const salesChannelLabel = (channel: string): string =>
  SALES_CHANNELS.find((item) => item.key === channel)?.label || 'All channels';

const ALL_YEARS = 'all';
const ALL_FILTER = 'all';
const ALL_CHANNELS = 'all';
const MIN_REPORT_YEAR = new Date().getFullYear();
const getOrderDate = (order: AdminOrder): Date | null => {
  const value = order.created_at || order.timestamp;
  if (!value) return null;
  const normalizedValue = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}+08:00`;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
};

interface ReportFilters {
  year: string;
  month: string;
  week: string;
  day: string;
  date: string;
  channel: string;
}

const isWithinRange = (order: AdminOrder, filters: ReportFilters): boolean => {
  const date = getOrderDate(order);
  if (!date) return false;

  if (filters.year !== ALL_YEARS && date.getFullYear() !== Number(filters.year)) return false;
  if (filters.month !== ALL_FILTER && date.getMonth() !== Number(filters.month)) return false;
  if (filters.day !== ALL_FILTER && date.getDay() !== Number(filters.day)) return false;
  if (filters.week !== ALL_FILTER && Math.ceil(date.getDate() / 7) !== Number(filters.week)) return false;
  if (filters.date !== '' && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` !== filters.date) return false;
  if (filters.channel !== ALL_CHANNELS && !matchesSalesChannel(order, filters.channel)) return false;
  return true;
};

const isLeapYear = (year: number): boolean => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const getDaysInSelectedMonth = (filters: ReportFilters): number => {
  if (filters.month === ALL_FILTER) return 31;

  const month = Number(filters.month);
  if (month === 1) {
    return filters.year === ALL_YEARS || isLeapYear(Number(filters.year)) ? 29 : 28;
  }

  return new Date(2000, month + 1, 0).getDate();
};

const getWeekCount = (filters: ReportFilters): number => Math.ceil(getDaysInSelectedMonth(filters) / 7);

const getWeekDateRange = (filters: ReportFilters): [Date, Date] | null => {
  if (filters.month === ALL_FILTER || filters.year === ALL_YEARS || filters.week === ALL_FILTER) return null;

  const month = Number(filters.month);
  const week = Number(filters.week);
  const start = new Date(Number(filters.year), month, (week - 1) * 7 + 1);
  const end = new Date(Number(filters.year), month, Math.min(week * 7, new Date(Number(filters.year), month + 1, 0).getDate()));
  return [start, end];
};

const formatDateRange = (range: [Date, Date]): string => {
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${formatDate(range[0])} - ${formatDate(range[1])}`;
};

interface TrendBucket {
  label: string;
  sales: number;
  orders: number;
}

const getDaysForTimeline = (filters: ReportFilters): number => {
  if (filters.month === ALL_FILTER) return 31;

  const month = Number(filters.month);
  if (filters.year === ALL_YEARS) {
    // Include February 29 when the history spans multiple years.
    return month === 1 ? 29 : new Date(2000, month + 1, 0).getDate();
  }

  return new Date(Number(filters.year), month + 1, 0).getDate();
};

const getTrendBuckets = (orders: AdminOrder[], range: ReportRange, filters: ReportFilters): TrendBucket[] => {
  const buckets: TrendBucket[] = [];
  const getBucket = (label: string) => {
    const bucket = buckets.find((item) => item.label === label);
    if (bucket) return bucket;
    const next = { label, sales: 0, orders: 0 };
    buckets.push(next);
    return next;
  };

  if (range === 'daily') {
    for (let hour = 10; hour <= 23; hour += 1) getBucket(`${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`);
  } else if (range === 'weekly') {
    const weekRange = getWeekDateRange(filters);
    if (weekRange) {
      const [start, end] = weekRange;
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        getBucket(`${date.toLocaleDateString('en-US', { weekday: 'short' })}\n${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
      }
    } else {
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((day) => getBucket(day));
    }
  } else if (range === 'monthly') {
    const daysInMonth = getDaysForTimeline(filters);
    for (let day = 1; day <= daysInMonth; day += 1) getBucket(String(day));
  } else if (range === 'yearly') {
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].forEach((month) => getBucket(month));
  }

  orders.forEach((order) => {
    const date = getOrderDate(order);
    if (!date) return;
    if (range === 'daily' && (date.getHours() < 10 || date.getHours() > 23)) return;
    const label = range === 'daily'
      ? `${date.getHours() % 12 || 12}:00 ${date.getHours() >= 12 ? 'PM' : 'AM'}`
      : range === 'weekly'
        ? getWeekDateRange(filters)
          ? `${date.toLocaleDateString('en-US', { weekday: 'short' })}\n${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
        : range === 'monthly'
          ? String(date.getDate())
          : date.toLocaleString('en-US', { month: 'short' });
    const bucket = getBucket(label);
    bucket.sales += Number(order.total || 0);
    bucket.orders += 1;
  });

  return buckets;
};

interface SalesChannelSummary {
  key: SalesChannel;
  label: string;
  color: string;
  orders: number;
  sales: number;
  percent: number;
}

const SalesMetricCard = ({ label, value, detail, primary = false }: {
  label: string;
  value: string | number;
  detail: string;
  primary?: boolean;
}) => (
  <section className={`admin-card flex min-h-28 flex-col justify-between p-4 ${primary ? 'admin-card--brand border-[var(--oppa-green)] text-white' : ''}`}>
    <p className={`text-xs font-semibold ${primary ? 'text-white/80' : 'text-[var(--oppa-text-muted)]'}`}>{label}</p>
    <p className={`mt-2 text-2xl font-bold leading-tight tabular-nums ${primary ? 'text-white' : 'text-[var(--oppa-text)]'}`}>{value}</p>
    <p className={`mt-2 text-xs ${primary ? 'text-white/80' : 'text-[var(--oppa-text-muted)]'}`}>{detail}</p>
  </section>
);

const SalesChannelPerformanceCard = ({ channels }: { channels: SalesChannelSummary[] }) => (
  <section className="admin-card mb-6 p-4 sm:p-5" aria-labelledby="sales-channel-performance-title">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 id="sales-channel-performance-title" className="text-sm font-semibold text-[var(--oppa-text)]">Channel performance</h2>
        <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Sales and orders by channel.</p>
      </div>
    </div>
    <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]" role="img" aria-label={`Sales share: ${channels.map((channel) => `${channel.label} ${channel.percent}%`).join(', ')}`}>
      {channels.filter((channel) => channel.orders > 0).map((channel) => (
        <span key={channel.key} className="block h-full shrink-0 transition-all" style={{ width: `${channel.percent}%`, backgroundColor: channel.color }} />
      ))}
    </div>
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {channels.map((channel) => (
        <li key={channel.key} className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--oppa-text)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: channel.color }} aria-hidden="true" />
              {channel.label}
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--oppa-text-muted)]">{channel.percent}%</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--oppa-text-muted)]">
            <span>{channel.orders} {channel.orders === 1 ? 'order' : 'orders'}</span>
            <strong className="text-[var(--oppa-text)]">{formatCurrency(channel.sales)}</strong>
          </div>
        </li>
      ))}
    </ul>
  </section>
);

const SalesTargetPanel = ({
  savedGoal,
  goalInput,
  sales,
  goalReached,
  goalSet,
  editing,
  saving,
  error,
  onGoalChange,
  onSave,
  onStartEdit,
  onCancelEdit,
  onClear,
}: {
  savedGoal: number;
  goalInput: string;
  sales: number;
  goalReached: boolean;
  goalSet: boolean;
  editing: boolean;
  saving: boolean;
  error: string;
  onGoalChange: (value: string) => void;
  onSave: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onClear: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const progress = goalSet ? Math.max(0, Math.min((sales / savedGoal) * 100, 100)) : 0;
  const numericInput = Number(goalInput);
  const isInputValid = !Number.isNaN(numericInput) && numericInput > 0;
  const isDirty = goalSet ? isInputValid && numericInput !== savedGoal : isInputValid;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <section className={`admin-card h-full p-4 sm:p-5 ${goalSet && !goalReached ? 'border-amber-200 bg-amber-50/60' : ''}`} aria-labelledby="sales-target-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="sales-target-title" className="text-sm font-semibold text-[var(--oppa-text)]">Sales target</h2>
          <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Set a target for the selected report period.</p>
        </div>
        <TrendingUp size={18} className={goalReached ? 'text-[var(--oppa-green)]' : 'text-amber-700'} aria-hidden="true" />
      </div>
      {goalSet && (
        <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${goalReached ? 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]' : 'bg-amber-100 text-amber-800'}`}>
          {goalReached ? 'Target reached' : 'Below profit target'}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="min-w-[150px] flex-1 text-xs font-medium text-[var(--oppa-text-muted)]">
          Target amount
          <span className="mt-1 flex h-10 items-center rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 focus-within:border-[var(--oppa-green)] focus-within:ring-2 focus-within:ring-[var(--oppa-green)]/20">
            <span className="mr-2 text-sm text-[var(--oppa-text-muted)]">₱</span>
            <input
              ref={inputRef}
              type="number"
              min="1"
              step="0.01"
              value={goalSet && !editing ? savedGoal : goalInput}
              onChange={(event) => onGoalChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (!goalSet || editing) && isInputValid && (!goalSet || isDirty)) onSave();
                if (event.key === 'Escape' && editing) onCancelEdit();
              }}
              disabled={(goalSet && !editing) || saving}
              placeholder="Set target"
              aria-label="Sales target amount"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--oppa-text)] outline-none disabled:cursor-default"
            />
          </span>
        </label>
        {!goalSet ? (
          <button type="button" onClick={onSave} disabled={saving || !isInputValid} className="h-10 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
        ) : editing ? (
          <>
            <button type="button" onClick={onSave} disabled={saving || !isInputValid || !isDirty} className="h-10 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? 'Saving...' : 'Update'}</button>
            {editing && <button type="button" onClick={onCancelEdit} disabled={saving} className="h-10 rounded-xl border border-[var(--oppa-border)] px-3 text-sm font-semibold text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-surface)] disabled:opacity-50">Cancel</button>}
          </>
        ) : (
          <button type="button" onClick={onStartEdit} className="h-10 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:border-[var(--oppa-green)] hover:text-[var(--oppa-green-dark)]">Edit</button>
        )}
        {goalSet && (
          <button type="button" onClick={onClear} disabled={saving} className="ml-auto h-10 px-2 text-sm font-semibold text-[var(--oppa-text-muted)] underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-50">Remove</button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      <div className="mt-4 flex items-center justify-between gap-2 text-xs text-[var(--oppa-text-muted)]">
        <span>Sales: <strong className="text-[var(--oppa-text)]">{formatCurrency(sales)}</strong></span>
        {goalSet && <span>Target: <strong className="text-[var(--oppa-text)]">{formatCurrency(savedGoal)}</strong></span>}
      </div>
      {goalSet && (
        <>
          <div className="mb-1 mt-3 flex items-center justify-between text-xs text-[var(--oppa-text-muted)]">
            <span>Target progress</span>
            <span className="font-semibold tabular-nums text-[var(--oppa-text)]">{Math.round(progress)}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]" role="progressbar" aria-label="Sales target progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-[var(--oppa-green)] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-right text-xs text-[var(--oppa-text-muted)]">Remaining <strong className="text-[var(--oppa-text)]">{formatCurrency(Math.max(savedGoal - sales, 0))}</strong></p>
        </>
      )}
    </section>
  );
};

const TOP_PRODUCT_TABS: Array<{ key: 'all' | SalesChannel; label: string }> = [
  { key: 'all', label: 'All' },
  ...SALES_CHANNELS.map(({ key, label }) => ({ key, label })),
];

const TopProductsPanel = ({
  selectedChannel,
  products,
  onChannelChange,
}: {
  selectedChannel: 'all' | SalesChannel;
  products: Array<[string, number]>;
  onChannelChange: (channel: 'all' | SalesChannel) => void;
}) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const maxQuantity = Math.max(...products.map(([, quantity]) => quantity), 1);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + direction + TOP_PRODUCT_TABS.length) % TOP_PRODUCT_TABS.length;
    onChannelChange(TOP_PRODUCT_TABS[nextIndex].key);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <section className="admin-card min-w-0 p-4 sm:p-5" aria-labelledby="top-products-title">
      <div>
        <h2 id="top-products-title" className="text-sm font-semibold text-[var(--oppa-text)]">Top 5 products</h2>
        <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Products sold in the selected report period.</p>
      </div>
      <div className="mt-4 -mx-1 overflow-x-auto px-1">
        <div role="tablist" aria-label="Top products channel" className="flex w-max min-w-full gap-1 border-b border-[var(--oppa-border)]">
          {TOP_PRODUCT_TABS.map((tab, index) => (
            <button
              key={tab.key}
              ref={(element) => { tabRefs.current[index] = element; }}
              id={`top-products-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={selectedChannel === tab.key}
              aria-controls="top-products-panel"
              tabIndex={selectedChannel === tab.key ? 0 : -1}
              onClick={() => onChannelChange(tab.key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] ${selectedChannel === tab.key ? 'border-[var(--oppa-green)] text-[var(--oppa-green-dark)]' : 'border-transparent text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div id="top-products-panel" role="tabpanel" aria-labelledby={`top-products-tab-${selectedChannel}`} className="mt-4">
        {products.length ? (
          <ol className="space-y-4">
            {products.map(([name, quantity], index) => (
              <li key={name} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-xs font-bold text-[var(--oppa-green-dark)]">{index + 1}</span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium text-[var(--oppa-text)]">{name}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]" aria-hidden="true">
                    <div className="h-full rounded-full bg-[var(--oppa-green)]" style={{ width: `${Math.max((quantity / maxQuantity) * 100, 4)}%` }} />
                  </div>
                </div>
                <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-[var(--oppa-text-muted)]">{quantity} sold</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded-xl bg-[var(--oppa-surface)] px-4 py-8 text-center text-sm text-[var(--oppa-text-muted)]" role="status">No sales for this channel yet</div>
        )}
      </div>
    </section>
  );
};

const SalesTimelinePanel = ({
  buckets,
  orderCount,
  description,
  style,
  onStyleChange,
}: {
  buckets: TrendBucket[];
  orderCount: number;
  description: string;
  style: 'line' | 'bar';
  onStyleChange: (style: 'line' | 'bar') => void;
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(1000);
  const left = 64;
  const right = 18;
  const top = 24;
  const bottom = 54;
  const chartHeight = 280;

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(Math.max(Math.round(entry.contentRect.width), 1));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [orderCount]);

  const plotWidth = chartWidth - left - right;
  const plotHeight = chartHeight - top - bottom;
  const maxSales = Math.max(...buckets.map((bucket) => bucket.sales), 0);
  const scaleMax = maxSales > 0 ? maxSales * 1.15 : 1;
  const step = buckets.length > 1 ? plotWidth / (buckets.length - 1) : plotWidth;
  const pointX = (index: number) => buckets.length > 1 ? left + index * step : left + plotWidth / 2;
  const pointY = (sales: number) => top + plotHeight - (sales / scaleMax) * plotHeight;
  const peak = buckets.reduce<TrendBucket | null>((current, bucket) => !current || bucket.sales > current.sales ? bucket : current, null);
  const linePoints = buckets.map((bucket, index) => `${pointX(index)},${pointY(bucket.sales)}`).join(' ');
  const barWidth = Math.min(28, plotWidth / Math.max(buckets.length, 1) * 0.52);

  return (
    <section className="admin-card mb-6 p-4 sm:p-5" aria-labelledby="sales-timeline-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="sales-timeline-title" className="text-sm font-semibold text-[var(--oppa-text)]">Sales timeline</h2>
          <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {peak && <span className="rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--oppa-green-dark)]">Peak {formatCurrency(peak.sales)}</span>}
          <div role="group" aria-label="Chart style" className="inline-flex rounded-lg border border-[var(--oppa-border)] p-0.5">
            {(['line', 'bar'] as const).map((option) => (
              <button key={option} type="button" aria-pressed={style === option} onClick={() => onStyleChange(option)} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] ${style === option ? 'bg-[var(--oppa-green)] text-white' : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'}`}>{option}</button>
            ))}
          </div>
        </div>
      </div>
      {orderCount ? (
        <div ref={chartContainerRef} className="mt-4 w-full">
          <svg className="block h-[280px] w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" role="img" aria-label="Sales by time period">
            {[0, 1, 2, 3].map((index) => {
              const value = (scaleMax * index) / 3;
              const y = top + plotHeight - (index / 3) * plotHeight;
              return (
                <g key={index}>
                  <line x1={left} y1={y} x2={chartWidth - right} y2={y} stroke="var(--oppa-border)" strokeDasharray={index ? '3 4' : undefined} />
                  <text x={left - 8} y={y + 4} textAnchor="end" fill="var(--oppa-text-muted)" fontSize="11">{formatCurrency(value)}</text>
                </g>
              );
            })}
            {style === 'line' && buckets.length > 1 && <polygon points={`${pointX(0)},${top + plotHeight} ${linePoints} ${pointX(buckets.length - 1)},${top + plotHeight}`} fill="var(--oppa-green)" opacity="0.08" />}
            {style === 'line' && buckets.length > 1 && <polyline points={linePoints} fill="none" stroke="var(--oppa-green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            {buckets.map((bucket, index) => {
              const x = pointX(index);
              const y = pointY(bucket.sales);
              const isNarrow = chartWidth < 500;
              const hideDenseLabel = isNarrow && buckets.length > 20 && index % 2 === 1 && index !== buckets.length - 1;
              const label = isNarrow && chartWidth < 650
                ? bucket.label.replace(':00', '').replace(' AM', 'a').replace(' PM', 'p')
                : bucket.label;
              const labelLines = label.split('\n');
              return (
                <g key={`${bucket.label}-${index}`}>
                  {style === 'bar' && <rect x={x - barWidth / 2} y={y} width={barWidth} height={Math.max(top + plotHeight - y, 1)} rx="4" fill="var(--oppa-green)" opacity="0.85" />}
                  {style === 'line' && <circle cx={x} cy={y} r="4" fill="white" stroke="var(--oppa-green)" strokeWidth="2.5" />}
                  <title>{`${bucket.label.replace('\n', ' ')}: ${formatCurrency(bucket.sales)}, ${bucket.orders} orders`}</title>
                  {!hideDenseLabel && labelLines.map((line, lineIndex) => (
                    <text key={`${line}-${lineIndex}`} x={x} y={chartHeight - bottom + 18 + lineIndex * 13} textAnchor="middle" fill="var(--oppa-text-muted)" fontSize={isNarrow ? '10' : '11'}>{line}</text>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-[var(--oppa-surface)] py-14 text-center text-sm text-[var(--oppa-text-muted)]">No sales for these filters.</div>
      )}
    </section>
  );
};

const AdminReportsPage: React.FC = () => {
  const { admin } = useAdminAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({ year: ALL_YEARS, month: ALL_FILTER, week: ALL_FILTER, day: ALL_FILTER, date: '', channel: ALL_CHANNELS });
  const [quickRange, setQuickRange] = useState<QuickRange>('year');
  const [timelineStyle, setTimelineStyle] = useState<'line' | 'bar'>('line');
  const [topProductsChannel, setTopProductsChannel] = useState<'all' | SalesChannel>('all');
  const [savedGoal, setSavedGoal] = useState(0);
  const [goalInput, setGoalInput] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');

  useEffect(() => {
    let isMounted = true;
    getAllOrders()
      .then((allOrders) => {
        if (isMounted) setOrders(Array.isArray(allOrders) ? allOrders : []);
      })
      .catch(() => {
        if (isMounted) setOrders([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    getTargetProfitSale()
      .then((savedValue) => {
        if (isMounted) {
          const num = Number(savedValue) || 0;
          setSavedGoal(num);
          setGoalInput(num > 0 ? String(num) : '');
          setEditingGoal(false);
        }
      })
      .catch(() => {
        if (isMounted) setGoalError('Sales target could not be loaded.');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (quickRange === '7days') start.setDate(start.getDate() - 6);
    else if (quickRange === '30days') start.setDate(start.getDate() - 29);
    else if (quickRange === 'month') start.setDate(1);
    else if (quickRange === 'year') start.setMonth(0, 1);
    return orders.filter((order) => {
      if (!isWithinRange(order, filters)) return false;
      if (quickRange === 'custom') return true;
      const date = getOrderDate(order);
      return date !== null && date >= start && date <= now;
    });
  }, [orders, filters, quickRange]);

  const salesOrders = useMemo(
    () => filteredOrders.filter(isRevenueOrder),
    [filteredOrders]
  );
  const paymentEntries = useMemo(() => {
    const summary = new Map<string, { orders: number; amount: number }>();
    salesOrders.forEach((order) => {
      const method = String(order.payment_method || order.paymentMethod || 'unknown').trim().toLowerCase();
      const current = summary.get(method) || { orders: 0, amount: 0 };
      current.orders += 1;
      current.amount += Number(order.total) || 0;
      summary.set(method, current);
    });
    return [...summary.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [salesOrders]);
  const totalPaymentSales = paymentEntries.reduce((sum, [, payment]) => sum + payment.amount, 0);

  const timelineRange: ReportRange = quickRange === 'today' || filters.date !== '' || filters.day !== ALL_FILTER
    ? 'daily'
    : quickRange === '7days' ? 'weekly'
    : quickRange === '30days' || quickRange === 'month' ? 'monthly'
    : quickRange === 'year' ? 'yearly'
    : filters.week !== ALL_FILTER
      ? 'weekly'
      : filters.month !== ALL_FILTER
        ? 'monthly'
        : 'yearly';

  const years = useMemo(() => [...new Set(orders.map((order) => getOrderDate(order)?.getFullYear()).filter(Boolean))].sort((a, b) => Number(b) - Number(a)), [orders]);

  const metrics = useMemo(() => {
    const channelOrders = SALES_CHANNELS.map((channel) => ({
      ...channel,
      orders: salesOrders.filter((order) => matchesSalesChannel(order, channel.key)),
    }));
    const channelSales = channelOrders.map((channel) => ({
      ...channel,
      sales: channel.orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    }));
    const shareWeights = channelSales.map((channel) => Math.max(channel.sales, 0));
    const totalShareWeight = shareWeights.reduce((sum, weight) => sum + weight, 0);
    const weights = totalShareWeight > 0
      ? shareWeights
      : channelSales.map((channel) => channel.orders.length);
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    const exactShares = weights.map((weight) => weightTotal ? (weight / weightTotal) * 100 : 0);
    const percentages = exactShares.map(Math.floor);
    let remainingPercent = weightTotal ? 100 - percentages.reduce((sum, percent) => sum + percent, 0) : 0;
    const remainderOrder = exactShares
      .map((share, index) => ({ index, fraction: share - percentages[index] }))
      .sort((left, right) => right.fraction - left.fraction);
    for (let index = 0; remainingPercent > 0; index += 1, remainingPercent -= 1) {
      percentages[remainderOrder[index % remainderOrder.length].index] += 1;
    }
    channelSales.forEach((channel, index) => {
      if (channel.orders.length === 0 || percentages[index] > 0) return;
      let donorIndex = -1;
      percentages.forEach((percent, candidateIndex) => {
        if (candidateIndex !== index && percent > (donorIndex < 0 ? 1 : percentages[donorIndex])) {
          donorIndex = candidateIndex;
        }
      });
      if (donorIndex >= 0 && percentages[donorIndex] > 1) {
        percentages[donorIndex] -= 1;
        percentages[index] = 1;
      }
    });

    return {
      totalSales: salesOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      totalOrders: salesOrders.length,
      channels: channelSales.map((channel, index) => ({
        key: channel.key,
        label: channel.label,
        color: channel.color,
        orders: channel.orders.length,
        sales: channel.sales,
        percent: percentages[index],
      })),
    };
  }, [salesOrders]);

  const topProductsByChannel = useMemo(() => {
    const getTop = (channel?: SalesChannel) => {
      const products = new Map<string, number>();
      salesOrders.filter((order) => !channel || matchesSalesChannel(order, channel)).forEach((order) => {
        order.items?.forEach((item: { product_name?: string; name?: string; quantity?: number }) => {
          const name = item.product_name || item.name || 'Unnamed item';
          products.set(name, (products.get(name) || 0) + Number(item.quantity || 0));
        });
      });
      return [...products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    };
    return {
      all: getTop(),
      online: getTop('online'),
      onsite: getTop('onsite'),
      foodpanda: getTop('foodpanda'),
      grabfood: getTop('grabfood'),
    };
  }, [salesOrders]);

  const trendBuckets = useMemo(() => getTrendBuckets(salesOrders, timelineRange, filters), [salesOrders, timelineRange, filters]);
  const weekDateRange = getWeekDateRange(filters);
  const weekOptions = Array.from({ length: getWeekCount(filters) }, (_, index) => {
    const week = index + 1;
    const range = getWeekDateRange({ ...filters, week: String(week) });
    return { value: String(week), label: range ? `Week ${week} (${formatDateRange(range).replace(`, ${filters.year}`, '')})` : `Week ${week}` };
  });
  const goalSet = savedGoal > 0;
  const goalReached = goalSet && metrics.totalSales >= savedGoal;

  const updateFilter = (key: keyof ReportFilters, value: string) => {
    if (key !== 'channel') setQuickRange('custom');
    if (key === 'channel') setTopProductsChannel(value === ALL_CHANNELS ? 'all' : value as SalesChannel);
    setFilters((current) => {
    if (key === 'date' && value !== '') {
      const selectedDate = new Date(`${value}T00:00:00+08:00`);
      if (selectedDate.getFullYear() < MIN_REPORT_YEAR) return current;
      return {
        ...current,
        year: String(selectedDate.getFullYear()),
        month: String(selectedDate.getMonth()),
        week: String(Math.ceil(selectedDate.getDate() / 7)),
        day: String(selectedDate.getDay()),
        date: value,
      };
    }

    return {
      ...current,
      [key]: value,
      ...(['year', 'month', 'week', 'day'].includes(key) ? { date: '' } : {}),
      ...(key === 'year' || key === 'month' ? { week: ALL_FILTER } : {}),
    };
    });
  };

  const clearFilters = () => {
    setQuickRange('custom');
    setFilters({ year: ALL_YEARS, month: ALL_FILTER, week: ALL_FILTER, day: ALL_FILTER, date: '', channel: ALL_CHANNELS });
    setTopProductsChannel('all');
  };

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    setFilters((current) => ({ year: ALL_YEARS, month: ALL_FILTER, week: ALL_FILTER, day: ALL_FILTER, date: '', channel: current.channel }));
  };

  const quickRangeLabels: Record<QuickRange, string> = {
    custom: 'Custom range',
    today: 'Today',
    '7days': 'Last 7 days',
    '30days': 'Last 30 days',
    month: 'This month',
    year: 'This year',
  };
  const customDateSummary = filters.date
    ? new Date(`${filters.date}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : [
      filters.year !== ALL_YEARS ? filters.year : 'All years',
      filters.month !== ALL_FILTER ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(filters.month)] : null,
      filters.week !== ALL_FILTER ? `Week ${filters.week}` : null,
      filters.day !== ALL_FILTER ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(filters.day)] : null,
    ].filter(Boolean).join(' · ');
  const dateRangeSummary = quickRange === 'custom' ? customDateSummary : quickRangeLabels[quickRange];
  const activeFilterSummary = `${dateRangeSummary} · ${salesChannelLabel(filters.channel)}`;

  const handleSaveGoal = async () => {
    const targetAmount = Number(goalInput.replaceAll(',', ''));
    if (isNaN(targetAmount) || targetAmount <= 0) {
      setGoalError('Please enter a valid target amount greater than 0.');
      return;
    }
    setGoalSaving(true);
    setGoalError('');
    try {
      const updated = await updateTargetProfitSale(targetAmount);
      setSavedGoal(updated);
      setGoalInput(String(updated));
      setEditingGoal(false);
      setNoticeTone('success');
      setNotice('Sales target saved.');
    } catch {
      setGoalError('Sales target could not be saved.');
    } finally {
      setGoalSaving(false);
    }
  };

  const handleClearGoal = async () => {
    setGoalSaving(true);
    setGoalError('');
    try {
      await deleteTargetProfitSale();
      setSavedGoal(0);
      setGoalInput('');
      setEditingGoal(false);
      setNoticeTone('success');
      setNotice('Sales target removed.');
    } catch {
      setGoalError('Sales target could not be removed.');
    } finally {
      setGoalSaving(false);
    }
  };

  const handleStartEdit = () => {
    setGoalInput(savedGoal > 0 ? String(savedGoal) : '');
    setEditingGoal(true);
    setGoalError('');
  };

  const handleCancelEdit = () => {
    setGoalInput(savedGoal > 0 ? String(savedGoal) : '');
    setEditingGoal(false);
    setGoalError('');
  };

  const handleExportPDF = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const currentAdmin = admin || getCurrentAdmin();
      const weekRange = getWeekDateRange(filters);
      const weekRangeText = weekRange ? formatDateRange(weekRange).replace(`, ${filters.year}`, '') : undefined;

      await generateSalesReportPdf({
        orders: salesOrders,
        metrics,
        payments: paymentEntries.map(([method, payment]) => ({
          method: getPaymentMethodLabel(method),
          orders: payment.orders,
          amount: payment.amount,
        })),
        goal: savedGoal,
        goalReached,
        goalSet,
        timelineRange,
        activeFilterSummary,
        filters: {
          ...filters,
          weekRangeText,
        },
        topProducts: topProductsByChannel,
        generatedBy: {
          name: currentAdmin?.fullName || 'System Administrator',
          email: currentAdmin?.email || 'admin@oppadru.com',
          role: currentAdmin?.role || 'admin',
        },
      });
      setNoticeTone('success');
      setNotice('Sales report exported successfully.');
    } catch (error) {
      console.error('Failed to generate sales report PDF:', error);
      setNoticeTone('error');
      setNotice('The PDF could not be generated. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const currentAdmin = admin || getCurrentAdmin();

  return (
    <AdminLayout>
      {notice && <Toast message={notice} tone={noticeTone} onDismiss={() => setNotice('')} />}
      <PageHeader title="Sales report" subtitle="A clear view of revenue and order performance across every channel." actions={
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleExportPDF} disabled={loading || exportingPdf} className="bg-oppa-gradient inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50">
              {exportingPdf ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              {exportingPdf ? 'Generating PDF...' : 'Export PDF'}
            </button>
          </div>
          {currentAdmin && (
            <div className="inline-flex items-center gap-1.5 text-xs text-[var(--oppa-text-muted)]">
              <Shield size={13} className="text-[var(--oppa-green)] flex-shrink-0" />
              <span>
                Exporting as: <strong className="font-semibold text-[var(--oppa-text)]">{currentAdmin.fullName || 'Admin'}</strong>{' '}
                <span className="text-[11px] text-[var(--oppa-text-muted)]">({currentAdmin.email || 'admin@oppadru.com'})</span>
              </span>
            </div>
          )}
        </div>
      } />

      <ReportFilterCard className="mb-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div role="group" aria-label="Quick date ranges" className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {([
                ['today', 'Today'], ['7days', '7 days'], ['30days', '30 days'],
                ['month', 'This month'], ['year', 'This year'], ['custom', 'Custom'],
              ] as const).map(([range, label]) => (
                <button key={range} type="button" aria-pressed={quickRange === range} onClick={() => applyQuickRange(range)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] ${quickRange === range ? 'border-[var(--oppa-green)] bg-[var(--oppa-green)] text-white' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text-muted)] hover:border-[var(--oppa-green)] hover:text-[var(--oppa-green-dark)]'}`}>{label}</button>
              ))}
            </div>
            <div className="w-full shrink-0 sm:w-48">
              <FilterSelect
                label="Channel"
                value={filters.channel}
                onChange={(value) => updateFilter('channel', value)}
                options={[
                  { value: ALL_CHANNELS, label: 'All channels' },
                  ...SALES_CHANNELS.map((channel) => ({ value: channel.key, label: channel.label, icon: channel.icon })),
                ]}
              />
            </div>
          </div>
        </div>
        {quickRange === 'custom' && <div className="mt-3 grid gap-3 border-t border-[var(--oppa-border)] pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <FilterSelect label="Year" value={filters.year} onChange={(value) => updateFilter('year', value)} options={[{ value: ALL_YEARS, label: 'All years' }, ...years.map((year) => ({ value: String(year), label: String(year) }))]} />
          <FilterSelect label="Month" value={filters.month} onChange={(value) => updateFilter('month', value)} options={[{ value: ALL_FILTER, label: 'All months' }, ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((label, index) => ({ value: String(index), label }))]} />
          <FilterSelect label="Week of month" value={filters.week} onChange={(value) => updateFilter('week', value)} options={[{ value: ALL_FILTER, label: 'All weeks' }, ...weekOptions]} />
          <FilterSelect label="Day of week" value={filters.day} onChange={(value) => updateFilter('day', value)} options={[{ value: ALL_FILTER, label: 'All days' }, ...['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, index) => ({ value: String(index), label }))]} />
          <label className="text-xs font-medium text-[var(--oppa-text-muted)]">Exact date<input type="date" data-min={`${MIN_REPORT_YEAR}-01-01`} value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 py-2 text-sm font-normal text-[var(--oppa-text)] focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20" /></label>
        </div>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--oppa-border)] pt-3 text-xs">
          <p className="text-[var(--oppa-text-muted)]"><span>Showing: </span><strong className="font-semibold text-[var(--oppa-text)]">{activeFilterSummary}</strong></p>
          <button type="button" onClick={clearFilters} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">Clear filters</button>
        </div>
      </ReportFilterCard>

      {loading ? <div role="status" aria-label="Loading sales report" aria-busy="true" className="mb-6 min-h-36" /> : <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <SalesMetricCard label="Total sales" value={formatCurrency(metrics.totalSales)} detail="Based on selected filters" primary />
        <SalesMetricCard label="Total orders" value={metrics.totalOrders} detail={salesChannelLabel(filters.channel)} />
        {metrics.channels.map((channel) => (
          <SalesMetricCard key={channel.key} label={`${channel.label} orders`} value={channel.orders} detail={`${formatCurrency(channel.sales)} sales`} />
        ))}
      </div>}

      <SalesChannelPerformanceCard channels={metrics.channels} />

      <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.7fr)]">
        <SalesTargetPanel
          savedGoal={savedGoal}
          goalInput={goalInput}
          sales={metrics.totalSales}
          goalReached={goalReached}
          goalSet={goalSet}
          editing={editingGoal}
          saving={goalSaving}
          error={goalError}
          onGoalChange={setGoalInput}
          onSave={handleSaveGoal}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onClear={handleClearGoal}
        />
        <TopProductsPanel
          selectedChannel={topProductsChannel}
          products={topProductsByChannel[topProductsChannel]}
          onChannelChange={setTopProductsChannel}
        />
      </div>

      <section aria-label="Payment method summary" className="admin-card mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--oppa-text)]">Sales by payment method</h2>
            <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Platform-paid orders are listed separately from register payments.</p>
          </div>
          <p className="text-sm text-[var(--oppa-text-muted)]">Sales total <strong className="ml-1 text-[var(--oppa-text)]">{formatCurrency(totalPaymentSales)}</strong></p>
        </div>
        {paymentEntries.length ? <div className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {paymentEntries.map(([method, payment]) => (
            <div key={method} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-[var(--oppa-text)]">{getPaymentMethodLabel(method).replace(' (paid by platform)', '')}</span>
                  {getPaymentMethodLabel(method).includes('(paid by platform)') && <span className="rounded-full bg-[var(--oppa-green-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--oppa-green-dark)]">Paid by platform</span>}
                </div>
                <span className="mt-1 block text-xs text-[var(--oppa-text-muted)]">{payment.orders} {payment.orders === 1 ? 'order' : 'orders'}</span>
              </div>
              <strong className="shrink-0 text-sm tabular-nums text-[var(--oppa-text)]">{formatCurrency(payment.amount)}</strong>
            </div>
          ))}
        </div> : <p className="mt-4 text-sm text-[var(--oppa-text-muted)]">No paid orders for these filters.</p>}
      </section>
      <SalesTimelinePanel
        buckets={trendBuckets}
        orderCount={salesOrders.length}
        description={timelineRange === 'daily' ? 'Hourly activity from 10:00 AM to 11:00 PM.' : timelineRange === 'weekly' ? weekDateRange ? `Daily activity for ${formatDateRange(weekDateRange)}.` : 'Daily activity grouped by weekday.' : timelineRange === 'monthly' ? 'Daily activity grouped by calendar date.' : 'Monthly activity grouped from January to December.'}
        style={timelineStyle}
        onStyleChange={setTimelineStyle}
      />

    </AdminLayout>
  );
};

const FilterSelect = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string; icon?: React.ReactNode }[] }) => (
  <Select label={label} value={value} onChange={onChange} options={options} />
);

export default AdminReportsPage;

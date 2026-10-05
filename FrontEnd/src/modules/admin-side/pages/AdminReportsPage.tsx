import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileText, Globe2, Loader2, Shield, Store, TrendingUp } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllOrders, isRevenueOrder, type AdminOrder } from '../../../services/adminOrderService';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { getCurrentAdmin } from '../../../services/adminAuthService';
import { deleteTargetProfitSale, getTargetProfitSale, updateTargetProfitSale } from '../../../services/targetProfitSaleService';
import { formatCurrency } from '../../../utils/formatters';
import { generateSalesReportPdf } from '../../../utils/reportPdfGenerator';
import { EmptyState, PageHeader, Toast } from '../components/AdminUI';

type ReportRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
type QuickRange = 'custom' | 'today' | '7days' | '30days' | 'month' | 'year';

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
  if (filters.channel !== ALL_CHANNELS && order.channel !== filters.channel) return false;
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
    for (let hour = 11; hour <= 23; hour += 1) getBucket(`${hour % 12 || 12}:00 ${hour >= 12 ? 'PM' : 'AM'}`);
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
    if (range === 'daily' && (date.getHours() < 11 || date.getHours() > 23)) return;
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

const AdminReportsPage: React.FC = () => {
  const { admin } = useAdminAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({ year: ALL_YEARS, month: ALL_FILTER, week: ALL_FILTER, day: ALL_FILTER, date: '', channel: ALL_CHANNELS });
  const [quickRange, setQuickRange] = useState<QuickRange>('custom');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [timelineStyle, setTimelineStyle] = useState<'line' | 'bar'>('line');
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
    const onlineOrders = salesOrders.filter((order) => order.channel === 'online');
    const onsiteOrders = salesOrders.filter((order) => order.channel === 'onsite');
    return {
      totalSales: salesOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      totalOrders: salesOrders.length,
      onlineOrders,
      onsiteOrders,
      onlineSales: onlineOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      onsiteSales: onsiteOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    };
  }, [salesOrders]);

  const topProductsByChannel = useMemo(() => {
    const getTop = (channel: 'online' | 'onsite') => {
      const products = new Map<string, number>();
      salesOrders.filter((order) => order.channel === channel).forEach((order) => {
        order.items?.forEach((item: { product_name?: string; name?: string; quantity?: number }) => {
          const name = item.product_name || item.name || 'Unnamed item';
          products.set(name, (products.get(name) || 0) + Number(item.quantity || 0));
        });
      });
      return [...products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    };
    return { online: getTop('online'), onsite: getTop('onsite') };
  }, [salesOrders]);

  const trendBuckets = useMemo(() => getTrendBuckets(salesOrders, timelineRange, filters), [salesOrders, timelineRange, filters]);
  const weekDateRange = getWeekDateRange(filters);
  const weekOptions = Array.from({ length: getWeekCount(filters) }, (_, index) => {
    const week = index + 1;
    const range = getWeekDateRange({ ...filters, week: String(week) });
    return { value: String(week), label: range ? `Week ${week} (${formatDateRange(range).replace(`, ${filters.year}`, '')})` : `Week ${week}` };
  });
  const highestTrendSales = Math.max(...trendBuckets.map((bucket) => bucket.sales), 1);
  const goalSet = savedGoal > 0;
  const goalReached = goalSet && metrics.totalSales >= savedGoal;

  const updateFilter = (key: keyof ReportFilters, value: string) => {
    setQuickRange('custom');
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
  };

  const applyQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    setFilters({ year: ALL_YEARS, month: ALL_FILTER, week: ALL_FILTER, day: ALL_FILTER, date: '', channel: ALL_CHANNELS });
  };

  const activeFilterSummary = [
    filters.date ? new Date(`${filters.date}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : filters.year !== ALL_YEARS ? filters.year : 'All years',
    !filters.date && filters.month !== ALL_FILTER ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(filters.month)] : null,
    !filters.date && filters.week !== ALL_FILTER ? `Week ${filters.week}` : null,
    !filters.date && filters.day !== ALL_FILTER ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(filters.day)] : null,
    filters.channel === ALL_CHANNELS ? 'All channels' : filters.channel === 'online' ? 'Online' : 'Onsite',
  ].filter(Boolean).join(' · ');

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

      <section aria-label="Report filters" className="admin-reports-filters admin-card mb-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" aria-label="Quick date ranges">
          {([
            ['today', 'Today'], ['7days', '7 days'], ['30days', '30 days'],
            ['month', 'This month'], ['year', 'This year'], ['custom', 'Custom'],
          ] as const).map(([range, label]) => <button key={range} type="button" aria-pressed={quickRange === range} onClick={() => applyQuickRange(range)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${quickRange === range ? 'border-[var(--oppa-green)] bg-[var(--oppa-green)] text-white' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text-muted)] hover:border-[var(--oppa-green)] hover:text-[var(--oppa-green-dark)]'}`}>{label}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-expanded={moreFiltersOpen} onClick={() => setMoreFiltersOpen((open) => !open)} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-xs font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">{moreFiltersOpen ? 'Hide filters' : 'More filters'}</button>
          <button onClick={clearFilters} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]">Clear filters</button>
        </div>
      </div>
      {moreFiltersOpen && <div className="mt-3 grid gap-3 border-t border-[var(--oppa-border)] pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FilterSelect label="Year" value={filters.year} onChange={(value) => updateFilter('year', value)} options={[{ value: ALL_YEARS, label: 'All years' }, ...years.map((year) => ({ value: String(year), label: String(year) }))]} />
        <FilterSelect label="Month" value={filters.month} onChange={(value) => updateFilter('month', value)} options={[{ value: ALL_FILTER, label: 'All months' }, ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((label, index) => ({ value: String(index), label }))]} />
        <FilterSelect label="Week of month" value={filters.week} onChange={(value) => updateFilter('week', value)} options={[{ value: ALL_FILTER, label: 'All weeks' }, ...weekOptions]} />
        <FilterSelect label="Day of week" value={filters.day} onChange={(value) => updateFilter('day', value)} options={[{ value: ALL_FILTER, label: 'All days' }, ...['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, index) => ({ value: String(index), label }))]} />
        <label className="text-xs font-medium text-[var(--oppa-text-muted)]">Exact date<input type="date" min={`${MIN_REPORT_YEAR}-01-01`} value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} className="mt-1 block h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 py-2 text-sm font-normal text-[var(--oppa-text)]" /></label>
        <FilterSelect label="Channel" value={filters.channel} onChange={(value) => updateFilter('channel', value)} options={[{ value: ALL_CHANNELS, label: 'All channels' }, { value: 'online', label: 'Online' }, { value: 'onsite', label: 'Onsite' }]} />
      </div>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--oppa-border)] pt-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--oppa-text-muted)]">
          <span>Showing:</span>
          {quickRange !== 'custom' && <button type="button" onClick={() => applyQuickRange('custom')} className="rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 font-medium text-[var(--oppa-green-dark)]">{({ today: 'Today', '7days': 'Last 7 days', '30days': 'Last 30 days', month: 'This month', year: 'This year' } as const)[quickRange]} ×</button>}
          {[filters.date && `Date: ${filters.date}`, !filters.date && filters.year !== ALL_YEARS && `Year: ${filters.year}`, !filters.date && filters.month !== ALL_FILTER && `Month: ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(filters.month)]}`, !filters.date && filters.week !== ALL_FILTER && `Week ${filters.week}`, !filters.date && filters.day !== ALL_FILTER && `Day: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(filters.day)]}`, filters.channel !== ALL_CHANNELS && `Channel: ${filters.channel}`].filter((chip): chip is string => Boolean(chip)).map((chip) => <span key={chip} className="rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 font-medium text-[var(--oppa-green-dark)]">{chip}</span>)}
          {!filters.date && filters.year === ALL_YEARS && filters.month === ALL_FILTER && filters.week === ALL_FILTER && filters.day === ALL_FILTER && filters.channel === ALL_CHANNELS && <strong className="font-semibold text-[var(--oppa-text)]">{activeFilterSummary}</strong>}
        </div>
      </div>
      </section>

      {loading ? <div aria-label="Loading sales report" aria-busy="true" className="mb-6 grid animate-pulse gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="admin-card admin-skeleton h-36" />)}</div> : <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="admin-card admin-card--brand relative overflow-hidden p-5 text-white sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between"><p className="text-sm font-medium text-white/80">Total sales</p><TrendingUp size={19} /></div>
          <p className="tabular-nums mt-4 text-3xl font-bold tracking-tight sm:text-4xl">{formatCurrency(metrics.totalSales)}</p>
          <p className="mt-1 text-xs text-white/75">Based on selected filters</p>
          <div className="mt-3 flex items-center gap-2"><span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold">Current selection</span><svg aria-label="Sales trend for selected period" role="img" viewBox="0 0 100 25" className="h-6 w-20 text-white/90"><polyline points={trendBuckets.map((bucket, index) => `${(index / (trendBuckets.length - 1 || 1)) * 100},${23 - (bucket.sales / highestTrendSales) * 20}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
        </div>
        <MetricCard icon={<BarChart3 size={18} />} label="Total orders" value={metrics.totalOrders} detail="All channels" />
        <MetricCard icon={<Globe2 size={18} />} label="Online orders" value={metrics.onlineOrders.length} detail={formatCurrency(metrics.onlineSales)} />
        <MetricCard icon={<Store size={18} />} label="Onsite orders" value={metrics.onsiteOrders.length} detail={formatCurrency(metrics.onsiteSales)} />
      </div>}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <GoalCard
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
        <TopProductCard channel="Online" products={topProductsByChannel.online} />
        <TopProductCard channel="Onsite" products={topProductsByChannel.onsite} />
      </div>

      <section className="admin-card mb-6">
        <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-5 py-4"><div><h2 className="font-serif font-semibold text-[var(--oppa-text)]">Channel performance</h2><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Revenue contribution for the selected filters.</p></div><BarChart3 size={19} className="text-[var(--oppa-green-dark)]" /></div>
        <div className="space-y-4 p-5">
          {(() => {
            const onlineShare = metrics.totalSales > 0 ? Math.round(metrics.onlineSales / metrics.totalSales * 100) : 0;
            const onsiteShare = Math.max(0, 100 - onlineShare);
            return <>
              <div role="img" aria-label={`Online ${onlineShare} percent, Onsite ${onsiteShare} percent`} className="flex h-5 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]">
                <div className="h-full rounded-l-full bg-[var(--oppa-green)] transition-[width] duration-500" style={{ width: `${onlineShare}%` }} />
                <div className="h-full rounded-r-full bg-amber-500 transition-[width] duration-500" style={{ width: `${onsiteShare}%` }} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 font-medium text-[var(--oppa-text)]"><span className="size-2.5 rounded-full bg-[var(--oppa-green)]" />Online</span><span className="tabular-nums text-right text-xs text-[var(--oppa-text-muted)]">{metrics.onlineOrders.length} orders · {formatCurrency(metrics.onlineSales)} · {onlineShare}%</span></div>
                <div className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 font-medium text-[var(--oppa-text)]"><span className="size-2.5 rounded-full bg-amber-500" />Onsite</span><span className="tabular-nums text-right text-xs text-[var(--oppa-text-muted)]">{metrics.onsiteOrders.length} orders · {formatCurrency(metrics.onsiteSales)} · {onsiteShare}%</span></div>
              </div>
            </>;
          })()}
        </div>
      </section>

      <section className="admin-card mb-6">
        <div className="flex flex-col gap-1 border-b border-[var(--oppa-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif font-semibold text-[var(--oppa-text)]">Sales timeline</h2>
            <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">
              {timelineRange === 'daily' ? 'Hourly activity from 11:00 AM to 11:00 PM.' : timelineRange === 'weekly' ? weekDateRange ? `Daily activity for ${formatDateRange(weekDateRange)}.` : 'Daily activity grouped by weekday.' : timelineRange === 'monthly' ? 'Daily activity grouped by calendar date.' : 'Monthly activity grouped from January to December.'}
            </p>
          </div>
          <div className="flex items-center gap-3"><span className="text-xs font-semibold text-[var(--oppa-green-dark)]">Peak: {formatCompactPeso(Math.max(...trendBuckets.map((bucket) => bucket.sales), 0))}</span><div className="flex rounded-lg border border-[var(--oppa-border)] p-0.5" aria-label="Timeline chart style">{(['line', 'bar'] as const).map((style) => <button key={style} type="button" aria-pressed={timelineStyle === style} onClick={() => setTimelineStyle(style)} className={`rounded-md px-2 py-1 text-[10px] font-semibold capitalize ${timelineStyle === style ? 'bg-[var(--oppa-green)] text-white' : 'text-[var(--oppa-text-muted)]'}`}>{style}</button>)}</div><span className="text-xs text-[var(--oppa-text-muted)]">{filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}</span></div>
        </div>
        <div className="w-full p-5">
          {trendBuckets.length ? <div className="w-full">
            {trendBuckets.some((bucket) => bucket.orders > 0) ? (() => {
              const width = Math.max(760, trendBuckets.length * 58);
              const left = 68;
              const right = width - 18;
              const top = 24;
              const bottom = 176;
              const xAt = (index: number) => left + (index * (right - left)) / Math.max(trendBuckets.length - 1, 1);
              const yAt = (sales: number) => bottom - (sales / highestTrendSales) * (bottom - top);
              const line = trendBuckets.map((bucket, index) => `${xAt(index)},${yAt(bucket.sales)}`).join(' ');
              const peak = Math.max(...trendBuckets.map((bucket) => bucket.sales));
              return <svg role="img" aria-label="Sales and order timeline" viewBox={`0 0 ${width} 230`} className="h-[250px] w-full">
                {[0, .25, .5, .75, 1].map((fraction) => {
                  const y = bottom - fraction * (bottom - top);
                  return <g key={fraction}><line x1={left} x2={right} y1={y} y2={y} stroke="var(--oppa-border)" strokeDasharray="4 5" /><text x={left - 8} y={y + 4} textAnchor="end" fill="var(--oppa-text-muted)" fontSize="10">{formatCompactPeso(highestTrendSales * fraction)}</text></g>;
                })}
                <line x1={left} x2={left} y1={top} y2={bottom} stroke="var(--oppa-border)" /><line x1={left} x2={right} y1={bottom} y2={bottom} stroke="var(--oppa-border)" />
                {timelineStyle === 'line' && <><polygon points={`${left},${bottom} ${line} ${right},${bottom}`} fill="rgba(38,122,67,.10)" /><polyline points={line} fill="none" stroke="#267a43" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /></>}
                {timelineStyle === 'bar' && trendBuckets.map((bucket, index) => {
                  const step = (right - left) / Math.max(trendBuckets.length, 1);
                  const barHeight = (bucket.sales / highestTrendSales) * (bottom - top);
                  return <rect key={`bar-${bucket.label}`} x={left + index * step + step * .2} y={bottom - barHeight} width={Math.max(2, step * .6)} height={barHeight} rx="4" fill="#267a43"><title>{`${bucket.label.replace('\n', ' ')} · ${formatCurrency(bucket.sales)} · ${bucket.orders} ${bucket.orders === 1 ? 'order' : 'orders'}`}</title></rect>;
                })}
                {trendBuckets.map((bucket, index) => <g key={bucket.label}>
                  {timelineStyle === 'line' && <circle cx={xAt(index)} cy={yAt(bucket.sales)} r={bucket.sales === peak && peak > 0 ? 5 : 3.5} fill={bucket.sales === peak && peak > 0 ? '#e0a800' : '#267a43'} stroke="var(--oppa-surface)" strokeWidth="2">
                    <title>{`${bucket.label.replace('\n', ' ')} · ${formatCurrency(bucket.sales)} · ${bucket.orders} ${bucket.orders === 1 ? 'order' : 'orders'}`}</title>
                  </circle>}
                  <text x={xAt(index)} y="199" textAnchor="middle" fill="var(--oppa-text-muted)" fontSize="10">{bucket.label.split('\n')[0]}</text>
                </g>)}
              </svg>;
            })() : <EmptyState title="No sales for these filters" description="The timeline will show revenue and order activity when sales are available." />}
          </div> : <EmptyState title="No timeline data" description="There is no activity to chart for this selection." />}
        </div>
      </section>

    </AdminLayout>
  );
};

const MetricCard = ({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) => <div className="admin-card p-5"><div className="flex items-center gap-2 text-[var(--oppa-green-dark)]">{icon}<span className="text-sm font-medium text-[var(--oppa-text-muted)]">{label}</span></div><p className="tabular-nums mt-5 text-3xl font-bold text-[var(--oppa-text)]">{value}</p><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{detail}</p></div>;

const formatCompactPeso = (amount: number) => formatCurrency(amount);

const FilterSelect = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) => (
  <label className="text-xs font-medium text-[var(--oppa-text-muted)]">
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 py-2 text-sm font-normal text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)]">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

interface GoalCardProps {
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
}

const GoalCard: React.FC<GoalCardProps> = ({
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
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const numericInput = Number(goalInput);
  const isInputValid = !isNaN(numericInput) && numericInput > 0;
  const isDirty = goalSet ? isInputValid && numericInput !== savedGoal : isInputValid;
  const progress = goalSet ? Math.min(Math.round((sales / savedGoal) * 100), 100) : 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!goalSet) {
        if (isInputValid) onSave();
      } else if (editing) {
        if (isInputValid && isDirty) onSave();
      }
    } else if (e.key === 'Escape' && editing) {
      onCancelEdit();
    }
  };

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        !goalSet
          ? 'admin-card'
          : goalReached
            ? 'border-green-200 bg-green-50'
            : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--oppa-text)]">Sales target</p>
          <p
            className={`mt-1 text-xs font-medium ${
              !goalSet
                ? 'text-[var(--oppa-text-muted)]'
                : goalReached
                  ? 'text-green-700'
                  : 'text-red-700'
            }`}
          >
            {!goalSet
              ? 'No target set'
              : goalReached
                ? 'Profit target reached'
                : 'Below profit target'}
          </p>
        </div>
        <TrendingUp
          size={19}
          className={
            !goalSet
              ? 'text-[var(--oppa-text-muted)]'
              : goalReached
                ? 'text-green-600'
                : 'text-red-600'
          }
        />
      </div>

      <div className="mt-4 flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text-muted)] focus-within:border-[var(--oppa-green)]">
          ₱<input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={goalSet && !editing ? savedGoal.toLocaleString('en-PH') : goalInput}
            onChange={(event) => onGoalChange(event.target.value.replace(/[^\d.]/g, ''))}
            onKeyDown={handleKeyDown}
            disabled={goalSet && !editing}
            placeholder="Set target"
            aria-label="Sales target in Philippine pesos"
            className="admin-embedded-input min-w-0 w-full px-1 py-2 text-sm text-[var(--oppa-text)] disabled:cursor-not-allowed"
          />
        </label>

        {!goalSet ? (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !isInputValid}
            className="rounded-lg bg-[var(--oppa-text)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        ) : !editing ? (
          <button
            type="button"
            onClick={onStartEdit}
            disabled={saving}
            className="rounded-lg bg-[var(--oppa-text)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Edit
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !isInputValid || !isDirty}
              className="rounded-lg bg-[var(--oppa-text)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Update'}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={saving}
              className="rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2.5 py-2 text-xs font-medium text-[var(--oppa-text-muted)] transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-[var(--oppa-text-muted)]">
          Sales: {formatCurrency(sales)} / Target: {formatCurrency(savedGoal)}
        </p>
        {goalSet && (
          <button
            type="button"
            onClick={onClear}
            disabled={saving}
            className="text-xs font-medium text-[var(--oppa-text-muted)] underline transition hover:text-[var(--oppa-text)] disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {goalSet && <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium text-[var(--oppa-text-muted)]">Target progress</span><span className="tabular-nums font-bold text-[var(--oppa-text)]">{Math.round((sales / savedGoal) * 100)}%</span></div>
        <div role="progressbar" aria-label="Sales target reached" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.round((sales / savedGoal) * 100), 100)} className="h-2.5 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]"><div className={`h-full rounded-full transition-[width] duration-700 ${goalReached ? 'bg-emerald-600' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} /></div>
        <p className="mt-1.5 text-right text-xs text-[var(--oppa-text-muted)]">Remaining <strong className="tabular-nums text-[var(--oppa-text)]">{formatCurrency(Math.max(savedGoal - sales, 0))}</strong></p>
      </div>}
      {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
};

const TopProductCard = ({ channel, products }: { channel: string; products: [string, number][] }) => {
  const max = Math.max(...products.map(([, quantity]) => quantity), 1);
  const ranks = ['bg-amber-300 text-amber-950', 'bg-slate-300 text-slate-900', 'bg-orange-300 text-orange-950'];
  return <div className="admin-card p-5">
    <p className="text-sm font-semibold text-[var(--oppa-text)]">Top 5 {channel} products</p>
    {products.length === 0 ? <EmptyState title="No product sales" description="No product sales in this filter." /> : <ol className="mt-4 space-y-3">{products.map(([name, quantity], index) => <li key={name} className="flex items-center gap-3">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ranks[index] || 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]'}`}>{index + 1}</span>
      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span title={name} className="min-w-0 truncate text-sm font-medium text-[var(--oppa-text)]">{name}</span><span className="tabular-nums shrink-0 text-xs font-semibold text-[var(--oppa-text-muted)]">{quantity} sold</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]"><div className="h-full rounded-full bg-[var(--oppa-green)] transition-[width] duration-500" style={{ width: `${(quantity / max) * 100}%` }} /></div></div>
    </li>)}</ol>}
  </div>;
};

export default AdminReportsPage;

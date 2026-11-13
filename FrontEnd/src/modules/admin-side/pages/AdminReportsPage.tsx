import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, FileText, Globe2, Loader2, Shield, Store } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllOrders, isRevenueOrder, type AdminOrder } from '../../../services/adminOrderService';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { getCurrentAdmin } from '../../../services/adminAuthService';
import { deleteTargetProfitSale, getTargetProfitSale, updateTargetProfitSale } from '../../../services/targetProfitSaleService';
import { formatCurrency, formatPeso } from '../../../utils/formatters';
import { formatInventoryQuantity } from '../../../utils/inventoryFormatters';
import { generateSalesReportPdf } from '../../../utils/reportPdfGenerator';
import { getInventoryReport } from '../../../services/mainBranchInventoryService';
import type { InventoryReport } from '../../../services/mainBranchInventoryService';
import { PageHeader, Toast } from '../components/AdminUI';
import Select from '../../../components/ui/Select';
import {
  MetricCard,
  ReportFilterCard,
  SalesChannelCard,
  SalesTargetCard,
  SalesTimelineCard,
  SalesTotalCard,
  TopProductCard,
} from '../../shared/components/SalesReportCards';

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
  const [quickRange, setQuickRange] = useState<QuickRange>('year');
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
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null);
  const [inventoryReportError, setInventoryReportError] = useState('');
  const [inventoryReportLoading, setInventoryReportLoading] = useState(true);

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

    getInventoryReport()
      .then((report) => {
        if (isMounted) setInventoryReport(report);
      })
      .catch((error: unknown) => {
        if (isMounted) setInventoryReportError(error instanceof Error ? error.message : 'Inventory reports could not be loaded.');
      })
      .finally(() => {
        if (isMounted) setInventoryReportLoading(false);
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

      <ReportFilterCard className="mb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" aria-label="Quick date ranges">
          {([
            ['today', 'Today'], ['7days', '7 days'], ['30days', '30 days'],
            ['month', 'This month'], ['year', 'This year'], ['custom', 'Custom'],
          ] as const).map(([range, label]) => <button key={range} type="button" aria-pressed={quickRange === range} onClick={() => applyQuickRange(range)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${quickRange === range ? 'border-[var(--oppa-green)] bg-[var(--oppa-green)] text-white' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text-muted)] hover:border-[var(--oppa-green)] hover:text-[var(--oppa-green-dark)]'}`}>{label}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearFilters} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]">Clear filters</button>
        </div>
      </div>
      {quickRange === 'custom' && <div className="mt-3 grid gap-3 border-t border-[var(--oppa-border)] pt-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
      </ReportFilterCard>

      {loading ? <div role="status" aria-label="Loading sales report" aria-busy="true" className="mb-6 min-h-36" /> : <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SalesTotalCard label="Total sales" amount={metrics.totalSales} trendBuckets={trendBuckets} />
        <MetricCard icon={<BarChart3 size={18} />} label="Total orders" value={metrics.totalOrders} detail="All channels" />
        <MetricCard icon={<Globe2 size={18} />} label="Online orders" value={metrics.onlineOrders.length} detail={formatCurrency(metrics.onlineSales)} />
        <MetricCard icon={<Store size={18} />} label="Onsite orders" value={metrics.onsiteOrders.length} detail={formatCurrency(metrics.onsiteSales)} />
      </div>}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SalesTargetCard
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
        <TopProductCard title="Top 5 Online products" products={topProductsByChannel.online} />
        <TopProductCard title="Top 5 Onsite products" products={topProductsByChannel.onsite} />
      </div>

      <div className="mb-6">
        <SalesChannelCard
          onlineOrders={metrics.onlineOrders.length}
          onlineSales={metrics.onlineSales}
          onsiteOrders={metrics.onsiteOrders.length}
          onsiteSales={metrics.onsiteSales}
        />
      </div>
      <div className="mb-6">
        <SalesTimelineCard
          buckets={trendBuckets}
          orderCount={filteredOrders.length}
          description={timelineRange === 'daily' ? 'Hourly activity from 11:00 AM to 11:00 PM.' : timelineRange === 'weekly' ? weekDateRange ? `Daily activity for ${formatDateRange(weekDateRange)}.` : 'Daily activity grouped by weekday.' : timelineRange === 'monthly' ? 'Daily activity grouped by calendar date.' : 'Monthly activity grouped from January to December.'}
          style={timelineStyle}
          onStyleChange={setTimelineStyle}
        />
      </div>

      <section aria-labelledby="inventory-reports-title" className="admin-card space-y-4 p-5">
        <div>
          <h2 id="inventory-reports-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">Ingredient and food-cost reports</h2>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Inventory usage, waste, count variance, and recipe-based food cost.</p>
        </div>
        {inventoryReportLoading ? <p role="status" className="py-5 text-sm text-[var(--oppa-text-muted)]">Loading inventory reports…</p>
          : inventoryReportError ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{inventoryReportError}</p>
            : inventoryReport ? <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard icon={<FileText size={18} />} label="Current inventory value" value={formatPeso(inventoryReport.inventory_value)} detail="Based on recorded stock value and legacy unit costs" />
                <MetricCard icon={<BarChart3 size={18} />} label="Ingredients used" value={inventoryReport.ingredient_usage.length} detail="Ingredients with recorded order usage" />
                <MetricCard icon={<Store size={18} />} label="Waste entries" value={inventoryReport.waste.length} detail="Ingredients with logged spoilage" />
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--oppa-text)]">Ingredient usage vs sales</h3>
                  {inventoryReport.ingredient_usage.length ? <div className="overflow-x-auto"><table className="admin-table w-full min-w-[380px] text-left text-sm"><thead><tr><th className="px-3 py-2">Ingredient</th><th className="px-3 py-2">Used</th></tr></thead><tbody className="divide-y divide-[var(--oppa-border)]">{inventoryReport.ingredient_usage.map((item) => <tr key={item.ingredient_name}><td className="px-3 py-2">{item.ingredient_name}</td><td className="px-3 py-2">{formatInventoryQuantity(item.quantity, item.unit)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--oppa-text-muted)]">No recipe-based ingredient usage recorded yet.</p>}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--oppa-text)]">Waste and spoilage</h3>
                  {inventoryReport.waste.length ? <div className="overflow-x-auto"><table className="admin-table w-full min-w-[380px] text-left text-sm"><thead><tr><th className="px-3 py-2">Ingredient</th><th className="px-3 py-2">Wasted</th></tr></thead><tbody className="divide-y divide-[var(--oppa-border)]">{inventoryReport.waste.map((item) => <tr key={item.ingredient_name}><td className="px-3 py-2">{item.ingredient_name}</td><td className="px-3 py-2">{formatInventoryQuantity(item.quantity, item.unit)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--oppa-text-muted)]">No waste has been logged.</p>}
                </div>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--oppa-text)]">Stock count variance</h3>
                  {inventoryReport.variance.length ? <div className="overflow-x-auto"><table className="admin-table w-full min-w-[420px] text-left text-sm"><thead><tr><th className="px-3 py-2">Ingredient</th><th className="px-3 py-2">Variance</th><th className="px-3 py-2">Reason</th></tr></thead><tbody className="divide-y divide-[var(--oppa-border)]">{inventoryReport.variance.map((item, index) => <tr key={`${item.ingredient_name}-${item.occurred_at}-${index}`}><td className="px-3 py-2">{item.ingredient_name}</td><td className="px-3 py-2">{Number(item.variance) > 0 ? '+' : ''}{formatInventoryQuantity(item.variance, item.unit)}</td><td className="px-3 py-2">{item.reason || '—'}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[var(--oppa-text-muted)]">No stock count variances recorded.</p>}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-[var(--oppa-text)]">Food cost % per product</h3>
                  <div className="overflow-x-auto"><table className="admin-table w-full min-w-[420px] text-left text-sm"><thead><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2">Sales</th><th className="px-3 py-2">Cost / portion</th><th className="px-3 py-2">Food cost</th></tr></thead><tbody className="divide-y divide-[var(--oppa-border)]">{inventoryReport.food_cost_by_product.map((item) => <tr key={item.product_id}><td className="px-3 py-2">{item.product_name}</td><td className="px-3 py-2">{formatCurrency(item.sales)}</td><td className="px-3 py-2">{formatPeso(item.ingredient_cost_per_portion)}</td><td className="px-3 py-2">{item.food_cost_percent === null ? '—' : `${item.food_cost_percent}%`}</td></tr>)}</tbody></table></div>
                </div>
              </div>
            </> : null}
      </section>

    </AdminLayout>
  );
};

const FilterSelect = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) => (
  <Select label={label} value={value} onChange={onChange} options={options} />
);

export default AdminReportsPage;

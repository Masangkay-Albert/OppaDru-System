import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Globe2, RefreshCw, Store, TrendingUp } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getAllOrders, type AdminOrder } from '../../../services/adminOrderService';
import { deleteTargetProfitSale, getTargetProfitSale, updateTargetProfitSale } from '../../../services/targetProfitSaleService';
import { formatCurrency } from '../../../utils/formatters';

type ReportRange = 'daily' | 'weekly' | 'monthly' | 'yearly';

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

const csvCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

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
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({ year: ALL_YEARS, month: ALL_FILTER, week: ALL_FILTER, day: ALL_FILTER, date: '', channel: ALL_CHANNELS });
  const [goal, setGoal] = useState(0);
  const [goalBeforeEdit, setGoalBeforeEdit] = useState(0);
  const [goalDirty, setGoalDirty] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const allOrders = await getAllOrders();
      setOrders(Array.isArray(allOrders) ? allOrders : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    getTargetProfitSale()
      .then((savedGoal) => {
        setGoal(savedGoal);
        setGoalBeforeEdit(savedGoal);
        setGoalDirty(false);
        setEditingGoal(false);
      })
      .catch(() => setGoalError('Sales target could not be loaded.'));
  }, []);

  const filteredOrders = useMemo(
    () => orders.filter((order) => isWithinRange(order, filters)),
    [orders, filters]
  );

  const timelineRange: ReportRange = filters.date !== '' || filters.day !== ALL_FILTER
    ? 'daily'
    : filters.week !== ALL_FILTER
      ? 'weekly'
      : filters.month !== ALL_FILTER
        ? 'monthly'
        : 'yearly';

  const years = useMemo(() => [...new Set(orders.map((order) => getOrderDate(order)?.getFullYear()).filter(Boolean))].sort((a, b) => Number(b) - Number(a)), [orders]);

  const metrics = useMemo(() => {
    const onlineOrders = filteredOrders.filter((order) => order.channel === 'online');
    const onsiteOrders = filteredOrders.filter((order) => order.channel === 'onsite');
    return {
      totalSales: filteredOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      totalOrders: filteredOrders.length,
      onlineOrders,
      onsiteOrders,
      onlineSales: onlineOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      onsiteSales: onsiteOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    };
  }, [filteredOrders]);

  const topProductsByChannel = useMemo(() => {
    const getTop = (channel: 'online' | 'onsite') => {
      const products = new Map<string, number>();
      filteredOrders.filter((order) => order.channel === channel).forEach((order) => {
        order.items?.forEach((item: any) => {
          const name = item.product_name || item.name || 'Unnamed item';
          products.set(name, (products.get(name) || 0) + Number(item.quantity || 0));
        });
      });
      return [...products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    };
    return { online: getTop('online'), onsite: getTop('onsite') };
  }, [filteredOrders]);

  const trendBuckets = useMemo(() => getTrendBuckets(filteredOrders, timelineRange, filters), [filteredOrders, timelineRange, filters]);
  const weekDateRange = getWeekDateRange(filters);
  const weekOptions = Array.from({ length: getWeekCount(filters) }, (_, index) => {
    const week = index + 1;
    const range = getWeekDateRange({ ...filters, week: String(week) });
    return { value: String(week), label: range ? `Week ${week} (${formatDateRange(range).replace(`, ${filters.year}`, '')})` : `Week ${week}` };
  });
  const highestTrendSales = Math.max(...trendBuckets.map((bucket) => bucket.sales), 1);
  const goalReached = goal > 0 && metrics.totalSales >= goal;
  const goalSet = goal > 0;

  const updateFilter = (key: keyof ReportFilters, value: string) => setFilters((current) => {
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

  const clearFilters = () => setFilters({ year: ALL_YEARS, month: ALL_FILTER, week: ALL_FILTER, day: ALL_FILTER, date: '', channel: ALL_CHANNELS });

  const activeFilterSummary = [
    filters.date ? new Date(`${filters.date}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : filters.year !== ALL_YEARS ? filters.year : 'All years',
    !filters.date && filters.month !== ALL_FILTER ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(filters.month)] : null,
    !filters.date && filters.week !== ALL_FILTER ? `Week ${filters.week}` : null,
    !filters.date && filters.day !== ALL_FILTER ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(filters.day)] : null,
    filters.channel === ALL_CHANNELS ? 'All channels' : filters.channel === 'online' ? 'Online' : 'Onsite',
  ].filter(Boolean).join(' · ');

  const saveGoal = async () => {
    setGoalSaving(true);
    setGoalError('');
    try {
      setGoal(await updateTargetProfitSale(goal));
      setGoalBeforeEdit(goal);
      setGoalDirty(false);
      setEditingGoal(false);
    } catch {
      setGoalError('Sales target could not be saved.');
    } finally {
      setGoalSaving(false);
    }
  };

  const clearGoal = async () => {
    setGoalSaving(true);
    setGoalError('');
    try {
      await deleteTargetProfitSale();
      setGoal(0);
      setGoalBeforeEdit(0);
      setGoalDirty(false);
      setEditingGoal(false);
    } catch {
      setGoalError('Sales target could not be removed.');
    } finally {
      setGoalSaving(false);
    }
  };

  const handleGoalAction = () => {
    if (goalSet && !editingGoal) {
      setGoalBeforeEdit(goal);
      setGoalDirty(false);
      setEditingGoal(true);
      return;
    }
    if (editingGoal && goalDirty) void saveGoal();
  };

  const handleGoalChange = (value: number) => {
    setGoal(value);
    setGoalDirty(value !== goalBeforeEdit);
  };

  const handleGoalBlur = () => {
    if (editingGoal && !goalDirty) void saveGoal();
  };

  const handleExportCSV = () => {
    const rows = [
      ['Order ID', 'Customer', 'Channel', 'Total', 'Status', 'Date'],
      ...filteredOrders.map((order) => [
        order.order_number || order.id,
        order.customerName || order.email || 'Customer',
        order.channel,
        Number(order.total || 0).toFixed(2),
        String(order.status || 'pending'),
        getOrderDate(order)?.toLocaleString() || 'N/A',
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-report-${timelineRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold leading-tight text-[var(--oppa-text)]">Sales report</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">A clear view of revenue and order performance across every channel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadOrders} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] disabled:opacity-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleExportCSV} disabled={loading} className="bg-oppa-gradient inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="mb-3 grid gap-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FilterSelect label="Year" value={filters.year} onChange={(value) => updateFilter('year', value)} options={[{ value: ALL_YEARS, label: 'All years' }, ...years.map((year) => ({ value: String(year), label: String(year) }))]} />
        <FilterSelect label="Month" value={filters.month} onChange={(value) => updateFilter('month', value)} options={[{ value: ALL_FILTER, label: 'All months' }, ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((label, index) => ({ value: String(index), label }))]} />
        <FilterSelect label="Week of month" value={filters.week} onChange={(value) => updateFilter('week', value)} options={[{ value: ALL_FILTER, label: 'All weeks' }, ...weekOptions]} />
        <FilterSelect label="Day of week" value={filters.day} onChange={(value) => updateFilter('day', value)} options={[{ value: ALL_FILTER, label: 'All days' }, ...['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((label, index) => ({ value: String(index), label }))]} />
        <label className="text-xs font-medium text-[var(--oppa-text-muted)]">Exact date<input type="date" min={`${MIN_REPORT_YEAR}-01-01`} value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm font-normal text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)]" /></label>
        <FilterSelect label="Channel" value={filters.channel} onChange={(value) => updateFilter('channel', value)} options={[{ value: ALL_CHANNELS, label: 'All channels' }, { value: 'online', label: 'Online' }, { value: 'onsite', label: 'Onsite' }]} />
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[var(--oppa-text-muted)]"><span>Showing: <strong className="font-semibold text-[var(--oppa-text)]">{activeFilterSummary}</strong></span><button onClick={clearFilters} className="font-semibold text-[var(--oppa-green-dark)] underline hover:text-[var(--oppa-text)]">Clear filters</button></div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-[var(--oppa-green)] p-5 text-white shadow-sm sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between"><p className="text-sm text-white/75">Total sales</p><TrendingUp size={19} /></div>
          <p className="mt-5 text-3xl font-bold">{formatCurrency(metrics.totalSales)}</p>
          <p className="mt-1 text-xs text-white/70">Based on selected filters</p>
        </div>
        <MetricCard icon={<BarChart3 size={18} />} label="Total orders" value={metrics.totalOrders} detail="All channels" />
        <MetricCard icon={<Globe2 size={18} />} label="Online orders" value={metrics.onlineOrders.length} detail={formatCurrency(metrics.onlineSales)} />
        <MetricCard icon={<Store size={18} />} label="Onsite orders" value={metrics.onsiteOrders.length} detail={formatCurrency(metrics.onsiteSales)} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <GoalCard goal={goal} sales={metrics.totalSales} goalReached={goalReached} goalSet={goalSet} editing={editingGoal} dirty={goalDirty} saving={goalSaving} error={goalError} onGoalChange={handleGoalChange} onBlur={handleGoalBlur} onAction={handleGoalAction} onClear={clearGoal} />
        <TopProductCard channel="Online" products={topProductsByChannel.online} />
        <TopProductCard channel="Onsite" products={topProductsByChannel.onsite} />
      </div>

      <section className="mb-6 rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-5 py-4"><div><h2 className="font-serif font-semibold text-[var(--oppa-text)]">Channel performance</h2><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Revenue contribution for the selected filters.</p></div><BarChart3 size={19} className="text-[var(--oppa-green-dark)]" /></div>
        <div className="space-y-5 p-5">
          {(filters.channel === ALL_CHANNELS || filters.channel === 'online') && <ChannelRow label="Online" count={metrics.onlineOrders.length} sales={metrics.onlineSales} total={metrics.totalSales} color="bg-[var(--oppa-green)]" />}
          {(filters.channel === ALL_CHANNELS || filters.channel === 'onsite') && <ChannelRow label="Onsite" count={metrics.onsiteOrders.length} sales={metrics.onsiteSales} total={metrics.totalSales} color="bg-amber-400" />}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-[var(--oppa-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-serif font-semibold text-[var(--oppa-text)]">Sales timeline</h2>
            <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">
              {timelineRange === 'daily' ? 'Hourly activity from 11:00 AM to 11:00 PM.' : timelineRange === 'weekly' ? weekDateRange ? `Daily activity for ${formatDateRange(weekDateRange)}.` : 'Daily activity grouped by weekday.' : timelineRange === 'monthly' ? 'Daily activity grouped by calendar date.' : 'Monthly activity grouped from January to December.'}
            </p>
          </div>
          <span className="text-xs text-[var(--oppa-text-muted)]">{filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}</span>
        </div>
        <div className="overflow-x-auto p-5">
          {trendBuckets.some((bucket) => bucket.orders > 0) ? <div className="flex min-w-[620px] items-end gap-2" style={{ height: 190 }}>
            {trendBuckets.map((bucket) => (
              <div key={bucket.label} className="group flex min-w-[22px] flex-1 flex-col items-center justify-end gap-2">
                <div className="invisible rounded-md bg-[var(--oppa-text)] px-2 py-1 text-center text-[10px] text-white opacity-0 transition group-hover:visible group-hover:opacity-100">
                  {formatCurrency(bucket.sales)}<br />{bucket.orders} {bucket.orders === 1 ? 'order' : 'orders'}
                </div>
                <div className="w-full rounded-t-md bg-[var(--oppa-green)] transition-all group-hover:bg-[var(--oppa-green-dark)]" style={{ height: `${Math.max(bucket.sales > 0 ? (bucket.sales / highestTrendSales) * 125 : 3, 3)}px` }} />
                <span className="whitespace-pre-line text-center text-[10px] text-[var(--oppa-text-muted)]">{bucket.label}</span>
              </div>
            ))}
          </div> : <div className="flex h-[190px] items-center justify-center text-sm text-[var(--oppa-text-muted)]">No sales found for these filters.</div>}
        </div>
      </section>

    </AdminLayout>
  );
};

const MetricCard = ({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: number; detail: string }) => <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-[var(--oppa-green-dark)]">{icon}<span className="text-sm font-medium text-[var(--oppa-text-muted)]">{label}</span></div><p className="mt-5 text-3xl font-bold text-[var(--oppa-text)]">{value}</p><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{detail}</p></div>;

const ChannelRow = ({ label, count, sales, total, color }: { label: string; count: number; sales: number; total: number; color: string }) => {
  const percentage = total > 0 ? Math.round((sales / total) * 100) : 0;
  return <div><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium text-[var(--oppa-text)]">{label}</span><span className="text-[var(--oppa-text-muted)]">{count} orders · {formatCurrency(sales)}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--oppa-green-soft)]"><div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} /></div><p className="mt-1 text-right text-xs text-[var(--oppa-text-muted)]">{percentage}% of sales</p></div>;
};

const FilterSelect = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) => (
  <label className="text-xs font-medium text-[var(--oppa-text-muted)]">
    {label}
    <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm font-normal text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)]">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </label>
);

const GoalCard = ({ goal, sales, goalReached, goalSet, editing, dirty, saving, error, onGoalChange, onBlur, onAction, onClear }: { goal: number; sales: number; goalReached: boolean; goalSet: boolean; editing: boolean; dirty: boolean; saving: boolean; error: string; onGoalChange: (value: number) => void; onBlur: () => void; onAction: () => void; onClear: () => void }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${!goalSet ? 'border-[var(--oppa-border)] bg-white' : goalReached ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[var(--oppa-text)]">Sales target</p><p className={`mt-1 text-xs font-medium ${!goalSet ? 'text-[var(--oppa-text-muted)]' : goalReached ? 'text-green-700' : 'text-red-700'}`}>{!goalSet ? 'No target set' : goalReached ? 'Profit target reached' : 'Below profit target'}</p></div><TrendingUp size={19} className={!goalSet ? 'text-[var(--oppa-text-muted)]' : goalReached ? 'text-green-600' : 'text-red-600'} /></div>
      <div className="mt-4 flex gap-2"><input ref={inputRef} type="number" min="0" value={goal || ''} onChange={(event) => onGoalChange(Number(event.target.value))} onBlur={onBlur} disabled={goalSet && !editing} placeholder="Set target" className="min-w-0 flex-1 rounded-lg border border-white bg-white px-3 py-2 text-sm text-[var(--oppa-text)] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" /><button onClick={onAction} disabled={saving || (editing && !dirty)} className="rounded-lg bg-[var(--oppa-text)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? 'Saving' : goalSet ? editing ? dirty ? 'Update' : 'No changes' : 'Edit' : 'Save'}</button></div>
      <div className="mt-3 flex items-center justify-between"><p className="text-xs text-[var(--oppa-text-muted)]">Sales: {formatCurrency(sales)} / Target: {formatCurrency(goal)}</p>{goalSet && <button onClick={onClear} disabled={saving} className="text-xs font-medium text-[var(--oppa-text-muted)] underline hover:text-[var(--oppa-text)] disabled:opacity-50">Remove</button>}</div>
      {error && <p className="mt-2 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
};

const TopProductCard = ({ channel, products }: { channel: string; products: [string, number][] }) => (
  <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
    <p className="text-sm font-semibold text-[var(--oppa-text)]">Top 5 {channel} products</p>
    {products.length === 0 ? <p className="mt-5 text-sm text-[var(--oppa-text-muted)]">No product sales in this filter.</p> : <div className="mt-4 space-y-3">{products.map(([name, quantity], index) => <div key={name} className="flex items-center gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-xs font-bold text-[var(--oppa-green-dark)]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--oppa-text)]">{name}</span><span className="shrink-0 text-xs font-semibold text-[var(--oppa-text-muted)]">{quantity} sold</span></div>)}</div>}
  </div>
);

export default AdminReportsPage;

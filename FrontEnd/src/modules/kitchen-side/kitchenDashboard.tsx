import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StaffBranchBadge from '../shared/components/StaffBranchBadge';
import {
  CalendarClock, CheckCircle, ChefHat, Eye, Flame,
} from 'lucide-react';
import { sortOrders } from '../../utils/dashboardOrders';
import { OrderDateTime, StatusBadge } from '../shared/components/DashboardPrimitives';
import {
  EmployeeDashboardEmptyState,
  EmployeeDashboardHeader,
  EmployeeDashboardSort,
  EmployeeDashboardTabs,
} from '../shared/components/EmployeeDashboardUI';
import { API_URL } from '../../services/apiConfig';
import KitchenLayout from './components/kitchenLayout';
import OrderDetailsModal from './components/OrderDetailsModal';
import type { KitchenOrder, KitchenSort, KitchenTab, ScheduledDateFilter } from './kitchenOrderTypes';
import { formatKitchenManilaDateTime, getKitchenScheduleState } from './kitchenSchedule';
import Select from '../../components/ui/Select';

const chipBase = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition whitespace-nowrap';
const chipPrimary = `${chipBase} bg-[var(--oppa-green)] text-white shadow-sm hover:bg-[#245f37] disabled:cursor-not-allowed disabled:opacity-50`;
const chipSuccess = `${chipBase} bg-[var(--oppa-green)] text-white shadow-sm hover:bg-[#245f37]`;
const chipDisabled = `${chipBase} bg-[var(--oppa-green-soft)] text-[var(--oppa-text-muted)]`;
const tabs: KitchenTab[] = ['pending', 'scheduled', 'preparing', 'history'];
const tabLabels: Record<KitchenTab, string> = {
  pending: 'New Orders',
  scheduled: 'Scheduled',
  preparing: 'Currently Preparing',
  history: 'History',
};

const manilaDate = (timestamp: number) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date(timestamp));

const shiftDate = (date: string, days: number) => {
  const [year, month, day] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
};

const KitchenDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<KitchenTab>('pending');
  const [sortOrder, setSortOrder] = useState<KitchenSort>('desc');
  const [staffName, setStaffName] = useState('Kitchen Staff');
  const [branchName, setBranchName] = useState('Main system');
  const [branchId, setBranchId] = useState<string | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [scheduledDateFilter, setScheduledDateFilter] = useState<ScheduledDateFilter>('all');
  const [customDate, setCustomDate] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [promotionNotice, setPromotionNotice] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const ordersFetchInFlightRef = useRef(false);
  const activeTabRef = useRef<KitchenTab>('pending');
  const mutationVersionRef = useRef(0);
  const knownPromotedOrdersRef = useRef<Set<string> | null>(null);
  const promotionNoticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const authData = sessionStorage.getItem('employee_auth');
    const token = sessionStorage.getItem('employee_token');
    if (!token || !authData) {
      navigate('/staff/login', { replace: true });
      return;
    }
    let employee: { fullName?: string; name?: string; franchise_id?: string | null; franchise?: { id?: string; name?: string } | null };
    try {
      employee = JSON.parse(authData);
    } catch {
      navigate('/staff/login', { replace: true });
      return;
    }
    const timer = window.setTimeout(() => {
      setStaffName(employee.fullName || employee.name || 'Kitchen Staff');
      setBranchName(employee.franchise?.name || 'Main system');
      setBranchId(employee.franchise?.id || employee.franchise_id || null);
      document.title = `${employee.franchise?.name || 'Main system'} | Kitchen Dashboard | Oppa Dru`;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (ordersFetchInFlightRef.current) return;
    ordersFetchInFlightRef.current = true;
    const requestedTab = activeTab;
    const requestedMutationVersion = mutationVersionRef.current;
    if (showLoading) setLoading(true);
    try {
      const token = sessionStorage.getItem('employee_token');
      const headers = { Authorization: `Bearer ${token || ''}`, Accept: 'application/json' };
      const [response, countsResponse] = await Promise.all([
        fetch(`${API_URL}/kitchen/orders?tab=${requestedTab}`, { headers }),
        fetch(`${API_URL}/kitchen/orders/counts`, { headers }),
      ]);
      if (!response.ok || !countsResponse.ok) {
        throw new Error('Failed to fetch kitchen orders or scheduled order counts.');
      }
      const [data, counts] = await Promise.all([response.json(), countsResponse.json()]);
      if (requestedTab !== activeTabRef.current || requestedMutationVersion !== mutationVersionRef.current) return;

      setOrders((current) => JSON.stringify(current) === JSON.stringify(data) ? current : data);
      setScheduledCount(Number(counts.scheduled_count || 0));
      setNewCount(Number(counts.new_count || 0));
      const promotedOrders = counts.promoted_orders as KitchenOrder[];
      const promotedIds = new Set(promotedOrders.filter((order) => order.isScheduled).map((order) => order.id));
      if (knownPromotedOrdersRef.current) {
        const newlyPromotedIds = [...promotedIds].filter((id) => !knownPromotedOrdersRef.current?.has(id));
        if (newlyPromotedIds.length > 0) {
          const promotedOrder = promotedOrders.find((order) => order.id === newlyPromotedIds[0]);
          setPromotionNotice(`Scheduled order ${promotedOrder?.order_number || newlyPromotedIds[0]} is ready to prepare.`);
          if (promotionNoticeTimerRef.current) window.clearTimeout(promotionNoticeTimerRef.current);
          promotionNoticeTimerRef.current = window.setTimeout(() => setPromotionNotice(null), 7000);
          try {
            const audio = new AudioContext();
            const oscillator = audio.createOscillator();
            const gain = audio.createGain();
            oscillator.frequency.value = 880;
            gain.gain.value = 0.08;
            oscillator.connect(gain);
            gain.connect(audio.destination);
            oscillator.start();
            oscillator.stop(audio.currentTime + 0.18);
            oscillator.onended = () => void audio.close();
          } catch (error) {
            console.info('Kitchen alert sound is unavailable; visual alert remains active.', error);
          }
        }
      }
      knownPromotedOrdersRef.current = promotedIds;
    } catch (error) {
      console.error('Error fetching kitchen orders:', error);
    } finally {
      ordersFetchInFlightRef.current = false;
      if (showLoading && requestedTab === activeTabRef.current) setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    const initialFetch = window.setTimeout(() => void fetchOrders(), 0);
    const interval = window.setInterval(() => void fetchOrders(false), 5000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(interval);
    };
  }, [activeTab, fetchOrders]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(timer);
      if (promotionNoticeTimerRef.current) window.clearTimeout(promotionNoticeTimerRef.current);
    };
  }, []);

  const updateOrderStatus = async (
    orderId: string,
    status: string,
    nextTab: KitchenTab | null,
    startEarly = false,
  ) => {
    setBusyOrderId(orderId);
    try {
      const token = sessionStorage.getItem('employee_token');
      const response = await fetch(`${API_URL}/kitchen/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status, start_early: startEarly }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.message || 'Failed to update order status.');
      }
      mutationVersionRef.current += 1;
      setOrders((current) => current.filter((order) => order.id !== orderId));
      if (nextTab) setActiveTab(nextTab);
      setSelectedOrder(null);
      if (!nextTab || nextTab === activeTab) await fetchOrders(false);
    } catch (error) {
      console.error('Error updating kitchen order:', error);
      window.alert(error instanceof Error ? error.message : 'Failed to update order status.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const rescheduleOrder = async (order: KitchenOrder, scheduledFor: string) => {
    setBusyOrderId(order.id);
    try {
      const token = sessionStorage.getItem('employee_token');
      const response = await fetch(`${API_URL}/kitchen/orders/${order.id}/schedule`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ scheduled_for: scheduledFor }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(failure.message || failure.errors?.scheduled_for?.[0] || 'Failed to reschedule order.');
      }
      const result = await response.json();
      const rescheduledOrder = result.order as KitchenOrder;
      mutationVersionRef.current += 1;
      setOrders((current) => {
        if (rescheduledOrder.prepStartTime && new Date(rescheduledOrder.prepStartTime).getTime() <= Date.now()) {
          return current.filter((currentOrder) => currentOrder.id !== order.id);
        }
        return current.map((currentOrder) => currentOrder.id === order.id ? rescheduledOrder : currentOrder);
      });
      setSelectedOrder(null);
      await fetchOrders(false);
    } catch (error) {
      console.error('Error rescheduling kitchen order:', error);
      window.alert(error instanceof Error ? error.message : 'Failed to reschedule order.');
    } finally {
      setBusyOrderId(null);
    }
  };

  const isAutoPriority = (order: KitchenOrder) => Boolean(
    order.isScheduled && order.scheduledFor
    && new Date(order.scheduledFor).getTime() - now <= 15 * 60_000
    && new Date(order.scheduledFor).getTime() >= now,
  );
  const isLate = (order: KitchenOrder) => Boolean(
    order.isScheduled && order.scheduledFor
    && new Date(order.scheduledFor).getTime() < now
    && order.status === 'pending',
  );
  const isPriority = (order: KitchenOrder) => order.deliveryType === 'priority' || isAutoPriority(order);
  const today = manilaDate(now);
  const weekdayNumber = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short' }).format(new Date(now))
  ];
  const weekStart = shiftDate(today, -((weekdayNumber + 6) % 7));
  const weekEnd = shiftDate(weekStart, 7);
  const matchesScheduledDate = (order: KitchenOrder) => {
    if (!order.scheduledFor || scheduledDateFilter === 'all') return true;
    const date = manilaDate(new Date(order.scheduledFor).getTime());
    if (scheduledDateFilter === 'today') return date === today;
    if (scheduledDateFilter === 'tomorrow') return date === shiftDate(today, 1);
    if (scheduledDateFilter === 'week') return date >= weekStart && date < weekEnd;
    return !customDate || date === customDate;
  };
  const visibleOrders = activeTab === 'scheduled' ? orders.filter(matchesScheduledDate) : orders;
  const sortedOrders = sortOrder === 'due'
    ? [...visibleOrders].sort((left, right) => {
      const priorityDifference = Number(isPriority(right)) - Number(isPriority(left));
      if (priorityDifference) return priorityDifference;
      return new Date(left.scheduledFor || left.created_at).getTime()
        - new Date(right.scheduledFor || right.created_at).getTime();
    })
    : sortOrders(visibleOrders, sortOrder);
  const priorityOrders = sortedOrders.filter(isPriority);
  const otherOrders = sortedOrders.filter((order) => !isPriority(order));
  const orderGroups = [
    { key: 'priority', label: 'Priority orders', count: priorityOrders.length, orders: priorityOrders },
    { key: 'other', label: 'Other orders', count: otherOrders.length, orders: otherOrders },
  ].filter((group) => group.orders.length > 0);
  const renderBadges = (order: KitchenOrder) => (
    <div className="mt-1 flex flex-wrap gap-1">
      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${order.channel === 'onsite' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
        {order.channel === 'onsite' ? 'Onsite' : 'Online'}
      </span>
      {order.isScheduled && <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-900"><CalendarClock size={11} /> Scheduled</span>}
      {order.rescheduledFrom && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Rescheduled</span>}
      {isPriority(order) && <span className="inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold text-white"><Flame size={11} /> PRIORITY</span>}
      {isLate(order) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">LATE</span>}
    </div>
  );

  return (
    <KitchenLayout>
      <EmployeeDashboardHeader
        title="Kitchen Dashboard"
        name={staffName}
        context={<StaffBranchBadge name={branchName} id={branchId} />}
      />

      {promotionNotice && (
        <div role="status" aria-live="assertive" className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 font-semibold text-emerald-950 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          <span className="grid size-9 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-900/60"><ChefHat size={18} /></span>
          <span className="flex-1">{promotionNotice}</span>
          <button type="button" onClick={() => setPromotionNotice(null)} aria-label="Dismiss order alert" className="rounded-lg p-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/60">×</button>
        </div>
      )}

      <div className="relative z-20 mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <EmployeeDashboardTabs<KitchenTab>
          tabs={tabs.map((tab) => ({
            id: tab,
            label: tabLabels[tab],
            count: tab === 'scheduled' ? scheduledCount : tab === 'pending' ? newCount : undefined,
          }))}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        <div className="admin-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {activeTab === 'scheduled' && (
            <>
              <Select aria-label="Filter scheduled orders by date" value={scheduledDateFilter} onChange={(value) => setScheduledDateFilter(value as ScheduledDateFilter)} options={[{ value: 'all', label: 'All dates' }, { value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'week', label: 'This Week' }, { value: 'custom', label: 'Custom' }]} className="shrink-0" />
              {scheduledDateFilter === 'custom' && <input aria-label="Choose scheduled date" type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} className="h-10 shrink-0 rounded-full border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2" />}
            </>
          )}
          <EmployeeDashboardSort<KitchenSort>
            value={sortOrder}
            onChange={setSortOrder}
            ariaLabel="Sort orders"
            options={[{ value: 'desc', label: 'Latest First' }, { value: 'asc', label: 'Oldest First' }, { value: 'due', label: 'Due Soonest' }]}
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading orders...</div>
      ) : sortedOrders.length === 0 ? (
        <EmployeeDashboardEmptyState
          title={activeTab === 'pending' ? 'No new orders to prepare.' : activeTab === 'scheduled' ? 'No scheduled orders for this date.' : activeTab === 'preparing' ? 'You are not preparing any orders right now.' : 'No completed orders yet.'}
          description="Orders and schedule changes update automatically."
        />
      ) : (
        <>
          <div className="space-y-5 md:hidden">
            {orderGroups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <div className={`mb-2 flex items-center gap-2 border-b pb-2 ${group.key === 'priority' ? 'border-orange-300 text-orange-900 dark:border-orange-900 dark:text-orange-200' : 'border-[var(--oppa-border)] text-[var(--oppa-text-muted)]'}`}>
                  {group.key === 'priority' ? <Flame size={15} /> : <span className="size-2 rounded-full bg-gray-300" />}
                  <h2 className="text-xs font-bold uppercase tracking-[0.14em]">{group.label}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${group.key === 'priority' ? 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text-muted)]'}`}>{group.count}</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]">
            {group.orders.map((order) => {
              const scheduleState = order.isScheduled && order.prepStartTime && order.scheduledFor
                ? getKitchenScheduleState(order.prepStartTime, order.scheduledFor, now) : null;
              const mayStart = !order.isScheduled || !order.prepStartTime || new Date(order.prepStartTime).getTime() <= now;
              return (
                <article key={order.id} className={`rounded-2xl border p-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md ${group.key === 'priority' ? 'border-orange-200 border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-[var(--oppa-surface)] dark:border-orange-900 dark:from-orange-950/50' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <StatusBadge status={order.status} />
                      <p className="mt-2 font-mono text-xs text-[var(--oppa-text-muted)]">{order.order_number || order.id}</p>
                      {(order.branch_name || order.branchName) && <p className="mt-1 truncate text-xs font-medium text-[var(--oppa-green)]">{order.branch_name || order.branchName}</p>}
                      <p className="font-medium text-[var(--oppa-text)]">{order.customerName}</p>
                      {renderBadges(order)}
                    </div>
                    <button type="button" onClick={() => setSelectedOrder(order)} aria-label={`Details for ${order.order_number || order.id}`} className="rounded-lg border border-[var(--oppa-border)] p-2 text-[var(--oppa-text-muted)] transition-all duration-200 ease-out hover:bg-[var(--oppa-green-soft)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2"><Eye size={16} /></button>
                  </div>
                  <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">{order.isScheduled && order.scheduledFor ? `Due ${formatKitchenManilaDateTime(order.scheduledFor, { year: undefined })}` : <OrderDateTime date={order.created_at} />}</p>
                  {scheduleState && <p className="mt-1 text-xs font-semibold text-violet-900">{scheduleState.label} · {scheduleState.detail}</p>}
                  <div className="mt-3 border-t border-[var(--oppa-border)] pt-2">
                    {activeTab === 'pending' && <button type="button" disabled={!mayStart || busyOrderId === order.id} onClick={() => void updateOrderStatus(order.id, 'preparing', 'preparing')} className={`${chipPrimary} w-full`}><ChefHat size={14} /> Start Preparing</button>}
                    {activeTab === 'preparing' && <button type="button" onClick={() => void updateOrderStatus(order.id, 'prepared', 'history')} className={`${chipSuccess} w-full`}><CheckCircle size={14} /> Done Preparing</button>}
                    {activeTab === 'history' && <span className={`${chipDisabled} w-full`}><CheckCircle size={14} /> {order.status === 'delivered' ? 'Delivered' : order.status === 'cancelled' ? 'Cancelled' : 'Ready'}</span>}
                  </div>
                </article>
              );
            })}
                </div>
              </section>
            ))}
          </div>

          <div className="hidden overflow-x-auto overflow-y-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-sm md:block">
            <table className="w-full min-w-[1000px] text-sm">
              <thead><tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                <th className="px-4 py-3">Order ID</th><th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">{activeTab === 'scheduled' ? 'Scheduled For' : 'Date Ordered'}</th>
                <th className="px-4 py-3">Items</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody>{orderGroups.map((group) => (
                <React.Fragment key={group.key}>
                  <tr className={group.key === 'priority' ? 'bg-orange-50 dark:bg-orange-950/30' : 'bg-[var(--oppa-cream)]'}>
                    <td colSpan={6} className={`border-b px-4 py-2 ${group.key === 'priority' ? 'border-orange-200' : 'border-[var(--oppa-border)]'}`}>
                      <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] ${group.key === 'priority' ? 'text-orange-900' : 'text-[var(--oppa-text-muted)]'}`}>
                        {group.key === 'priority' ? <Flame size={13} /> : <span className="size-2 rounded-full bg-gray-300" />}
                        {group.label}
                        <span className={`rounded-full px-2 py-0.5 ${group.key === 'priority' ? 'bg-orange-200/70 text-orange-950 dark:bg-orange-950 dark:text-orange-200' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text-muted)]'}`}>{group.count}</span>
                      </div>
                    </td>
                  </tr>
              {group.orders.map((order) => {
                const scheduleState = order.isScheduled && order.prepStartTime && order.scheduledFor
                  ? getKitchenScheduleState(order.prepStartTime, order.scheduledFor, now) : null;
                const mayStart = !order.isScheduled || !order.prepStartTime || new Date(order.prepStartTime).getTime() <= now;
                return (
                  <tr key={order.id} className={`border-b border-[var(--oppa-border)]/60 transition-colors duration-200 ease-out last:border-0 hover:bg-[var(--oppa-green-soft)]/50 ${group.key === 'priority' ? 'bg-orange-50/30 dark:bg-orange-950/20' : ''}`}>
                    <td className="px-4 py-3 align-middle"><span className="font-mono text-xs">{order.order_number || order.id}</span>{(order.branch_name || order.branchName) && <span className="mt-1 block truncate text-xs font-medium text-[var(--oppa-green)]">{order.branch_name || order.branchName}</span>}{renderBadges(order)}</td>
                    <td className="px-4 py-3 font-medium">{order.customerName || 'Customer'}</td>
                    <td className="px-4 py-3 text-[var(--oppa-text-muted)]">
                      {order.isScheduled && order.scheduledFor ? <><strong className="block text-[var(--oppa-text)]">{formatKitchenManilaDateTime(order.scheduledFor)}</strong>{scheduleState && <span className="text-xs">{scheduleState.detail}</span>}</> : <OrderDateTime date={order.created_at} />}
                    </td>
                    <td className="px-4 py-3">{order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'items'}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setSelectedOrder(order)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-xs font-semibold text-[var(--oppa-text)] transition-all duration-200 ease-out hover:bg-[var(--oppa-green-soft)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2"><Eye size={14} /> Details</button>
                      {activeTab === 'pending' && <button type="button" disabled={!mayStart || busyOrderId === order.id} onClick={() => void updateOrderStatus(order.id, 'preparing', 'preparing')} className={chipPrimary}><ChefHat size={14} /> Start</button>}
                      {activeTab === 'preparing' && <button type="button" onClick={() => void updateOrderStatus(order.id, 'prepared', 'history')} className={chipSuccess}><CheckCircle size={14} /> Done</button>}
                    </div></td>
                  </tr>
                );
              })}
                </React.Fragment>
              ))}</tbody>
            </table>
          </div>
        </>
      )}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          busy={busyOrderId === selectedOrder.id}
          onClose={() => setSelectedOrder(null)}
          onStart={(order, startEarly = false) => void updateOrderStatus(order.id, 'preparing', 'preparing', startEarly)}
          onComplete={(order) => void updateOrderStatus(order.id, 'prepared', 'history')}
          onReschedule={(order, scheduledFor) => void rescheduleOrder(order, scheduledFor)}
          onCancel={(order) => void updateOrderStatus(order.id, 'cancelled', null)}
        />
      )}
    </KitchenLayout>
  );
};

export default KitchenDashboardPage;

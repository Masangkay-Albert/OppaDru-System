import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownUp, CalendarClock, CheckCircle, ChefHat, ChevronDown, ClipboardList, Eye, Flame,
} from 'lucide-react';
import { sortOrders } from '../../utils/dashboardOrders';
import { OrderDateTime, StatusBadge, UserChip } from '../shared/components/DashboardPrimitives';
import { API_URL } from '../../services/apiConfig';
import KitchenLayout from './components/kitchenLayout';
import OrderDetailsModal from './components/OrderDetailsModal';
import type { KitchenOrder, KitchenSort, KitchenTab, ScheduledDateFilter } from './kitchenOrderTypes';
import { formatKitchenManilaDateTime, getKitchenScheduleState } from './kitchenSchedule';

const chipBase = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition whitespace-nowrap';
const chipPrimary = `${chipBase} bg-[var(--oppa-green)] text-white shadow-sm hover:bg-[#245f37] disabled:cursor-not-allowed disabled:opacity-50`;
const chipSuccess = `${chipBase} bg-[var(--oppa-green)] text-white shadow-sm hover:bg-[#245f37]`;
const chipDisabled = `${chipBase} bg-gray-100 text-gray-500`;
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
    const authData = localStorage.getItem('employee_auth');
    const token = localStorage.getItem('employee_token');
    if (!token || !authData) {
      navigate('/staff/login', { replace: true });
      return;
    }
    let employee: { fullName?: string; name?: string };
    try {
      employee = JSON.parse(authData);
    } catch {
      navigate('/staff/login', { replace: true });
      return;
    }
    const timer = window.setTimeout(() => setStaffName(employee.fullName || employee.name || 'Kitchen Staff'), 0);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (ordersFetchInFlightRef.current) return;
    ordersFetchInFlightRef.current = true;
    const requestedTab = activeTab;
    const requestedMutationVersion = mutationVersionRef.current;
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem('employee_token');
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
      const token = localStorage.getItem('employee_token');
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
      const token = localStorage.getItem('employee_token');
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
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-[var(--oppa-text)] sm:text-4xl">Kitchen Dashboard</h1>
        </div>
        <UserChip name={staffName} />
      </div>

      {promotionNotice && (
        <div role="status" aria-live="assertive" className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 font-semibold text-emerald-950 shadow-sm">
          <span className="grid size-9 place-items-center rounded-full bg-emerald-100"><ChefHat size={18} /></span>
          <span className="flex-1">{promotionNotice}</span>
          <button type="button" onClick={() => setPromotionNotice(null)} aria-label="Dismiss order alert" className="rounded-lg p-2 hover:bg-emerald-100">×</button>
        </div>
      )}

      <div className="relative z-20 mb-4 flex min-h-10 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex min-h-10 flex-wrap gap-1 rounded-2xl border border-[var(--oppa-border)] bg-white/70 p-1 shadow-sm">
          {tabs.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] ${activeTab === tab ? 'bg-[var(--oppa-green)] text-white shadow-sm' : 'text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)]'}`}>
              {tabLabels[tab]}
              {tab === 'scheduled' && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${activeTab === tab ? 'bg-white/20' : 'bg-violet-100 text-violet-900'}`}>{scheduledCount}</span>}
              {tab === 'pending' && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${activeTab === tab ? 'bg-white/20' : 'bg-emerald-100 text-emerald-900'}`}>{newCount}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'scheduled' && (
            <>
              <select aria-label="Filter scheduled orders by date" value={scheduledDateFilter}
                onChange={(event) => setScheduledDateFilter(event.target.value as ScheduledDateFilter)}
                className="h-10 rounded-xl border border-[var(--oppa-border)] bg-white px-3 text-sm font-medium">
                <option value="all">All dates</option><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="week">This Week</option><option value="custom">Custom</option>
              </select>
              {scheduledDateFilter === 'custom' && <input aria-label="Choose scheduled date" type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} className="h-10 rounded-xl border border-[var(--oppa-border)] bg-white px-3 text-sm" />}
            </>
          )}
          <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-white px-3 text-sm text-[var(--oppa-text-muted)] shadow-sm">
            <ArrowDownUp size={16} className="text-[var(--oppa-green)]" /><span className="font-medium">Sort:</span>
            <span className="relative inline-flex items-center">
              <select aria-label="Sort orders" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as KitchenSort)}
                className="appearance-none bg-transparent py-1 pr-5 font-semibold text-[var(--oppa-text)] outline-none">
                <option value="desc">Latest First</option><option value="asc">Oldest First</option><option value="due">Due Soonest</option>
              </select><ChevronDown size={14} className="pointer-events-none absolute right-0" />
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading orders...</div>
      ) : sortedOrders.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-10 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <ClipboardList className="mx-auto mb-3 text-[var(--oppa-green)]/60" size={30} />
          <p className="font-medium text-[var(--oppa-text)]">
            {activeTab === 'pending' ? 'No new orders to prepare.' : activeTab === 'scheduled' ? 'No scheduled orders for this date.' : activeTab === 'preparing' ? 'You are not preparing any orders right now.' : 'No completed orders yet.'}
          </p>
          <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">Orders and schedule changes update automatically.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 md:hidden">
            {sortedOrders.map((order) => {
              const scheduleState = order.isScheduled && order.prepStartTime && order.scheduledFor
                ? getKitchenScheduleState(order.prepStartTime, order.scheduledFor, now) : null;
              const mayStart = !order.isScheduled || !order.prepStartTime || new Date(order.prepStartTime).getTime() <= now;
              return (
                <article key={order.id} className={`rounded-2xl border border-[var(--oppa-border)] p-3 shadow-sm ${isPriority(order) ? 'border-l-4 border-l-orange-500 bg-orange-50/60' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <StatusBadge status={order.status} />
                      <p className="mt-2 font-mono text-xs text-gray-700">{order.order_number || order.id}</p>
                      <p className="font-medium text-[var(--oppa-text)]">{order.customerName}</p>
                      {renderBadges(order)}
                    </div>
                    <button type="button" onClick={() => setSelectedOrder(order)} aria-label={`Details for ${order.order_number || order.id}`} className="rounded-lg border p-2 text-gray-600 hover:bg-gray-50"><Eye size={16} /></button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{order.isScheduled && order.scheduledFor ? `Due ${formatKitchenManilaDateTime(order.scheduledFor, { year: undefined })}` : <OrderDateTime date={order.created_at} />}</p>
                  {scheduleState && <p className="mt-1 text-xs font-semibold text-violet-900">{scheduleState.label} · {scheduleState.detail}</p>}
                  <div className="mt-3 border-t border-gray-100 pt-2">
                    {activeTab === 'pending' && <button type="button" disabled={!mayStart || busyOrderId === order.id} onClick={() => void updateOrderStatus(order.id, 'preparing', 'preparing')} className={`${chipPrimary} w-full`}><ChefHat size={14} /> Start Preparing</button>}
                    {activeTab === 'preparing' && <button type="button" onClick={() => void updateOrderStatus(order.id, 'prepared', 'history')} className={`${chipSuccess} w-full`}><CheckCircle size={14} /> Done Preparing</button>}
                    {activeTab === 'history' && <span className={`${chipDisabled} w-full`}><CheckCircle size={14} /> {order.status === 'delivered' ? 'Delivered' : order.status === 'cancelled' ? 'Cancelled' : 'Ready'}</span>}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
            <table className="w-full min-w-[1000px] text-sm">
              <thead><tr className="border-b bg-[#eaf3eb] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                <th className="px-4 py-3">Order ID</th><th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">{activeTab === 'scheduled' ? 'Scheduled For' : 'Date Ordered'}</th>
                <th className="px-4 py-3">Items</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
              </tr></thead>
              <tbody>{sortedOrders.map((order) => {
                const scheduleState = order.isScheduled && order.prepStartTime && order.scheduledFor
                  ? getKitchenScheduleState(order.prepStartTime, order.scheduledFor, now) : null;
                const mayStart = !order.isScheduled || !order.prepStartTime || new Date(order.prepStartTime).getTime() <= now;
                return (
                  <tr key={order.id} className={`border-b border-gray-100 last:border-0 hover:bg-emerald-50/60 ${isPriority(order) ? 'bg-orange-50/50' : ''}`}>
                    <td className="px-4 py-3 align-middle"><span className="font-mono text-xs">{order.order_number || order.id}</span>{renderBadges(order)}</td>
                    <td className="px-4 py-3 font-medium">{order.customerName || 'Customer'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.isScheduled && order.scheduledFor ? <><strong className="block text-gray-800">{formatKitchenManilaDateTime(order.scheduledFor)}</strong>{scheduleState && <span className="text-xs">{scheduleState.detail}</span>}</> : <OrderDateTime date={order.created_at} />}
                    </td>
                    <td className="px-4 py-3">{order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'items'}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setSelectedOrder(order)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-xs font-semibold hover:bg-gray-50"><Eye size={14} /> Details</button>
                      {activeTab === 'pending' && <button type="button" disabled={!mayStart || busyOrderId === order.id} onClick={() => void updateOrderStatus(order.id, 'preparing', 'preparing')} className={chipPrimary}><ChefHat size={14} /> Start</button>}
                      {activeTab === 'preparing' && <button type="button" onClick={() => void updateOrderStatus(order.id, 'prepared', 'history')} className={chipSuccess}><CheckCircle size={14} /> Done</button>}
                    </div></td>
                  </tr>
                );
              })}</tbody>
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

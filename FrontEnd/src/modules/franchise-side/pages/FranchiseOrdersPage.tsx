import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, ClipboardList, Copy, Eye, Globe2, ShoppingBag, Store, X } from 'lucide-react';
import type { SelectOption } from '../../../components/ui/Select';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { formatCurrency } from '../../../utils/formatters';
import { AdminDate, PageHeader, StatusBadge } from '../../admin-side/components/AdminUI';
import OrdersFilterBar from '../../shared/components/OrdersFilterBar';
import { getThirdPartyPlatformLabel, getThirdPartyReferencePrefix, type ThirdPartyPlatform } from '../../../constants/thirdPartyPlatforms';
import ReplacementRequestsPanel from '../../shared/components/ReplacementRequestsPanel';
import ReplaceOnsiteItemAction from '../../shared/components/ReplaceOnsiteItemAction';

interface OrderItem {
  id?: string;
  selected_addons?: Array<{ id?: string; name?: string; price?: number | string; quantity?: number }>;
  product_name?: string;
  name?: string;
  quantity?: number;
  product_price?: number | string;
  price?: number | string;
}

interface BranchOrder {
  id: string;
  order_number: string;
  total: number | string;
  status: string;
  payment_method: string;
  payment_status?: string | null;
  delivery_type?: string | null;
  third_party_platform?: ThirdPartyPlatform | null;
  replacement_of_order_id?: string | null;
  original_order_number?: string | null;
  external_order_ref?: string | null;
  delivery_address?: string | null;
  phone?: string | null;
  email?: string;
  customer_name?: string;
  user?: { full_name?: string; email?: string };
  created_at: string;
  delivery_proof_image?: string | null;
  delivery_proof_uploaded_at?: string | null;
  delivery_confirmed_at?: string | null;
  scheduled_at?: string | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  schedule_display?: string | null;
  items?: OrderItem[];
  order_items?: OrderItem[];
  orderItems?: OrderItem[];
}

type StatusFilter = 'all' | 'pending' | 'preparing' | 'prepared' | 'on_the_way' | 'delivered' | 'cancelled';
type ChannelFilter = 'all' | 'online' | 'onsite' | ThirdPartyPlatform;

const STATUS_OPTIONS: Array<{ label: string; value: StatusFilter; dot: string }> = [
  { label: 'All', value: 'all', dot: '' },
  { label: 'Pending', value: 'pending', dot: 'pending' },
  { label: 'Preparing', value: 'preparing', dot: 'preparing' },
  { label: 'Prepared', value: 'prepared', dot: 'prepared' },
  { label: 'On the way', value: 'on_the_way', dot: 'on_the_way' },
  { label: 'Delivered', value: 'delivered', dot: 'delivered' },
  { label: 'Cancelled', value: 'cancelled', dot: 'cancelled' },
];

const getChannel = (order: BranchOrder): Exclude<ChannelFilter, 'all'> =>
  order.delivery_type?.toLowerCase() === 'onsite' ? 'onsite' : 'online';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

const getCustomerName = (order: BranchOrder) =>
  order.user?.full_name || order.customer_name || order.email || order.user?.email || 'Walk-in customer';

const getOrderItems = (order: BranchOrder) => order.items || order.order_items || order.orderItems || [];

const getItemsSummary = (order: BranchOrder) => {
  const items = getOrderItems(order);
  if (!items.length) return 'No items';
  const first = `${items[0].quantity || 1}x ${items[0].product_name || items[0].name || 'Item'}`;
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
};

const FranchiseOrdersPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellationNotice, setCancellationNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<BranchOrder | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeOrdersTab, setActiveOrdersTab] = useState<'orders' | 'replacements'>('orders');
  const [replacementWaitingCount, setReplacementWaitingCount] = useState(0);
  const replacementFetcher = useCallback((url: string, init?: RequestInit) => fetchWithFranchiseAuth(url, init), []);
  const orderDetailsPanelRef = useRef<HTMLElement>(null);
  const previousOrderStatuses = useRef(new Map<string, string>());
  const branchName = franchiseUser?.branch?.name || franchiseUser?.franchise?.name || 'Current branch';

  const selectedOrderId = selectedOrder?.id;
  useEffect(() => {
    if (selectedOrderId) orderDetailsPanelRef.current?.scrollTo({ top: 0 });
  }, [selectedOrderId]);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/orders`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch orders.');
      setError('');
      const nextOrders = Array.isArray(payload.data) ? payload.data as BranchOrder[] : [];
      const newlyCancelledOrders = nextOrders.filter((order) => {
        const previousStatus = previousOrderStatuses.current.get(order.id);
        return previousStatus !== undefined
          && previousStatus !== 'cancelled'
          && String(order.status).toLowerCase() === 'cancelled';
      });
      if (newlyCancelledOrders.length === 1) {
        setCancellationNotice(`Order ${newlyCancelledOrders[0].order_number || newlyCancelledOrders[0].id} was cancelled by the customer.`);
      } else if (newlyCancelledOrders.length > 1) {
        setCancellationNotice(`${newlyCancelledOrders.length} orders were cancelled by customers.`);
      }
      previousOrderStatuses.current = new Map(
        nextOrders.map((order) => [order.id, String(order.status || '').toLowerCase()]),
      );
      setOrders(nextOrders);
      setSelectedOrder((current) => {
        const updated = current && nextOrders.find((order) => order.id === current.id);
        return updated ? { ...current, ...updated } : current;
      });
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.name === 'TimeoutError'
        ? 'Loading orders took too long. Please retry.'
        : loadError instanceof Error ? loadError.message : 'Could not load branch orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReplacementWaitingCount = useCallback(async () => {
    try {
      const response = await replacementFetcher(`${API_URL}/franchise/replacement-requests?status=pending`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load replacement request count.');
      setReplacementWaitingCount(Number(payload.waiting_count || 0));
    } catch (countError) {
      console.error('Could not load replacement request count:', countError);
    }
  }, [replacementFetcher]);

  useEffect(() => { void Promise.resolve().then(loadOrders); }, [loadOrders, reload]);
  useEffect(() => {
    const refresh = () => { void loadReplacementWaitingCount(); };
    const initialLoad = window.setTimeout(refresh, 0);
    window.addEventListener('focus', refresh);
    window.addEventListener('replacement-requests-updated', refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('replacement-requests-updated', refresh);
    };
  }, [loadReplacementWaitingCount]);
  useEffect(() => {
    const interval = window.setInterval(() => { void loadOrders(); }, 15000);
    return () => window.clearInterval(interval);
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (query && !`${order.order_number || ''} ${order.id} ${getCustomerName(order)} ${order.email || ''} ${order.external_order_ref || ''}`.toLowerCase().includes(query)) return false;
      if (channel !== 'all' && (channel === 'online' || channel === 'onsite'
        ? getChannel(order) !== channel
        : order.third_party_platform !== channel)) return false;
      if (status !== 'all' && order.status.toLowerCase() !== status) return false;
      if (date && !order.created_at?.startsWith(date)) return false;
      return true;
    });
  }, [orders, search, status, channel, date]);
  const replacementOrderIds = useMemo(
    () => new Set(orders.map((order) => order.replacement_of_order_id).filter((orderId): orderId is string => Boolean(orderId))),
    [orders],
  );

  const statusCount = (filter: StatusFilter) =>
    orders.filter((order) => filter === 'all' || order.status.toLowerCase() === filter).length;
  const statusOptions: SelectOption<StatusFilter>[] = STATUS_OPTIONS.map(({ label, value, dot }) => ({
    label,
    value,
    icon: dot ? <span aria-hidden="true" className={`admin-order-status-dot admin-order-status-dot--${dot}`} /> : undefined,
    badge: <span className="admin-orders-option-count">{statusCount(value)}</span>,
  }));
  const hasScheduledOrder = (order: BranchOrder) => (
    order.status.toLowerCase() === 'scheduled'
    ||
    order.delivery_type?.toLowerCase() === 'scheduled'
    || !!order.scheduled_at
    || !!order.scheduled_date
    || !!order.scheduled_time
    || !!order.schedule_display
  );

  const viewOrder = async (order: BranchOrder) => {
    setSelectedOrder(order);
    setDetailLoading(true);
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/orders/${encodeURIComponent(order.id)}`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load order details.');
      setSelectedOrder(payload.data as BranchOrder);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : 'Could not load order details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setChannel('all');
    setDate('');
  };
  const hasFilters = search !== '' || status !== 'all' || channel !== 'all' || date !== '';
  const detailItems = selectedOrder ? getOrderItems(selectedOrder) : [];
  const copyOrderId = (orderId: string) => {
    if (!navigator.clipboard) {
      setError('Copying order IDs is not supported by this browser.');
      return;
    }
    void navigator.clipboard.writeText(orderId)
      .then(() => setCopiedOrderId(orderId))
      .catch((copyError: unknown) => {
        console.error('Failed to copy order ID:', copyError);
        setError('Could not copy order ID.');
      });
  };
  const copyExternalOrderRef = (reference: string, platformLabel: string) => {
    if (!navigator.clipboard) {
      setError('Copying platform order numbers is not supported by this browser.');
      return;
    }
    void navigator.clipboard.writeText(reference)
      .then(() => setCopiedOrderId(reference))
      .catch((copyError: unknown) => {
        console.error('Failed to copy platform order number:', copyError);
        setError(`Could not copy the ${platformLabel} order number.`);
      });
  };
  const isScheduledOrder = selectedOrder && (
    selectedOrder.status.toLowerCase() === 'scheduled'
    || selectedOrder.delivery_type?.toLowerCase() === 'scheduled'
    || !!selectedOrder.scheduled_at
    || !!selectedOrder.scheduled_date
    || !!selectedOrder.scheduled_time
    || !!selectedOrder.schedule_display
  );
  const scheduledDisplay = selectedOrder?.schedule_display
    || [selectedOrder?.scheduled_date, selectedOrder?.scheduled_time].filter(Boolean).join(' at ')
    || selectedOrder?.scheduled_at;

  return (
    <main className="admin-orders-page min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader title="Orders" subtitle="Track this branch’s online and onsite orders. Statuses update as authorized kitchen and delivery roles process each order." />
        <div role="tablist" aria-label="Orders sections" className="mb-4 flex w-fit max-w-full gap-1 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-1">
          <button type="button" role="tab" aria-selected={activeOrdersTab === 'orders'} onClick={() => setActiveOrdersTab('orders')} className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${activeOrdersTab === 'orders' ? 'bg-[var(--oppa-green)] text-white' : 'text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]'}`}>All orders</button>
          <button type="button" role="tab" aria-selected={activeOrdersTab === 'replacements'} onClick={() => setActiveOrdersTab('replacements')} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${activeOrdersTab === 'replacements' ? 'bg-[var(--oppa-green)] text-white' : 'text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]'}`}>
            Replacements
            {replacementWaitingCount > 0 && <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold ${activeOrdersTab === 'replacements' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'}`}>{replacementWaitingCount > 99 ? '99+' : replacementWaitingCount}</span>}
          </button>
        </div>

        {activeOrdersTab === 'replacements' ? <ReplacementRequestsPanel
          endpoint={`${API_URL}/franchise/replacement-requests`}
          fetcher={replacementFetcher}
          onHandled={() => { setReload((value) => value + 1); void loadReplacementWaitingCount(); }}
          onOpenOrder={(orderId) => {
            setActiveOrdersTab('orders');
            const order = orders.find((item) => item.id === orderId);
            if (order) void viewOrder(order);
            else setError('Could not find that order in this branch.');
          }}
        /> : <>
        {cancellationNotice && <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span>{cancellationNotice}</span><button type="button" aria-label="Dismiss cancellation notice" onClick={() => setCancellationNotice('')} className="rounded-lg p-1 text-red-700 transition hover:bg-red-100"><X size={16} /></button></div>}
        {error && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} className="font-semibold underline">Retry</button></div>}
        <section className="admin-orders-controls">
        <OrdersFilterBar
          search={search}
          onSearchChange={setSearch}
          channel={channel}
          onChannelChange={setChannel}
          date={date}
          onDateChange={(value) => setDate(value <= TODAY ? value : TODAY)}
          dateMax={TODAY}
          onClear={hasFilters ? clearFilters : undefined}
          status={status}
          statusOptions={statusOptions}
          onStatusChange={(value) => setStatus(value as StatusFilter)}
          statusCount={statusCount(status)}
        />
        <p className="px-1 text-xs text-[var(--oppa-text-muted)]">
          Showing <strong className="font-semibold text-[var(--oppa-text)]">{filteredOrders.length}</strong> of <strong className="font-semibold text-[var(--oppa-text)]">{orders.length}</strong> orders
        </p>
        </section>

        {loading ? (
          <div aria-label="Loading orders" aria-busy="true" className="admin-card space-y-3 p-5">{[0, 1, 2, 3].map((row) => <div key={row} className="h-14 animate-pulse rounded-xl bg-[var(--oppa-green-soft)]" />)}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-card p-10 text-center">
            <ClipboardList size={28} aria-hidden="true" className="mx-auto mb-2 text-[var(--oppa-green)]" />
            <p className="font-semibold text-[var(--oppa-text)]">No orders found</p>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{hasFilters ? 'Try changing or clearing your filters.' : 'New orders for this branch will appear here.'}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="mt-3 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">Clear filters</button>}
          </div>
        ) : (
          <div className="admin-orders-table-shell">
            <div className="admin-orders-table-scroll">
              <table className="admin-table franchise-orders-table w-full min-w-[1100px] text-left text-sm">
                <thead><tr className="admin-orders-table-head border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">
                  <th className="w-[12%] px-3 py-3 font-semibold">Order ID</th>
                  <th className="w-[16%] px-3 py-3 font-semibold">Customer</th>
                  <th className="w-[8%] px-3 py-3 font-semibold">Channel</th>
                  <th className="w-[12%] px-3 py-3 font-semibold">Branch</th>
                  <th className="w-[16%] px-3 py-3 font-semibold">Items</th>
                  <th className="w-[8%] px-3 py-3 text-right font-semibold">Total</th>
                  <th className="w-[10%] px-3 py-3 font-semibold">Status</th>
                  <th className="w-[9%] px-3 py-3 font-semibold">Date</th>
                  <th className="w-[9%] min-w-[96px] px-2 py-3 text-right font-semibold">View</th>
                </tr></thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const orderId = String(order.order_number || order.id);
                    const customerName = getCustomerName(order);
                    const orderChannel = getChannel(order);
                    const platformLabel = getThirdPartyPlatformLabel(order.third_party_platform);
                    const referencePrefix = getThirdPartyReferencePrefix(order.third_party_platform);
                    return <tr key={order.id} className="group border-b border-[var(--oppa-border)]/60 last:border-0 transition hover:bg-[var(--oppa-cream)]/50">
                      <td className="min-w-0 px-3 py-3 font-mono text-xs font-semibold text-[var(--oppa-text)]"><span className="block truncate" title={orderId}>{orderId}</span>{order.replacement_of_order_id && <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 font-sans text-xs font-bold text-emerald-900">REPLACEMENT</span>}{replacementOrderIds.has(order.id) && <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 font-sans text-xs font-semibold text-blue-900">Replacement sent</span>}{platformLabel && order.external_order_ref && <span className="block max-w-36 truncate text-[10px] font-medium text-[var(--oppa-text-muted)]" title={`${referencePrefix}: ${order.external_order_ref}`}>{referencePrefix}: {order.external_order_ref}</span>}</td>
                      <td className="px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">{customerName.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?'}</span><div className="min-w-0"><span className="block truncate font-medium text-[var(--oppa-text)]">{customerName}</span><span className="block truncate text-xs text-[var(--oppa-text-muted)]">{order.email || order.user?.email || ' '}</span></div></div></td>
                      <td className="px-3 py-3"><span className={`franchise-channel-badge ${orderChannel === 'onsite' ? 'franchise-channel-badge--onsite' : 'franchise-channel-badge--online'}`}>{platformLabel ? <><ShoppingBag size={12} aria-hidden="true" />{platformLabel}</> : <>{orderChannel === 'onsite' ? <Store size={12} aria-hidden="true" /> : <Globe2 size={12} aria-hidden="true" />}{orderChannel === 'onsite' ? 'Onsite' : 'Online'}</>}</span></td>
                      <td className="truncate px-3 py-3 text-[var(--oppa-text)]" title={branchName}>{branchName}</td>
                      <td className="truncate px-3 py-3 text-xs text-[var(--oppa-text-muted)]" title={getOrderItems(order).map((item) => `${item.quantity || 1}x ${item.product_name || item.name || 'Item'}`).join(', ')}>{getItemsSummary(order)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[var(--oppa-text)]">{formatCurrency(order.total)}</td>
                      <td className="px-3 py-3"><div className="flex flex-col items-start gap-1.5"><StatusBadge status={order.status} />{hasScheduledOrder(order) && <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-1 text-[10px] font-semibold text-orange-800">Scheduled</span>}</div></td>
                      <td className="px-3 py-2.5 text-xs text-[var(--oppa-text-muted)]"><AdminDate value={order.created_at} /></td>
                      <td className="px-2 py-3 text-right"><button type="button" onClick={() => void viewOrder(order)} aria-label={`View order ${orderId}`} title="View order" className="inline-flex size-9 items-center justify-center rounded-xl border border-[var(--oppa-border)] text-[var(--oppa-text-muted)] transition hover:border-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-green-dark)]"><Eye size={16} aria-hidden="true" /></button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>}
      </div>

      {selectedOrder && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end overflow-hidden bg-black/50" role="presentation" onClick={() => setSelectedOrder(null)}>
          <section
            ref={orderDetailsPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Order details"
            onKeyDown={(event) => { if (event.key === 'Escape') setSelectedOrder(null); }}
            onClick={(event) => event.stopPropagation()}
            className="flex h-dvh w-full max-w-[450px] flex-col overflow-hidden border-l border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] shadow-2xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--oppa-border)] px-5 py-3" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
              <div className="min-w-0">
                <h2 className="font-serif text-lg font-bold">Order Details</h2>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate font-mono text-[10px] text-[var(--oppa-text-muted)]">{selectedOrder.order_number || selectedOrder.id}</span>
                  <button
                    type="button"
                    onClick={() => copyOrderId(String(selectedOrder.order_number || selectedOrder.id))}
                    aria-label="Copy order ID"
                    title={copiedOrderId === String(selectedOrder.order_number || selectedOrder.id) ? 'Copied' : 'Copy order ID'}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--oppa-text-muted)] transition hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
                  >
                    <Copy size={13} aria-hidden="true" />
                  </button>
                  <StatusBadge status={selectedOrder.status} />
                  {selectedOrder.replacement_of_order_id && <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900">REPLACEMENT · Original {selectedOrder.original_order_number || selectedOrder.replacement_of_order_id}</span>}
                </div>
              </div>
              <button type="button" aria-label="Close order details" onClick={() => setSelectedOrder(null)} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--oppa-text-muted)] transition hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">
                <X size={18} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              {detailLoading ? <p className="py-10 text-center text-sm text-[var(--oppa-text-muted)]">Loading order details...</p> : <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
                  <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Customer</p><p className="mt-1 font-medium">{getCustomerName(selectedOrder)}</p>{(selectedOrder.email || selectedOrder.user?.email) && <p className="break-all text-xs text-[var(--oppa-text-muted)]">{selectedOrder.email || selectedOrder.user?.email}</p>}</div>
                  <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">{getThirdPartyPlatformLabel(selectedOrder.third_party_platform) ? 'Source' : 'Channel'}</p><p className="mt-1 font-medium">{getThirdPartyPlatformLabel(selectedOrder.third_party_platform) || getChannel(selectedOrder)}</p></div>
                  <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Payment Method</p><p className="mt-1 font-medium">{selectedOrder.replacement_of_order_id ? 'Replacement (no charge)' : getThirdPartyPlatformLabel(selectedOrder.third_party_platform) ? `Paid via ${getThirdPartyPlatformLabel(selectedOrder.third_party_platform)}` : selectedOrder.payment_method?.replaceAll('_', ' ') || '—'}</p></div>
                  {selectedOrder.third_party_platform && selectedOrder.external_order_ref && <div className="col-span-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Platform order number</p><div className="mt-1 flex min-w-0 items-center gap-2"><span className="truncate font-mono font-semibold" title={selectedOrder.external_order_ref}>{selectedOrder.external_order_ref}</span><button type="button" onClick={() => copyExternalOrderRef(selectedOrder.external_order_ref || '', getThirdPartyPlatformLabel(selectedOrder.third_party_platform) || 'Platform')} aria-label="Copy platform order number" title={copiedOrderId === selectedOrder.external_order_ref ? 'Copied' : 'Copy platform order number'} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--oppa-text-muted)] transition hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"><Copy size={14} aria-hidden="true" /></button></div></div>}
                  <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Status</p><div className="mt-1"><StatusBadge status={selectedOrder.status} /></div></div>
                  <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Delivery</p><p className="mt-1 font-medium capitalize">{(selectedOrder.delivery_type || 'standard').replaceAll('_', ' ')}</p></div>
                </div>

                {isScheduledOrder && <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">Scheduled Delivery</p>
                  <p className="mt-1 text-sm font-semibold">{scheduledDisplay || 'Schedule details unavailable'}</p>
                </div>}

                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Order Date</p><div className="mt-1 text-sm font-medium"><AdminDate value={selectedOrder.created_at} /></div></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Delivery Address</p><p className="mt-1 break-words text-sm font-medium">{selectedOrder.delivery_address || 'Onsite / Walk-in'}</p></div>

                {selectedOrder.status === 'delivered' && <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={15} aria-hidden="true" /> Delivered</div>
                  <p className="mt-1 text-xs text-green-700">This order has been marked delivered by the assigned driver.</p>
                </div>}

                {(selectedOrder.delivery_proof_image || selectedOrder.status === 'delivered') && <div className="rounded-2xl border border-[var(--oppa-border)] p-3">
                  <p className="mb-2 text-xs font-semibold">Delivery Proof</p>
                  {selectedOrder.delivery_proof_image ? <a href={selectedOrder.delivery_proof_image} target="_blank" rel="noreferrer" className="inline-block">
                    <img src={selectedOrder.delivery_proof_image} alt="Driver delivery proof" className="max-h-60 max-w-full rounded-xl border border-[var(--oppa-border)] object-contain" />
                  </a> : <p className="text-sm text-[var(--oppa-text-muted)]">No delivery photo has been uploaded.</p>}
                  {selectedOrder.delivery_proof_uploaded_at && <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">Sent <AdminDate value={selectedOrder.delivery_proof_uploaded_at} /></p>}
                </div>}

                {selectedOrder.phone && <div><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Phone</p><p className="mt-1 text-sm font-medium">{selectedOrder.phone}</p></div>}

                <div>
                  <p className="mb-2 text-xs font-semibold">Items</p>
                  {detailItems.length ? <div className="space-y-2 rounded-xl bg-[var(--oppa-cream)] p-3">{detailItems.map((item, index) => {
                    const quantity = item.quantity || 1;
                    const addons = item.selected_addons || [];
                    const itemTotal = (Number(item.product_price ?? item.price ?? 0) + addons.reduce((sum, addon) => sum + Number(addon.price || 0) * (addon.quantity || 1), 0)) * quantity;
                    return <div key={`${item.product_name || item.name || 'item'}-${index}`} className="flex justify-between gap-3 border-b border-[var(--oppa-border)]/30 pb-2 last:border-0">
                      <div className="min-w-0"><p className="break-words font-medium">{item.product_name || item.name || 'Item'}</p><p className="break-words text-xs text-[var(--oppa-text-muted)]">Qty: {quantity}{addons.length > 0 && <span className="ml-2">Add-ons: {addons.map((addon) => `${addon.name || 'Add-on'}${(addon.quantity || 1) > 1 ? ` x${addon.quantity}` : ''}`).join(', ')}</span>}</p></div>
                      <span className="shrink-0 font-semibold">{formatCurrency(itemTotal)}</span>
                    </div>;
                  })}<div className="flex justify-between border-t border-[var(--oppa-border)]/30 pt-2 font-bold"><span>Total</span><span>{formatCurrency(selectedOrder.total)}</span></div></div> : <p className="rounded-xl bg-[var(--oppa-cream)] p-3 text-sm text-[var(--oppa-text-muted)]">No item details provided.</p>}
                  {selectedOrder.delivery_type?.toLowerCase() === 'onsite'
                    && !selectedOrder.third_party_platform
                    && !selectedOrder.replacement_of_order_id
                    && <ReplaceOnsiteItemAction
                      orderId={selectedOrder.id}
                      items={detailItems.map((item) => ({
                        id: item.id ?? '',
                        product_name: item.product_name,
                        name: item.name,
                        quantity: item.quantity,
                      }))}
                      endpointPrefix="/franchise/orders"
                      fetcher={replacementFetcher}
                    />}
                </div>
              </div>}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </main>
  );
};

export default FranchiseOrdersPage;

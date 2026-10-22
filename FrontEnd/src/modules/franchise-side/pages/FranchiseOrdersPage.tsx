import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Globe2, Search, Store, X } from 'lucide-react';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { formatCurrency } from '../../../utils/formatters';
import { AdminDate, PageHeader, StatusBadge } from '../../admin-side/components/AdminUI';

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
  delivery_address?: string | null;
  phone?: string | null;
  email?: string;
  customer_name?: string;
  user?: { full_name?: string; email?: string };
  created_at: string;
  delivery_proof_image?: string | null;
  delivery_proof_uploaded_at?: string | null;
  delivery_confirmed_at?: string | null;
  items?: OrderItem[];
  order_items?: OrderItem[];
  orderItems?: OrderItem[];
}

type StatusFilter = 'all' | 'pending' | 'on_the_way' | 'delivered' | 'cancelled';
type ChannelFilter = 'all' | 'online' | 'onsite';

const STATUS_TABS: Array<{ label: string; value: StatusFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'On the way', value: 'on_the_way' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

const getChannel = (order: BranchOrder): Exclude<ChannelFilter, 'all'> =>
  order.delivery_type?.toLowerCase() === 'onsite' ? 'onsite' : 'online';

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
  const [reload, setReload] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<BranchOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newOrdersNotice, setNewOrdersNotice] = useState('');
  const knownOrderIds = useRef<Set<string> | null>(null);
  const orderDetailsPanelRef = useRef<HTMLElement>(null);
  const branchName = franchiseUser?.branch?.name || franchiseUser?.franchise?.name || 'Current branch';

  useEffect(() => {
    if (selectedOrder) orderDetailsPanelRef.current?.scrollTo({ top: 0 });
  }, [selectedOrder?.id]);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/orders`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch orders.');
      setError('');
      const nextOrders = Array.isArray(payload.data) ? payload.data as BranchOrder[] : [];
      if (knownOrderIds.current) {
        const newCount = nextOrders.filter((order) => !knownOrderIds.current?.has(order.id)).length;
        if (newCount > 0) setNewOrdersNotice(`${newCount} new branch order${newCount === 1 ? '' : 's'} received.`);
      }
      knownOrderIds.current = new Set(nextOrders.map((order) => order.id));
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

  useEffect(() => { void Promise.resolve().then(loadOrders); }, [loadOrders, reload]);
  useEffect(() => {
    const interval = window.setInterval(() => { void loadOrders(); }, 15000);
    return () => window.clearInterval(interval);
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (query && !`${order.order_number || ''} ${order.id} ${getCustomerName(order)} ${order.email || ''}`.toLowerCase().includes(query)) return false;
      if (channel !== 'all' && getChannel(order) !== channel) return false;
      if (status !== 'all' && order.status.toLowerCase() !== status) return false;
      if (date && !order.created_at?.startsWith(date)) return false;
      return true;
    });
  }, [orders, search, status, channel, date]);

  const statusCount = (filter: StatusFilter) =>
    orders.filter((order) => filter === 'all' || order.status.toLowerCase() === filter).length;

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

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader title="Orders" subtitle="Track this branch’s online and onsite orders. Statuses update as authorized kitchen and delivery roles process each order." />

        {error && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} className="font-semibold underline">Retry</button></div>}
        {newOrdersNotice && <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><span>{newOrdersNotice}</span><button type="button" onClick={() => setNewOrdersNotice('')} className="font-semibold underline">Dismiss</button></div>}

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" aria-label="Filter orders by status" className="flex gap-2 overflow-x-auto pb-1">
            {STATUS_TABS.map((tab) => <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => setStatus(tab.value)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${status === tab.value ? 'border-[var(--oppa-green)] bg-[var(--oppa-green)] text-white shadow-sm' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]'}`}
            >{tab.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${status === tab.value ? 'bg-white/20' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]'}`}>{statusCount(tab.value)}</span></button>)}
          </div>
          <span className="text-xs text-[var(--oppa-text-muted)]">Showing <strong className="tabular-nums text-[var(--oppa-text)]">{filteredOrders.length}</strong> of <strong className="tabular-nums text-[var(--oppa-text)]">{orders.length}</strong> orders</span>
        </div>

        <div className="mb-4 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="franchise-search-field flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-[var(--oppa-text-muted)]">
              <Search size={16} aria-hidden="true" />
              <input aria-label="Search orders by ID, customer, or email" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID, customer, email..." className="admin-embedded-input min-w-0 w-full text-sm placeholder:text-[var(--oppa-text-muted)]" />
            </label>
            <select aria-label="Filter by channel" value={channel} onChange={(event) => setChannel(event.target.value as ChannelFilter)} className="h-11 min-w-36 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]"><option value="all">All channels</option><option value="online">Online</option><option value="onsite">Onsite</option></select>
            <label className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text-muted)]"><span className="whitespace-nowrap">Date</span><input aria-label="Filter by date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[145px] border-0 bg-transparent p-0 text-[var(--oppa-text)] outline-none ring-0 shadow-none focus:border-0 focus:outline-none focus:ring-0" /></label>
            {hasFilters && <button type="button" onClick={clearFilters} className="h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]">Clear filters</button>}
          </div>
        </div>

        {loading ? (
          <div aria-label="Loading orders" aria-busy="true" className="admin-card space-y-3 p-5">{[0, 1, 2, 3].map((row) => <div key={row} className="h-14 animate-pulse rounded-xl bg-[var(--oppa-green-soft)]" />)}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="admin-card p-10 text-center">
            <p className="font-semibold text-[var(--oppa-text)]">{hasFilters ? 'No orders match these filters' : 'No orders yet'}</p>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{hasFilters ? 'Try adjusting or clearing your filters.' : 'New orders for this branch will appear here.'}</p>
            {hasFilters && <button type="button" onClick={clearFilters} className="mt-3 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">Clear filters</button>}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="admin-table franchise-orders-table w-full min-w-[1100px] table-fixed text-left text-sm">
                <thead><tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">
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
                    return <tr key={order.id} className="group border-b border-[var(--oppa-border)]/60 last:border-0 transition hover:bg-[var(--oppa-cream)]/50">
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs font-semibold text-[var(--oppa-text)]" title={orderId}>{orderId}</td>
                      <td className="px-3 py-2.5"><div className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">{customerName.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || '?'}</span><div className="min-w-0"><span className="block truncate font-medium text-[var(--oppa-text)]">{customerName}</span><span className="block truncate text-xs text-[var(--oppa-text-muted)]">{order.email || order.user?.email || ' '}</span></div></div></td>
                      <td className="px-3 py-3"><span className={`franchise-channel-badge ${orderChannel === 'onsite' ? 'franchise-channel-badge--onsite' : 'franchise-channel-badge--online'}`}>{orderChannel === 'onsite' ? <Store size={12} aria-hidden="true" /> : <Globe2 size={12} aria-hidden="true" />}{orderChannel === 'onsite' ? 'Onsite' : 'Online'}</span></td>
                      <td className="truncate px-3 py-3 text-[var(--oppa-text)]" title={branchName}>{branchName}</td>
                      <td className="truncate px-3 py-3 text-xs text-[var(--oppa-text-muted)]" title={getOrderItems(order).map((item) => `${item.quantity || 1}x ${item.product_name || item.name || 'Item'}`).join(', ')}>{getItemsSummary(order)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-[var(--oppa-text)]">{formatCurrency(order.total)}</td>
                      <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-3 py-2.5 text-xs text-[var(--oppa-text-muted)]"><AdminDate value={order.created_at} /></td>
                      <td className="px-2 py-3 text-right"><button type="button" onClick={() => void viewOrder(order)} aria-label={`View order ${orderId}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--oppa-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)]"><Eye size={13} /> View</button></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedOrder && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-6" role="presentation" onClick={() => setSelectedOrder(null)}><section ref={orderDetailsPanelRef} role="dialog" aria-modal="true" aria-label="Order details" onClick={(event) => event.stopPropagation()} className="max-h-[min(92dvh,900px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 text-[var(--oppa-text)] shadow-2xl sm:p-7">
        <div className="sticky top-0 z-10 -mx-5 mb-5 flex items-center justify-between gap-4 border-b border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-5 py-3 sm:-mx-7 sm:px-7"><div className="min-w-0"><p className="text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">Branch order</p><h2 className="mt-1 truncate font-mono text-xs text-[var(--oppa-text-muted)]">{selectedOrder.order_number || selectedOrder.id}</h2></div><button type="button" aria-label="Close order details" onClick={() => setSelectedOrder(null)} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-700"><X size={18} /></button></div>
        {detailLoading ? <p className="py-10 text-center text-sm text-[var(--oppa-text-muted)]">Loading order details...</p> : <>
          <div className="rounded-2xl bg-[var(--oppa-green-soft)] p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div><p className="text-xs text-[var(--oppa-text-muted)]">Customer</p><p className="mt-1 font-semibold">{getCustomerName(selectedOrder)}</p>{selectedOrder.email && <p className="mt-0.5 break-all text-xs text-[var(--oppa-text-muted)]">{selectedOrder.email}</p>}</div>
              <div><p className="text-xs text-[var(--oppa-text-muted)]">Status</p><div className="mt-1"><StatusBadge status={selectedOrder.status} /></div></div>
              <div><p className="text-xs text-[var(--oppa-text-muted)]">Payment Method</p><p className="mt-1 font-medium capitalize">{selectedOrder.payment_method?.replaceAll('_', ' ') || '—'}</p></div>
              <div><p className="text-xs text-[var(--oppa-text-muted)]">Order Type</p><p className="mt-1 font-medium">{getChannel(selectedOrder) === 'onsite' ? 'Onsite' : 'Online'}</p></div>
              <div><p className="text-xs text-[var(--oppa-text-muted)]">Delivery</p><p className="mt-1 font-medium capitalize">{(selectedOrder.delivery_type || 'standard').replaceAll('_', ' ')}</p></div>
              <div><p className="text-xs text-[var(--oppa-text-muted)]">Order Date</p><div className="mt-1"><AdminDate value={selectedOrder.created_at} /></div></div>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-[var(--oppa-border)] p-4"><p className="text-xs font-medium text-[var(--oppa-text-muted)]">Delivery Address</p><p className="mt-1 break-words text-sm">{selectedOrder.delivery_address || 'Onsite / Walk-in'}</p></div>
          {selectedOrder.status === 'delivered' && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><p className="font-semibold">Delivered</p><p className="mt-1 text-green-700">This order has been marked delivered by the assigned driver.</p></div>}
          {(selectedOrder.delivery_proof_image || selectedOrder.status === 'delivered') && <div className="mt-4 rounded-xl border border-[var(--oppa-border)] p-4"><p className="mb-2 text-sm font-semibold">Delivery Proof</p>{selectedOrder.delivery_proof_image ? <a href={selectedOrder.delivery_proof_image} target="_blank" rel="noreferrer" className="inline-block"><img src={selectedOrder.delivery_proof_image} alt="Driver delivery proof" className="max-h-72 max-w-full rounded-lg border border-[var(--oppa-border)] object-contain" /></a> : <p className="text-sm text-[var(--oppa-text-muted)]">No delivery photo has been uploaded.</p>}{selectedOrder.delivery_proof_uploaded_at && <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">Sent <AdminDate value={selectedOrder.delivery_proof_uploaded_at} /></p>}</div>}
          {selectedOrder.phone && <div className="mt-4"><p className="text-xs text-[var(--oppa-text-muted)]">Phone</p><p className="text-sm">{selectedOrder.phone}</p></div>}
          <div className="mt-5"><p className="mb-2 text-sm font-semibold">Items</p>{detailItems.length ? <div className="space-y-2 rounded-xl bg-[var(--oppa-cream)] p-4">{detailItems.map((item, index) => {
            const quantity = item.quantity || 1;
            const addons = item.selected_addons || [];
            const itemTotal = (Number(item.product_price ?? item.price ?? 0) + addons.reduce((sum, addon) => sum + Number(addon.price || 0) * (addon.quantity || 1), 0)) * quantity;
            return <div key={`${item.product_name || item.name || 'item'}-${index}`} className="flex justify-between gap-4 border-b border-[var(--oppa-border)]/30 pb-2 last:border-0"><div><p className="font-medium">{item.product_name || item.name || 'Item'}</p><p className="text-xs text-[var(--oppa-text-muted)]">Qty: {quantity}{addons.length > 0 && <span className="ml-2">Add-ons: {addons.map((addon) => `${addon.name || 'Add-on'}${(addon.quantity || 1) > 1 ? ` x${addon.quantity}` : ''}`).join(', ')}</span>}</p></div><p className="font-semibold">{formatCurrency(itemTotal)}</p></div>;
          })}<div className="flex justify-between border-t border-[var(--oppa-border)]/30 pt-2 font-bold"><span>Total</span><span>{formatCurrency(selectedOrder.total)}</span></div></div> : <p className="py-5 text-sm text-[var(--oppa-text-muted)]">No item details provided.</p>}</div>
        </>}
      </section></div>}
    </main>
  );
};

export default FranchiseOrdersPage;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Globe2, Search, Store, X } from 'lucide-react';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { formatCurrency } from '../../../utils/formatters';
import { AdminDate, PageHeader, StatusBadge } from '../../admin-side/components/AdminUI';

interface OrderItem {
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
  email?: string;
  customer_name?: string;
  user?: { full_name?: string; email?: string };
  created_at: string;
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
  const branchName = franchiseUser?.branch?.name || franchiseUser?.franchise?.name || 'Current branch';

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
            <label className="flex h-11 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text-muted)]"><span className="whitespace-nowrap">Date</span><input aria-label="Filter by date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="min-w-0 bg-transparent text-[var(--oppa-text)]" /></label>
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
              <table className="admin-table franchise-orders-table w-full table-fixed text-left text-sm">
                <thead><tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">
                  <th className="w-[13%] px-3 py-3 font-semibold">Order ID</th>
                  <th className="w-[17%] px-3 py-3 font-semibold">Customer</th>
                  <th className="w-[8%] px-3 py-3 font-semibold">Channel</th>
                  <th className="w-[13%] px-3 py-3 font-semibold">Branch</th>
                  <th className="w-[17%] px-3 py-3 font-semibold">Items</th>
                  <th className="w-[9%] px-3 py-3 text-right font-semibold">Total</th>
                  <th className="w-[10%] px-3 py-3 font-semibold">Status</th>
                  <th className="w-[9%] px-3 py-3 font-semibold">Date</th>
                  <th className="w-[4%] px-2 py-3 text-right font-semibold">View</th>
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

      {selectedOrder && <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onClick={() => setSelectedOrder(null)}><section role="dialog" aria-modal="true" aria-label="Order details" onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-xl overflow-y-auto bg-[var(--oppa-surface)] p-6 text-[var(--oppa-text)] shadow-xl">
        <div className="mb-5 flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">Branch order</p><h2 className="mt-1 text-xl font-semibold">{selectedOrder.order_number || selectedOrder.id}</h2></div><button type="button" aria-label="Close order details" onClick={() => setSelectedOrder(null)} className="rounded-lg p-2 hover:bg-[var(--oppa-green-soft)]"><X size={18} /></button></div>
        {detailLoading ? <p className="py-10 text-center text-sm text-[var(--oppa-text-muted)]">Loading order details...</p> : <>
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-[var(--oppa-green-soft)] p-4 text-sm"><div><p className="text-xs text-[var(--oppa-text-muted)]">Customer</p><p className="mt-1 font-medium">{getCustomerName(selectedOrder)}</p></div><div><p className="text-xs text-[var(--oppa-text-muted)]">Status</p><p className="mt-1"><StatusBadge status={selectedOrder.status} /></p></div><div><p className="text-xs text-[var(--oppa-text-muted)]">Payment</p><p className="mt-1">{selectedOrder.payment_method?.replaceAll('_', ' ') || '—'}</p></div><div><p className="text-xs text-[var(--oppa-text-muted)]">Order type</p><p className="mt-1">{getChannel(selectedOrder) === 'onsite' ? 'Onsite' : 'Online'}</p></div><div className="col-span-2"><p className="text-xs text-[var(--oppa-text-muted)]">Address / notes</p><p className="mt-1">{selectedOrder.delivery_address || '—'}</p></div></div>
          <h3 className="mb-3 mt-6 font-semibold">Items</h3>
          {detailItems.length ? <div className="divide-y divide-[var(--oppa-border)]">{detailItems.map((item, index) => <div key={`${item.product_name || item.name || 'item'}-${index}`} className="flex justify-between gap-4 py-3 text-sm"><span>{item.quantity || 1} × {item.product_name || item.name || 'Item'}</span><span>{formatCurrency(Number(item.product_price ?? item.price ?? 0) * (item.quantity || 1))}</span></div>)}</div> : <p className="py-5 text-sm text-[var(--oppa-text-muted)]">No item details provided.</p>}
          <div className="mt-4 flex justify-between border-t border-[var(--oppa-border)] pt-4 font-semibold"><span>Total</span><span>{formatCurrency(selectedOrder.total)}</span></div>
        </>}
      </section></div>}
    </main>
  );
};

export default FranchiseOrdersPage;

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Eye, RefreshCw, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';

interface OrderItem {
  product_name?: string;
  name?: string;
  quantity: number;
  product_price?: number | string;
  price?: number | string;
}

interface BranchOrder {
  id: string;
  order_number: string;
  total: number | string;
  status: string;
  payment_method: string;
  delivery_type?: string | null;
  delivery_address?: string | null;
  email?: string;
  user?: { full_name?: string; email?: string };
  created_at: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
  orderItems?: OrderItem[];
}

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'prepared', 'ready', 'delivered', 'completed', 'cancelled'];

const FranchiseOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<BranchOrder[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<BranchOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/orders?${params}`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch orders.');
      setError('');
      setOrders(Array.isArray(payload.data) ? payload.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.name === 'TimeoutError'
        ? 'Loading orders took too long. Please retry.'
        : loadError instanceof Error ? loadError.message : 'Could not load branch orders.');
    } finally {
      setLoading(false);
    }
  }, [search, status, type, from, to]);

  useEffect(() => { void Promise.resolve().then(loadOrders); }, [loadOrders, reload]);

  const updateStatus = async (order: BranchOrder, nextStatus: string) => {
    setUpdatingOrderId(order.id);
    setError('');
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/orders/${encodeURIComponent(order.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not update the order status.');
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: nextStatus } : item));
      if (selectedOrder?.id === order.id) setSelectedOrder({ ...selectedOrder, status: nextStatus });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update the order status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

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

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div><Link to="/franchise/dashboard" className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--oppa-green)] hover:underline"><ArrowLeft size={16} /> Dashboard</Link><h1 className="text-2xl font-semibold text-[var(--oppa-text)]">Branch Orders</h1><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Search, review, and manage this branch's in-person and online orders.</p></div>
          <button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-white px-4 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button>
        </header>

        {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} className="font-semibold underline">Retry</button></div>}
        <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <div className="grid gap-3 border-b border-[var(--oppa-border)] p-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_150px_140px_160px_160px]">
            <label className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order #, customer, email..." className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm" /></label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="all">All statuses</option>{ORDER_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="all">All types</option><option value="online">Online</option><option value="onsite">In person</option></select>
            <input aria-label="Orders from date" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
            <input aria-label="Orders to date" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm" />
          </div>
          {loading ? <p className="p-10 text-center text-sm text-[var(--oppa-text-muted)]">Loading orders...</p> : orders.length === 0 ? <p className="p-10 text-center text-sm text-[var(--oppa-text-muted)]">No branch orders match these filters.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-[#edf5ef] text-xs uppercase text-[var(--oppa-text-muted)]"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Type / Customer</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Details</th></tr></thead><tbody className="divide-y divide-gray-100">{orders.map((order) => <tr key={order.id}>
              <td className="px-4 py-4 font-medium">{order.order_number}</td>
              <td className="max-w-xs px-4 py-4"><span className="block capitalize">{order.delivery_type === 'onsite' ? 'In person' : 'Online'}</span><span className="block truncate text-xs text-gray-500">{order.user?.full_name || order.email || order.user?.email || order.delivery_address || 'Customer'}</span></td>
              <td className="px-4 py-4">₱{Number(order.total).toFixed(2)}</td>
              <td className="px-4 py-4 capitalize">{order.payment_method?.replaceAll('_', ' ') || '—'}</td>
              <td className="px-4 py-4"><select value={order.status} disabled={updatingOrderId === order.id} onChange={(event) => void updateStatus(order, event.target.value)} className="rounded-lg border border-gray-200 px-2 py-1.5 capitalize disabled:opacity-50">{ORDER_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></td>
              <td className="px-4 py-4 text-xs text-gray-500">{order.created_at ? new Date(order.created_at).toLocaleString() : '—'}</td>
              <td className="px-4 py-4"><button onClick={() => void viewOrder(order)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs hover:bg-gray-50"><Eye size={14} /> View</button></td>
            </tr>)}</tbody></table></div>
          )}
        </section>
      </div>

      {selectedOrder && <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation" onClick={() => setSelectedOrder(null)}><section role="dialog" aria-modal="true" aria-label="Order details" onClick={(event) => event.stopPropagation()} className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-gray-500">Branch order</p><h2 className="mt-1 text-xl font-semibold">{selectedOrder.order_number}</h2></div><button aria-label="Close order details" onClick={() => setSelectedOrder(null)} className="rounded-lg p-2 hover:bg-gray-100"><X size={18} /></button></div>
        {detailLoading ? <p className="py-10 text-center text-sm text-gray-500">Loading order details...</p> : <>
          <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#edf5ef] p-4 text-sm"><div><p className="text-xs text-gray-500">Customer</p><p className="mt-1 font-medium">{selectedOrder.user?.full_name || selectedOrder.email || 'Walk-in customer'}</p></div><div><p className="text-xs text-gray-500">Status</p><p className="mt-1 capitalize">{selectedOrder.status}</p></div><div><p className="text-xs text-gray-500">Payment</p><p className="mt-1 capitalize">{selectedOrder.payment_method?.replaceAll('_', ' ') || '—'}</p></div><div><p className="text-xs text-gray-500">Order type</p><p className="mt-1">{selectedOrder.delivery_type === 'onsite' ? 'In person' : 'Online'}</p></div><div className="col-span-2"><p className="text-xs text-gray-500">Address / notes</p><p className="mt-1">{selectedOrder.delivery_address || '—'}</p></div></div>
          <h3 className="mb-3 mt-6 font-semibold">Items</h3>
          {(selectedOrder.items || selectedOrder.order_items || selectedOrder.orderItems || []).length ? <div className="divide-y">{(selectedOrder.items || selectedOrder.order_items || selectedOrder.orderItems || []).map((item, index) => <div key={`${item.product_name || item.name || 'item'}-${index}`} className="flex justify-between gap-4 py-3 text-sm"><span>{item.quantity} × {item.product_name || item.name || 'Item'}</span><span>₱{(Number(item.product_price ?? item.price ?? 0) * item.quantity).toFixed(2)}</span></div>)}</div> : <p className="py-5 text-sm text-gray-500">No item details provided.</p>}
          <div className="mt-4 flex justify-between border-t pt-4 font-semibold"><span>Total</span><span>₱{Number(selectedOrder.total).toFixed(2)}</span></div>
        </>}
      </section></div>}
    </main>
  );
};

export default FranchiseOrdersPage;

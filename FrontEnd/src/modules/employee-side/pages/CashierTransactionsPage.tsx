import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, RefreshCw, Trophy } from 'lucide-react';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithEmployeeAuth } from '../../../services/employeeAuth';
import { formatPeso } from '../../../utils/formatters';
import StaffBranchBadge from '../../shared/components/StaffBranchBadge';

interface CashierOrder {
  id: string;
  order_number?: string | null;
  branch_name?: string | null;
  total: number;
  payment_method: string;
  payment_status?: string | null;
  payment_reference?: string | null;
  status: string;
  created_at: string;
}

const CashierTransactionsPage: React.FC<{ view?: 'orders' | 'transactions' }> = ({ view = 'transactions' }) => {
  const [orders, setOrders] = useState<CashierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const staff = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('employee_auth') || 'null') as {
        franchise_id?: string | null;
        franchise?: { id?: string; name?: string } | null;
      } | null;
    } catch {
      return null;
    }
  })();
  const branchName = staff?.franchise?.name || 'Main system';
  const branchId = staff?.franchise?.id || staff?.franchise_id || null;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchWithEmployeeAuth(`${API_URL}/employee/pos/orders`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load your transactions.');
      setOrders(Array.isArray(payload.data) ? payload.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your transactions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadOrders); }, [loadOrders]);
  useEffect(() => {
    document.title = `${branchName} | My ${view === 'orders' ? 'Orders' : 'Transactions'} | Oppa Dru`;
  }, [branchName, view]);

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--oppa-green)]">Branch cashier</p><h1 className="mt-1 text-2xl font-semibold">My {view === 'orders' ? 'orders' : 'transactions'}</h1><p className="mt-1 text-sm text-gray-500">Only orders placed using your cashier account and assigned franchise location are shown.</p><div className="mt-2"><StaffBranchBadge name={branchName} id={branchId} /></div></div>
          <div className="flex flex-wrap gap-2">
            <Link to="/cashier/pos" className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white">POS</Link>
            <Link to="/cashier/branch-orders" className={`rounded-xl border px-4 py-2 text-sm font-medium ${view === 'orders' ? 'border-[var(--oppa-green)] text-[var(--oppa-green)]' : ''}`}>Orders</Link>
            <Link to="/cashier/transactions" className={`rounded-xl border px-4 py-2 text-sm font-medium ${view === 'transactions' ? 'border-[var(--oppa-green)] text-[var(--oppa-green)]' : ''}`}>Transactions</Link>
            <Link to="/cashier/top-products" className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-medium"><Trophy size={15} /> Top Products</Link>
            <Link to="/cashier/pos?filter=favorites" className="inline-flex items-center gap-1 rounded-xl border px-4 py-2 text-sm font-medium"><Heart size={15} /> Favorites</Link>
            <button onClick={() => void loadOrders()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button>
          </div>
        </header>
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading {view === 'orders' ? 'orders' : 'transactions'}...</p> : orders.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">No {view === 'orders' ? 'orders' : 'transactions'} have been recorded for your account yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#edf5ef] text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Payment</th>{view === 'transactions' && <th className="px-4 py-3">Reference</th>}<th className="px-4 py-3">{view === 'orders' ? 'Order status' : 'Payment status'}</th><th className="px-4 py-3">Date</th></tr></thead><tbody className="divide-y divide-gray-100">{orders.map((order) => <tr key={order.id}><td className="px-4 py-3.5 font-medium"><span className="block">{order.order_number || order.id}</span>{order.branch_name && <span className="mt-0.5 block text-xs font-normal text-gray-500">{order.branch_name}</span>}</td><td className="px-4 py-3.5 tabular-nums">{formatPeso(order.total || 0)}</td><td className="px-4 py-3.5 capitalize">{order.payment_method.replaceAll('_', ' ')}</td>{view === 'transactions' && <td className="px-4 py-3.5">{order.payment_reference || '—'}</td>}<td className="px-4 py-3.5 capitalize">{(view === 'orders' ? order.status : order.payment_status || order.status).replaceAll('_', ' ')}</td><td className="px-4 py-3.5 text-gray-500">{new Date(order.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </main>
  );
};

export default CashierTransactionsPage;

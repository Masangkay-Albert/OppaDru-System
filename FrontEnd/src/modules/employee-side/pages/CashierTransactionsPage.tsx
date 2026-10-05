import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithEmployeeAuth } from '../../../services/employeeAuth';
import { formatCurrency } from '../../../utils/formatters';

interface CashierOrder {
  id: string;
  order_number?: string | null;
  total: number;
  payment_method: string;
  status: string;
  created_at: string;
}

const CashierTransactionsPage: React.FC = () => {
  const [orders, setOrders] = useState<CashierOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--oppa-green)]">Branch cashier</p><h1 className="mt-1 text-2xl font-semibold">My recent transactions</h1><p className="mt-1 text-sm text-gray-500">Only orders placed using your cashier account are shown.</p></div>
          <div className="flex gap-2"><button onClick={() => void loadOrders()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button><Link to="/cashier/pos" className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white">Open POS</Link></div>
        </header>
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading transactions...</p> : orders.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">No transactions have been recorded for your account yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-[#edf5ef] text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date</th></tr></thead><tbody className="divide-y divide-gray-100">{orders.map((order) => <tr key={order.id}><td className="px-4 py-3.5 font-medium">{order.order_number || order.id}</td><td className="px-4 py-3.5">{formatCurrency(order.total || 0)}</td><td className="px-4 py-3.5 capitalize">{order.payment_method}</td><td className="px-4 py-3.5 capitalize">{order.status.replaceAll('_', ' ')}</td><td className="px-4 py-3.5 text-gray-500">{new Date(order.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </main>
  );
};

export default CashierTransactionsPage;

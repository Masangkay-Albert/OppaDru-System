import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { formatPeso } from '../../../utils/formatters';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import Select from '../../../components/ui/Select';

interface PosTransaction {
  id: string;
  order_number: string;
  franchise?: { id: string; name: string } | null;
  location?: { id: string; name: string | null };
  location_name: string;
  cashier?: { name: string; email: string } | null;
  franchise_operator?: { name: string; email: string } | null;
  operator_email?: string;
  total: number;
  payment_method: string;
  payment_status: string;
  payment_reference: string | null;
  gateway_payment?: { status: string; paid_at: string | null } | null;
  status: string;
  created_at: string;
}

interface PosActivityResponse {
  data: PosTransaction[];
  summary: {
    transaction_count: number;
    sales_count: number;
    total_sales: number;
    average_transaction_value: number;
  };
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
  };
}

const emptySummary = {
  transaction_count: 0,
  sales_count: 0,
  total_sales: 0,
  average_transaction_value: 0,
};

const FranchisePosActivityPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const [activity, setActivity] = useState<PosActivityResponse>({
    data: [],
    summary: emptySummary,
    pagination: { current_page: 1, last_page: 1, per_page: 50 },
  });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivity = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page) });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (paymentMethod) params.set('payment_method', paymentMethod);

    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/pos/orders?${params}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load POS activity.');
      setActivity({
        data: Array.isArray(payload.data) ? payload.data : [],
        summary: payload.summary || emptySummary,
        pagination: payload.pagination || { current_page: 1, last_page: 1, per_page: 50 },
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load POS activity.');
    } finally {
      setLoading(false);
    }
  }, [from, page, paymentMethod, to]);

  useEffect(() => { void Promise.resolve().then(loadActivity); }, [loadActivity]);

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--oppa-green)]">Franchise Portal · POS</p>
            <h1 className="mt-1 text-2xl font-semibold">Sales and POS activity</h1>
            <p className="mt-1 text-sm text-gray-500">Transactions and sales for {franchiseUser?.franchise?.name || 'your authorized location'} only.</p>
          </div>
          {franchiseUser?.can_process_pos && <Link to="/franchise/pos" className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white">Open POS</Link>}
        </header>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <section aria-label="POS sales summary" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'POS sales', value: formatPeso(activity.summary.total_sales) },
            { label: 'Completed sales', value: String(activity.summary.sales_count) },
            { label: 'Transactions', value: String(activity.summary.transaction_count) },
            { label: 'Average sale', value: formatPeso(activity.summary.average_transaction_value) },
          ].map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{metric.label}</p>
              <p className="mt-2 text-xl font-semibold text-[var(--oppa-green)]">{metric.value}</p>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-end gap-3 border-b border-[var(--oppa-border)] p-4">
            <label className="grid gap-1 text-xs font-medium text-gray-600">From
              <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            </label>
            <label className="grid gap-1 text-xs font-medium text-gray-600">To
              <input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900" />
            </label>
            <Select label="Payment method" value={paymentMethod} onChange={(value) => { setPaymentMethod(value); setPage(1); }} options={[{ value: '', label: 'All methods' }, { value: 'cash', label: 'Cash' }, { value: 'gcash', label: 'GCash' }, { value: 'credit_card', label: 'Card' }]} />
          </div>

          {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading POS activity...</p>
            : activity.data.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">No POS transactions match this period.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1150px] text-left text-sm">
                    <thead className="bg-[#edf5ef] text-xs uppercase text-gray-500">
                      <tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Franchise</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Cashier / operator</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date / time</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activity.data.map((transaction) => {
                        const operator = transaction.cashier || transaction.franchise_operator;
                        return (
                          <tr key={transaction.id}>
                            <td className="px-4 py-3.5 font-medium">{transaction.order_number}</td>
                            <td className="px-4 py-3.5">{transaction.franchise?.name || 'Legacy franchise'}</td>
                            <td className="px-4 py-3.5">{transaction.location?.name || transaction.location_name}</td>
                            <td className="px-4 py-3.5">{operator?.name || transaction.operator_email || 'Unattributed legacy transaction'}{operator?.email && <span className="block text-xs text-gray-500">{operator.email}</span>}</td>
                            <td className="px-4 py-3.5 tabular-nums">{formatPeso(transaction.total)}</td>
                            <td className="px-4 py-3.5 capitalize">{transaction.payment_method.replaceAll('_', ' ')}<span className="block text-xs text-gray-500">{transaction.gateway_payment?.status || transaction.payment_status}</span></td>
                            <td className="px-4 py-3.5 capitalize">{transaction.status.replaceAll('_', ' ')}</td>
                            <td className="px-4 py-3.5 text-gray-500">{new Date(transaction.created_at).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          <footer className="flex items-center justify-between border-t border-[var(--oppa-border)] px-4 py-3 text-sm">
            <span className="text-gray-500">Page {activity.pagination.current_page} of {activity.pagination.last_page}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={loading || page <= 1} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button>
              <button onClick={() => setPage((current) => Math.min(activity.pagination.last_page, current + 1))} disabled={loading || page >= activity.pagination.last_page} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
};

export default FranchisePosActivityPage;

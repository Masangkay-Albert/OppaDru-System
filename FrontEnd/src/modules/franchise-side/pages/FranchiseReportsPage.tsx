import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';

interface ProductSale {
  product_id: string | null;
  product_name: string;
  quantity: number;
  sales: number;
}

interface Report {
  total_sales: number;
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  average_order_value: number;
  product_sales: ProductSale[];
  payment_summary: Record<string, { orders: number; amount: number }>;
  discount_summary: { discounted_orders: number; discount_amount: number };
}

const money = (amount: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
}).format(amount || 0);

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

const FranchiseReportsPage: React.FC = () => {
  const [from, setFrom] = useState(`${TODAY.slice(0, 8)}01`);
  const [to, setTo] = useState(TODAY);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const loadReport = useCallback(async () => {
    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/reports?${params}`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch reports.');
      setError('');
      setReport(payload.data as Report);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load branch reports.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void Promise.resolve().then(loadReport); }, [loadReport, reload]);

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div>
            <Link to="/franchise/dashboard" className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--oppa-green)] hover:underline"><ArrowLeft size={16} /> Dashboard</Link>
            <h1 className="text-2xl font-semibold text-[var(--oppa-text)]">Branch Reports</h1>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Sales and order performance for this branch only.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs text-gray-500">From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800" /></label>
            <label className="grid gap-1 text-xs text-gray-500">To<input type="date" value={to} min={from} max={TODAY} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800" /></label>
            <button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-border)] px-4 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button>
          </div>
        </header>

        {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} className="font-semibold underline">Retry</button></div>}
        {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading branch reports...</p> : report && (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Net sales" value={money(report.total_sales)} />
              <Metric label="Orders" value={report.total_orders} />
              <Metric label="Completed orders" value={report.completed_orders} />
              <Metric label="Average order value" value={money(report.average_order_value)} />
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold">Product sales</h2>
                {report.product_sales.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-gray-500"><th className="py-2">Product</th><th className="py-2">Quantity</th><th className="py-2 text-right">Sales</th></tr></thead><tbody className="divide-y">{report.product_sales.map((item) => <tr key={item.product_id || item.product_name}><td className="py-3">{item.product_name}</td><td className="py-3">{item.quantity}</td><td className="py-3 text-right">{money(item.sales)}</td></tr>)}</tbody></table></div> : <Empty>No product sales in this date range.</Empty>}
              </div>
              <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold">Payment methods</h2>
                {Object.keys(report.payment_summary).length ? <div className="space-y-3">{Object.entries(report.payment_summary).map(([method, summary]) => <div key={method} className="flex justify-between gap-4 border-b pb-3 text-sm"><span className="capitalize">{method.replaceAll('_', ' ')} <span className="text-gray-500">({summary.orders} orders)</span></span><strong>{money(summary.amount)}</strong></div>)}</div> : <Empty>No payments in this date range.</Empty>}
                <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-[#edf5ef] p-4 text-sm"><span>Cancelled orders</span><strong className="text-right">{report.cancelled_orders}</strong><span>Discounted orders</span><strong className="text-right">{report.discount_summary.discounted_orders}</strong><span>Discount amount</span><strong className="text-right">{money(report.discount_summary.discount_amount)}</strong></div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
};

const Metric = ({ label, value }: { label: string; value: string | number }) => <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>;
const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-8 text-center text-sm text-gray-500">{children}</p>;

export default FranchiseReportsPage;

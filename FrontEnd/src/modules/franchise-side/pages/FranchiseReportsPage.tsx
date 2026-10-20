import React, { useCallback, useEffect, useState } from 'react';
import { BarChart3, CalendarDays, CreditCard, DollarSign, RefreshCw, ShoppingCart } from 'lucide-react';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { formatCurrency } from '../../../utils/formatters';
import { PageHeader } from '../../admin-side/components/AdminUI';
import StatCard from '../../admin-side/components/StatCard';

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

const money = (amount: number) => formatCurrency(amount);

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

const FranchiseReportsPage: React.FC = () => {
  const [from, setFrom] = useState(`${TODAY.slice(0, 8)}01`);
  const [to, setTo] = useState(TODAY);
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'month' | 'year' | 'custom'>('month');
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
  const applyPeriod = (value: typeof period) => {
    setPeriod(value);
    if (value === 'custom') return;
    const end = new Date(`${TODAY}T00:00:00Z`);
    const start = new Date(end);
    if (value === '7days') start.setUTCDate(start.getUTCDate() - 6);
    else if (value === '30days') start.setUTCDate(start.getUTCDate() - 29);
    else if (value === 'month') start.setUTCDate(1);
    else start.setUTCMonth(0, 1);
    setFrom(start.toISOString().slice(0, 10));
    setTo(TODAY);
  };
  const paymentEntries = Object.entries(report?.payment_summary || {});
  const totalPaymentSales = paymentEntries.reduce((sum, [, summary]) => sum + Number(summary.amount || 0), 0);
  const paymentColors = ['#1e7045', '#70a77f', '#e4aa49', '#5299a1', '#cf7661'];
  let currentAngle = 0;
  const paymentGradient = paymentEntries.map(([, summary], index) => {
    const segment = totalPaymentSales > 0 ? (Number(summary.amount) / totalPaymentSales) * 360 : 0;
    const segmentColor = `${paymentColors[index % paymentColors.length]} ${currentAngle}deg ${currentAngle + segment}deg`;
    currentAngle += segment;
    return segmentColor;
  }).join(', ');

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader title="Branch Reports" subtitle="Sales and order performance for this branch only." />
        <section className="admin-card mb-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div role="tablist" aria-label="Report date range" className="flex flex-wrap gap-2">
              {([
                ['today', 'Today'],
                ['7days', '7 days'],
                ['30days', '30 days'],
                ['month', 'This month'],
                ['year', 'This year'],
                ['custom', 'Custom'],
              ] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={period === value} onClick={() => applyPeriod(value)} className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${period === value ? 'border-[var(--oppa-green)] bg-[var(--oppa-green)] text-white' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)]'}`}>{label}</button>)}
            </div>
            <div className="flex flex-wrap items-end gap-2">
            <CalendarDays size={17} className="mb-2 hidden text-[var(--oppa-green)] sm:block" />
            <label className="grid gap-1 text-xs text-[var(--oppa-text-muted)]">From<input type="date" value={from} max={to} onChange={(event) => { setPeriod('custom'); setFrom(event.target.value); }} className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
            <label className="grid gap-1 text-xs text-[var(--oppa-text-muted)]">To<input type="date" value={to} min={from} max={TODAY} onChange={(event) => { setPeriod('custom'); setTo(event.target.value); }} className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
            <button type="button" onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--oppa-green-dark)] disabled:opacity-50"><RefreshCw size={15} /> Refresh</button>
            </div>
          </div>
        </section>

        {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} className="font-semibold underline">Retry</button></div>}
        {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading branch reports...</p> : report && (
          <>
            <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <StatCard icon={DollarSign} label="Net sales" value={money(report.total_sales)} />
              <StatCard icon={ShoppingCart} label="Orders" value={report.total_orders} />
              <StatCard icon={BarChart3} label="Completed orders" value={report.completed_orders} accent="green" />
              <StatCard icon={BarChart3} label="Cancelled orders" value={report.cancelled_orders} accent="amber" />
              <StatCard icon={CreditCard} label="Average order value" value={money(report.average_order_value)} accent="amber" />
            </section>
            <section className="grid gap-4 2xl:grid-cols-3">
              <div className="admin-card p-5">
                <div className="mb-4"><h2 className="text-lg font-semibold">Product sales</h2><p className="mt-1 text-xs text-gray-500">Best-performing items in the selected period</p></div>
                {report.product_sales.length ? <div className="overflow-x-auto"><table className="admin-table w-full text-left text-sm"><thead><tr><th className="py-2">Product</th><th className="py-2">Quantity</th><th className="py-2 text-right">Sales</th></tr></thead><tbody>{report.product_sales.map((item) => <tr key={item.product_id || item.product_name}><td className="py-3">{item.product_name}</td><td className="py-3">{item.quantity}</td><td className="py-3 text-right">{money(item.sales)}</td></tr>)}</tbody></table></div> : <Empty>No product sales in this date range.</Empty>}
              </div>
              <div className="admin-card p-5">
                <div className="mb-4"><h2 className="text-lg font-semibold">Payment methods</h2><p className="mt-1 text-xs text-gray-500">Revenue collected by payment type</p></div>
                {paymentEntries.length ? <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                  <div className="relative h-36 w-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${paymentGradient})` }} aria-label="Payment methods sales distribution">
                    <div className="absolute inset-5 grid place-content-center rounded-full bg-[var(--oppa-surface)] text-center"><span className="text-[10px] text-[var(--oppa-text-muted)]">Total</span><strong className="text-sm">{money(totalPaymentSales)}</strong></div>
                  </div>
                  <div className="w-full space-y-3">{paymentEntries.map(([method, summary], index) => <div key={method} className="flex items-start gap-2 text-sm"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: paymentColors[index % paymentColors.length] }} /><span className="flex-1 capitalize">{method.replaceAll('_', ' ')}<span className="block text-xs text-gray-500">{summary.orders} orders</span></span><strong>{money(summary.amount)}</strong></div>)}</div>
                </div> : <Empty>No payments in this date range.</Empty>}
              </div>
              <div className="admin-card p-5">
                <div className="mb-4"><h2 className="text-lg font-semibold">Discount summary</h2><p className="mt-1 text-xs text-gray-500">Approved discounts for this period</p></div>
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-[#edf5ef] p-4 text-sm"><span>Discounted orders</span><strong className="text-right">{report.discount_summary.discounted_orders}</strong><span>Discount amount</span><strong className="text-right">{money(report.discount_summary.discount_amount)}</strong></div>
                <p className="mt-4 text-xs text-gray-500">Cancelled orders in range: <strong className="text-gray-800">{report.cancelled_orders}</strong></p>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
};

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-8 text-center text-sm text-gray-500">{children}</p>;

export default FranchiseReportsPage;

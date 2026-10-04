import React, { useEffect, useState } from 'react';
import { ArrowRight, DollarSign, Package2, ShoppingCart, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';

interface OrderSummary {
  id: string | number;
  order_number?: string;
  email?: string;
  user?: { full_name?: string };
  delivery_type?: string;
  status?: string;
  total?: number;
  payment_method?: string;
  created_at?: string;
}

interface DashboardState {
  franchise_id?: string;
  franchise_name?: string;
  branch_address?: string;
  branch_status?: string;
  products?: number;
  branch_products?: number;
  shared_products?: number;
  orders?: number;
  total_orders?: number;
  total_revenue?: number;
  average_order_value?: number;
  branch_users?: number;
  available_products?: number;
  available_items?: number;
  pending_orders?: number;
  preparing_orders?: number;
  ready_orders?: number;
  completed_orders?: number;
  cancelled_orders?: number;
  orders_by_status?: Record<string, number>;
  recent_orders?: OrderSummary[];
}

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

const FranchiseDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { franchiseUser } = useFranchiseAuth();
  const [dashboard, setDashboard] = useState<DashboardState>({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadDashboard = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/dashboard`, {
          signal: AbortSignal.timeout(15000),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || 'Unable to load this branch dashboard.');
        }
        if (isMounted) setDashboard((payload.data || {}) as DashboardState);
      } catch (loadError) {
        if (!isMounted) return;
        setError(loadError instanceof Error && loadError.name === 'TimeoutError'
          ? 'The branch dashboard is taking too long to respond. Please retry.'
          : loadError instanceof Error
            ? loadError.message
            : 'Unable to load the branch dashboard right now.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void loadDashboard();
    return () => { isMounted = false; };
  }, [retryCount]);

  const retryDashboard = () => setRetryCount((current) => current + 1);
  const recentOrders = dashboard.recent_orders ?? [];
  const orderStatusEntries = Object.entries(dashboard.orders_by_status ?? {});
  const branchName = dashboard.franchise_name || franchiseUser?.franchise?.name || franchiseUser?.full_name || 'Branch Dashboard';

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--oppa-green)]">Branch-specific overview</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--oppa-text)]">{branchName}</h1>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">
              {dashboard.branch_address || franchiseUser?.franchise?.address || 'Branch location not provided'}
              {' · '}
              <span className="capitalize">{dashboard.branch_status || franchiseUser?.franchise?.status || 'active'}</span>
              {dashboard.franchise_id && <> · Branch ID: {dashboard.franchise_id}</>}
            </p>
          </div>

          <NavButton primary onClick={() => navigate('/franchise/pos')}>Open POS</NavButton>
        </header>

        {error && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={retryDashboard} className="rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100">Retry</button>
          </div>
        )}
        {isLoading && <p className="mb-4 text-sm text-[var(--oppa-text-muted)]">Loading branch dashboard...</p>}

        <section className="mb-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          <StatCard icon={ShoppingCart} label="Branch orders" value={dashboard.total_orders ?? dashboard.orders ?? 0} tone="default" />
          <StatCard icon={DollarSign} label="Branch revenue" value={money.format(dashboard.total_revenue ?? 0)} tone="success" />
          <StatCard icon={Package2} label="Available products" value={dashboard.available_products ?? 0} tone="default" />
          <StatCard icon={Users} label="Branch users" value={dashboard.branch_users ?? 0} tone="warning" />
        </section>

        <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-lg font-semibold text-[var(--oppa-text)]">Order status</h2><p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">Live fulfillment for this branch</p></div>
            <button onClick={() => navigate('/franchise/orders')} className="inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)]">
              Branch orders <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {isLoading && <span className="text-sm text-[var(--oppa-text-muted)]">Loading order status...</span>}
            {!isLoading && orderStatusEntries.length === 0 && !error && (
              <span className="text-sm text-[var(--oppa-text-muted)]">No order data available yet.</span>
            )}
            {[
              { label: 'Pending', count: dashboard.pending_orders, color: 'bg-amber-50 text-amber-800 border-amber-100' },
              { label: 'Preparing', count: dashboard.preparing_orders, color: 'bg-blue-50 text-blue-800 border-blue-100' },
              { label: 'Ready', count: dashboard.ready_orders, color: 'bg-emerald-50 text-emerald-800 border-emerald-100' },
              { label: 'Delivered', count: dashboard.completed_orders, color: 'bg-green-50 text-green-800 border-green-100' },
              { label: 'Cancelled', count: dashboard.cancelled_orders, color: 'bg-red-50 text-red-800 border-red-100' },
            ].map(({ label, count, color }) => (
              <div key={label} className={`rounded-xl border p-3 ${color}`}>
                <p className="text-xs font-semibold">{label}</p>
                <p className="mt-1 text-xl font-bold">{count ?? orderStatusEntries.find(([status]) => status.toLowerCase() === label.toLowerCase())?.[1] ?? 0}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-5 py-4">
            <div><h2 className="text-lg font-semibold text-[var(--oppa-text)]">Recent branch orders</h2><p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">Latest activity from this branch only</p></div>
            <button onClick={retryDashboard} className="text-sm text-[var(--oppa-green)] hover:underline">Refresh</button>
          </div>
          {isLoading ? (
            <p className="p-8 text-center text-sm text-[var(--oppa-text-muted)]">Loading recent branch orders...</p>
          ) : recentOrders.length === 0 ? (
            <p className="p-8 text-center text-sm text-[var(--oppa-text-muted)]">No branch orders yet. Orders from this branch will appear here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--oppa-green-soft)]/50 text-left text-[var(--oppa-text-muted)]">
                  <tr>
                    <th className="px-5 py-3">Order</th><th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Type</th><th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Amount</th><th className="px-5 py-3">Payment</th><th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-[var(--oppa-border)]">
                      <td className="px-5 py-3 font-medium">{order.order_number || `#${order.id}`}</td>
                      <td className="px-5 py-3">{order.user?.full_name || order.email || 'Walk-in Customer'}</td>
                      <td className="px-5 py-3 capitalize">{order.delivery_type || 'online'}</td>
                      <td className="px-5 py-3 capitalize">{order.status || 'pending'}</td>
                      <td className="px-5 py-3">{money.format(Number(order.total ?? 0))}</td>
                      <td className="px-5 py-3">{order.payment_method || 'N/A'}</td>
                      <td className="px-5 py-3">{order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <InfoCard title="Catalog overview" items={[{ label: 'Branch products', value: dashboard.branch_products ?? 0 }, { label: 'Shared products', value: dashboard.shared_products ?? 0 }]} />
          <InfoCard title="Performance" items={[{ label: 'Average order', value: money.format(dashboard.average_order_value ?? 0) }, { label: 'Available items', value: dashboard.available_items ?? dashboard.available_products ?? 0 }]} />
          <InfoCard title="Team" items={[{ label: 'Branch users', value: dashboard.branch_users ?? 0 }, { label: 'Completed orders', value: dashboard.completed_orders ?? 0 }]} />
        </section>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: 'default' | 'success' | 'warning';
}

const StatCard: React.FC<StatCardProps> = ({ icon: Icon, label, value, tone = 'default' }) => {
  const palette = {
    default: 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className={`inline-flex rounded-xl p-2 ${palette[tone]}`}><Icon size={18} /></span>
      </div>
      <p className="text-2xl font-semibold text-[var(--oppa-text)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{label}</p>
    </div>
  );
};

interface InfoCardProps {
  title: string;
  items: Array<{ label: string; value: string | number }>;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, items }) => (
  <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
    <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--oppa-text-muted)]">{title}</h3>
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between border-b border-[var(--oppa-border)] pb-2 last:border-0 last:pb-0">
          <span className="text-sm text-[var(--oppa-text-muted)]">{item.label}</span>
          <span className="text-sm font-semibold text-[var(--oppa-text)]">{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);

const NavButton: React.FC<{ children: React.ReactNode; onClick: () => void; primary?: boolean }> = ({
  children, onClick, primary = false,
}) => (
  <button
    onClick={onClick}
    className={primary
      ? 'rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--oppa-green-dark)]'
      : 'rounded-xl border border-[var(--oppa-border)] px-4 py-2 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]'}
  >
    {children}
  </button>
);

export default FranchiseDashboardPage;

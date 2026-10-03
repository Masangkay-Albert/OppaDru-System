import React, { useEffect, useState } from 'react';
import { ArrowRight, DollarSign, LogOut, Package2, ShoppingCart, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';

interface OrderSummary {
  id?: string | number;
  order_number?: string;
  status?: string;
  total?: number;
  payment_method?: string;
  created_at?: string;
}

interface DashboardState {
  franchise_id?: string | number;
  franchise_name?: string;
  products?: number;
  branch_products?: number;
  shared_products?: number;
  orders?: number;
  customers?: number;
  orders_by_status?: Record<string, number>;
  recent_orders?: OrderSummary[];
}

interface SummaryState {
  franchise_id?: string | number;
  franchise_name?: string;
  total_products?: number;
  branch_products?: number;
  shared_products?: number;
  total_orders?: number;
  total_revenue?: number;
  average_order_value?: number;
  status_breakdown?: Record<string, number>;
}

interface InventoryState {
  franchise_id?: string | number;
  total_products?: number;
  branch_products?: number;
  shared_products?: number;
  available_products?: number;
  unavailable_products?: number;
  category_breakdown?: Record<string, number>;
}

interface FulfillmentState {
  franchise_id?: string | number;
  total_orders?: number;
  pending_orders?: number;
  preparing_orders?: number;
  prepared_orders?: number;
  ready_orders?: number;
  delivered_orders?: number;
  cancelled_orders?: number;
  average_order_value?: number;
  latest_orders?: OrderSummary[];
}

const money = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

const FranchiseDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { franchiseUser, logout } = useFranchiseAuth();
  const [dashboard, setDashboard] = useState<DashboardState>({});
  const [summary, setSummary] = useState<SummaryState>({});
  const [inventory, setInventory] = useState<InventoryState>({});
  const [fulfillment, setFulfillment] = useState<FulfillmentState>({});
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [dashboardRes, summaryRes, inventoryRes, fulfillmentRes] = await Promise.all([
          fetchWithFranchiseAuth(`${API_URL}/franchise/dashboard`),
          fetchWithFranchiseAuth(`${API_URL}/franchise/summary`),
          fetchWithFranchiseAuth(`${API_URL}/franchise/inventory`),
          fetchWithFranchiseAuth(`${API_URL}/franchise/fulfillment`),
        ]);

        const dashboardData = dashboardRes.ok ? await dashboardRes.json() : null;
        const summaryData = summaryRes.ok ? await summaryRes.json() : null;
        const inventoryData = inventoryRes.ok ? await inventoryRes.json() : null;
        const fulfillmentData = fulfillmentRes.ok ? await fulfillmentRes.json() : null;

        setDashboard((dashboardData?.data as DashboardState) ?? {});
        setSummary((summaryData?.data as SummaryState) ?? {});
        setInventory((inventoryData?.data as InventoryState) ?? {});
        setFulfillment((fulfillmentData?.data as FulfillmentState) ?? {});

        if (!dashboardRes.ok || !summaryRes.ok || !inventoryRes.ok || !fulfillmentRes.ok) {
          setError('One or more dashboard sections could not be loaded.');
        }
      } catch {
        setError('Unable to load the franchise dashboard right now.');
      }
    };

    loadDashboard();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/franchise/login');
  };

  const recentOrders = dashboard.recent_orders ?? fulfillment.latest_orders ?? [];
  const orderStatusEntries = Object.entries(dashboard.orders_by_status ?? summary.status_breakdown ?? {});

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--oppa-green)]">Franchise Portal</p>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--oppa-text)]">
              {franchiseUser?.franchise?.name || franchiseUser?.full_name || 'Branch Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/franchise/login')}
              className="rounded-xl border border-[var(--oppa-border)] px-4 py-2 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]"
            >
              Switch Account
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--oppa-green-dark)]"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={ShoppingCart} label="Orders" value={dashboard.orders ?? summary.total_orders ?? 0} tone="default" />
          <StatCard icon={DollarSign} label="Revenue" value={money.format(summary.total_revenue ?? 0)} tone="success" />
          <StatCard icon={Package2} label="Products" value={dashboard.products ?? summary.total_products ?? inventory.total_products ?? 0} tone="default" />
          <StatCard icon={Users} label="Branch users" value={dashboard.customers ?? 0} tone="warning" />
        </section>

        <section className="mb-6 grid gap-4 lg:grid-cols-3">
          <InfoCard title="Catalog overview" items={[
            { label: 'Branch products', value: dashboard.branch_products ?? summary.branch_products ?? inventory.branch_products ?? 0 },
            { label: 'Shared products', value: dashboard.shared_products ?? summary.shared_products ?? inventory.shared_products ?? 0 },
            { label: 'Available items', value: inventory.available_products ?? 0 },
          ]} />

          <InfoCard title="Fulfillment" items={[
            { label: 'Pending', value: fulfillment.pending_orders ?? 0 },
            { label: 'Preparing', value: fulfillment.preparing_orders ?? 0 },
            { label: 'Ready', value: fulfillment.ready_orders ?? 0 },
          ]} />

          <InfoCard title="Performance" items={[
            { label: 'Average order', value: money.format(summary.average_order_value ?? fulfillment.average_order_value ?? 0) },
            { label: 'Completed', value: fulfillment.delivered_orders ?? 0 },
            { label: 'Cancelled', value: fulfillment.cancelled_orders ?? 0 },
          ]} />
        </section>

        <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--oppa-text)]">Order status overview</h2>
            <span className="inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)]">
              Live branch summary <ArrowRight size={14} />
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {orderStatusEntries.length === 0 && (
              <span className="text-sm text-[var(--oppa-text-muted)]">No order status data available yet.</span>
            )}
            {orderStatusEntries.map(([status, count]) => (
              <span key={status} className="rounded-full bg-[var(--oppa-green-soft)] px-3 py-1.5 text-xs font-medium capitalize text-[var(--oppa-green)]">
                {status}: {count}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <div className="border-b border-[var(--oppa-border)] px-5 py-4">
            <h2 className="text-lg font-semibold text-[var(--oppa-text)]">Recent branch orders</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--oppa-green-soft)]/50 text-left text-[var(--oppa-text-muted)]">
                <tr>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-[var(--oppa-text-muted)]">
                      No recent orders yet.
                    </td>
                  </tr>
                )}

                {recentOrders.map((order, index) => (
                  <tr key={`${order.order_number ?? order.id ?? index}`} className="border-t border-[var(--oppa-border)] last:border-0">
                    <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">
                      {order.order_number || `#${order.id}`}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs capitalize text-gray-700">
                        {order.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--oppa-text)]">{money.format(Number(order.total ?? 0))}</td>
                    <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{order.payment_method || 'N/A'}</td>
                    <td className="px-5 py-3 text-[var(--oppa-text-muted)]">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <span className={`inline-flex rounded-xl p-2 ${palette[tone]}`}>
          <Icon size={18} />
        </span>
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

export default FranchiseDashboardPage;

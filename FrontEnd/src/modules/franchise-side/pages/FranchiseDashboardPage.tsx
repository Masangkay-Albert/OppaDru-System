import React, { useEffect, useState } from 'react';
import { Activity, ArrowRight, Boxes, DollarSign, MapPin, ShoppingCart, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { formatCurrency } from '../../../utils/formatters';
import AdminStatCard from '../../admin-side/components/StatCard';
import { AdminDate, Avatar, DataTable, EmptyState, PageHeader, StatusBadge } from '../../admin-side/components/AdminUI';

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
  inventory_items?: number;
  tracked_inventory_items?: number;
  pos_activity_count?: number;
  pos_sales?: number;
  pending_orders?: number;
  preparing_orders?: number;
  ready_orders?: number;
  completed_orders?: number;
  cancelled_orders?: number;
  orders_by_status?: Record<string, number>;
  recent_orders?: OrderSummary[];
}

const money = { format: formatCurrency };

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
      <div className="mx-auto max-w-[1500px]">
        <PageHeader title="Dashboard" subtitle={`Branch overview for ${branchName}.`} actions={franchiseUser?.can_process_pos ? <NavButton primary onClick={() => navigate('/franchise/pos')}>Open POS</NavButton> : undefined} />
        <section className="admin-card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Current branch</p><p className="mt-1 font-semibold text-[var(--oppa-text)]">{branchName}</p><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{dashboard.branch_address || franchiseUser?.franchise?.address || 'Branch location not provided'}</p></div>
          <div className="text-right"><StatusBadge status={dashboard.branch_status || franchiseUser?.franchise?.status || 'active'} /><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Branch ID: {dashboard.franchise_id || franchiseUser?.branch_id || '—'}</p></div>
        </section>

        {error && (
          <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={retryDashboard} className="rounded-lg border border-red-300 px-3 py-1.5 font-medium hover:bg-red-100">Retry</button>
          </div>
        )}
        {isLoading && <p className="mb-4 text-sm text-[var(--oppa-text-muted)]">Loading branch dashboard...</p>}

        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <AdminStatCard icon={ShoppingCart} label="Branch orders" value={dashboard.total_orders ?? dashboard.orders ?? 0} />
          <AdminStatCard icon={DollarSign} label="Branch revenue" value={money.format(dashboard.total_revenue ?? 0)} accent="green" />
          <AdminStatCard icon={Users} label="Branch staff" value={dashboard.branch_users ?? 0} accent="amber" />
          <AdminStatCard icon={Boxes} label="Inventory items" value={dashboard.inventory_items ?? dashboard.available_products ?? 0} />
          <AdminStatCard icon={Activity} label="POS activity" value={dashboard.pos_activity_count ?? 0} accent="amber" />
        </section>

        <section className="mb-5 grid gap-3 sm:grid-cols-2">
          <div className="admin-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><MapPin size={17} className="text-[var(--oppa-green)]" /> Assigned location</div>
            <p className="mt-2 text-sm text-[var(--oppa-text)]">{branchName}</p>
            <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{dashboard.branch_address || franchiseUser?.franchise?.address || 'Address not provided'} · <span className="capitalize">{dashboard.branch_status || franchiseUser?.franchise?.status || 'active'}</span></p>
          </div>
          <div className="admin-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Activity size={17} className="text-[var(--oppa-green)]" /> POS sales</div>
            <p className="mt-2 text-xl font-semibold text-[var(--oppa-green)]">{money.format(dashboard.pos_sales ?? 0)}</p>
            <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{dashboard.tracked_inventory_items ?? 0} inventory items with tracked stock</p>
            <button onClick={() => navigate('/franchise/pos/activity')} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--oppa-green)] hover:underline">View POS activity <ArrowRight size={14} /></button>
          </div>
        </section>

        <section className="mb-5 flex flex-wrap gap-2">
          <button onClick={() => navigate('/franchise/orders')} className="rounded-xl border border-[var(--oppa-border)] bg-white px-4 py-2 text-sm font-medium">Manage orders</button>
          <button onClick={() => navigate('/franchise/users')} className="rounded-xl border border-[var(--oppa-border)] bg-white px-4 py-2 text-sm font-medium">Manage staff</button>
          <button onClick={() => navigate('/franchise/inventory')} className="rounded-xl border border-[var(--oppa-border)] bg-white px-4 py-2 text-sm font-medium">Manage inventory</button>
          {franchiseUser?.can_process_pos && <button onClick={() => navigate('/franchise/pos')} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white">Open POS</button>}
        </section>

        <section className="admin-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-lg font-semibold text-[var(--oppa-text)]">Order status</h2><p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">Live fulfillment for this branch</p></div>
            <button onClick={() => navigate('/franchise/orders')} className="inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)]">
              Branch orders <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-5">
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
              <div key={label} className={`rounded-xl border p-2.5 sm:p-3 ${color}`}>
                <p className="text-xs font-semibold">{label}</p>
                <p className="mt-1 text-xl font-bold">{count ?? orderStatusEntries.find(([status]) => status.toLowerCase() === label.toLowerCase())?.[1] ?? 0}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-5 py-4">
            <div><h2 className="text-lg font-semibold text-[var(--oppa-text)]">Recent branch orders</h2><p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">Latest activity from this branch only</p></div>
          </div>
          <DataTable
            headers={['Order ID', 'Customer', 'Type', 'Amount', 'Status', 'Date']}
            caption="Recent orders for this branch"
            loading={isLoading}
            emptyState={<EmptyState title="No branch orders yet" description="Orders from this branch will appear here." />}
          >
            {recentOrders.map((order) => <tr key={order.id} className="border-b border-[var(--oppa-border)]/70 last:border-0 hover:bg-[var(--oppa-cream)]">
              <td className="px-4 py-3 font-mono text-xs font-semibold">{order.order_number || `#${order.id}`}</td>
              <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar name={order.user?.full_name || order.email || 'Walk-in Customer'} /><span className="truncate">{order.user?.full_name || order.email || 'Walk-in Customer'}</span></div></td>
              <td className="px-4 py-3">{order.delivery_type === 'onsite' ? 'In person' : 'Online'}</td>
              <td className="px-4 py-3 font-semibold">{money.format(Number(order.total ?? 0))}</td>
              <td className="px-4 py-3"><StatusBadge status={order.status || 'pending'} /></td>
              <td className="px-4 py-3"><AdminDate value={order.created_at} /></td>
            </tr>)}
          </DataTable>
        </section>
      </div>
    </div>
  );
};

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

import React, { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, Building2, Loader2, MapPin, Plus, Save, Users } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import {
  createFranchiseManager,
  getFranchiseAdminOverview,
  getFranchiseDetail,
  toggleFranchiseManager,
  updateFranchiseManager,
  updateFranchise,
} from '../../../services/franchiseAdminService';
import type { FranchiseAdminUser, FranchiseSummary } from '../../../services/franchiseAdminService';
import { formatCurrency } from '../../../utils/formatters';
import LocationPicker from '../../customer-side/components/common/LocationPicker';

type Tab = 'overview' | 'orders' | 'inventory' | 'users' | 'reports' | 'settings';
type Overview = Awaited<ReturnType<typeof getFranchiseAdminOverview>>;

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'users', label: 'Users' },
  { id: 'reports', label: 'Reports' },
  { id: 'settings', label: 'Branch info' },
];
const money = { format: formatCurrency };

const AdminFranchiseDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [branch, setBranch] = useState<FranchiseSummary | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    const requestedTab = searchParams.get('tab');
    return tabs.some((item) => item.id === requestedTab) ? requestedTab as Tab : 'overview';
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAddManager, setShowAddManager] = useState(false);
  const [managerForm, setManagerForm] = useState({ full_name: '', email: '', phone: '', password: '', can_process_pos: false });
  const [branchCoordinates, setBranchCoordinates] = useState({ latitude: '', longitude: '' });
  const [branchAddress, setBranchAddress] = useState('');
  const [showBranchLocationPicker, setShowBranchLocationPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [branchData, overviewData] = await Promise.all([getFranchiseDetail(id), getFranchiseAdminOverview(id)]);
      setBranch(branchData);
      setBranchCoordinates({
        latitude: branchData.latitude == null ? '' : String(branchData.latitude),
        longitude: branchData.longitude == null ? '' : String(branchData.longitude),
      });
      setBranchAddress(branchData.address || '');
      setOverview(overviewData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load franchise details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const saveBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!branch) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateFranchise(id, {
        name: String(form.get('name') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        address: branchAddress,
        status: String(form.get('status') || 'active'),
        latitude: branchCoordinates.latitude ? Number(branchCoordinates.latitude) : null,
        longitude: branchCoordinates.longitude ? Number(branchCoordinates.longitude) : null,
        delivery_radius_km: form.get('delivery_radius_km') ? Number(form.get('delivery_radius_km')) : null,
        is_active: form.get('is_active') === 'on',
        accepts_online_orders: form.get('accepts_online_orders') === 'on',
        delivery_enabled: form.get('delivery_enabled') === 'on',
      });
      setBranch(updated);
      setNotice('Branch information saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save branch information.');
    } finally {
      setSaving(false);
    }
  };

  const addManager = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await createFranchiseManager(id, managerForm);
      setManagerForm({ full_name: '', email: '', phone: '', password: '', can_process_pos: false });
      setShowAddManager(false);
      setNotice('Branch manager account created.');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create branch manager.');
    } finally {
      setSaving(false);
    }
  };

  const setManagerStatus = async (user: FranchiseAdminUser) => {
    setError('');
    setNotice('');
    try {
      await toggleFranchiseManager(id, user.id, !user.is_active);
      setNotice(`Manager account ${user.is_active ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update manager status.');
    }
  };

  const setManagerPosPermission = async (user: FranchiseAdminUser) => {
    setError('');
    setNotice('');
    try {
      await updateFranchiseManager(id, user.id, { can_process_pos: !user.can_process_pos });
      setNotice(`Manager POS permission ${user.can_process_pos ? 'disabled' : 'enabled'}.`);
      await load();
    } catch (permissionError) {
      setError(permissionError instanceof Error ? permissionError.message : 'Could not update POS permission.');
    }
  };

  const summary = overview?.summary ?? {};
  const inventory = overview?.inventory ?? {};
  const fulfillment = overview?.fulfillment ?? {};
  const users = overview?.users ?? [];

  return (
    <AdminLayout>
      <div className="mb-5">
        <Link to="/admin/franchises" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--oppa-green)] hover:underline"><ArrowLeft size={16} /> Franchise list</Link>
      </div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
      {loading ? (
        <div className="rounded-2xl border bg-white p-12 text-center text-sm text-gray-500"><Loader2 className="mx-auto mb-3 animate-spin" />Loading branch details...</div>
      ) : branch && (
        <>
          <header className="mb-5 flex flex-col gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green-soft)] p-3 text-[var(--oppa-green)]"><Building2 size={22} /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Branch details</p><h1 className="text-2xl font-semibold">{branch.name}</h1><p className="text-sm text-gray-500">{branch.id} · {branch.address || 'No address'}</p></div></div>
            <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${branch.status === 'active' ? 'bg-green-100 text-green-800' : branch.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{branch.status}</span>
          </header>
          <div role="tablist" aria-label="Branch management sections" className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--oppa-border)] bg-white px-2">
            {tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => { setTab(item.id); setSearchParams(item.id === 'overview' ? {} : { tab: item.id }, { replace: true }); }} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === item.id ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)]/50 text-[var(--oppa-green-dark)]' : 'border-transparent text-gray-600 hover:border-gray-300 hover:bg-[var(--oppa-cream)]'}`}>{item.label}</button>)}
          </div>

          {tab === 'overview' && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Orders" value={Number(summary.total_orders ?? 0)} />
            <Metric label="Branch revenue" value={money.format(Number(summary.total_revenue ?? 0))} />
            <Metric label="Branch products" value={Number(inventory.total_products ?? 0)} />
            <Metric label="Manager accounts" value={Number(summary.total_users ?? users.length)} />
            <Panel title="Order fulfillment" className="sm:col-span-2">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[['Pending', fulfillment.pending_orders], ['Preparing', fulfillment.preparing_orders], ['Ready', fulfillment.ready_orders], ['Completed', fulfillment.delivered_orders], ['Cancelled', fulfillment.cancelled_orders]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-[var(--oppa-cream)] p-3"><p className="text-xs text-gray-500">{String(label)}</p><p className="mt-1 text-lg font-semibold">{String(value ?? 0)}</p></div>)}</div>
            </Panel>
            <Panel title="Branch information" className="sm:col-span-2">
              <dl className="grid gap-3 sm:grid-cols-2"><Info label="Email" value={branch.email} /><Info label="Phone" value={branch.phone} /><Info label="Address" value={branch.address} /><Info label="Status" value={branch.status} /></dl>
              <button onClick={() => setTab('settings')} className="mt-4 text-sm font-semibold text-[var(--oppa-green)] hover:underline">Edit branch info</button>
            </Panel>
          </div>}

          {tab === 'orders' && <Panel title="Latest branch orders">
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[var(--oppa-cream)] text-gray-600"><tr>{['Order', 'Status', 'Amount', 'Address / type', 'Date'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{(fulfillment.latest_orders as Array<Record<string, unknown>> ?? []).map((order) => <tr key={String(order.id)} className="border-t"><td className="px-4 py-3 font-medium">{String(order.order_number || `#${order.id}`)}</td><td className="px-4 py-3 capitalize">{String(order.status || 'pending')}</td><td className="px-4 py-3">{money.format(Number(order.total || 0))}</td><td className="px-4 py-3">{String(order.delivery_address || '—')}</td><td className="px-4 py-3">{order.created_at ? new Date(String(order.created_at)).toLocaleString() : '—'}</td></tr>)}</tbody></table></div>
              {!(fulfillment.latest_orders as unknown[] | undefined)?.length && <p className="p-6 text-center text-sm text-gray-500">No branch orders yet.</p>}
              <p className="mt-3 text-xs text-gray-500">Showing the latest 10 orders from this branch.</p>
          </Panel>}

          {tab === 'inventory' && <Panel title="Branch inventory overview">
            <div className="mb-4 grid gap-3 sm:grid-cols-3"><Metric label="Branch products" value={Number(inventory.total_products ?? 0)} /><Metric label="Available" value={Number(inventory.available_products ?? 0)} /><Metric label="Unavailable" value={Number(inventory.unavailable_products ?? 0)} /></div>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[var(--oppa-cream)] text-gray-600"><tr>{['Product', 'Category', 'Price', 'Availability'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{(inventory.recent_products as Array<Record<string, unknown>> ?? []).map((product) => <tr key={String(product.id)} className="border-t"><td className="px-4 py-3 font-medium">{String(product.name)}</td><td className="px-4 py-3">{String(product.category || '—')}</td><td className="px-4 py-3">{money.format(Number(product.price || 0))}</td><td className="px-4 py-3 capitalize">{product.is_available ? 'Available' : 'Unavailable'}</td></tr>)}</tbody></table></div>
          </Panel>}

          {tab === 'users' && <Panel title="Branch manager accounts">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-500">These accounts access the branch portal. POS permission is off by default; cashiers should use staff accounts instead.</p><button onClick={() => setShowAddManager(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]"><Plus size={16} /> Add manager</button></div>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[var(--oppa-cream)] text-gray-600"><tr>{['Name', 'Email', 'Phone', 'Status', 'POS permission', 'Action'].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{users.map((user) => <tr key={String(user.id)} className="border-t"><td className="px-4 py-3 font-medium">{user.full_name}</td><td className="px-4 py-3">{user.email}</td><td className="px-4 py-3">{user.phone || '—'}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs capitalize ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td><td className="px-4 py-3"><button onClick={() => void setManagerPosPermission(user)} className="font-medium text-[var(--oppa-green)] hover:underline">{user.can_process_pos ? 'Enabled' : 'Disabled'}</button></td><td className="px-4 py-3"><button onClick={() => void setManagerStatus(user)} className="font-medium text-[var(--oppa-green)] hover:underline">{user.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>
            {!users.length && <p className="p-6 text-center text-sm text-gray-500">No manager accounts found.</p>}
          </Panel>}

          {tab === 'reports' && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total orders" value={Number(summary.total_orders ?? 0)} />
            <Metric label="Revenue (non-cancelled)" value={money.format(Number(summary.total_revenue ?? 0))} />
            <Metric label="Average order value" value={money.format(Number(summary.average_order_value ?? 0))} />
            <Metric label="Products" value={Number(inventory.total_products ?? 0)} />
            <Panel title="Order status breakdown" className="sm:col-span-2 xl:col-span-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries((summary.status_breakdown || {}) as Record<string, number>).map(([status, count]) => <div key={status} className="flex items-center justify-between rounded-xl bg-[var(--oppa-cream)] p-4"><span className="capitalize text-gray-600">{status}</span><span className="font-semibold">{String(count)}</span></div>)}</div>
              {!Object.keys((summary.status_breakdown || {}) as object).length && <p className="text-sm text-gray-500">No report data is available yet.</p>}
            </Panel>
          </div>}

          {tab === 'settings' && <Panel title="Edit branch information">
            <form onSubmit={saveBranch} className="grid gap-4 sm:grid-cols-2">
              <Field label="Branch name" name="name" defaultValue={branch.name} required />
              <Field label="Contact email" name="email" type="email" defaultValue={branch.email || ''} />
              <Field label="Phone" name="phone" defaultValue={branch.phone || ''} />
              <label className="text-sm font-medium text-gray-700">Status<select name="status" defaultValue={branch.status || 'active'} className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-normal"><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select></label>
              <label className="text-sm font-medium text-gray-700 sm:col-span-2">Address<textarea name="address" value={branchAddress} onChange={(event) => setBranchAddress(event.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>
              <div className="sm:col-span-2 rounded-xl border border-[var(--oppa-border)] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Branch delivery location</h3><p className="text-xs text-gray-500">A verified map pin in the Philippines is required to enable delivery.</p></div><button type="button" onClick={() => setShowBranchLocationPicker(true)} className="inline-flex items-center gap-2 rounded-lg border border-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green)]"><MapPin size={15} />Pin on map</button></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700">Latitude<input name="latitude" type="number" min="4" max="22" step="any" required={branch.is_active !== false && branch.delivery_enabled !== false} value={branchCoordinates.latitude} onChange={(event) => setBranchCoordinates((current) => ({ ...current, latitude: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>
                  <label className="text-sm font-medium text-gray-700">Longitude<input name="longitude" type="number" min="116" max="127" step="any" required={branch.is_active !== false && branch.delivery_enabled !== false} value={branchCoordinates.longitude} onChange={(event) => setBranchCoordinates((current) => ({ ...current, longitude: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>
                </div>
              </div>
              <Field label="Delivery radius (km)" name="delivery_radius_km" type="number" defaultValue={branch.delivery_radius_km == null ? '' : String(branch.delivery_radius_km)} />
              <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={branch.is_active !== false} />Active</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="accepts_online_orders" defaultChecked={branch.accepts_online_orders !== false} />Accepts online orders</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="delivery_enabled" defaultChecked={branch.delivery_enabled !== false} />Delivery enabled</label>
              </div>
              <div className="sm:col-span-2"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Saving…' : 'Save branch info'}</button></div>
            </form>
          </Panel>}
        </>
      )}
      {showAddManager && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAddManager(false); }}>
        <form onSubmit={addManager} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green-soft)] p-2 text-[var(--oppa-green)]"><Users size={20} /></span><div><h2 className="text-lg font-semibold">Add branch manager</h2><p className="text-sm text-gray-500">Creates a portal account assigned to this branch.</p></div></div>
          <div className="space-y-3"><Field label="Full name" value={managerForm.full_name} onChange={(value) => setManagerForm({ ...managerForm, full_name: value })} required /><Field label="Email" type="email" value={managerForm.email} onChange={(value) => setManagerForm({ ...managerForm, email: value })} required /><Field label="Phone" value={managerForm.phone} onChange={(value) => setManagerForm({ ...managerForm, phone: value })} /><Field label="Initial password" type="password" value={managerForm.password} onChange={(value) => setManagerForm({ ...managerForm, password: value })} minLength={8} required /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={managerForm.can_process_pos} onChange={(event) => setManagerForm({ ...managerForm, can_process_pos: event.target.checked })} />Allow this manager to process branch POS orders</label></div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowAddManager(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create account'}</button></div>
        </form>
      </div>}
      {showBranchLocationPicker && branch && <LocationPicker
        initialLat={Number(branchCoordinates.latitude) || undefined}
        initialLng={Number(branchCoordinates.longitude) || undefined}
        initialAddress={branch.address || ''}
        onClose={() => setShowBranchLocationPicker(false)}
        onSelectLocation={(location) => {
          setBranchCoordinates({ latitude: String(location.lat), longitude: String(location.lng) });
          setBranchAddress(location.address);
          setShowBranchLocationPicker(false);
          setNotice(`Map pin selected: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}. Save branch information to apply it.`);
        }}
      />}
    </AdminLayout>
  );
};

const Panel: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => <section className={`rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm ${className}`}><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>;
const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>;
const Info: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => <div><dt className="text-xs uppercase tracking-wider text-gray-500">{label}</dt><dd className="mt-1 text-sm">{value || 'Not provided'}</dd></div>;
const Field: React.FC<{ label: string; name?: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; type?: string; required?: boolean; minLength?: number }> = ({ label, name, value, defaultValue, onChange, type = 'text', required, minLength }) => <label className="block text-sm font-medium text-gray-700">{label}<input name={name} type={type} value={value} defaultValue={defaultValue} onChange={onChange ? (event) => onChange(event.target.value) : undefined} required={required} minLength={minLength} className="mt-1.5 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>;

export default AdminFranchiseDetailPage;

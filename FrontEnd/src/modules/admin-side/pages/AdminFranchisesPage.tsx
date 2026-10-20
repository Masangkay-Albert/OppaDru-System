import React, { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, CheckCircle2, DollarSign, Loader2, MapPin, Phone, Plus, Search, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { createFranchiseAccount, getFranchiseAccounts, updateFranchiseAccount } from '../../../services/franchiseAdminService';
import type { FranchiseAccount, FranchiseSummary } from '../../../services/franchiseAdminService';
import { formatCurrency } from '../../../utils/formatters';

const AdminFranchisesPage: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<FranchiseAccount[]>([]);
  const [mainBranch, setMainBranch] = useState<FranchiseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const dashboard = await getFranchiseAccounts();
      setAccounts(dashboard.accounts);
      setMainBranch(dashboard.main_branch || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load franchises.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void Promise.resolve().then(load); }, []);

  const filteredAccounts = useMemo(() => accounts.filter((account) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      account.name,
      account.email,
      account.address,
      account.id,
      ...(account.locations || []).map((location) => location.name),
    ].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'all' || account.status === statusFilter);
  }), [accounts, search, statusFilter]);
  const showMainBranch = Boolean(mainBranch
    && (statusFilter === 'all' || mainBranch.status === statusFilter)
    && [mainBranch.name, mainBranch.address, mainBranch.id]
      .some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const account = await createFranchiseAccount({
        name: String(form.get('name') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        address: String(form.get('address') || ''),
        status: String(form.get('status') || 'active'),
      });
      setShowCreate(false);
      navigate(`/admin/franchise-accounts/${account.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create franchise.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (account: FranchiseAccount) => {
    setWorkingId(account.id);
    setError('');
    try {
      await updateFranchiseAccount(account.id, { status: account.status === 'active' ? 'inactive' : 'active' });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update franchise status.');
    } finally {
      setWorkingId(null);
    }
  };

  const activeCount = accounts.filter((account) => account.status === 'active').length;
  const locationCount = accounts.reduce((sum, account) => sum + Number(account.locations_count || 0), 0);
  const managerCount = accounts.reduce((sum, account) => sum + Number(account.managers_count || 0), 0);
  const salesTotal = accounts.reduce((sum, account) => sum + Number(account.total_sales || 0), 0);

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Franchise Management</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Manage franchise accounts, their locations, managers, and performance.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]"><Plus size={16} /> Add Franchise</button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Franchises" value={accounts.length} icon={Building2} />
        <MetricCard label="Active franchises" value={activeCount} icon={CheckCircle2} tone="success" />
        <MetricCard label="Locations" value={locationCount} icon={MapPin} />
        <MetricCard label="Franchise sales" value={formatCurrency(salesTotal)} icon={DollarSign} tone="success" />
        <MetricCard label="Managers" value={managerCount} icon={Users} tone="warning" />
      </div>

      {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => void load()} className="font-semibold underline">Retry</button></div>}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-3 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search franchise or location..." className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm" /></label>
        <select aria-label="Filter franchises by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm sm:min-w-40"><option value="all">All status</option><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm"><Loader2 className="mx-auto size-6 animate-spin text-[var(--oppa-green)]" /><p className="mt-3">Loading franchises...</p></div>
      ) : filteredAccounts.length === 0 && !showMainBranch ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm"><Building2 className="mx-auto h-12 w-12 text-[var(--oppa-text-muted)]/30" /><p className="mt-2">{accounts.length ? 'No franchises match your search.' : 'No franchises found yet.'}</p></div>
      ) : (
        <div className="space-y-3">
          {showMainBranch && mainBranch && (
            <article className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]"><Building2 size={27} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-[var(--oppa-text)]">{mainBranch.name}</h2><span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-800">Main</span><Status status={mainBranch.status || 'active'} /></div>
                  <p className="mt-0.5 break-words text-xs text-[var(--oppa-text-muted)]">{mainBranch.address || 'No address'} · ID: {mainBranch.id}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600"><span>Latitude: {mainBranch.latitude ?? 'Not set'}</span><span>Longitude: {mainBranch.longitude ?? 'Not set'}</span><span>Delivery radius: {mainBranch.delivery_radius_km ?? 'Not set'} km</span></div>
                </div>
                <Link to={`/admin/franchises/${mainBranch.id}`} className="w-fit rounded-lg border border-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]">View details</Link>
              </div>
            </article>
          )}
          {filteredAccounts.map((account) => (
            <article key={account.id} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]"><Building2 size={27} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-[var(--oppa-text)]">{account.name}</h2><Status status={account.status} /></div>
                  <p className="mt-0.5 truncate text-xs text-[var(--oppa-text-muted)]">{account.email || 'No email provided'} · ID: {account.id}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600"><span className="inline-flex items-center gap-1.5"><Phone size={13} />{account.phone || 'No phone'}</span><span className="inline-flex items-center gap-1.5"><MapPin size={13} />{account.locations_count ?? account.locations?.length ?? 0} locations</span><span className="inline-flex items-center gap-1.5"><Users size={13} />{account.managers_count ?? 0} managers</span></div>
                  {account.locations?.length ? <p className="mt-2 truncate text-xs text-gray-500">Locations: {account.locations.map((location) => location.name).join(', ')}</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/franchise-accounts/${account.id}`} className="rounded-lg border border-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]">View details</Link>
                  <button onClick={() => void toggleStatus(account)} disabled={workingId === account.id} className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${account.status === 'active' ? 'border border-red-200 text-red-700 hover:bg-red-50' : 'bg-[var(--oppa-green)] text-white hover:bg-[var(--oppa-green-dark)]'}`}>
                    {workingId === account.id ? 'Saving…' : account.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
        <form onSubmit={handleCreate} className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
          <div><h2 className="text-xl font-semibold">Add franchise</h2><p className="mt-1 text-sm text-gray-500">Create the franchise account first, then assign locations and managers.</p></div>
          <label className="block text-sm font-medium">Franchise name<input name="name" required maxLength={255} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Email<input name="email" type="email" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="text-sm font-medium">Phone<input name="phone" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label></div>
          <label className="block text-sm font-medium">Head office address<textarea name="address" rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
          <label className="block text-sm font-medium">Status<select name="status" defaultValue="active" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select></label>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create franchise'}</button></div>
        </form>
      </div>}
    </AdminLayout>
  );
};

const Status: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${status === 'active' ? 'bg-green-100 text-green-700' : status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{status}</span>
);

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone?: 'default' | 'success' | 'warning';
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon: Icon, tone = 'default' }) => {
  const palette = {
    default: 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
  };

  return <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm"><span className={`inline-flex rounded-xl p-2 ${palette[tone]}`}><Icon size={18} /></span><div className="mt-3 text-2xl font-semibold text-[var(--oppa-text)]">{value}</div><div className="mt-1 text-sm text-[var(--oppa-text-muted)]">{label}</div></div>;
};

export default AdminFranchisesPage;

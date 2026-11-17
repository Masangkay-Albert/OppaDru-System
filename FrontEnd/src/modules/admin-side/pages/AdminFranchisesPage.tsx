import React, { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, CheckCircle2, Loader2, MapPin, Phone, Plus, Trash2, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { ConfirmDialog } from '../components/AdminUI';
import Select from '../../../components/ui/Select';
import SearchInput from '../../../components/ui/SearchInput';
import { createFranchiseAccount, deleteFranchise, deleteFranchiseAccount, getFranchiseAccounts, updateFranchise, updateFranchiseAccount } from '../../../services/franchiseAdminService';
import type { FranchiseAccount, FranchiseSummary } from '../../../services/franchiseAdminService';
import { formatCurrency } from '../../../utils/formatters';
import { useToast } from '../../customer-side/components/ToastProvider';
import { ValidatedForm } from '../../../components/ui/FormValidation';
import CreateCompanyBranchModal from '../components/CreateCompanyBranchModal';

const PesoSign: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <span
    aria-hidden="true"
    className="inline-flex items-center justify-center font-sans font-bold leading-none"
    style={{ width: size, height: size, fontSize: size }}
  >
    ₱
  </span>
);

const AdminFranchisesPage: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<FranchiseAccount[]>([]);
  const [companyBranches, setCompanyBranches] = useState<Array<FranchiseSummary & { users_count?: number }>>([]);
  const [mainBranch, setMainBranch] = useState<FranchiseSummary | null>(null);
  const [branchCounts, setBranchCounts] = useState<{ total: number; company_owned: number; franchise: number; active: number; managers: number; sales: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'company' | 'franchise'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<FranchiseAccount | null>(null);
  const [companyBranchToDelete, setCompanyBranchToDelete] = useState<FranchiseSummary | null>(null);
  const [mainBranchToDelete, setMainBranchToDelete] = useState<FranchiseSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingCompanyBranch, setDeletingCompanyBranch] = useState(false);
  const [deletingMainBranch, setDeletingMainBranch] = useState(false);
  const { showToast } = useToast();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const dashboard = await getFranchiseAccounts();
      setAccounts(dashboard.accounts);
      setCompanyBranches(dashboard.company_branches || []);
      setMainBranch(dashboard.main_branch || null);
      setBranchCounts(dashboard.branch_counts || null);
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
    return matchesSearch
      && (statusFilter === 'all' || account.status === statusFilter)
      && (typeFilter === 'all' || typeFilter === 'franchise');
  }), [accounts, search, statusFilter, typeFilter]);
  const filteredCompanyBranches = useMemo(() => companyBranches.filter((branch) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [
      branch.name,
      branch.email,
      branch.phone,
      branch.address,
      branch.id,
    ].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesSearch
      && (statusFilter === 'all' || branch.status === statusFilter)
      && (typeFilter === 'all' || typeFilter === 'company');
  }), [companyBranches, search, statusFilter, typeFilter]);
  const showMainBranch = Boolean(mainBranch
    && (statusFilter === 'all' || mainBranch.status === statusFilter)
    && (typeFilter === 'all' || typeFilter === 'company')
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

  const toggleCompanyBranchStatus = async (branch: FranchiseSummary) => {
    setWorkingId(String(branch.id));
    setError('');
    const activate = branch.status !== 'active';
    try {
      await updateFranchise(branch.id, {
        status: activate ? 'active' : 'inactive',
        is_active: activate,
        ...(activate ? { accepts_online_orders: true, delivery_enabled: true } : {}),
      });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update branch status.');
    } finally {
      setWorkingId(null);
    }
  };

  const removeCompanyBranch = async () => {
    if (!companyBranchToDelete) return;
    setDeletingCompanyBranch(true);
    try {
      await deleteFranchise(companyBranchToDelete.id);
      showToast(`${companyBranchToDelete.name} was permanently deleted.`, 'success');
      setCompanyBranchToDelete(null);
      await load();
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Unable to delete branch.', 'error');
    } finally {
      setDeletingCompanyBranch(false);
    }
  };

  const removeAccount = async () => {
    if (!accountToDelete) return;
    setDeleting(true);
    try {
      await deleteFranchiseAccount(accountToDelete.id);
      setAccounts((current) => current.filter((account) => account.id !== accountToDelete.id));
      showToast(`${accountToDelete.name} was permanently deleted.`, 'success');
      setAccountToDelete(null);
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Unable to delete franchise.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const removeMainBranch = async () => {
    if (!mainBranchToDelete) return;
    setDeletingMainBranch(true);
    try {
      await deleteFranchise(mainBranchToDelete.id);
      showToast(`${mainBranchToDelete.name} was permanently deleted.`, 'success');
      setMainBranchToDelete(null);
      await load();
    } catch (deleteError) {
      showToast(deleteError instanceof Error ? deleteError.message : 'Unable to delete branch.', 'error');
    } finally {
      setDeletingMainBranch(false);
    }
  };

  const locationCount = accounts.reduce((sum, account) => sum + Number(account.locations_count || 0), 0) + companyBranches.length;
  const totalBranchCount = branchCounts?.total ?? locationCount + (mainBranch ? 1 : 0);
  const companyBranchCount = branchCounts?.company_owned ?? companyBranches.length + (mainBranch?.type === 'company' ? 1 : 0);
  const franchiseBranchCount = branchCounts?.franchise ?? locationCount - companyBranches.length;
  const activeCount = branchCounts?.active ?? accounts.filter((account) => account.status === 'active').length + companyBranches.filter((branch) => branch.status === 'active').length + (mainBranch?.status === 'active' ? 1 : 0);
  const managerCount = branchCounts?.managers ?? accounts.reduce((sum, account) => sum + Number(account.managers_count || 0), 0) + companyBranches.reduce((sum, branch) => sum + Number(branch.users_count || 0), 0);
  const salesTotal = branchCounts?.sales ?? accounts.reduce((sum, account) => sum + Number(account.total_sales || 0), 0);

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Franchise Management</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Manage franchise accounts, company-owned branches, locations, managers, and performance.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowAddBranch(true)} className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-green)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]"><Plus size={16} /> Add Branch</button>
        </div>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total branches" value={totalBranchCount} hint={`${companyBranchCount} company-owned · ${franchiseBranchCount} franchise`} icon={Building2} />
        <MetricCard label="Active branches" value={activeCount} icon={CheckCircle2} tone="success" />
        <MetricCard label="Locations" value={locationCount} icon={MapPin} />
        <MetricCard label="Branch sales" value={formatCurrency(salesTotal)} icon={PesoSign} tone="success" />
        <MetricCard label="Managers" value={managerCount} icon={Users} tone="warning" />
      </div>

      {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => void load()} className="font-semibold underline">Retry</button></div>}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-3 sm:flex-row">
        <SearchInput aria-label="Search branches by name or location" value={search} onChange={setSearch} placeholder="Search branch or location..." wrapperClassName="flex-1" />
        <Select<string> aria-label="Filter branches by status" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All status' }, { value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }, { value: 'inactive', label: 'Inactive' }]} className="sm:min-w-40" />
        <Select<string> aria-label="Filter branches by type" value={typeFilter} onChange={(value) => setTypeFilter(value as 'all' | 'company' | 'franchise')} options={[{ value: 'all', label: 'All types' }, { value: 'company', label: 'Company-owned' }, { value: 'franchise', label: 'Franchise' }]} className="sm:min-w-44" />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm"><Loader2 className="mx-auto size-6 animate-spin text-[var(--oppa-green)]" /><p className="mt-3">Loading branches...</p></div>
      ) : filteredAccounts.length === 0 && filteredCompanyBranches.length === 0 && !showMainBranch ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm"><Building2 className="mx-auto h-12 w-12 text-[var(--oppa-text-muted)]/30" /><p className="mt-2">{accounts.length || companyBranches.length || mainBranch ? 'No branches match your search.' : 'No branches found yet.'}</p></div>
      ) : (
        <div className="space-y-3">
          {showMainBranch && mainBranch && (
            <article className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]"><Building2 size={27} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-[var(--oppa-text)]">{mainBranch.name}</h2><span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-800">Main</span><Status status={mainBranch.status || 'active'} /></div>
                  <p className="mt-0.5 break-words text-xs text-[var(--oppa-text-muted)]">{mainBranch.address || 'No address'} · ID: {mainBranch.id}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600"><span>Delivery radius: {mainBranch.delivery_radius_km ?? 'Not set'} km</span></div>
                </div>
                <div className="flex shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={() => setMainBranchToDelete(mainBranch)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </article>
          )}
          {filteredCompanyBranches.map((branch) => (
            <article key={String(branch.id)} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]"><Building2 size={27} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-[var(--oppa-text)]">{branch.name}</h2>
                    <span className="rounded-full border border-[var(--oppa-green)]/20 bg-[var(--oppa-green-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--oppa-green-dark)]">Company-owned</span>
                    <Status status={branch.status || 'inactive'} />
                  </div>
                  <p className="mt-0.5 break-words text-xs text-[var(--oppa-text-muted)]">{branch.address || 'No address'} · ID: {branch.id}</p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1.5"><Phone size={13} />{branch.phone || 'No phone'}</span>
                    <span>Delivery radius: {branch.delivery_radius_km ?? 'Not set'} km</span>
                    <span className="inline-flex items-center gap-1.5"><Users size={13} />{branch.users_count ?? 0} managers</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/admin/franchises/${branch.id}`} className="rounded-lg border border-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]">View details</Link>
                  <button type="button" onClick={() => void toggleCompanyBranchStatus(branch)} disabled={workingId === String(branch.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${branch.status === 'active' ? 'border border-red-200 text-red-700 hover:bg-red-50' : 'bg-[var(--oppa-green)] text-white hover:bg-[var(--oppa-green-dark)]'}`}>
                    {workingId === String(branch.id) ? 'Saving…' : branch.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompanyBranchToDelete(branch)}
                    disabled={Boolean(branch.users_count)}
                    title={branch.users_count ? 'Branches with managers or other linked records cannot be deleted.' : 'Permanently delete branch'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
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
                  <button
                    type="button"
                    onClick={() => setAccountToDelete(account)}
                    disabled={Boolean(account.locations_count || account.managers_count)}
                    title={account.locations_count || account.managers_count ? 'Only franchises without locations or managers can be permanently deleted.' : 'Permanently delete franchise'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
        <ValidatedForm onSubmit={handleCreate} className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
          <div><h2 className="text-xl font-semibold">Add franchise</h2><p className="mt-1 text-sm text-gray-500">Create the franchise account first, then assign locations and managers.</p></div>
          <label className="block text-sm font-medium">Franchise name<input name="name" data-required="true" maxLength={255} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Email<input name="email" type="email" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="text-sm font-medium">Phone<input name="phone" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label></div>
          <label className="block text-sm font-medium">Head office address<textarea name="address" rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
          <Select label="Status" name="status" defaultValue="active" options={[{ value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }, { value: 'inactive', label: 'Inactive' }]} />
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create franchise'}</button></div>
        </ValidatedForm>
      </div>}
      {showAddBranch && <CreateCompanyBranchModal
        onClose={() => setShowAddBranch(false)}
        onCreated={(branch) => {
          setShowAddBranch(false);
          showToast(`${branch.name} created. Branch ID: ${branch.id}.`, 'success');
          void load();
        }}
      />}
      {accountToDelete && <ConfirmDialog
        title="Permanently delete franchise?"
        description={`Delete “${accountToDelete.name}” (${accountToDelete.id})? This cannot be undone. Franchises with linked locations, managers, orders, or applications cannot be deleted.`}
        confirmLabel="Delete franchise"
        onConfirm={() => { void removeAccount(); }}
        onCancel={() => { if (!deleting) setAccountToDelete(null); }}
        busy={deleting}
      />}
      {companyBranchToDelete && <ConfirmDialog
        title="Permanently delete branch?"
        description={`Delete “${companyBranchToDelete.name}” (${companyBranchToDelete.id})? This cannot be undone. Branches with linked orders, staff, inventory, products, or managers cannot be deleted.`}
        confirmLabel="Delete branch"
        onConfirm={() => { void removeCompanyBranch(); }}
        onCancel={() => { if (!deletingCompanyBranch) setCompanyBranchToDelete(null); }}
        busy={deletingCompanyBranch}
      />}
      {mainBranchToDelete && <ConfirmDialog
        title="Permanently delete Main Branch?"
        description={`Delete “${mainBranchToDelete.name}” (${mainBranchToDelete.id})? The oldest remaining branch will become the Main Branch. This branch can only be deleted if it has no linked orders, staff, inventory, products, or applications.`}
        confirmLabel="Delete Main Branch"
        onConfirm={() => { void removeMainBranch(); }}
        onCancel={() => { if (!deletingMainBranch) setMainBranchToDelete(null); }}
        busy={deletingMainBranch}
      />}
    </AdminLayout>
  );
};

const Status: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${status === 'active' ? 'bg-green-100 text-green-700' : status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{status}</span>
);

interface MetricCardProps {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ElementType;
  tone?: 'default' | 'success' | 'warning';
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, hint, icon: Icon, tone = 'default' }) => {
  const palette = {
    default: 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
  };

  return <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm"><span className={`inline-flex rounded-xl p-2 ${palette[tone]}`}><Icon size={18} /></span><div className="mt-3 text-2xl font-semibold text-[var(--oppa-text)]">{value}</div><div className="mt-1 text-sm text-[var(--oppa-text-muted)]">{label}</div>{hint && <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{hint}</p>}</div>;
};

export default AdminFranchisesPage;

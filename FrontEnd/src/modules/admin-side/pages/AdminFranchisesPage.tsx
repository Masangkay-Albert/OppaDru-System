import React, { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Building2, CheckCircle2, CircleDashed, Loader2, MapPin, Phone, Plus, Search, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { createFranchise, getFranchiseStats, getFranchises } from '../../../services/franchiseAdminService';
import type { FranchiseSummary } from '../../../services/franchiseAdminService';

const AdminFranchisesPage: React.FC = () => {
  const navigate = useNavigate();
  const [franchises, setFranchises] = useState<FranchiseSummary[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [franchiseData, statsData] = await Promise.all([
        getFranchises(),
        getFranchiseStats(),
      ]);
      setFranchises(franchiseData);
      setStats(statsData);
    } catch {
      setError('Unable to load franchise branches. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  const statusTone = (status?: string) => {
    if (status === 'active') return 'bg-green-100 text-green-700';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };
  const filteredFranchises = useMemo(() => franchises.filter((franchise) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [franchise.name, franchise.email, franchise.address, franchise.id].some((value) => String(value || '').toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'all' || franchise.status === statusFilter);
  }), [franchises, search, statusFilter]);
  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const branch = await createFranchise({
        name: String(form.get('name') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        address: String(form.get('address') || ''),
        status: String(form.get('status') || 'active'),
      });
      setShowCreate(false);
      await load();
      navigate(`/admin/franchises/${branch.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create franchise branch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Franchise Management</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Search, add, and manage franchise branches.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--oppa-green-soft)] px-3 py-1.5 text-sm font-medium text-[var(--oppa-text)]">
          <Building2 size={16} className="text-[var(--oppa-green)]" />
          {stats.active_franchises ?? 0} active branches
        </div>
        <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]"><Plus size={16} /> Add Franchise</button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Total franchises" value={stats.total_franchises ?? 0} icon={Building2} />
        <MetricCard label="Active" value={stats.active_franchises ?? 0} icon={CheckCircle2} tone="success" />
        <MetricCard label="Pending" value={stats.pending_franchises ?? 0} icon={CircleDashed} tone="warning" />
        <MetricCard label="Users" value={stats.total_franchise_users ?? 0} icon={Users} />
      </div>

      {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => void load()} className="font-semibold underline">Retry</button></div>}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-4 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search branch name, email, address, or ID" className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm" /></label>
        <select aria-label="Filter branches by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <Loader2 className="mx-auto size-6 animate-spin text-[var(--oppa-green)]" />
          <p className="mt-3">Loading franchises...</p>
        </div>
      ) : filteredFranchises.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <Building2 className="mx-auto h-12 w-12 text-[var(--oppa-text-muted)]/30" />
          <p className="mt-2">{franchises.length ? 'No branches match your search.' : 'No franchises found yet.'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFranchises.map((franchise) => (
            <div key={String(franchise.id)} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--oppa-text)]">{franchise.name}</h2>
                  <p className="text-sm text-[var(--oppa-text-muted)]">{franchise.email || 'No email provided'}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusTone(franchise.status)}`}>
                  {franchise.status || 'active'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <MetaItem icon={Phone} label="Phone" value={franchise.phone || 'N/A'} />
                <MetaItem icon={MapPin} label="Address" value={franchise.address || 'N/A'} />
                <MetaItem icon={Users} label="Branch ID" value={String(franchise.id)} />
              </div>
              <div className="mt-4 flex justify-end border-t border-[var(--oppa-border)] pt-4">
                <Link to={`/admin/franchises/${franchise.id}`} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">View / Manage</Link>
              </div>
            </div>
          ))}
        </div>
      )}
      {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowCreate(false); }}>
        <form onSubmit={handleCreate} className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
          <div><h2 className="text-xl font-semibold">Add franchise branch</h2><p className="mt-1 text-sm text-gray-500">Create the branch record, then add its manager from the Users tab.</p></div>
          <label className="block text-sm font-medium">Branch name<input name="name" required maxLength={255} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Email<input name="email" type="email" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="text-sm font-medium">Phone<input name="phone" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label></div>
          <label className="block text-sm font-medium">Address<textarea name="address" rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
          <label className="block text-sm font-medium">Status<select name="status" defaultValue="active" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select></label>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create branch'}</button></div>
        </form>
      </div>}
    </AdminLayout>
  );
};

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

  return (
    <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className={`inline-flex rounded-xl p-2 ${palette[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="text-2xl font-semibold text-[var(--oppa-text)]">{value}</div>
      <div className="mt-1 text-sm text-[var(--oppa-text-muted)]">{label}</div>
    </div>
  );
};

interface MetaItemProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

const MetaItem: React.FC<MetaItemProps> = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl bg-[var(--oppa-cream)] p-3">
    <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-[var(--oppa-text-muted)]">
      <Icon size={14} /> {label}
    </div>
    <div className="text-sm font-medium text-[var(--oppa-text)]">{value}</div>
  </div>
);

export default AdminFranchisesPage;

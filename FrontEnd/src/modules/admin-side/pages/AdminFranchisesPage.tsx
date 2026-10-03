import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, CircleDashed, Loader2, MapPin, Phone, Users } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getFranchiseStats, getFranchises } from '../../../services/franchiseAdminService';

interface FranchiseRow {
  id: string | number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  created_at?: string;
}

const AdminFranchisesPage: React.FC = () => {
  const [franchises, setFranchises] = useState<FranchiseRow[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [franchiseData, statsData] = await Promise.all([
        getFranchises(),
        getFranchiseStats(),
      ]);
      setFranchises(franchiseData);
      setStats(statsData);
    } catch {
      setFranchises([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const statusTone = (status?: string) => {
    if (status === 'active') return 'bg-green-100 text-green-700';
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Franchise Management</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Manage approved franchise branches and their status.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg bg-[var(--oppa-green-soft)] px-3 py-1.5 text-sm font-medium text-[var(--oppa-text)]">
          <Building2 size={16} className="text-[var(--oppa-green)]" />
          {franchises.length} active branches
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Total franchises" value={stats.total_franchises ?? 0} icon={Building2} />
        <MetricCard label="Active" value={stats.active_franchises ?? 0} icon={CheckCircle2} tone="success" />
        <MetricCard label="Pending" value={stats.pending_franchises ?? 0} icon={CircleDashed} tone="warning" />
        <MetricCard label="Users" value={stats.total_franchise_users ?? 0} icon={Users} />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <Loader2 className="mx-auto size-6 animate-spin text-[var(--oppa-green)]" />
          <p className="mt-3">Loading franchises...</p>
        </div>
      ) : franchises.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <Building2 className="mx-auto h-12 w-12 text-[var(--oppa-text-muted)]/30" />
          <p className="mt-2">No franchises found yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {franchises.map((franchise) => (
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
            </div>
          ))}
        </div>
      )}
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

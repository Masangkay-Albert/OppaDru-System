import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { getFranchiseApplications, type FranchiseApplication } from '../../../services/franchiseAdminService';
import { franchiseStatusLabel } from '../../../services/franchiseWorkflow';
import { FranchiseSkeleton, FranchiseStatusPill } from '../../franchise-side/components/FranchisePortalUI';
import InlineMessage from '../../shared/components/InlineMessage';
import '../../franchise-side/pages/FranchisePortalDesign.css';

const AdminFranchiseApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<FranchiseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    const refreshApplications = async () => {
      if (!active || requestInFlight || document.visibilityState === 'hidden') return;
      requestInFlight = true;
      try {
        const data = await getFranchiseApplications();
        if (active) {
          setApplications(data);
          setError('');
        }
      } catch (loadError: unknown) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load franchise applications.');
      } finally {
        requestInFlight = false;
        if (active) setLoading(false);
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshApplications();
    };

    void refreshApplications();
    const interval = window.setInterval(() => void refreshApplications(), 15000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const statuses = useMemo(() => [...new Set(applications.map((application) => application.status || 'pending'))], [applications]);
  const filtered = applications.filter((application) => {
    const matchesStatus = statusFilter === 'all' || (application.status || 'pending') === statusFilter;
    const haystack = `${application.reference_number || ''} ${application.contact_name} ${application.email} ${application.location || ''}`.toLowerCase();
    return matchesStatus && haystack.includes(search.toLowerCase().trim());
  });

  return (
    <AdminLayout>
      <div className="franchise-admin">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[var(--oppa-text)] sm:text-3xl">Franchise Applications</h1>
        <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Evaluate each applicant and proposed site through the full review process. Final approval activates the registered applicant’s dashboard after readiness checks pass or a documented override is approved. New applications appear automatically while this page is open.</p>
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input aria-label="Search applications" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicant, email, location, or reference" className="w-full rounded-xl border border-[var(--oppa-border)] bg-white py-2.5 pl-10 pr-3 text-sm" />
        </label>
        <select aria-label="Filter application status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-[var(--oppa-border)] bg-white px-3 py-2.5 text-sm">
          <option value="all">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{franchiseStatusLabel(status)}</option>)}
        </select>
      </div>
      {error && <InlineMessage variant="error" message={error} className="mb-4" />}

      {loading ? (
        <FranchiseSkeleton rows={3} />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center shadow-sm">
          <AlertCircle className="mx-auto size-10 text-[var(--oppa-text-muted)]/40" />
          <p className="mt-3 text-sm text-[var(--oppa-text-muted)]">{applications.length ? 'No applications match your filters.' : 'No franchise applications have been submitted yet.'}</p>
        </div>
      ) : (
        <div className="franchise-admin-card overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <div className="franchise-admin-table-head hidden grid-cols-[1.2fr_1fr_.8fr_1.2fr_.8fr_auto] gap-4 border-b border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)] lg:grid">
            <span>Applicant</span><span>Business / branch</span><span>Reference</span><span>Proposed location</span><span>Submitted</span><span>Status</span>
          </div>
          {filtered.map((application) => (
            <Link key={String(application.id)} to={`/admin/franchise-applications/${application.id}`} aria-label={`Review application from ${application.contact_name} for ${application.franchise_name}`} className="franchise-admin-row grid gap-2 border-b border-[var(--oppa-border)] px-5 py-4 last:border-b-0 focus-visible:bg-[var(--oppa-cream)]/60 lg:grid-cols-[1.2fr_1fr_.8fr_1.2fr_.8fr_auto] lg:items-center lg:gap-4">
              <span><strong className="block text-sm text-[var(--oppa-text)]">{application.contact_name}</strong><span className="text-xs text-[var(--oppa-text-muted)]">{application.email}</span></span>
              <span className="text-sm font-medium text-[var(--oppa-text)]">{application.franchise_name}</span>
              <span className="font-mono text-xs text-[var(--oppa-text-muted)]">{application.reference_number || 'Legacy application'}</span>
              <span className="text-sm text-[var(--oppa-text-muted)]">{application.location || 'Not provided'}</span>
              <span className="text-xs text-[var(--oppa-text-muted)]">{application.created_at ? new Date(application.created_at).toLocaleDateString() : '—'}</span>
              <FranchiseStatusPill status={application.status || 'pending'} label={franchiseStatusLabel(application.status)} compact />
            </Link>
          ))}
        </div>
      )}
      </div>
    </AdminLayout>
  );
};

export default AdminFranchiseApplicationsPage;

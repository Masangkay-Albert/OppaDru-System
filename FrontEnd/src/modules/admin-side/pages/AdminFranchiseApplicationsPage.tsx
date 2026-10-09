import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import {
  getFranchiseApplications,
  getFranchiseOpportunitySettings,
  updateFranchiseOpportunitySettings,
  type FranchiseApplication,
} from '../../../services/franchiseAdminService';

const statusLabel = (status?: string) => (status || 'pending').replaceAll('_', ' ');
const statusClass = (status?: string) => {
  if (status === 'rejected' || status === 'withdrawn') return 'bg-red-50 text-red-700';
  if (status === 'active' || status === 'approved_for_opening') return 'bg-green-50 text-green-700';
  if (status === 'conditionally_approved' || status === 'agreement_pending' || status === 'requirements_pending') return 'bg-blue-50 text-blue-700';
  if (status === 'on_hold') return 'bg-gray-100 text-gray-700';
  return 'bg-amber-50 text-amber-800';
};

const AdminFranchiseApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<FranchiseApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [investmentMinimum, setInvestmentMinimum] = useState('');
  const [investmentMaximum, setInvestmentMaximum] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    getFranchiseApplications()
      .then(setApplications)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load franchise applications.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getFranchiseOpportunitySettings()
      .then((settings) => {
        setInvestmentMinimum(settings.investment?.minimum || '');
        setInvestmentMaximum(settings.investment?.maximum || '');
      })
      .catch((loadError: unknown) => setSettingsError(loadError instanceof Error ? loadError.message : 'Unable to load investment settings.'));
  }, []);

  const saveOpportunitySettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsMessage('');
    try {
      await updateFranchiseOpportunitySettings({
        investment_minimum: investmentMinimum || null,
        investment_maximum: investmentMaximum || null,
      });
      setSettingsMessage('Public franchise investment estimates updated.');
    } catch (saveError) {
      setSettingsError(saveError instanceof Error ? saveError.message : 'Unable to save investment settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const statuses = useMemo(() => [...new Set(applications.map((application) => application.status || 'pending'))], [applications]);
  const filtered = applications.filter((application) => {
    const matchesStatus = statusFilter === 'all' || (application.status || 'pending') === statusFilter;
    const haystack = `${application.reference_number || ''} ${application.contact_name} ${application.email} ${application.location || ''}`.toLowerCase();
    return matchesStatus && haystack.includes(search.toLowerCase().trim());
  });

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[var(--oppa-text)] sm:text-3xl">Franchise Applications</h1>
        <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Evaluate each applicant and proposed site through the full review process. Applications never activate a franchise by themselves.</p>
      </div>
      <form onSubmit={saveOpportunitySettings} className="mb-5 rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1"><h2 className="text-sm font-semibold text-[var(--oppa-text)]">Public investment estimate</h2><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Leave both fields blank to show that investment figures have not been published.</p></div>
          <label className="text-xs font-medium text-[var(--oppa-text-muted)]">Minimum (PHP)<input type="number" min="0" step="0.01" value={investmentMinimum} onChange={(event) => setInvestmentMinimum(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
          <label className="text-xs font-medium text-[var(--oppa-text-muted)]">Maximum (PHP)<input type="number" min="0" step="0.01" value={investmentMaximum} onChange={(event) => setInvestmentMaximum(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
          <button type="submit" disabled={settingsSaving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{settingsSaving ? 'Saving…' : 'Save estimate'}</button>
        </div>
        {settingsError && <p role="alert" className="mt-3 text-xs text-red-700">{settingsError}</p>}
        {settingsMessage && <p role="status" className="mt-3 text-xs text-green-700">{settingsMessage}</p>}
      </form>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input aria-label="Search applications" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applicant, email, location, or reference" className="w-full rounded-xl border border-[var(--oppa-border)] bg-white py-2.5 pl-10 pr-3 text-sm" />
        </label>
        <select aria-label="Filter application status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-[var(--oppa-border)] bg-white px-3 py-2.5 text-sm">
          <option value="all">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <Loader2 className="mx-auto size-6 animate-spin text-[var(--oppa-green)]" /><p className="mt-3">Loading applications…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center shadow-sm">
          <AlertCircle className="mx-auto size-10 text-[var(--oppa-text-muted)]/40" />
          <p className="mt-3 text-sm text-[var(--oppa-text-muted)]">{applications.length ? 'No applications match your filters.' : 'No franchise applications have been submitted yet.'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_auto] gap-4 border-b border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)] md:grid">
            <span>Applicant</span><span>Reference</span><span>Proposed location</span><span>Submitted</span><span>Status</span>
          </div>
          {filtered.map((application) => (
            <Link key={String(application.id)} to={`/admin/franchise-applications/${application.id}`} className="grid gap-2 border-b border-[var(--oppa-border)] px-5 py-4 last:border-b-0 hover:bg-[var(--oppa-cream)]/60 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto] md:items-center md:gap-4">
              <span><strong className="block text-sm text-[var(--oppa-text)]">{application.contact_name}</strong><span className="text-xs text-[var(--oppa-text-muted)]">{application.email}</span></span>
              <span className="font-mono text-xs text-[var(--oppa-text-muted)]">{application.reference_number || 'Legacy application'}</span>
              <span className="text-sm text-[var(--oppa-text-muted)]">{application.location || 'Not provided'}</span>
              <span className="text-xs text-[var(--oppa-text-muted)]">{application.created_at ? new Date(application.created_at).toLocaleDateString() : '—'}</span>
              <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(application.status)}`}>{statusLabel(application.status)}</span>
            </Link>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminFranchiseApplicationsPage;

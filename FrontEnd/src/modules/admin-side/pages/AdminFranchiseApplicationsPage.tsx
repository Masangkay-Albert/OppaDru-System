import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import {
  getFranchiseApplications,
  getFranchiseOpportunitySettings,
  updateFranchiseOpportunitySettings,
  type FranchiseOpportunitySettings,
  type FranchiseApplication,
} from '../../../services/franchiseAdminService';
import { franchiseStatusLabel } from '../../../services/franchiseWorkflow';

const lines = (items: string[] | undefined) => (items || []).join('\n');
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
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[var(--oppa-text)] sm:text-3xl">Franchise Applications</h1>
        <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Evaluate each applicant and proposed site through the full review process. Applications never activate a franchise by themselves. New applications appear automatically while this page is open.</p>
      </div>
      <FranchiseProgramSettingsForm />
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
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
              <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(application.status)}`}>{franchiseStatusLabel(application.status)}</span>
            </Link>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

const FranchiseProgramSettingsForm: React.FC = () => {
  const [settings, setSettings] = useState<FranchiseOpportunitySettings | null>(null);
  const [investmentMinimum, setInvestmentMinimum] = useState('');
  const [investmentMaximum, setInvestmentMaximum] = useState('');
  const [franchiseFee, setFranchiseFee] = useState('');
  const [requirements, setRequirements] = useState('');
  const [availableLocations, setAvailableLocations] = useState('');
  const [qualifications, setQualifications] = useState('');
  const [businessRules, setBusinessRules] = useState('');
  const [support, setSupport] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getFranchiseOpportunitySettings()
      .then((current) => {
        setSettings(current);
        setInvestmentMinimum(current.investment?.minimum || '');
        setInvestmentMaximum(current.investment?.maximum || '');
        setFranchiseFee(current.franchise_fee || '');
        setRequirements(lines(current.requirements));
        setAvailableLocations(lines(current.available_locations));
        setQualifications(lines(current.qualifications));
        setBusinessRules(lines(current.business_rules));
        setSupport(lines(current.support));
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load franchise program settings.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await updateFranchiseOpportunitySettings({
        investment_minimum: investmentMinimum || null,
        investment_maximum: investmentMaximum || null,
        franchise_fee: franchiseFee || null,
        requirements,
        available_locations: availableLocations,
        qualifications,
        business_rules: businessRules,
        support,
      });
      setSettings(updated);
      setMessage('Franchise program details updated. The public opportunities page now shows these terms.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update franchise program settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mb-5 rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-[var(--oppa-text)]">Configure franchise program, fees, and applicant requirements</summary>
      <form onSubmit={save} className="grid gap-4 border-t border-[var(--oppa-border)] p-5 md:grid-cols-2">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 md:col-span-2">{error}</p>}
        {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800 md:col-span-2">{message}</p>}
        <p className="text-xs leading-5 text-[var(--oppa-text-muted)] md:col-span-2">Set accurate published terms. Use one item per line. Leave fees blank if they are not yet approved for publication. The signed agreement and per-application checklist remain the record for actual charges and completion.</p>
        <label className="text-sm font-medium">Estimated minimum investment<input type="number" min="0" step="0.01" value={investmentMinimum} onChange={(event) => setInvestmentMinimum(event.target.value)} placeholder="Not published" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium">Estimated maximum investment<input type="number" min="0" step="0.01" value={investmentMaximum} onChange={(event) => setInvestmentMaximum(event.target.value)} placeholder="Not published" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium">Published franchise fee (optional)<input type="number" min="0" step="0.01" value={franchiseFee} onChange={(event) => setFranchiseFee(event.target.value)} placeholder="Not published" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium">Applicant requirements<textarea rows={4} maxLength={10000} value={requirements} onChange={(event) => setRequirements(event.target.value)} placeholder="One requirement per line" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium">Available franchise locations<textarea rows={4} maxLength={10000} value={availableLocations} onChange={(event) => setAvailableLocations(event.target.value)} placeholder="One city, area, or region per line" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium">Applicant qualifications<textarea rows={4} maxLength={10000} value={qualifications} onChange={(event) => setQualifications(event.target.value)} placeholder="One qualification per line" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium">Business rules<textarea rows={4} maxLength={10000} value={businessRules} onChange={(event) => setBusinessRules(event.target.value)} placeholder="One rule per line" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="text-sm font-medium">Franchisor support<textarea rows={4} maxLength={10000} value={support} onChange={(event) => setSupport(event.target.value)} placeholder="One support item per line" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        {settings && <p className="text-xs text-[var(--oppa-text-muted)] md:col-span-2">Changes publish immediately to Franchise Opportunities; per-applicant signed terms and readiness continue to be tracked separately.</p>}
        <button type="submit" disabled={loading || saving || !settings} className="rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2">{loading ? 'Loading program…' : saving ? 'Saving program…' : 'Save franchise program'}</button>
      </form>
    </details>
  );
};

export default AdminFranchiseApplicationsPage;

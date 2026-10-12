import React, { useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Clock3, Loader2, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { trackFranchiseApplication, type ApplicantFranchiseApplication } from '../../../services/franchiseApplicationService';
import { FRANCHISE_APPLICATION_STAGES, franchiseStageIndex, franchiseStatusLabel } from '../../../services/franchiseWorkflow';

const formatPhilippineDateTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
}).format(new Date(value));

const FranchiseTrackApplicationPage: React.FC = () => {
  const location = useLocation();
  const routeState = location.state as { referenceNumber?: string; email?: string } | null;
  const [referenceNumber, setReferenceNumber] = useState(routeState?.referenceNumber || '');
  const [email, setEmail] = useState(routeState?.email || '');
  const [application, setApplication] = useState<ApplicantFranchiseApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!routeState?.referenceNumber || !routeState.email) return;
    let active = true;
    setLoading(true);
    trackFranchiseApplication(routeState.referenceNumber, routeState.email)
      .then((data) => {
        if (active) {
          setApplication(data);
          setError('');
        }
      })
      .catch((trackError: unknown) => {
        if (active) setError(trackError instanceof Error ? trackError.message : 'Unable to find your franchise application.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [routeState?.referenceNumber, routeState?.email]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setApplication(null);
    try {
      setApplication(await trackFranchiseApplication(referenceNumber.trim(), email.trim()));
    } catch (trackError) {
      setError(trackError instanceof Error ? trackError.message : 'Unable to find your franchise application.');
    } finally {
      setLoading(false);
    }
  };

  const status = application?.status || 'under_review';
  const stageIndex = application ? franchiseStageIndex(application) : -1;
  const showProgress = status !== 'rejected' && status !== 'withdrawn';

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/franchise-opportunities" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)]"><ArrowLeft size={16} /> Back to franchise opportunities</Link>
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--oppa-green)]">Franchise partner portal</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-[var(--oppa-text)]">Track your application</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">Enter the application reference number and contact email you used when applying.</p>
        </header>

        <form onSubmit={handleSubmit} className="mb-6 grid gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:grid-cols-2">
          <label className="text-sm font-medium">Application reference number<input required maxLength={32} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="OPPA-2026-XXXXXXXX" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm font-normal" /></label>
          <label className="text-sm font-medium">Contact email<input required type="email" maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm font-normal" /></label>
          <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"><Search size={16} />{loading ? 'Checking application…' : 'Check application status'}</button>
        </form>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading && !application && <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)]"><Loader2 className="mx-auto size-6 animate-spin text-[var(--oppa-green)]" /><p className="mt-3">Looking up your application…</p></div>}
        {application && (
          <article className="overflow-hidden rounded-3xl border border-[var(--oppa-border)] bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-[var(--oppa-border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div><p className="font-mono text-xs text-[var(--oppa-text-muted)]">{application.reference_number}</p><h2 className="mt-1 text-xl font-bold text-[var(--oppa-text)]">{application.franchise_name}</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Proposed location: {application.location}</p></div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-sm font-semibold ${status === 'rejected' ? 'bg-red-50 text-red-700' : status === 'active' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>{franchiseStatusLabel(status)}</span>
            </header>
            <div className="space-y-5 p-5 sm:p-6">
              {status === 'rejected' && <section role="status" className="rounded-2xl border border-red-200 bg-red-50 p-4"><h3 className="font-semibold text-red-900">Application not approved</h3><p className="mt-1 text-sm leading-6 text-red-800">{application.next_step_instructions || 'The franchisor has reviewed your application and decided not to proceed.'}</p></section>}
              {showProgress && <section className="rounded-2xl border border-[var(--oppa-border)] p-4">
                <h3 className="mb-3 text-sm font-semibold">Franchise process</h3>
                <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {FRANCHISE_APPLICATION_STAGES.map((stage, index) => {
                    const complete = index < stageIndex;
                    const current = index === stageIndex;
                    return <li key={stage.status} aria-current={current ? 'step' : undefined} className={`rounded-xl p-3 text-xs ${current ? 'bg-[var(--oppa-green)] text-white' : complete ? 'bg-green-50 text-green-800' : 'bg-[var(--oppa-cream)] text-[var(--oppa-text-muted)]'}`}><span className="font-semibold">{index + 1}. {stage.label}</span><span className="mt-1 block">{current ? `Current: ${franchiseStatusLabel(status)}` : complete ? 'Completed' : 'Next stage'}</span></li>;
                  })}
                </ol>
              </section>}
              {status !== 'rejected' && <section className="rounded-2xl bg-[var(--oppa-cream)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-[var(--oppa-green)]" /> Your next step</div>
                <p className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">{application.next_step_instructions || 'Your application is in the review queue. We will update this page when there is a next step.'}</p>
                {(application.interview_at || application.interview_meeting_url || application.interview_location) && <div className="mt-3 rounded-xl bg-white p-3 text-sm">
                  {application.interview_at && <p className="font-medium">Interview (Philippine time): {formatPhilippineDateTime(application.interview_at)}</p>}
                  {application.interview_type && <p className="mt-1">Type: {application.interview_type === 'onsite' ? 'Onsite' : 'Online'}</p>}
                  {application.interview_location && <p className="mt-1">Location: {application.interview_location}</p>}
                  {application.interview_meeting_url && <a href={application.interview_meeting_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-semibold text-[var(--oppa-green)] underline">Join online interview</a>}
                </div>}
              </section>}
              <section>
                <h3 className="mb-3 flex items-center gap-2 font-semibold"><BriefcaseBusiness size={16} className="text-[var(--oppa-green)]" /> Application timeline</h3>
                {!application.events?.length ? <p className="text-sm text-[var(--oppa-text-muted)]">No timeline updates yet.</p> : <ol className="space-y-4">{application.events.map((event) => <li key={event.id} className="border-l border-[var(--oppa-border)] pl-4"><p className="text-sm font-semibold">{event.title}</p>{event.message && <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[var(--oppa-text-muted)]">{event.message}</p>}<p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{formatPhilippineDateTime(event.created_at)}</p></li>)}</ol>}
              </section>
              <p className="text-xs leading-5 text-[var(--oppa-text-muted)]">For privacy, this lookup requires both your reference number and contact email. Keep your reference number for future updates.</p>
            </div>
          </article>
        )}
      </div>
    </main>
  );
};

export default FranchiseTrackApplicationPage;

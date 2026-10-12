import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock3, Download, FileText, Loader2, RotateCcw, Send } from 'lucide-react';
import {
  downloadMyFranchiseApplicationDocument,
  getMyFranchiseApplications,
  respondToFranchiseApplication,
  withdrawFranchiseApplication,
  type ApplicantFranchiseApplication,
} from '../../../services/franchiseApplicationService';
import { FRANCHISE_APPLICATION_STAGES, franchiseStageIndex, franchiseStatusLabel } from '../../../services/franchiseWorkflow';

const title = franchiseStatusLabel;
const formatPhilippineDateTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
}).format(new Date(value));

const uniqueTimelineEvents = (
  events: NonNullable<ApplicantFranchiseApplication['events']>,
  hasCurrentInterview: boolean,
) => {
  const seen = new Set<string>();
  return [...events].reverse().filter((event) => {
    if (hasCurrentInterview && event.title === 'Interview scheduled') return false;
    const signature = `${event.status || ''}|${event.title}|${event.message || ''}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  }).reverse();
};

const FranchiseMyApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<ApplicantFranchiseApplication[]>([]);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [responseFiles, setResponseFiles] = useState<Record<string, File[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const requestInFlight = useRef(false);
  const mounted = useRef(false);

  const load = useCallback(async (showLoading = true) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (showLoading) setLoading(true);
    try {
      const data = await getMyFranchiseApplications();
      if (mounted.current) {
        setApplications(data);
        setError('');
      }
    } catch (loadError) {
      if (mounted.current) setError(loadError instanceof Error ? loadError.message : 'Unable to load your applications.');
    } finally {
      requestInFlight.current = false;
      if (mounted.current && showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    const interval = window.setInterval(refreshWhenVisible, 15000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [load]);

  const handleResponse = async (application: ApplicantFranchiseApplication) => {
    const response = responses[application.id]?.trim() || '';
    if (!response) {
      setError('Write a response before sending additional information.');
      return;
    }
    setBusyId(application.id);
    setError('');
    setMessage('');
    try {
      await respondToFranchiseApplication(application.id, response, responseFiles[application.id] || []);
      setResponses((current) => ({ ...current, [application.id]: '' }));
      setResponseFiles((current) => ({ ...current, [application.id]: [] }));
      setMessage(`Your response for ${application.reference_number} has been sent.`);
      await load(false);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send your response.');
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdraw = async (application: ApplicantFranchiseApplication) => {
    if (!window.confirm(`Withdraw application ${application.reference_number}? This action cannot be undone.`)) return;
    setBusyId(application.id);
    setError('');
    setMessage('');
    try {
      await withdrawFranchiseApplication(application.id);
      setMessage(`Application ${application.reference_number} was withdrawn.`);
      await load(false);
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Unable to withdraw the application.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (application: ApplicantFranchiseApplication, index: number, name: string) => {
    setBusyId(application.id);
    setError('');
    try {
      const blob = await downloadMyFranchiseApplicationDocument(application.id, index);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the document.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--oppa-green)]">Franchise partner portal</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-[var(--oppa-text)]">My Applications</h1>
          <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">View your application status, next steps, interview updates, and information requests.</p>
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        {loading ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-[var(--oppa-text-muted)]"><Loader2 className="mx-auto size-6 animate-spin" /><p className="mt-3">Loading your applications…</p></div> : applications.length === 0 ? (
          <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-10 text-center">
            <AlertCircle className="mx-auto size-10 text-[var(--oppa-green)]" />
            <h2 className="mt-3 font-semibold">No franchise applications yet</h2>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Start an application to see its progress here.</p>
            <a href="/franchise-opportunities" className="mt-5 inline-flex rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white">Explore franchise opportunities</a>
          </section>
        ) : (
          <div className="space-y-6">
            {applications.map((application) => {
              const currentStatus = application.status || 'under_review';
              const currentStageIndex = franchiseStageIndex(application);
              const showProgress = currentStatus !== 'rejected' && currentStatus !== 'withdrawn';
              const canWithdraw = ['submitted', 'pending', 'under_review', 'additional_information_required', 'for_interview', 'location_assessment', 'on_hold'].includes(currentStatus);
              return (
                <article key={application.id} className="overflow-hidden rounded-3xl border border-[var(--oppa-border)] bg-white shadow-sm">
                  <header className="flex flex-col gap-3 border-b border-[var(--oppa-border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div><p className="font-mono text-xs text-[var(--oppa-text-muted)]">{application.reference_number}</p><h2 className="mt-1 text-xl font-bold text-[var(--oppa-text)]">{application.franchise_name}</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Proposed location: {application.location}</p></div>
                    <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${currentStatus === 'rejected' ? 'bg-red-50 text-red-700' : currentStatus === 'active' ? 'bg-green-50 text-green-700' : currentStatus === 'on_hold' ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-800'}`}><span className="size-2 rounded-full bg-current" />{title(currentStatus)}</div>
                  </header>

                  <div className="p-5 sm:p-6">
                    {currentStatus === 'on_hold' && <p className="mb-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">Your application is temporarily on hold. Please follow the instructions below or contact the franchise team if clarification is needed.</p>}
                    {currentStatus === 'rejected' && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">This application was not approved. Any applicant-visible update from the team is shown in the timeline below.</p>}
                    {currentStatus === 'withdrawn' && <p className="mb-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">You withdrew this application.</p>}

                    {showProgress && (
                      <section aria-label="Application progress" className="mb-5 rounded-2xl border border-[var(--oppa-border)] p-4">
                        <h3 className="mb-3 text-sm font-semibold">Franchise process</h3>
                        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {FRANCHISE_APPLICATION_STAGES.map((stage, index) => {
                            const complete = index < currentStageIndex;
                            const current = index === currentStageIndex;
                            return <li key={stage.status} aria-current={current ? 'step' : undefined} className={`rounded-xl p-3 text-xs ${current ? 'bg-[var(--oppa-green)] text-white' : complete ? 'bg-green-50 text-green-800' : 'bg-[var(--oppa-cream)] text-[var(--oppa-text-muted)]'}`}><span className="font-semibold">{index + 1}. {stage.label}</span><span className="mt-1 block">{current ? `Current: ${title(currentStatus)}` : complete ? 'Completed' : 'Next stage'}</span></li>;
                          })}
                        </ol>
                      </section>
                    )}

                    {currentStatus === 'active' && <p className="mb-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">Your franchise is active. Authorized franchise operations, sales reporting, and compliance monitoring are now managed through the franchise portal.</p>}

                    <section className="mb-5 rounded-2xl bg-[var(--oppa-cream)] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-[var(--oppa-green)]" /> Your next step</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">{application.next_step_instructions || 'Your application is in the review queue. We will update this page when there is a next step.'}</p>
                      {(application.interview_at || application.interview_meeting_url) && <div className="mt-3 rounded-xl bg-white p-3 text-sm">
                        {application.interview_at && <p className="font-medium">Interview (Philippine time): {formatPhilippineDateTime(application.interview_at)}</p>}
                        {application.interview_meeting_url && <a href={application.interview_meeting_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-semibold text-[var(--oppa-green)] underline">Join online interview</a>}
                      </div>}
                    </section>

                    {currentStatus === 'additional_information_required' && (
                      <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                        <h3 className="font-semibold text-[var(--oppa-text)]">Send additional information</h3>
                        <textarea value={responses[application.id] || ''} onChange={(event) => setResponses((current) => ({ ...current, [application.id]: event.target.value}))} rows={4} maxLength={5000} placeholder="Write your response to the review team's request." className="mt-3 w-full rounded-xl border border-[var(--oppa-border)] bg-white p-3 text-sm" />
                        <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(event) => setResponseFiles((current) => ({ ...current, [application.id]: Array.from(event.target.files || [])}))} className="mt-3 block text-sm" />
                        <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Optional supporting files: PDF, JPG, PNG, DOC, or DOCX; up to 10 MB each.</p>
                        <button type="button" onClick={() => void handleResponse(application)} disabled={busyId === application.id} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Send size={15} />{busyId === application.id ? 'Sending…' : 'Send information'}</button>
                      </section>
                    )}

                    {(application.agreement_status || application.required_documents?.length || application.location_readiness) && (
                      <section className="mb-5 rounded-2xl border border-[var(--oppa-border)] p-4">
                        <h3 className="mb-1 font-semibold">Agreement and opening readiness</h3>
                        <p className="mb-3 text-xs text-[var(--oppa-text-muted)]">Read-only updates from the franchise review team. Contact the team if you have questions about a requirement.</p>
                        <div className="grid gap-2 text-sm sm:grid-cols-2">
                          {application.agreement_status && <p>Agreement: <span className="font-medium">{title(application.agreement_status)}</span></p>}
                          {application.franchise_fee_payment_status && application.franchise_fee_payment_status !== 'not_configured' && <p>Fee status: <span className="font-medium">{title(application.franchise_fee_payment_status)}</span>{application.franchise_fee_amount ? ` · ₱${Number(application.franchise_fee_amount).toLocaleString('en-PH')}` : ''}</p>}
                          {application.location_readiness && <p>Location: <span className="font-medium">{title(application.location_readiness)}</span></p>}
                          {application.permit_compliance_status && <p>Permits and compliance: <span className="font-medium">{title(application.permit_compliance_status)}</span></p>}
                          {application.training_status && <p>Training: <span className="font-medium">{title(application.training_status)}</span></p>}
                          {application.operational_preparation_status && <p>Operational preparation: <span className="font-medium">{title(application.operational_preparation_status)}</span></p>}
                        </div>
                        {application.required_documents?.length ? <ul className="mt-3 space-y-1 border-t border-[var(--oppa-border)] pt-3 text-sm">{application.required_documents.filter((document) => document.required).map((document) => <li key={document.label} className="flex justify-between gap-3"><span>{document.label}</span><span className="font-medium">{title(document.status)}</span></li>)}</ul> : null}
                      </section>
                    )}

                    {application.documents?.length ? <section className="mb-5"><h3 className="mb-2 text-sm font-semibold">Your supporting documents</h3><ul className="space-y-2">{application.documents.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--oppa-border)] p-3"><span className="flex min-w-0 items-center gap-2 text-sm"><FileText size={16} className="shrink-0 text-[var(--oppa-green)]" /><span className="truncate">{file.name}</span></span><button type="button" onClick={() => void handleDownload(application, index, file.name)} disabled={busyId === application.id} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--oppa-green)]"><Download size={14} />Download</button></li>)}</ul></section> : null}

                    <section>
                      <h3 className="mb-3 text-sm font-semibold">Application timeline</h3>
                      {!application.events?.length ? <p className="text-sm text-[var(--oppa-text-muted)]">No timeline updates yet.</p> : <ol className="space-y-4">{uniqueTimelineEvents(application.events, Boolean(application.interview_at)).map((event) => <li key={event.id} className="relative border-l border-[var(--oppa-border)] pl-4"><p className="text-sm font-semibold">{event.title}</p>{event.message && <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[var(--oppa-text-muted)]">{event.message}</p>}<p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{formatPhilippineDateTime(event.created_at)}</p></li>)}</ol>}
                    </section>

                    {canWithdraw && <div className="mt-5 border-t border-[var(--oppa-border)] pt-4"><button type="button" onClick={() => void handleWithdraw(application)} disabled={busyId === application.id} className="inline-flex items-center gap-2 text-xs font-medium text-red-700 hover:underline disabled:opacity-60"><RotateCcw size={14} />Withdraw this application</button></div>}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
};

export default FranchiseMyApplicationsPage;

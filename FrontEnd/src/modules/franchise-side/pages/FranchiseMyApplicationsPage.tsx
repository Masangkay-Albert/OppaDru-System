import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Clock3, Download, FileText, Loader2, LogOut, RotateCcw, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFranchiseApplicantAuth } from '../../../contexts/franchiseApplicantAuth';
import {
  downloadMyFranchiseApplicationDocument,
  downloadFranchiseRequiredDocumentTemplate,
  getMyFranchiseApplications,
  respondToFranchiseApplication,
  withdrawFranchiseApplication,
  type ApplicantFranchiseApplication,
} from '../../../services/franchiseApplicationService';
import { FRANCHISE_APPLICATION_STAGES, franchiseStageIndex, franchiseStatusLabel } from '../../../services/franchiseWorkflow';

const title = franchiseStatusLabel;
const requirementCategoryTitle = (category?: string) => ({
  agreement_signing: 'Agreement and signing',
  payment: 'Payment receipt/reference',
  location_readiness: 'Location readiness',
  permits_compliance: 'Permits and compliance',
  operational_preparation: 'System and operational preparation',
}[category || ''] || 'Required document');

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
  const navigate = useNavigate();
  const { logout } = useFranchiseApplicantAuth();
  const [applications, setApplications] = useState<ApplicantFranchiseApplication[]>([]);
  const [requiredResponseFiles, setRequiredResponseFiles] = useState<Record<string, Record<number, File>>>({});
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
    const interval = window.setInterval(refreshWhenVisible, 5000);
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
    const requiredFiles = requiredResponseFiles[application.id] || {};
    const missingRequiredFiles = (application.required_documents || [])
      .map((document, index) => ({ document, index }))
      .filter(({ document, index }) => document.required
        && !['verified', 'not_applicable'].includes(document.status)
        && !requiredFiles[index])
      .map(({ document }) => document.label);
    if (missingRequiredFiles.length) {
      setError(`Upload all required forms before submitting: ${missingRequiredFiles.join(', ')}.`);
      return;
    }
    if (Object.keys(requiredFiles).length > 8) {
      setError('Submit no more than 8 documents in one response.');
      return;
    }
    setBusyId(application.id);
    setError('');
    setMessage('');
    try {
      await respondToFranchiseApplication(application.id, '', [], requiredFiles);
      setRequiredResponseFiles((current) => ({ ...current, [application.id]: {} }));
      setMessage(`Your response for ${application.reference_number} has been sent.`);
      await load(false);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send your response.');
    } finally {
      setBusyId(null);
    }
  };

  const handleTemplateDownload = async (application: ApplicantFranchiseApplication, index: number, name: string) => {
    setBusyId(application.id);
    setError('');
    try {
      const blob = await downloadFranchiseRequiredDocumentTemplate(application.id, index);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the required form.');
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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/franchise/applicant-login?returnTo=%2Ffranchise%2Fmy-applications', { replace: true });
    } catch (logoutError: unknown) {
      const message = logoutError instanceof Error ? logoutError.message : 'Unable to sign out of the applicant account.';
      navigate('/franchise/applicant-login?returnTo=%2Ffranchise%2Fmy-applications', { replace: true, state: { signOutError: message } });
    }
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--oppa-green)]">Franchise partner portal</p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-[var(--oppa-text)]">My Applications</h1>
            <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">View your application status, next steps, interview updates, and document requests.</p>
          </div>
          <button type="button" onClick={handleLogout} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-[var(--oppa-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--oppa-text)] transition hover:border-red-200 hover:text-red-700">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
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
              const latestPacketRequest = [...(application.events || [])].reverse().find((event) => event.title === 'Document packet requested');
              const latestPacketSubmission = [...(application.events || [])].reverse().find((event) => ['Additional information submitted', 'Document packet submitted'].includes(event.title));
              const hasRequiredDocuments = application.required_documents?.some((document) => document.required && document.status !== 'not_applicable') === true;
              const packetAlreadySubmitted = Boolean(latestPacketSubmission && (!latestPacketRequest || latestPacketSubmission.id > latestPacketRequest.id));
              const packetRequestOpen = !packetAlreadySubmitted && (
                currentStatus === 'additional_information_required'
                || Boolean(latestPacketRequest && (!latestPacketSubmission || latestPacketRequest.id > latestPacketSubmission.id))
                || (currentStatus === 'location_assessment' && hasRequiredDocuments)
              );
              const pendingPacketDocuments = (application.required_documents || [])
                .map((document, index) => ({ document, index }))
                .filter(({ document }) => document.required && !['verified', 'not_applicable'].includes(document.status));
              const selectedPacketFiles = pendingPacketDocuments.filter(({ index }) => requiredResponseFiles[application.id]?.[index]).length;
              const canWithdraw = ['submitted', 'pending', 'under_review', 'additional_information_required', 'for_interview', 'location_assessment', 'on_hold'].includes(currentStatus);
              return (
                <article key={application.id} className="overflow-hidden rounded-3xl border border-[var(--oppa-border)] bg-white shadow-sm">
                  <header className="flex flex-col gap-3 border-b border-[var(--oppa-border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div><p className="font-mono text-xs text-[var(--oppa-text-muted)]">{application.reference_number}</p><h2 className="mt-1 text-xl font-bold text-[var(--oppa-text)]">{application.franchise_name}</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Proposed location: {application.location}</p></div>
                    <div className={`flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${currentStatus === 'rejected' ? 'bg-red-50 text-red-700' : currentStatus === 'active' ? 'bg-green-50 text-green-700' : currentStatus === 'on_hold' ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-800'}`}><span className="size-2 rounded-full bg-current" />{title(currentStatus)}</div>
                  </header>

                  <div className="p-5 sm:p-6">
                    {currentStatus === 'on_hold' && <p className="mb-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">Your application is temporarily on hold. Please follow the instructions below or contact the franchise team if clarification is needed.</p>}
                    {currentStatus === 'rejected' && (
                      <section role="status" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" />
                          <div>
                            <h3 className="font-semibold text-red-900">Application not approved</h3>
                            <p className="mt-1 text-sm leading-6 text-red-800">{application.next_step_instructions || 'The franchisor has reviewed your application and decided not to proceed.'}</p>
                            <p className="mt-2 text-xs text-red-800">You can review the application timeline below for the latest update.</p>
                          </div>
                        </div>
                      </section>
                    )}
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

                    {currentStatus !== 'rejected' && !packetRequestOpen && <section className="mb-5 rounded-2xl bg-[var(--oppa-cream)] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-[var(--oppa-green)]" /> Your next step</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">{application.next_step_instructions || 'Your application is in the review queue. We will update this page when there is a next step.'}</p>
                      {currentStatus === 'for_interview' && (application.interview_at || application.interview_meeting_url || application.interview_location) && <div className="mt-3 rounded-xl bg-white p-3 text-sm">
                        {application.interview_at && <p className="font-medium">Interview (Philippine time): {formatPhilippineDateTime(application.interview_at)}</p>}
                        {application.interview_type && <p className="mt-1">Type: {application.interview_type === 'onsite' ? 'Onsite' : 'Online'}</p>}
                        {application.interview_location && <p className="mt-1">Location: {application.interview_location}</p>}
                        {application.interview_meeting_url && <a href={application.interview_meeting_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-semibold text-[var(--oppa-green)] underline">Join online interview</a>}
                      </div>}
                    </section>}

                    {packetRequestOpen && (
                      <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div><h3 className="font-semibold text-[var(--oppa-text)]">Upload requested documents</h3><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Upload a file for each requirement below. If the franchise team attached a template, you can download it, fill it out, and upload the completed file. Templates are optional.</p></div>
                          <span className="w-fit shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">{selectedPacketFiles} of {pendingPacketDocuments.length} selected</span>
                        </div>
                        {!pendingPacketDocuments.length ? <p className="mt-3 rounded-xl bg-white p-3 text-sm text-[var(--oppa-text-muted)]">There are no outstanding required forms to submit.</p> : <div className="mt-3 space-y-3">
                          {pendingPacketDocuments.map(({ document, index }) => {
                            const selectedFile = requiredResponseFiles[application.id]?.[index];
                            return <div key={`${application.id}-${index}`} className="rounded-xl border border-amber-200 bg-white p-3 text-sm">
                              <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{document.label}</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">Required</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${document.status === 'rejected' ? 'bg-red-100 text-red-800' : document.status === 'submitted' || document.status === 'received' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}`}>{document.status === 'rejected' ? 'Rejected' : document.status === 'submitted' || document.status === 'received' ? 'Under review' : 'Pending'}</span></div>
                              <span className="mt-1 block text-xs text-[var(--oppa-text-muted)]">{requirementCategoryTitle(document.category)}</span>
                              {document.status === 'rejected' && document.reject_reason && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs leading-5 text-red-800">Please correct and resubmit: {document.reject_reason}</p>}
                              {document.template_name && <button type="button" onClick={() => void handleTemplateDownload(application, index, document.template_name || document.label)} disabled={busyId === application.id} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green)] disabled:opacity-60"><Download size={14} />Download file from franchisor</button>}
                              {!document.template_name && <p className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-900">No template was attached. You can upload the requested document directly below.</p>}
                              <div className="mt-3">
                                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-950">Upload file for this requirement</p>
                                <input id={`required-response-${application.id}-${index}`} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="peer sr-only" onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (!file) return;
                                  const extension = file.name.split('.').pop()?.toLowerCase();
                                  if (!['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(extension || '')) {
                                    setError('Choose a PDF, DOC, DOCX, JPG, or PNG file.');
                                    event.target.value = '';
                                    return;
                                  }
                                  if (file.size > 10 * 1024 * 1024) {
                                    setError('Each document must be 10 MB or smaller.');
                                    event.target.value = '';
                                    return;
                                  }
                                  setError('');
                                  setRequiredResponseFiles((current) => ({ ...current, [application.id]: { ...(current[application.id] || {}), [index]: file } }));
                                }} />
                                <label htmlFor={`required-response-${application.id}-${index}`} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-amber-500 px-3 py-3 transition hover:border-[var(--oppa-green)] hover:bg-green-50 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--oppa-green)] peer-focus-visible:ring-offset-2">
                                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"><Upload size={19} /></span>
                                  <span className="min-w-0 flex-1"><span className="block break-all font-semibold text-[var(--oppa-text)]">{selectedFile?.name || 'Tap here to choose your completed file'}</span><span className="mt-0.5 block text-xs text-[var(--oppa-text-muted)]">{selectedFile ? 'Ready to submit' : 'Select the filled-out file from your device'}</span></span>
                                  <span className="shrink-0 rounded-lg bg-[var(--oppa-green)] px-3 py-2 text-xs font-bold text-white">Choose file</span>
                                </label>
                              </div>
                            </div>;
                          })}
                        </div>}
                        <div className="mt-3 rounded-xl border border-[var(--oppa-green)]/30 bg-green-50 p-3">
                          <p className="mb-2 text-center text-sm font-semibold text-green-900">{selectedPacketFiles === pendingPacketDocuments.length ? 'All required files are ready to submit.' : `Select ${pendingPacketDocuments.length - selectedPacketFiles} more required ${pendingPacketDocuments.length - selectedPacketFiles === 1 ? 'file' : 'files'} to continue.`}</p>
                          <button type="button" onClick={() => void handleResponse(application)} disabled={busyId === application.id || !pendingPacketDocuments.length || selectedPacketFiles !== pendingPacketDocuments.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Upload size={16} />{busyId === application.id ? 'Submitting forms…' : 'Submit all completed forms'}</button>
                        </div>
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

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Check, ChevronDown, Clock3, Download, FileText, LogOut, MapPin, RotateCcw, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useFranchiseApplicantAuth } from '../../../contexts/franchiseApplicantAuth';
import {
  downloadMyFranchiseApplicationDocument,
  downloadFranchiseRequiredDocumentTemplate,
  getMyFranchiseApplications,
  respondToFranchiseApplication,
  withdrawFranchiseApplication,
  type ApplicantFranchiseApplication,
} from '../../../services/franchiseApplicationService';
import { franchiseStatusLabel } from '../../../services/franchiseWorkflow';
import { FranchiseEmptyState, FranchiseSkeleton, FranchiseStepper, FranchiseStatusPill, FranchiseTimeline } from '../components/FranchisePortalUI';
import InlineMessage from '../../shared/components/InlineMessage';
import './FranchisePortalDesign.css';

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

type ApplicationFeedback = {
  variant: 'success' | 'error' | 'warning' | 'info';
  message: string;
  title?: string;
  placement: 'upload' | 'supporting' | 'card';
};

const FranchiseMyApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useFranchiseApplicantAuth();
  const [applications, setApplications] = useState<ApplicantFranchiseApplication[]>([]);
  const [requiredResponseFiles, setRequiredResponseFiles] = useState<Record<string, Record<number, File>>>({});
  const [draggingRequirement, setDraggingRequirement] = useState<number | null>(null);
  const [expandedSupportingDocuments, setExpandedSupportingDocuments] = useState<Record<string, boolean>>({});
  const [expandedVerifiedDocuments, setExpandedVerifiedDocuments] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [applicationFeedback, setApplicationFeedback] = useState<Record<string, ApplicationFeedback>>({});
  const [requirementErrors, setRequirementErrors] = useState<Record<string, Record<number, string>>>({});
  const [focusSuccessId, setFocusSuccessId] = useState<string | null>(null);
  const uploadFeedbackRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const applicationStatuses = useRef<Record<string, string>>({});
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
        const changedStatusIds = new Set<string>();
        data.forEach((application) => {
          const status = application.status || 'under_review';
          const previousStatus = applicationStatuses.current[application.id];
          if (previousStatus && previousStatus !== status) changedStatusIds.add(application.id);
          applicationStatuses.current[application.id] = status;
        });
        setApplicationFeedback((current) => {
          const next = { ...current };
          let changed = false;
          data.forEach((application) => {
            if ((application.status === 'approved' || changedStatusIds.has(application.id)) && next[application.id]) {
              delete next[application.id];
              changed = true;
            }
          });
          return changed ? next : current;
        });
      }
    } catch (loadError) {
      if (mounted.current) setError(loadError instanceof Error ? loadError.message : 'Unable to load your applications.');
    } finally {
      requestInFlight.current = false;
      if (mounted.current && showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!focusSuccessId) return;
    const alert = uploadFeedbackRefs.current[focusSuccessId];
    if (!alert) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    alert.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    alert.focus({ preventScroll: true });
    setFocusSuccessId(null);
  }, [focusSuccessId, applicationFeedback]);

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
    const actionableIndexes = new Set((application.required_documents || [])
      .map((document, index) => ({ document, index }))
      .filter(({ document }) => document.required && ['pending', 'rejected'].includes(document.status))
      .map(({ index }) => index));
    const requiredFiles = Object.fromEntries(Object.entries(requiredResponseFiles[application.id] || {}).filter(([index]) => actionableIndexes.has(Number(index)))) as Record<number, File>;
    const missingRequiredFiles = (application.required_documents || [])
      .map((document, index) => ({ document, index }))
      .filter(({ document, index }) => document.required
        && ['pending', 'rejected'].includes(document.status)
        && !requiredFiles[index])
      .map(({ document }) => document.label);
    if (missingRequiredFiles.length) {
      setApplicationFeedback((current) => ({
        ...current,
        [application.id]: {
          variant: 'error',
          message: `Upload all required forms before submitting: ${missingRequiredFiles.join(', ')}.`,
          placement: 'upload',
        },
      }));
      return;
    }
    if (Object.keys(requiredFiles).length > 8) {
      setApplicationFeedback((current) => ({
        ...current,
        [application.id]: { variant: 'error', message: 'Submit no more than 8 documents in one response.', placement: 'upload' },
      }));
      return;
    }
    setBusyId(application.id);
    setError('');
    setApplicationFeedback((current) => {
      const next = { ...current };
      delete next[application.id];
      return next;
    });
    setFocusSuccessId(null);
    try {
      await respondToFranchiseApplication(application.id, '', [], requiredFiles);
      setRequiredResponseFiles((current) => ({ ...current, [application.id]: {} }));
      setApplicationFeedback((current) => ({
        ...current,
        [application.id]: {
          variant: 'success',
          title: 'Documents submitted',
          message: `Your response for ${application.reference_number} has been sent. The franchise team will review it.`,
          placement: 'upload',
        },
      }));
      setFocusSuccessId(application.id);
      await load(false);
    } catch (sendError) {
      setApplicationFeedback((current) => ({
        ...current,
        [application.id]: {
          variant: 'error',
          message: sendError instanceof Error ? sendError.message : 'Unable to send your response.',
          placement: 'upload',
        },
      }));
    } finally {
      setBusyId(null);
    }
  };

  const chooseRequiredFile = (applicationId: string, index: number, file?: File) => {
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(extension || '')) {
      setRequirementErrors((current) => ({
        ...current,
        [applicationId]: { ...(current[applicationId] || {}), [index]: 'Choose a PDF, DOC, DOCX, JPG, or PNG file.' },
      }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setRequirementErrors((current) => ({
        ...current,
        [applicationId]: { ...(current[applicationId] || {}), [index]: 'Each document must be 10 MB or smaller.' },
      }));
      return;
    }
    setError('');
    setRequirementErrors((current) => {
      const next = { ...(current[applicationId] || {}) };
      delete next[index];
      return { ...current, [applicationId]: next };
    });
    setApplicationFeedback((current) => {
      const next = { ...current };
      delete next[applicationId];
      return next;
    });
    setRequiredResponseFiles((current) => ({ ...current, [applicationId]: { ...(current[applicationId] || {}), [index]: file } }));
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
      setApplicationFeedback((current) => ({
        ...current,
        [application.id]: {
          variant: 'error',
          message: downloadError instanceof Error ? downloadError.message : 'Unable to download the required form.',
          placement: 'upload',
        },
      }));
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdraw = async (application: ApplicantFranchiseApplication) => {
    if (!window.confirm(`Withdraw application ${application.reference_number}? This action cannot be undone.`)) return;
    setBusyId(application.id);
    setError('');
    setApplicationFeedback((current) => {
      const next = { ...current };
      delete next[application.id];
      return next;
    });
    try {
      await withdrawFranchiseApplication(application.id);
      setApplicationFeedback((current) => ({
        ...current,
        [application.id]: {
          variant: 'success',
          title: 'Application withdrawn',
          message: `Application ${application.reference_number} was withdrawn.`,
          placement: 'card',
        },
      }));
      await load(false);
    } catch (withdrawError) {
      setApplicationFeedback((current) => ({
        ...current,
        [application.id]: {
          variant: 'error',
          message: withdrawError instanceof Error ? withdrawError.message : 'Unable to withdraw the application.',
          placement: 'card',
        },
      }));
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
      setApplicationFeedback((current) => ({
        ...current,
        [application.id]: {
          variant: 'error',
          message: downloadError instanceof Error ? downloadError.message : 'Unable to download the document.',
          placement: 'supporting',
        },
      }));
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
    <main className="franchise-portal min-h-screen bg-[var(--oppa-cream)] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="franchise-portal-header mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--oppa-green)]">Franchise partner portal</p>
            <h1 className="mt-1 font-serif text-3xl font-bold text-[var(--oppa-text)]">My Applications</h1>
            <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">View your application status, next steps, interview updates, and document requests.</p>
          </div>
          <button type="button" onClick={handleLogout} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-[var(--oppa-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--oppa-text)] transition hover:border-red-200 hover:text-red-700">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </header>
        {error && <InlineMessage variant="error" message={error} className="mb-4" />}
        {loading ? <FranchiseSkeleton /> : applications.length === 0 ? (
          <FranchiseEmptyState title="No franchise applications yet" description="Start an application to see its progress here." action={<a href="/franchise-opportunities" className="inline-flex min-h-11 items-center rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white">Explore franchise opportunities</a>} />
        ) : (
          <div className="space-y-6">
            {applications.map((application) => {
              const currentStatus = application.status || 'under_review';
              const dashboardProvisioned = Boolean(application.franchise_account_id && application.franchise_id);
              const existingEvents = application.events || [];
              const hasApprovalEvent = existingEvents.some((event) => event.status === 'approved' || event.title === 'Application approved');
              const timelineEvents = currentStatus === 'approved' && !hasApprovalEvent
                ? [...existingEvents, {
                  id: -1,
                  status: 'approved',
                  title: 'Application approved',
                  created_at: application.updated_at,
                }]
                : existingEvents;
              const showProgress = currentStatus !== 'rejected' && currentStatus !== 'withdrawn';
              const latestPacketRequest = [...(application.events || [])].reverse().find((event) => event.title === 'Document packet requested');
              const latestPacketSubmission = [...(application.events || [])].reverse().find((event) => ['Additional information submitted', 'Document packet submitted'].includes(event.title));
              const hasRequiredDocuments = application.required_documents?.some((document) => document.required) === true;
              const packetAlreadySubmitted = Boolean(latestPacketSubmission && (!latestPacketRequest || latestPacketSubmission.id > latestPacketRequest.id));
              const packetRequestOpen = !packetAlreadySubmitted && (
                currentStatus === 'additional_information_required'
                || Boolean(latestPacketRequest && (!latestPacketSubmission || latestPacketRequest.id > latestPacketSubmission.id))
                || (currentStatus === 'location_assessment' && hasRequiredDocuments)
              );
              const allRequiredDocuments = (application.required_documents || []).map((document, index) => ({ document, index })).filter(({ document }) => document.required);
              const pendingPacketDocuments = allRequiredDocuments.filter(({ document }) => ['pending', 'rejected'].includes(document.status));
              const underReviewDocuments = allRequiredDocuments.filter(({ document }) => ['submitted', 'received'].includes(document.status));
              const verifiedDocuments = allRequiredDocuments.filter(({ document }) => ['verified', 'not_applicable'].includes(document.status));
              const completedPacketDocuments = underReviewDocuments.length + verifiedDocuments.length;
              const allPacketDocumentsResolved = allRequiredDocuments.length > 0 && allRequiredDocuments.every(({ document }) => ['verified', 'not_applicable'].includes(document.status));
              const allPacketDocumentsVerified = allRequiredDocuments.length > 0 && allRequiredDocuments.every(({ document }) => document.status === 'verified');
              const verifiedDocumentCount = allRequiredDocuments.filter(({ document }) => document.status === 'verified').length;
              const verifiedDocumentsExpanded = expandedVerifiedDocuments[application.id] === true;
              const shouldCollapseVerifiedDocuments = currentStatus === 'approved' && allPacketDocumentsVerified;
              const showRequiredDocuments = hasRequiredDocuments;
              const selectedPacketFiles = pendingPacketDocuments.filter(({ index }) => requiredResponseFiles[application.id]?.[index]).length;
              const canWithdraw = ['submitted', 'pending', 'under_review', 'additional_information_required', 'for_interview', 'location_assessment', 'on_hold'].includes(currentStatus);
              return (
                <article key={application.id} className="franchise-application-card overflow-hidden rounded-3xl border border-[var(--oppa-border)] bg-white shadow-sm">
                  <header className="franchise-application-header flex flex-col gap-3 border-b border-[var(--oppa-border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
                    <div><p className="font-mono text-xs font-semibold tracking-wide text-[var(--oppa-green)]">{application.reference_number}</p><h2 className="mt-1 font-serif text-xl font-bold text-[var(--oppa-text)] sm:text-2xl">{application.franchise_name}</h2><p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--oppa-text-muted)]"><MapPin size={15} className="shrink-0 text-[var(--oppa-green)]" aria-hidden="true" />{application.location}</p></div>
                    <FranchiseStatusPill status={currentStatus} label={title(currentStatus)} />
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
                      <FranchiseStepper status={currentStatus} />
                    )}

                    {currentStatus === 'active' && <p className="mb-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">Your franchise is active. Authorized franchise operations, sales reporting, and compliance monitoring are now managed through the franchise portal.</p>}

                    {currentStatus === 'approved' && <section aria-labelledby={`dashboard-access-title-${application.id}`} className="mb-5 rounded-2xl border border-emerald-200 bg-[var(--franchise-success-bg)] p-4 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-[var(--franchise-success-text)]">Franchise dashboard access</p>
                          <h3 id={`dashboard-access-title-${application.id}`} className="mt-1 font-serif text-lg font-bold text-[var(--oppa-text)]">Congratulations! Your franchise is approved.</h3>
                          {dashboardProvisioned
                            ? <><p className="mt-1 text-sm leading-6 text-[var(--oppa-text-muted)]">Your franchise dashboard is ready. Manage your branch, orders, inventory, and account there.</p><p className="mt-2 text-sm font-medium text-[var(--oppa-text)]">Open your franchise dashboard to start managing your branch.</p></>
                            : <p role="status" className="mt-1 text-sm leading-6 text-[var(--oppa-text-muted)]">Dashboard being prepared. Your application is approved, but dashboard access details are not available yet. Please check back soon or contact the franchise team.</p>}
                        </div>
                        {dashboardProvisioned && <Link
                            to={`/franchise/login?email=${encodeURIComponent(application.email)}`}
                            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] sm:w-auto"
                          >
                            Go to franchise dashboard <ArrowRight size={17} aria-hidden="true" />
                          </Link>}
                      </div>
                      <dl className="mt-4 grid gap-2 border-t border-emerald-200/80 pt-3 text-sm sm:grid-cols-3">
                        <div><dt className="text-xs font-semibold text-[var(--oppa-text-muted)]">Branch</dt><dd className="mt-0.5 break-words font-medium">{application.franchise_name}</dd></div>
                        <div><dt className="text-xs font-semibold text-[var(--oppa-text-muted)]">Reference</dt><dd className="mt-0.5 break-all font-mono text-xs font-medium">{application.reference_number}</dd></div>
                        <div><dt className="text-xs font-semibold text-[var(--oppa-text-muted)]">Location</dt><dd className="mt-0.5 break-words font-medium">{application.location}</dd></div>
                      </dl>
                      {dashboardProvisioned && <p className="mt-3 text-xs leading-5 text-[var(--oppa-text-muted)]">Sign in with your franchise account using the same registered email and password from your applicant account{application.email ? ` (${application.email})` : ''}.</p>}
                    </section>}

                    {currentStatus !== 'rejected' && currentStatus !== 'location_assessment' && currentStatus !== 'approved' && !packetRequestOpen && <section className="franchise-next-step mb-5 rounded-2xl bg-[var(--oppa-cream)] p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-[var(--oppa-green)]" /> Your next step</div>
                      <p className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">{application.next_step_instructions || 'Your application is in the review queue. We will update this page when there is a next step.'}</p>
                      {currentStatus === 'for_interview' && (application.interview_at || application.interview_meeting_url || application.interview_location) && <div className="franchise-interview-card mt-3 rounded-xl border border-[var(--oppa-border)] bg-white p-4 text-sm">
                        {application.interview_at && <p className="font-medium">Interview (Philippine time): {formatPhilippineDateTime(application.interview_at)}</p>}
                        {application.interview_type && <p className="mt-1">Type: {application.interview_type === 'onsite' ? 'Onsite' : 'Online'}</p>}
                        {application.interview_location && <p className="mt-1">Location: {application.interview_location}</p>}
                        {application.interview_meeting_url && <a href={application.interview_meeting_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--oppa-green-dark)]">Join online interview</a>}
                      </div>}
                    </section>}

                    {showRequiredDocuments && (
                      <section className="franchise-feedback-anchor mb-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div><h3 className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Upload requested documents</h3><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Every requested item stays here so you can follow its review status.</p></div>
                          <span className="w-fit shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-950">{completedPacketDocuments} of {allRequiredDocuments.length} completed</span>
                        </div>
                        <div
                          ref={(element) => { uploadFeedbackRefs.current[application.id] = element; }}
                          tabIndex={focusSuccessId === application.id ? -1 : undefined}
                          className={`franchise-feedback-slot ${applicationFeedback[application.id]?.placement === 'upload' ? 'is-visible' : ''}`}
                        >
                          <div className="franchise-feedback-slot-content">
                            {applicationFeedback[application.id]?.placement === 'upload' && <InlineMessage
                              variant={applicationFeedback[application.id].variant}
                              title={applicationFeedback[application.id].title}
                              message={applicationFeedback[application.id].message}
                              onDismiss={() => {
                                setApplicationFeedback((current) => {
                                  const next = { ...current };
                                  delete next[application.id];
                                  return next;
                                });
                                setFocusSuccessId(null);
                              }}
                              className="mt-3"
                            />}
                          </div>
                        </div>
                        {!allRequiredDocuments.length ? <p className="mt-3 rounded-xl bg-white p-3 text-sm text-[var(--oppa-text-muted)]">There are no required documents for this application.</p> : <>
                          {shouldCollapseVerifiedDocuments && <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><Check size={17} aria-hidden="true" />{verifiedDocumentCount} of {allRequiredDocuments.length} documents verified</p>
                            <button
                              type="button"
                              aria-expanded={verifiedDocumentsExpanded}
                              onClick={() => setExpandedVerifiedDocuments((current) => ({ ...current, [application.id]: !current[application.id] }))}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm font-semibold text-[var(--oppa-green)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
                            >
                              {verifiedDocumentsExpanded ? 'Hide documents' : 'View documents'} <ChevronDown size={16} className={verifiedDocumentsExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} aria-hidden="true" />
                            </button>
                          </div>}
                          {(!shouldCollapseVerifiedDocuments || verifiedDocumentsExpanded) && <div className="mt-3 space-y-3">
                          {[...pendingPacketDocuments, ...underReviewDocuments, ...verifiedDocuments].map(({ document, index }, rowIndex) => {
                            const selectedFile = requiredResponseFiles[application.id]?.[index];
                            const isVerified = document.status === 'verified';
                            const isUnderReview = ['submitted', 'received'].includes(document.status);
                            const submittedIndex = document.submitted_document_index;
                            const submittedFile = typeof submittedIndex === 'number' ? application.documents?.[submittedIndex] : undefined;
                            const verifiedEvent = isVerified ? [...(application.events || [])].reverse().find((event) => event.title === 'Document verified' && event.message?.includes(`verified your submitted document: ${document.label}.`)) : undefined;
                            const statusText = isVerified ? 'Verified' : document.status === 'not_applicable' ? 'Not applicable' : isUnderReview ? 'Submitted / Under review' : document.status === 'rejected' ? 'Rejected / Needs resubmission' : selectedFile ? 'Selected' : 'Pending';
                            const statusStyle = isVerified || document.status === 'not_applicable' ? 'bg-emerald-50 text-emerald-800' : isUnderReview ? 'bg-sky-50 text-sky-800' : document.status === 'rejected' ? 'bg-red-50 text-red-800' : selectedFile ? 'bg-blue-50 text-blue-800' : 'bg-stone-100 text-stone-700';
                            const needsAction = pendingPacketDocuments.some((item) => item.index === index);
                            const groupHeading = rowIndex === 0
                              ? (pendingPacketDocuments.length ? 'Needs action' : underReviewDocuments.length ? 'Under review' : 'Verified')
                              : rowIndex === pendingPacketDocuments.length && underReviewDocuments.length ? 'Under review'
                                : rowIndex === pendingPacketDocuments.length + underReviewDocuments.length ? 'Verified' : '';
                            return <React.Fragment key={`${application.id}-${index}`}>{groupHeading && <h4 className="pt-2 text-xs font-bold uppercase tracking-[.12em] text-[var(--oppa-text-muted)]">{groupHeading}</h4>}<div className="franchise-requirement-card rounded-2xl border border-[var(--oppa-border)] bg-white p-4 text-sm">
                              <div className="flex flex-wrap items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]"><FileText size={16} aria-hidden="true" /></span><span className="font-semibold">{document.label}</span><span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">Required</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyle}`}>{statusText}</span></div>
                              <span className="mt-1 block text-xs text-[var(--oppa-text-muted)]">{requirementCategoryTitle(document.category)}</span>
                              {document.status === 'rejected' && document.reject_reason && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs leading-5 text-red-800">Please correct and resubmit: {document.reject_reason}</p>}
                              {(isVerified || isUnderReview) && (submittedFile || document.submitted_document_name) && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--oppa-cream)] p-3"><span className="flex min-w-0 items-center gap-2"><FileText size={16} className="shrink-0 text-[var(--oppa-green)]" aria-hidden="true" /><span className="min-w-0"><span className="block truncate font-medium" title={submittedFile?.name || document.submitted_document_name || ''}>{submittedFile?.name || document.submitted_document_name}</span>{submittedFile?.uploaded_at && <span className="block text-xs text-[var(--oppa-text-muted)]">Uploaded {formatPhilippineDateTime(submittedFile.uploaded_at)}</span>}</span></span>{typeof submittedIndex === 'number' && <button type="button" onClick={() => void handleDownload(application, submittedIndex, submittedFile?.name || document.submitted_document_name || document.label)} disabled={busyId === application.id} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--oppa-border)] bg-white px-3 text-xs font-semibold text-[var(--oppa-green)]"><Download size={14} />View / Download</button>}</div>}
                              {isVerified && <p className="mt-2 text-xs font-medium text-emerald-800">{verifiedEvent?.created_at ? `Verified ${formatPhilippineDateTime(verifiedEvent.created_at)}` : 'Verified by the franchise team'}</p>}
                              {document.template_name && <button type="button" onClick={() => void handleTemplateDownload(application, index, document.template_name || document.label)} disabled={busyId === application.id} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green)] disabled:opacity-60"><Download size={14} />Download file from franchisor</button>}
                              {!document.template_name && needsAction && <p className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-900">No template was attached. You can upload the requested document directly below.</p>}
                              {needsAction && <div className="mt-3">
                                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-950">Upload file for this requirement</p>
                                <input id={`required-response-${application.id}-${index}`} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-invalid={Boolean(requirementErrors[application.id]?.[index])} aria-describedby={requirementErrors[application.id]?.[index] ? `required-response-error-${application.id}-${index}` : undefined} className="peer sr-only" onChange={(event) => { const file = event.target.files?.[0]; chooseRequiredFile(application.id, index, file); if (file && (file.size > 10 * 1024 * 1024 || !['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(file.name.split('.').pop()?.toLowerCase() || ''))) event.target.value = ''; }} />
                                <label htmlFor={`required-response-${application.id}-${index}`} onDragOver={(event) => { event.preventDefault(); setDraggingRequirement(index); }} onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDraggingRequirement(null); }} onDrop={(event) => { event.preventDefault(); setDraggingRequirement(null); chooseRequiredFile(application.id, index, event.dataTransfer.files[0]); }} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-3 py-3 transition hover:border-[var(--oppa-green)] hover:bg-green-50 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--oppa-green)] peer-focus-visible:ring-offset-2 ${requirementErrors[application.id]?.[index] ? 'border-red-500 bg-red-50/50' : draggingRequirement === index ? 'border-[var(--oppa-green)] bg-green-50' : 'border-amber-400'}`}>
                                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"><Upload size={19} /></span>
                                  <span className="min-w-0 flex-1"><span className="block break-all font-semibold text-[var(--oppa-text)]">{selectedFile?.name || 'Tap here to choose your completed file'}</span><span className="mt-0.5 block text-xs text-[var(--oppa-text-muted)]">{selectedFile ? 'Ready to submit' : 'Select the filled-out file from your device'}</span></span>
                                  <span className="shrink-0 rounded-lg bg-[var(--oppa-green)] px-3 py-2 text-xs font-bold text-white">{selectedFile ? 'Replace file' : 'Choose file'}</span>
                                </label>
                                {requirementErrors[application.id]?.[index] && <div id={`required-response-error-${application.id}-${index}`} className="mt-2"><InlineMessage variant="error" message={requirementErrors[application.id][index]} compact /></div>}
                                {selectedFile && <div className="mt-2 flex items-center justify-between gap-2 text-xs"><span className="text-[var(--oppa-text-muted)]">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB · Ready to submit</span><button type="button" onClick={() => { setRequiredResponseFiles((current) => { const next = { ...(current[application.id] || {}) }; delete next[index]; return { ...current, [application.id]: next }; }); const input = window.document.getElementById(`required-response-${application.id}-${index}`) as HTMLInputElement | null; if (input) input.value = ''; }} className="font-semibold text-red-700 underline">Remove file</button></div>}
                                </div>}
                            </div></React.Fragment>;
                          })}
                        </div>}
                        {!shouldCollapseVerifiedDocuments && allPacketDocumentsResolved ? <div role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"><Check size={18} aria-hidden="true" />{allPacketDocumentsVerified ? 'All required documents verified' : 'All applicable required documents complete'}</div> : pendingPacketDocuments.length > 0 && <div className="mt-3 rounded-xl border border-[var(--oppa-green)]/30 bg-green-50 p-3">
                          <p className="mb-2 text-center text-sm font-semibold text-green-900">{selectedPacketFiles === pendingPacketDocuments.length ? 'All required files are ready to submit.' : `Select ${pendingPacketDocuments.length - selectedPacketFiles} more required ${pendingPacketDocuments.length - selectedPacketFiles === 1 ? 'file' : 'files'} to continue.`}</p>
                          <button type="button" onClick={() => void handleResponse(application)} disabled={busyId === application.id || !pendingPacketDocuments.length || selectedPacketFiles !== pendingPacketDocuments.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Upload size={16} />{busyId === application.id ? 'Submitting forms…' : 'Submit all completed forms'}</button>
                        </div>}
                        </>}
                      </section>
                    )}

                    {application.documents?.length ? <section className="mb-5"><h3 className="mb-2 font-serif text-lg font-semibold">Your supporting documents</h3>{applicationFeedback[application.id]?.placement === 'supporting' && <div className="mb-3"><InlineMessage
                      variant={applicationFeedback[application.id].variant}
                      message={applicationFeedback[application.id].message}
                      onDismiss={() => setApplicationFeedback((current) => {
                        const next = { ...current };
                        delete next[application.id];
                        return next;
                      })}
                    /></div>}<ul className="grid gap-2 sm:grid-cols-2">{application.documents.slice(0, expandedSupportingDocuments[application.id] ? undefined : 4).map((file, index) => <li key={`${file.name}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--oppa-border)] bg-white p-3"><span className="flex min-w-0 items-center gap-2 text-sm"><FileText size={16} className="shrink-0 text-[var(--oppa-green)]" /><span className="truncate" title={file.name}>{file.name}</span></span><button type="button" onClick={() => void handleDownload(application, index, file.name)} disabled={busyId === application.id} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--oppa-green)]"><Download size={14} />Download</button></li>)}</ul>{application.documents.length > 4 && <button type="button" onClick={() => setExpandedSupportingDocuments((current) => ({ ...current, [application.id]: !current[application.id] }))} className="mt-2 min-h-9 text-sm font-semibold text-[var(--oppa-green)]">{expandedSupportingDocuments[application.id] ? 'Show fewer' : `Show all (${application.documents.length})`}</button>}</section> : null}

                    <FranchiseTimeline events={uniqueTimelineEvents(timelineEvents, Boolean(application.interview_at))} />

                    {applicationFeedback[application.id]?.placement === 'card' && <div className="mt-5"><InlineMessage
                      variant={applicationFeedback[application.id].variant}
                      title={applicationFeedback[application.id].title}
                      message={applicationFeedback[application.id].message}
                      onDismiss={() => setApplicationFeedback((current) => {
                        const next = { ...current };
                        delete next[application.id];
                        return next;
                      })}
                    /></div>}
                    {canWithdraw && <div className="mt-7 border-t border-[var(--oppa-border)] pt-5"><button type="button" onClick={() => void handleWithdraw(application)} disabled={busyId === application.id} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"><RotateCcw size={14} />Withdraw this application</button></div>}
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

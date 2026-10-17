import React, { useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, Clock3, Download, Loader2, Search, Upload } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  downloadMyFranchiseApplicationDocument,
  downloadTrackedFranchiseDocumentTemplate,
  submitTrackedFranchiseDocuments,
  trackFranchiseApplication,
  type ApplicantFranchiseApplication,
} from '../../../services/franchiseApplicationService';
import { FRANCHISE_APPLICATION_STAGES, franchiseStageIndex, franchiseStatusLabel } from '../../../services/franchiseWorkflow';

const formatPhilippineDateTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
}).format(new Date(value));

const requirementCategoryLabel = (category?: string) => ({
  agreement_signing: 'Agreement and signing',
  payment: 'Payment receipt/reference',
  location_readiness: 'Location readiness',
  permits_compliance: 'Permits and compliance',
  operational_preparation: 'System and operational preparation',
}[category || ''] || 'Required document');

const FranchiseTrackApplicationPage: React.FC = () => {
  const location = useLocation();
  const routeState = location.state as { referenceNumber?: string; email?: string } | null;
  const [referenceNumber, setReferenceNumber] = useState(routeState?.referenceNumber || '');
  const [email, setEmail] = useState(routeState?.email || '');
  const [application, setApplication] = useState<ApplicantFranchiseApplication | null>(null);
  const [trackedLookup, setTrackedLookup] = useState<{ referenceNumber: string; email: string } | null>(null);
  const [loading, setLoading] = useState(Boolean(routeState?.referenceNumber && routeState.email));
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [actionBusy, setActionBusy] = useState('');
  const [documentFiles, setDocumentFiles] = useState<Record<number, File>>({});

  useEffect(() => {
    if (!routeState?.referenceNumber || !routeState.email) return;
    let active = true;
    const lookup = { referenceNumber: routeState.referenceNumber, email: routeState.email };
    trackFranchiseApplication(lookup.referenceNumber, lookup.email)
      .then((data) => {
        if (active) {
          setTrackedLookup(lookup);
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

  const applicationId = application?.id;
  useEffect(() => {
    if (!applicationId || !trackedLookup) return;
    let active = true;
    let requestInFlight = false;
    const refresh = async () => {
      if (requestInFlight || document.visibilityState !== 'visible') return;
      requestInFlight = true;
      try {
        const latest = await trackFranchiseApplication(trackedLookup.referenceNumber, trackedLookup.email);
        if (active) {
          setApplication(latest);
          setError('');
        }
      } catch (trackError) {
        if (active) setError(trackError instanceof Error ? trackError.message : 'Unable to refresh your application status.');
      } finally {
        requestInFlight = false;
      }
    };
    const interval = window.setInterval(() => void refresh(), 5000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [applicationId, trackedLookup]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setApplication(null);
    setTrackedLookup(null);
    setActionError('');
    setActionMessage('');
    setDocumentFiles({});
    try {
      const lookup = { referenceNumber: referenceNumber.trim(), email: email.trim() };
      const result = await trackFranchiseApplication(lookup.referenceNumber, lookup.email);
      setTrackedLookup(lookup);
      setApplication(result);
    } catch (trackError) {
      setError(trackError instanceof Error ? trackError.message : 'Unable to find your franchise application.');
    } finally {
      setLoading(false);
    }
  };

  const requiredDocuments = (application?.required_documents || [])
    .map((document, index) => ({ ...document, index }))
    .filter((document) => document.required);
  const documentsToSubmit = requiredDocuments.filter(
    (item) => !['verified', 'not_applicable'].includes(item.status),
  );
  const selectedDocumentCount = documentsToSubmit.filter((item) => documentFiles[item.index]).length;
  const packetNeedsApplicantAction = requiredDocuments.some((item) => ['pending', 'rejected'].includes(item.status));
  const showRequirements = Boolean(
    application
      && application.status !== 'approved'
      && application.status !== 'active'
      && application.status !== 'rejected'
      && application.status !== 'withdrawn'
      && (application.status === 'location_assessment'
        || application.requirements_reviewed_at
        || application.required_documents?.length),
  );
  const downloadTemplate = async (index: number, name: string) => {
    if (!trackedLookup) return;
    setActionBusy(`template-${index}`);
    setActionError('');
    try {
      const blob = await downloadTrackedFranchiseDocumentTemplate(
        trackedLookup.referenceNumber,
        trackedLookup.email,
        index,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setActionError(downloadError instanceof Error ? downloadError.message : 'Unable to download this template.');
    } finally {
      setActionBusy('');
    }
  };

  const downloadSubmittedDocument = async (documentIndex: number, name: string) => {
    if (!application) return;
    setActionBusy(`submitted-${documentIndex}`);
    setActionError('');
    try {
      const blob = await downloadMyFranchiseApplicationDocument(application.id, documentIndex);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setActionError(downloadError instanceof Error ? downloadError.message : 'Unable to download this document.');
    } finally {
      setActionBusy('');
    }
  };

  const submitDocuments = async () => {
    if (!application || !trackedLookup) return;
    const missing = requiredDocuments.filter((item) =>
      !['verified', 'not_applicable'].includes(item.status) && !documentFiles[item.index],
    );
    if (missing.length) {
      setActionError(`Choose a file for every required document: ${missing.map((item) => item.label).join(', ')}.`);
      return;
    }
    if (Object.keys(documentFiles).length > 8) {
      setActionError('Submit no more than 8 documents in one response.');
      return;
    }
    setActionBusy('documents');
    setActionError('');
    setActionMessage('');
    try {
      const result = await submitTrackedFranchiseDocuments(
        trackedLookup.referenceNumber,
        trackedLookup.email,
        documentFiles,
      );
      setApplication(result.data);
      setDocumentFiles({});
      setActionMessage(result.message || 'Your documents were submitted for review.');
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : 'Unable to submit your documents.');
    } finally {
      setActionBusy('');
    }
  };

  const status = application?.status || 'under_review';
  const applicantStatusLabel = franchiseStatusLabel(status);
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

        {!application && (!routeState?.referenceNumber || !routeState.email || error) && (
          <form onSubmit={handleSubmit} className="mb-6 grid gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:grid-cols-2">
            <label className="text-sm font-medium text-[var(--oppa-text)]">Application reference number<input required maxLength={32} value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="OPPA-2026-XXXXXXXX" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] bg-white px-3 py-2.5 text-sm font-normal text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)] focus:outline-none focus:ring-0" style={{ WebkitTextFillColor: 'var(--oppa-text)', WebkitBoxShadow: '0 0 0 1000px white inset' }} /></label>
            <label className="text-sm font-medium text-[var(--oppa-text)]">Contact email<input required type="email" maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] bg-white px-3 py-2.5 text-sm font-normal text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)] focus:outline-none focus:ring-0" style={{ WebkitTextFillColor: 'var(--oppa-text)', WebkitBoxShadow: '0 0 0 1000px white inset' }} /></label>
            <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"><Search size={16} />{loading ? 'Checking application…' : 'Check application status'}</button>
          </form>
        )}

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading && !application && <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)]"><Loader2 className="mx-auto size-6 animate-spin text-[var(--oppa-green)]" /><p className="mt-3">Looking up your application…</p></div>}
        {application && (
          <article className="overflow-hidden rounded-3xl border border-[var(--oppa-border)] bg-white shadow-sm">
            <header className="flex flex-col gap-3 border-b border-[var(--oppa-border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div><p className="font-mono text-xs text-[var(--oppa-text-muted)]">{application.reference_number}</p><h2 className="mt-1 text-xl font-bold text-[var(--oppa-text)]">{application.franchise_name}</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Proposed location: {application.location}</p></div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-sm font-semibold ${status === 'rejected' ? 'bg-red-50 text-red-700' : ['approved', 'active', 'approved_for_opening'].includes(status) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}>{applicantStatusLabel}</span>
            </header>
            <div className="space-y-5 p-5 sm:p-6">
              {status === 'rejected' && <section role="status" className="rounded-2xl border border-red-200 bg-red-50 p-4"><h3 className="font-semibold text-red-900">Application not approved</h3><p className="mt-1 text-sm leading-6 text-red-800">{application.next_step_instructions || 'The franchisor has reviewed your application and decided not to proceed.'}</p></section>}
              {['approved', 'active'].includes(status) && <section role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-700" /><div>
                  <h3 className="text-lg font-semibold text-emerald-950">Your franchise is approved</h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">Your franchise dashboard is active. Sign in with the registered email and password you used for your applicant account.</p>
                  <Link to={`/franchise/login?email=${encodeURIComponent(application.email)}`} className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">Go to franchise login</Link>
                </div></div>
                <ol className="mt-5 grid gap-2 sm:grid-cols-4">
                  {['Received', 'Under review', 'Interview', 'Decision'].map((item, index) => <li key={item} className="rounded-xl border border-emerald-200 bg-white/80 p-3 text-sm text-emerald-950"><span className="font-semibold">{index + 1}. {item}</span><span className="mt-1 block text-xs text-emerald-800">{index === 3 ? 'Approved' : 'Completed'}</span></li>)}
                </ol>
              </section>}
              {showProgress && <section className="rounded-2xl border border-[var(--oppa-border)] p-4">
                <h3 className="mb-3 text-sm font-semibold">Franchise process</h3>
                <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                  {FRANCHISE_APPLICATION_STAGES.map((stage, index) => {
                    const complete = index < stageIndex;
                    const current = index === stageIndex;
                    return <li key={stage.status} aria-current={current ? 'step' : undefined} className={`rounded-xl p-3 text-xs ${current ? 'bg-[var(--oppa-green)] text-white' : complete ? 'bg-green-50 text-green-800' : 'bg-[var(--oppa-cream)] text-[var(--oppa-text-muted)]'}`}><span className="font-semibold">{index + 1}. {stage.label}</span><span className="mt-1 block">{current ? `Current: ${franchiseStatusLabel(status)}` : complete ? 'Completed' : 'Next stage'}</span></li>;
                  })}
                </ol>
              </section>}
              {application.documents?.length ? <section className="rounded-2xl border border-[var(--oppa-border)] p-4">
                <h3 className="mb-3 font-semibold">Submitted documents</h3>
                <ul className="space-y-2">{application.documents.map((document, index) => <li key={`${document.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-[var(--oppa-cream)] p-3">
                  <BriefcaseBusiness className="size-5 shrink-0 text-[var(--oppa-green)]" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{document.name}</span><span className="text-xs text-[var(--oppa-text-muted)]">{(document.size / (1024 * 1024)).toFixed(document.size < 1024 * 1024 ? 0 : 1)} MB</span></span>
                  <span className="text-xs font-medium text-[var(--oppa-text-muted)]">Read only</span>
                </li>)}</ul>
              </section> : null}
              {status !== 'rejected' && !['approved', 'active'].includes(status) && <section className="rounded-2xl bg-[var(--oppa-cream)] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} className="text-[var(--oppa-green)]" /> Your next step</div>
                <p className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">{application.next_step_instructions || 'Your application is in the review queue. We will update this page when there is a next step.'}</p>
                {(application.interview_at || application.interview_meeting_url || application.interview_location) && <div className="mt-3 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 text-sm">
                  {application.interview_at && <p className="font-medium">Interview (Philippine time): {formatPhilippineDateTime(application.interview_at)}</p>}
                  {application.interview_type && <p className="mt-1">Type: {application.interview_type === 'onsite' ? 'Onsite' : 'Online'}</p>}
                  {application.interview_location && <p className="mt-1">Location: {application.interview_location}</p>}
                  {application.interview_meeting_url && <div className="mt-2">
                    <p className="font-medium text-[var(--oppa-text)]">Online meeting link</p>
                    <a href={application.interview_meeting_url} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all font-medium text-[var(--oppa-green)] underline">{application.interview_meeting_url}</a>
                    <a href={application.interview_meeting_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-lg bg-[var(--oppa-green)] px-3 py-2 font-semibold text-white hover:bg-[var(--oppa-green-dark)]">Join online interview</a>
                  </div>}
                </div>}
              </section>}
              {showRequirements && <>
                {(actionError || actionMessage) && <p role={actionError ? 'alert' : 'status'} className={`rounded-xl p-3 text-sm ${actionError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{actionError || actionMessage}</p>}
                <section className="rounded-2xl border border-[var(--oppa-border)] p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div><h3 className="font-semibold">Upload requested documents</h3><p className="mt-1 text-xs leading-5 text-[var(--oppa-text-muted)]">Upload a file for each requirement below. If the franchise team attached a template, download and complete it first. Templates are optional. Submit all required files together. PDF, DOC, DOCX, JPG, or PNG; up to 10 MB each.</p></div>
                    <span className="w-fit shrink-0 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">{selectedDocumentCount} of {documentsToSubmit.length} files selected</span>
                  </div>
                  {!requiredDocuments.length ? <p className="mt-4 rounded-xl bg-[var(--oppa-cream)] p-3 text-sm text-[var(--oppa-text-muted)]">The franchise team is preparing your document packet.</p> : <div className="mt-4 space-y-3">
                    {requiredDocuments.map((item) => {
                      const underReview = ['submitted', 'received'].includes(item.status);
                      const alreadyComplete = ['verified', 'not_applicable'].includes(item.status);
                      const submittedDocument = [...(application?.documents || [])]
                        .map((file, documentIndex) => ({ ...file, documentIndex }))
                        .reverse()
                        .find((file) => file.required_document_label === item.label);
                      const statusText = item.status === 'verified' ? 'Verified'
                        : item.status === 'rejected' ? 'Rejected'
                          : underReview ? 'Under review'
                            : item.status === 'not_applicable' ? 'Not applicable'
                              : 'Pending';
                      const downloadAction = submittedDocument?.name ? () => void downloadSubmittedDocument(submittedDocument.documentIndex, submittedDocument.name) : item.template_name ? () => void downloadTemplate(item.index, item.template_name || 'franchise-requirement-file') : undefined;
                      return <div key={item.index} className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start ${!alreadyComplete && packetNeedsApplicantAction ? 'border-amber-300 bg-amber-50/70' : 'border-[var(--oppa-border)] bg-[var(--oppa-cream)]'}`}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-[var(--oppa-text)]">{item.label}</p><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-green)]">Required</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === 'verified' ? 'bg-green-100 text-green-800' : item.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{statusText}</span></div>
                          <p className="mt-1 text-[11px] font-medium text-[var(--oppa-text-muted)]">{requirementCategoryLabel(item.category)}</p>
                          {item.submitted_document_name && <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Submitted file: {item.submitted_document_name}</p>}
                          {item.status === 'rejected' && item.reject_reason && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs leading-5 text-red-800">Please correct and resubmit: {item.reject_reason}</p>}
                          {!alreadyComplete && packetNeedsApplicantAction && <div className="mt-3">
                            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-950">{underReview ? 'Upload an updated document' : 'Upload file for this requirement'}</p>
                            <input id={`document-upload-${application.id}-${item.index}`} key={`${application.id}-${item.index}-${application.updated_at}`} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            const extension = file.name.split('.').pop()?.toLowerCase();
                            if (!['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(extension || '')) {
                              setActionError('Choose a PDF, DOC, DOCX, JPG, or PNG file.');
                              event.target.value = '';
                              return;
                            }
                            if (file.size > 10 * 1024 * 1024) {
                              setActionError('Each document must be 10 MB or smaller.');
                              event.target.value = '';
                              return;
                            }
                            setActionError('');
                            setDocumentFiles((current) => ({ ...current, [item.index]: file }));
                          }} className="peer sr-only" />
                            <label htmlFor={`document-upload-${application.id}-${item.index}`} className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-amber-500 bg-white px-3 py-3 transition hover:border-[var(--oppa-green)] hover:bg-green-50 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--oppa-green)] peer-focus-visible:ring-offset-2">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"><Upload size={19} /></span>
                              <span className="min-w-0 flex-1">
                                <span className="block break-all text-sm font-semibold text-[var(--oppa-text)]">{documentFiles[item.index]?.name || 'Tap here to choose your file'}</span>
                                <span className="mt-0.5 block text-xs text-[var(--oppa-text-muted)]">{documentFiles[item.index] ? 'File ready to submit' : 'Choose the filled-out file from your device'}</span>
                              </span>
                              <span className="shrink-0 rounded-lg bg-[var(--oppa-green)] px-3 py-2 text-xs font-bold text-white">Choose file</span>
                            </label>
                          </div>}
                          {underReview && !packetNeedsApplicantAction && <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">The franchise team is reviewing this submission.</p>}
                        </div>
                        {downloadAction && <button type="button" onClick={downloadAction} disabled={actionBusy === `template-${item.index}` || actionBusy === `submitted-${submittedDocument?.documentIndex ?? -1}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--oppa-green)] disabled:opacity-60"><Download size={14} />{actionBusy === `template-${item.index}` || actionBusy === `submitted-${submittedDocument?.documentIndex ?? -1}` ? 'Preparing…' : 'Download file'}</button>}
                      </div>;
                    })}
                    {packetNeedsApplicantAction && <div className="rounded-xl border border-[var(--oppa-green)]/30 bg-green-50 p-3">
                      <p className="mb-2 text-center text-sm font-semibold text-green-900">{selectedDocumentCount === documentsToSubmit.length ? 'All required files are ready to submit.' : `Select ${documentsToSubmit.length - selectedDocumentCount} more required ${documentsToSubmit.length - selectedDocumentCount === 1 ? 'file' : 'files'} to continue.`}</p>
                      <button type="button" onClick={() => void submitDocuments()} disabled={actionBusy !== '' || selectedDocumentCount !== documentsToSubmit.length} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Upload size={16} />{actionBusy === 'documents' ? 'Submitting documents…' : 'Submit all documents'}</button>
                    </div>}
                  </div>}
                </section>
              </>}
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

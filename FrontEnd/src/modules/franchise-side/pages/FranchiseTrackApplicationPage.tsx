import React, { useEffect, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, CheckCircle2, Clock3, Download, Loader2, Search, Upload } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  downloadTrackedFranchiseDocumentTemplate,
  submitTrackedFranchiseDocuments,
  submitTrackedFranchisePaymentProof,
  trackFranchiseApplication,
  type ApplicantFranchiseApplication,
} from '../../../services/franchiseApplicationService';
import { FRANCHISE_APPLICATION_STAGES, franchiseStageIndex, franchiseStatusLabel } from '../../../services/franchiseWorkflow';

const formatPhilippineDateTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
}).format(new Date(value));

const TrackInfo: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">{label}</p>
    <p className="mt-1 text-sm capitalize text-[var(--oppa-text)]">{value}</p>
  </div>
);

const agreementStatusLabel = (status?: string) => ({
  not_started: 'Not started',
  drafting: 'Prepared',
  sent: 'For signing',
  signed: 'Signed',
}[status || 'not_started'] || status || 'Not started');

const paymentStatusLabel = (status?: string) => ({
  not_configured: 'Not configured',
  pending: 'Pending',
  submitted: 'Submitted',
  paid: 'Verified',
  rejected: 'Rejected',
  waived: 'Waived',
  not_applicable: 'Not applicable',
}[status || 'not_configured'] || status || 'Not configured');

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
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentProof, setPaymentProof] = useState<File | null>(null);

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
    setPaymentReference('');
    setPaymentProof(null);
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
  const packetNeedsApplicantAction = requiredDocuments.some((item) => ['pending', 'rejected'].includes(item.status));
  const showRequirements = Boolean(
    application
      && application.status !== 'rejected'
      && application.status !== 'withdrawn'
      && (application.status === 'location_assessment'
        || application.requirements_reviewed_at
        || application.required_documents?.length),
  );
  const paymentProofFile = paymentProof;

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

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trackedLookup || !paymentProof) {
      setActionError('Enter the payment reference and select proof of payment.');
      return;
    }
    if (paymentProof.size > 5 * 1024 * 1024) {
      setActionError('Payment proof must be 5 MB or smaller.');
      return;
    }
    setActionBusy('payment');
    setActionError('');
    setActionMessage('');
    try {
      const result = await submitTrackedFranchisePaymentProof(
        trackedLookup.referenceNumber,
        trackedLookup.email,
        paymentReference.trim(),
        paymentProof,
      );
      setApplication(result.data);
      setPaymentProof(null);
      setActionMessage(result.message || 'Your payment reference and proof were submitted for review.');
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : 'Unable to submit your payment proof.');
    } finally {
      setActionBusy('');
    }
  };

  const status = application?.status || 'under_review';
  const stageIndex = application ? franchiseStageIndex(application) : -1;
  const showProgress = status !== 'rejected' && status !== 'withdrawn';
  const outstandingRequirements = application ? [
    ...requiredDocuments
      .filter((item) => item.status !== 'verified' && item.status !== 'not_applicable')
      .map((item) => `${item.label}: ${item.status === 'rejected' ? 'resubmission required' : item.status === 'submitted' || item.status === 'received' ? 'under review' : 'not submitted'}`),
    ...(application.franchise_fee_amount && !['paid', 'waived', 'not_applicable'].includes(application.franchise_fee_payment_status || '')
      ? ['Franchise fee payment: not verified']
      : []),
    ...(application.agreement_status !== 'signed' ? ['Franchise agreement: not signed'] : []),
    ...(!['ready', 'not_applicable'].includes(application.location_readiness || '') ? ['Location readiness: incomplete'] : []),
    ...(!['verified', 'not_applicable'].includes(application.permit_compliance_status || '') ? ['Permits and compliance: incomplete'] : []),
    ...(!['complete', 'not_applicable'].includes(application.training_status || '') ? ['Training: incomplete'] : []),
    ...(!['complete', 'not_applicable'].includes(application.operational_preparation_status || '') ? ['System and operational preparation: incomplete'] : []),
  ] : [];

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
                {status === 'for_interview' && (application.interview_at || application.interview_meeting_url || application.interview_location) && <div className="mt-3 rounded-xl bg-white p-3 text-sm">
                  {application.interview_at && <p className="font-medium">Interview (Philippine time): {formatPhilippineDateTime(application.interview_at)}</p>}
                  {application.interview_type && <p className="mt-1">Type: {application.interview_type === 'onsite' ? 'Onsite' : 'Online'}</p>}
                  {application.interview_location && <p className="mt-1">Location: {application.interview_location}</p>}
                  {application.interview_meeting_url && <a href={application.interview_meeting_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex font-semibold text-[var(--oppa-green)] underline">Join online interview</a>}
                </div>}
              </section>}
              {showRequirements && <>
                {(actionError || actionMessage) && <p role={actionError ? 'alert' : 'status'} className={`rounded-xl p-3 text-sm ${actionError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{actionError || actionMessage}</p>}
                <section className="rounded-2xl border border-[var(--oppa-border)] p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div><h3 className="font-semibold">Required documents</h3><p className="mt-1 text-xs leading-5 text-[var(--oppa-text-muted)]">Download each blank form, complete it, then submit all required files together. PDF, DOC, DOCX, JPG, or PNG up to 10 MB each.</p></div>
                    <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{requiredDocuments.length} required</span>
                  </div>
                  {!requiredDocuments.length ? <p className="mt-4 rounded-xl bg-[var(--oppa-cream)] p-3 text-sm text-[var(--oppa-text-muted)]">The franchise team is preparing the application-specific document checklist.</p> : <div className="mt-4 space-y-3">
                    {requiredDocuments.map((item) => {
                      const underReview = ['submitted', 'received'].includes(item.status);
                      const alreadyComplete = ['verified', 'not_applicable'].includes(item.status);
                      const statusText = item.status === 'verified' ? 'Verified'
                        : item.status === 'rejected' ? 'Rejected'
                          : underReview ? 'Under review'
                            : item.status === 'not_applicable' ? 'Not applicable'
                              : 'Pending';
                      return <div key={item.index} className="grid gap-3 rounded-xl bg-[var(--oppa-cream)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-[var(--oppa-text)]">{item.label}</p><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--oppa-green)]">Required</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === 'verified' ? 'bg-green-100 text-green-800' : item.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{statusText}</span></div>
                          {item.submitted_document_name && <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Submitted file: {item.submitted_document_name}</p>}
                          {item.status === 'rejected' && item.reject_reason && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs leading-5 text-red-800">Please correct and resubmit: {item.reject_reason}</p>}
                          {!alreadyComplete && packetNeedsApplicantAction && <label className="mt-3 block text-xs font-medium">{underReview ? 'Include updated document in this response' : 'Upload completed document'}<input key={`${application.id}-${item.index}-${application.updated_at}`} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => {
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
                          }} className="mt-1 block w-full rounded-lg border border-[var(--oppa-border)] bg-white p-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-[var(--oppa-cream)] file:px-2 file:py-1" />{documentFiles[item.index] && <span className="mt-1 block break-all text-[var(--oppa-green)]">{documentFiles[item.index].name}</span>}</label>}
                          {underReview && !packetNeedsApplicantAction && <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">The franchise team is reviewing this submission.</p>}
                        </div>
                        {item.template_name && <button type="button" onClick={() => void downloadTemplate(item.index, item.template_name || 'required-document-template')} disabled={actionBusy === `template-${item.index}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--oppa-green)] disabled:opacity-60"><Download size={14} />{actionBusy === `template-${item.index}` ? 'Preparing…' : 'Download form'}</button>}
                      </div>;
                    })}
                    {packetNeedsApplicantAction && <button type="button" onClick={() => void submitDocuments()} disabled={actionBusy !== ''} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><Upload size={16} />{actionBusy === 'documents' ? 'Submitting documents…' : 'Submit all documents'}</button>}
                  </div>}
                </section>

                <section className="rounded-2xl border border-[var(--oppa-border)] p-4 sm:p-5">
                  <h3 className="font-semibold">Franchise payment</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-[var(--oppa-cream)] p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Agreed franchise fee</p><p className="mt-1 text-lg font-bold text-[var(--oppa-text)]">{application.franchise_fee_amount ? `₱${Number(application.franchise_fee_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : 'Not configured yet'}</p></div>
                    <div className="rounded-xl bg-[var(--oppa-cream)] p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Payment status</p><p className="mt-1 text-sm font-semibold">{paymentStatusLabel(application.franchise_fee_payment_status)}</p>{application.franchise_fee_payment_reference && <p className="mt-1 break-all text-xs text-[var(--oppa-text-muted)]">Reference: {application.franchise_fee_payment_reference}</p>}</div>
                  </div>
                  {application.franchise_fee_payment_reject_reason && application.franchise_fee_payment_status === 'rejected' && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">Payment proof needs attention: {application.franchise_fee_payment_reject_reason}</p>}
                  {application.franchise_fee_amount && ['pending', 'rejected'].includes(application.franchise_fee_payment_status || '') && <form onSubmit={submitPayment} className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium sm:col-span-2">Payment reference number<input required maxLength={255} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" /></label>
                    <label className="text-sm font-medium sm:col-span-2">Receipt or proof of payment<input required type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      if (file && file.size > 5 * 1024 * 1024) {
                        setActionError('Payment proof must be 5 MB or smaller.');
                        event.target.value = '';
                        setPaymentProof(null);
                        return;
                      }
                      setActionError('');
                      setPaymentProof(file);
                    }} className="mt-1 block w-full rounded-lg border border-[var(--oppa-border)] p-2 text-xs" /><span className="mt-1 block text-xs font-normal text-[var(--oppa-text-muted)]">JPG, PNG, WEBP, or PDF, up to 5 MB.</span>{paymentProofFile && <span className="mt-1 block break-all text-xs text-[var(--oppa-green)]">{paymentProofFile.name}</span>}</label>
                    <button type="submit" disabled={actionBusy !== ''} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2"><Upload size={16} />{actionBusy === 'payment' ? 'Submitting payment…' : 'Submit payment proof'}</button>
                  </form>}
                  {application.franchise_fee_payment_status === 'submitted' && <p className="mt-3 text-sm text-[var(--oppa-text-muted)]">Your payment is waiting for verification by the franchise team.</p>}
                </section>

                <section className="rounded-2xl border border-[var(--oppa-border)] p-4 sm:p-5">
                  <h3 className="font-semibold">Agreement status</h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <TrackInfo label="Status" value={agreementStatusLabel(application.agreement_status)} />
                    <TrackInfo label="Prepared date" value={application.agreement_prepared_at ? new Date(application.agreement_prepared_at).toLocaleDateString('en-PH') : 'Not prepared'} />
                    <TrackInfo label="Signing date" value={application.agreement_signed_at ? new Date(application.agreement_signed_at).toLocaleDateString('en-PH') : 'Not signed'} />
                  </div>
                  <h4 className="mt-5 text-sm font-semibold">Readiness checklist</h4>
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {[
                      ['Location readiness', application.location_readiness || 'pending'],
                      ['Permits and compliance', application.permit_compliance_status || 'pending'],
                      ['Training', application.training_status || 'pending'],
                      ['System and operational preparation', application.operational_preparation_status || 'pending'],
                    ].map(([label, value]) => <li key={label} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--oppa-cream)] px-3 py-2 text-xs"><span>{label}</span><span className="rounded-full bg-white px-2 py-1 font-semibold capitalize">{value.replaceAll('_', ' ')}</span></li>)}
                  </ul>
                  <h4 className="mt-5 text-sm font-semibold">Outstanding requirements</h4>
                  {outstandingRequirements.length ? <ul className="mt-2 space-y-1.5 text-sm text-[var(--oppa-text-muted)]">{outstandingRequirements.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true">•</span><span>{item}</span></li>)}</ul> : <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-green-800"><CheckCircle2 size={16} />All listed readiness requirements are complete.</p>}
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

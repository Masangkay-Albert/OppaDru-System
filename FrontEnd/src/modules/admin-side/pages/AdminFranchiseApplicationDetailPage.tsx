import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Save } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { ConfirmDialog } from '../components/AdminUI';
import {
  activateFranchiseApplication,
  downloadFranchiseApplicationDocument,
  getFranchiseApplication,
  reviewFranchiseApplication,
  updateFranchiseApplicationRequirements,
  type FranchiseApplication,
} from '../../../services/franchiseAdminService';
import { franchiseStatusLabel } from '../../../services/franchiseWorkflow';

const statusTitle = franchiseStatusLabel;
const money = (amount?: string | number) => amount === undefined || amount === null ? 'Not provided' : `₱${Number(amount).toLocaleString('en-PH')}`;
const manilaTimeZone = 'Asia/Manila';

const toManilaDateTimeInput = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: manilaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((valuePart) => valuePart.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
};

const manilaDateTimeInputToIso = (value: string): string =>
  value ? new Date(`${value}:00+08:00`).toISOString() : '';

const minimumManilaDateTime = (): string =>
  toManilaDateTimeInput(new Date(Date.now() + 60_000).toISOString());

const todayInManila = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: manilaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

type FranchiseRequirementDocument = {
  label: string;
  required: boolean;
  status: string;
  category?: string;
  template_name?: string | null;
  submitted_document_name?: string | null;
  submitted_document_index?: number | null;
  reject_reason?: string | null;
};

const requirementCategories = [
  ['agreement_signing', 'Agreement and signing'],
  ['payment', 'Payment receipt/reference'],
  ['application_documents', 'Application-specific documents'],
  ['location_readiness', 'Location readiness'],
  ['permits_compliance', 'Permits and compliance'],
  ['training', 'Training'],
  ['operational_preparation', 'System and operational preparation'],
] as const;

const FranchiseRequirementsForm: React.FC<{
  application: FranchiseApplication;
  onSaved: () => Promise<void>;
  onDownload: (index: number, name: string) => void;
}> = ({ application, onSaved, onDownload }) => {
  const [agreementStatus, setAgreementStatus] = useState(application.agreement_status || 'not_started');
  const [agreementPreparedAt, setAgreementPreparedAt] = useState(application.agreement_prepared_at?.slice(0, 10) || '');
  const [agreementSignedAt, setAgreementSignedAt] = useState(application.agreement_signed_at?.slice(0, 10) || '');
  const [feeAmount, setFeeAmount] = useState(application.franchise_fee_amount ? String(application.franchise_fee_amount) : '');
  const [feeStatus, setFeeStatus] = useState(application.franchise_fee_payment_status || 'not_configured');
  const [feeRejectReason, setFeeRejectReason] = useState(application.franchise_fee_payment_reject_reason || '');
  const [documents, setDocuments] = useState<FranchiseRequirementDocument[]>(application.required_documents || []);
  const [documentTemplates, setDocumentTemplates] = useState<Record<number, File>>({});
  const [locationReadiness, setLocationReadiness] = useState(application.location_readiness || 'pending');
  const [permitStatus, setPermitStatus] = useState(application.permit_compliance_status || 'pending');
  const [trainingStatus, setTrainingStatus] = useState(application.training_status || 'pending');
  const [operationsStatus, setOperationsStatus] = useState(application.operational_preparation_status || 'pending');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [confirmFeeVerification, setConfirmFeeVerification] = useState(false);

  const saveRequirements = async () => {
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const result = await updateFranchiseApplicationRequirements(application.id, {
        agreement_status: agreementStatus,
        agreement_prepared_at: agreementPreparedAt,
        agreement_signed_at: agreementSignedAt,
        franchise_fee_amount: feeAmount,
        franchise_fee_payment_status: feeStatus,
        franchise_fee_payment_reference: application.franchise_fee_payment_reference || '',
        franchise_fee_payment_reject_reason: feeRejectReason,
        required_documents: documents,
        required_document_templates: documentTemplates,
        location_readiness: locationReadiness,
        permit_compliance_status: permitStatus,
        training_status: trainingStatus,
        operational_preparation_status: operationsStatus,
        internal_notes: internalNotes,
      });
      setInternalNotes('');
      setSavedMessage(result.message || 'Agreement and opening requirements saved.');
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save agreement and opening requirements.');
    } finally {
      setSaving(false);
    }
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const today = todayInManila();
    if ((agreementPreparedAt && agreementPreparedAt < today) || (agreementSignedAt && agreementSignedAt < today)) {
      setError('Agreement dates must be today or a future date.');
      return;
    }
    if (agreementStatus === 'signed' && !agreementSignedAt) {
      setError('Record the actual agreement signing date before marking it signed.');
      return;
    }
    if (['waived', 'not_applicable'].includes(feeStatus) && !internalNotes.trim()) {
      setError('Explain why the franchise fee is waived or not applicable in the internal note.');
      return;
    }
    if (feeStatus === 'paid' && application.franchise_fee_payment_status !== 'paid') {
      setConfirmFeeVerification(true);
      return;
    }
    void saveRequirements();
  };

  const updateDocument = (index: number, patch: Partial<FranchiseRequirementDocument>) =>
    setDocuments((current) => current.map((document, position) => position === index ? { ...document, ...patch } : document));
  const selectClass = 'mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm';
  const dateClass = 'mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm';

  return (
    <section className="mt-6 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4"><h2 className="font-serif text-xl font-bold text-[var(--oppa-text)]">Documents and final review</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Add each document the franchisee must complete and attach its blank form or instructions. Once every required file is attached, the franchisee can download, complete, and submit the forms together. Agreement, payment, and readiness records are available below if needed.</p></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {savedMessage && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{savedMessage}</p>}
      {confirmFeeVerification && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) setConfirmFeeVerification(false);
      }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="fee-verification-title" aria-describedby="fee-verification-description" onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) setConfirmFeeVerification(false);
        }} className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-2xl">
          <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-emerald-50 text-[var(--oppa-green)]"><CheckCircle2 size={22} aria-hidden="true" /></div>
          <h3 id="fee-verification-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">Verify franchise payment?</h3>
          <p id="fee-verification-description" className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">Confirm that you reviewed the submitted receipt and the franchise fee has actually been received. This will mark the payment as verified.</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => setConfirmFeeVerification(false)} className="rounded-lg border border-[var(--oppa-border)] px-4 py-2 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] disabled:opacity-60">Cancel</button>
            <button type="button" disabled={saving} onClick={() => { setConfirmFeeVerification(false); void saveRequirements(); }} className="inline-flex items-center gap-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:opacity-60">{saving && <Loader2 size={15} className="animate-spin" />}{saving ? 'Saving…' : 'Confirm and save'}</button>
          </div>
        </section>
      </div>}
      <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <details className="rounded-xl border border-[var(--oppa-border)] md:col-span-2">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Optional agreement and payment records</summary>
          <div className="grid gap-4 border-t border-[var(--oppa-border)] p-4 md:grid-cols-2">
            <label className="text-sm font-medium">Agreement status<select value={agreementStatus} onChange={(event) => setAgreementStatus(event.target.value)} className={selectClass}><option value="not_started">Not started</option><option value="drafting">Drafting</option><option value="sent">Sent for review/signing</option><option value="signed">Signed</option></select></label>
            <label className="text-sm font-medium">Agreement prepared date<input type="date" min={todayInManila()} value={agreementPreparedAt} onChange={(event) => setAgreementPreparedAt(event.target.value)} className={dateClass} /></label>
            <label className="text-sm font-medium">Actual agreement signing date<input type="date" min={todayInManila()} value={agreementSignedAt} onChange={(event) => setAgreementSignedAt(event.target.value)} className={dateClass} /></label>
            <label className="text-sm font-medium">Agreed franchise fee<input type="number" min="0" step="0.01" value={feeAmount} onChange={(event) => setFeeAmount(event.target.value)} placeholder="Not configured" className={dateClass} /></label>
            <label className="text-sm font-medium">Fee payment status<select value={feeStatus} onChange={(event) => setFeeStatus(event.target.value)} className={selectClass}><option value="not_configured">Not configured</option><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="paid">Verified</option><option value="rejected">Rejected</option><option value="waived">Waived</option><option value="not_applicable">Not applicable</option></select></label>
            <div className="text-sm"><span className="font-medium">Payment reference</span><p className="mt-1 break-all text-xs text-[var(--oppa-text-muted)]">{application.franchise_fee_payment_reference || 'Not submitted'}</p><span className="mt-2 block font-medium">Proof of payment</span><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{application.documents?.find((document) => document.document_type === 'payment_proof')?.name || 'No proof submitted yet. Review submitted files in Supporting documents above.'}</p></div>
            {feeStatus === 'rejected' && <label className="text-sm font-medium md:col-span-2">Payment rejection reason<textarea required value={feeRejectReason} onChange={(event) => setFeeRejectReason(event.target.value)} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" /></label>}
          </div>
        </details>

        <fieldset className="space-y-2 rounded-xl border border-[var(--oppa-border)] p-4 md:col-span-2">
          <legend className="px-1 text-sm font-semibold">Requirements and files for the franchisee</legend>
          {documents.map((document, index) => {
            const submission = application.documents
              ?.map((file, documentIndex) => ({ ...file, documentIndex }))
              .reverse()
              .find((file) => file.required_document_label === document.label);
            const submittedName = submission?.name || document.submitted_document_name;
            const submittedIndex = submission?.documentIndex ?? document.submitted_document_index;
            return <div key={index} className="grid gap-2 rounded-lg bg-[var(--oppa-cream)] p-3 sm:grid-cols-[minmax(180px,1fr)_auto_160px_auto] sm:items-center">
            <input aria-label="Required document name" required value={document.label} onChange={(event) => updateDocument(index, { label: event.target.value })} placeholder="Requirement or file name" className="rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm" />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={document.required} onChange={(event) => updateDocument(index, { required: event.target.checked })} />Required</label>
            <select aria-label="Document verification status" value={document.status} onChange={(event) => updateDocument(index, { status: event.target.value, reject_reason: event.target.value === 'rejected' ? document.reject_reason : null })} className="rounded-lg border border-[var(--oppa-border)] bg-white px-2 py-2 text-xs"><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="received">Received</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="not_applicable">Not applicable</option></select>
            <div className="flex gap-2 sm:col-span-4"><button type="button" onClick={() => updateDocument(index, { status: 'verified', reject_reason: null })} className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-800">Verify</button><button type="button" onClick={() => updateDocument(index, { status: 'rejected' })} className="rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-800">Reject</button></div>
            <button type="button" onClick={() => { setDocuments((current) => current.filter((_, position) => position !== index)); setDocumentTemplates((current) => Object.fromEntries(Object.entries(current).filter(([key]) => Number(key) !== index).map(([key, file]) => [Number(key) > index ? String(Number(key) - 1) : key, file]))); }} className="text-xs font-semibold text-red-700">Remove</button>
            <div className="text-xs text-[var(--oppa-text-muted)] sm:col-span-4">
              {submittedName && <p>Applicant submission: <span className="font-medium text-[var(--oppa-text)]">{submittedName}</span>{typeof submittedIndex === 'number' && <button type="button" onClick={() => onDownload(submittedIndex, submittedName)} className="ml-2 font-semibold text-[var(--oppa-green)] underline">Download submitted file</button>}</p>}
              {document.status === 'rejected' && <label className="mt-2 block font-medium">Reason for rejection<textarea required value={document.reject_reason || ''} onChange={(event) => updateDocument(index, { reject_reason: event.target.value })} rows={2} maxLength={2000} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-xs" /></label>}
              <label className="mt-2 block font-medium">Category<select value={document.category || 'application_documents'} onChange={(event) => updateDocument(index, { category: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-xs">{requirementCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="mt-2 block font-medium">File or form to send to franchisee<input type="file" accept=".pdf,.doc,.docx" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setDocumentTemplates((current) => ({ ...current, [index]: file })); updateDocument(index, { template_name: file.name }); } }} className="mt-1 block w-full text-xs" /></label>
              <p className="mt-1">{documentTemplates[index]?.name || document.template_name || 'No file attached yet'}</p>
              {(document.template_name || documentTemplates[index]) && <button type="button" onClick={() => { setDocumentTemplates((current) => { const next = { ...current }; delete next[index]; return next; }); updateDocument(index, { template_name: null }); }} className="mt-1 font-semibold text-red-700 hover:underline">Remove template</button>}
            </div>
          </div>;
          })}
          <button type="button" disabled={documents.length >= 8} onClick={() => setDocuments((current) => [...current, { label: '', category: 'application_documents', required: true, status: 'pending' }])} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Add requirement and file</button>
          <p className="text-xs text-[var(--oppa-text-muted)]">Attach the agreement, guide, form, or other file the franchisee needs for each requirement. They can download the files and return all required completed documents together (up to 8).</p>
        </fieldset>

        <details className="rounded-xl border border-[var(--oppa-border)] md:col-span-2">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Optional readiness statuses and internal note</summary>
          <div className="grid gap-4 border-t border-[var(--oppa-border)] p-4 md:grid-cols-2">
            <label className="text-sm font-medium">Location readiness<select value={locationReadiness} onChange={(event) => setLocationReadiness(event.target.value)} className={selectClass}><option value="pending">Pending</option><option value="ready">Ready</option><option value="not_applicable">Not applicable</option></select></label>
            <label className="text-sm font-medium">Permits and compliance<select value={permitStatus} onChange={(event) => setPermitStatus(event.target.value)} className={selectClass}><option value="pending">Pending</option><option value="verified">Verified</option><option value="not_applicable">Not applicable</option></select></label>
            <label className="text-sm font-medium">Training<select value={trainingStatus} onChange={(event) => setTrainingStatus(event.target.value)} className={selectClass}><option value="pending">Pending</option><option value="scheduled">Scheduled</option><option value="complete">Complete</option><option value="not_applicable">Not applicable</option></select></label>
            <label className="text-sm font-medium">System and operational preparation<select value={operationsStatus} onChange={(event) => setOperationsStatus(event.target.value)} className={selectClass}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="complete">Complete</option><option value="not_applicable">Not applicable</option></select></label>
            <label className="text-sm font-medium md:col-span-2">Internal note<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={2} maxLength={5000} placeholder="Explain waivers, not-applicable items, or audit details." className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" /></label>
          </div>
        </details>
        <button type="submit" disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2">{saving ? 'Saving review…' : 'Save combined review and requirements'}</button>
        <p className="text-xs text-[var(--oppa-text-muted)] md:col-span-2">{application.requirements_reviewed_at ? `Last reviewed ${new Date(application.requirements_reviewed_at).toLocaleString()}.` : 'Not yet reviewed. Saving records the current checklist and review.'}</p>
      </form>
    </section>
  );
};

const AdminFranchiseApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<FranchiseApplication | null>(null);
  const [status, setStatus] = useState('');
  const [instructions, setInstructions] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [minimumInterviewAt, setMinimumInterviewAt] = useState(minimumManilaDateTime);
  const [interviewType, setInterviewType] = useState<'online' | 'onsite'>('online');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [interviewMeetingUrl, setInterviewMeetingUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState<string | null>(null);
  const formDirty = useRef(false);
  const requestInFlight = useRef(false);
  const mounted = useRef(false);

  const load = async (showLoading = true) => {
    if (!id || requestInFlight.current) return;
    requestInFlight.current = true;
    if (showLoading) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await getFranchiseApplication(id);
      if (!mounted.current) return;
      setApplication(data);
      if (showLoading || !formDirty.current) {
        const storedStatus = data.status === 'pending' ? 'submitted' : data.status || 'submitted';
        const legacyReviewStatus = storedStatus === 'additional_information_required'
          ? data.events?.some((event) => event.title === 'Status updated' && event.status === 'location_assessment')
            ? 'location_assessment'
            : 'under_review'
          : storedStatus;
        setStatus(legacyReviewStatus);
        setInstructions(data.next_step_instructions || '');
        setInterviewAt(data.interview_at ? toManilaDateTimeInput(data.interview_at) : '');
        setInterviewType(data.interview_type || 'online');
        setInterviewLocation(data.interview_location || '');
        setInterviewNotes(data.interview_notes || '');
        setInterviewMeetingUrl(data.interview_meeting_url || '');
        formDirty.current = false;
      }
    } catch (loadError) {
      if (mounted.current && showLoading) setError(loadError instanceof Error ? loadError.message : 'Unable to load the application.');
    } finally {
      requestInFlight.current = false;
      if (mounted.current && showLoading) setLoading(false);
    }
  };

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
  }, [id]);

  useEffect(() => {
    const interval = window.setInterval(() => setMinimumInterviewAt(minimumManilaDateTime()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const storedStatus = application?.status === 'pending' ? 'submitted' : application?.status || 'submitted';
  const currentStatus = storedStatus === 'additional_information_required'
    ? application?.events?.some((event) => event.title === 'Status updated' && event.status === 'location_assessment')
      ? 'location_assessment'
      : 'under_review'
    : storedStatus;
  const availableStatuses = useMemo(() => {
    const options = (application?.allowed_transitions || [currentStatus])
      .filter((option) => option !== 'additional_information_required');
    return options.includes(status) ? options : [status, ...options];
  }, [application?.allowed_transitions, currentStatus, status]);
  const saveReviewUpdates = async () => {
    if (!id) return;
    const savedInterviewAt = application?.interview_at ? toManilaDateTimeInput(application.interview_at) : '';
    const interviewChanged = interviewAt !== savedInterviewAt;
    const interviewAtIso = interviewAt ? manilaDateTimeInputToIso(interviewAt) : '';
    setSaving(true);
    setError('');
    try {
      await reviewFranchiseApplication(id, {
        status,
        next_step_instructions: instructions,
        ...(interviewAt && (status === 'for_interview' || interviewChanged) ? { interview_at: interviewAtIso } : {}),
        interview_type: interviewType,
        interview_location: interviewType === 'onsite' ? interviewLocation.trim() : null,
        interview_notes: interviewNotes,
        interview_meeting_url: interviewType === 'online' ? interviewMeetingUrl.trim() || null : null,
      });
      formDirty.current = false;
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save review updates.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const savedInterviewAt = application?.interview_at ? toManilaDateTimeInput(application.interview_at) : '';
    const interviewChanged = interviewAt !== savedInterviewAt;
    const interviewAtIso = interviewAt ? manilaDateTimeInputToIso(interviewAt) : '';
    const interviewIsPast = Boolean(interviewAtIso) && new Date(interviewAtIso).getTime() < Date.now();
    if ((status === 'for_interview' || (interviewAt && interviewChanged)) && (!interviewAt || interviewIsPast)) {
      setError('Choose a current or future interview date and time.');
      return;
    }
    if (interviewType === 'onsite' && !interviewLocation.trim()) {
      setError('Enter the location for the onsite interview.');
      return;
    }
    if (status === 'conditionally_approved' || status === 'rejected') {
      setConfirmationStatus(status);
      return;
    }
    await saveReviewUpdates();
  };

  const downloadDocument = async (index: number, name: string) => {
    if (!id) return;
    setDownloading(index);
    setError('');
    try {
      const blob = await downloadFranchiseApplicationDocument(id, index);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the supporting document.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <AdminLayout>
      <Link to="/admin/franchise-applications" className="mb-5 inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)]"><ArrowLeft size={16} /> All applications</Link>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? <div className="rounded-2xl bg-white p-10 text-center text-sm text-[var(--oppa-text-muted)]"><Loader2 className="mx-auto size-6 animate-spin" /><p className="mt-3">Loading application…</p></div> : !application ? null : (
        <>
          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div><p className="font-mono text-xs text-[var(--oppa-text-muted)]">{application.reference_number || 'Legacy application'}</p><h1 className="mt-1 font-serif text-2xl font-bold text-[var(--oppa-text)] sm:text-3xl">{application.contact_name}</h1><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{application.email} · {application.phone || 'No phone number'}</p></div>
            <span className="w-fit rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold capitalize text-amber-800">{statusTitle(currentStatus)}</span>
          </header>

          <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-semibold text-[var(--oppa-text)]">Applicant and business profile</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Info label="Applicant address" value={application.applicant_address || 'Not provided'} />
                  <Info label="Proposed location" value={application.location || 'Not provided'} />
                  <Info label="Proposed business name" value={application.franchise_name} />
                  <Info label="Investment capacity" value={money(application.investment_capacity)} />
                  <Info label="Property identified" value={application.has_proposed_property ? 'Yes' : 'No'} />
                  <Info label="Expected opening" value={application.opening_timeline || 'Not provided'} />
                  <Info label="Business experience" value={application.business_experience || 'Not provided'} wide />
                  <Info label="Other business information" value={application.business_information || application.notes || 'Not provided'} wide />
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
                <h2 className="mb-3 font-semibold text-[var(--oppa-text)]">Supporting documents</h2>
                  {!application.documents?.length ? <p className="text-sm text-[var(--oppa-text-muted)]">No supporting documents were provided.</p> : <ul className="space-y-2">{application.documents.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--oppa-cream)] p-3"><span className="flex min-w-0 items-center gap-2 text-sm"><FileText size={17} className="shrink-0 text-[var(--oppa-green)]" /><span className="min-w-0"><span className="block truncate">{file.document_type === 'payment_proof' ? `Proof of payment: ${file.name}` : file.name}</span>{file.required_document_label && <span className="block text-xs text-[var(--oppa-text-muted)]">Submitted for: {file.required_document_label}</span>}</span></span><button type="button" onClick={() => void downloadDocument(index, file.name)} disabled={downloading === index} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-60"><Download size={14} />{downloading === index ? 'Loading…' : 'Download'}</button></li>)}</ul>}
              </section>

            </div>

            <form noValidate onChange={() => { formDirty.current = true; }} onSubmit={handleSave} className="h-fit space-y-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div><h2 className="font-semibold text-[var(--oppa-text)]">Review and decision</h2><p className="mt-1 text-xs leading-5 text-[var(--oppa-text-muted)]">Each status change is recorded. Approval does not create access; franchise activation is a separate gated action.</p></div>
              <label className="block text-sm font-medium">Application status<select value={status} onChange={(event) => setStatus(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm">{[currentStatus, ...availableStatuses.filter((next) => next !== currentStatus)].map((option) => <option key={option} value={option}>{statusTitle(option)}</option>)}</select></label>
              {currentStatus === 'for_interview' && <p className="rounded-xl bg-[var(--oppa-cream)] p-3 text-xs leading-5 text-[var(--oppa-text-muted)]">After the interview is completed, select Location Assessment. This begins the combined final stage (site inspection, financial evaluation, and agreement). Add the complete required-document checklist and upload a blank form for each item in the combined requirements panel. Saving the requirements automatically sends the upload request when each required form is ready.</p>}
              {currentStatus === 'location_assessment' && <p className="rounded-xl bg-[var(--oppa-cream)] p-3 text-xs leading-5 text-[var(--oppa-text-muted)]">Complete the site and financial assessment and prepare the final decision/agreement in the combined requirements panel below. Saving the checklist automatically opens the applicant's document upload area when each required form has a template. The application remains in Location Assessment while documents are submitted.</p>}
              <label className="block text-sm font-medium">Instructions for the applicant<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} maxLength={2000} placeholder="Explain the next step or list the requested documents." className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
              <div className="rounded-xl border border-[var(--oppa-border)] p-3">
                <h3 className="mb-3 text-sm font-semibold">Interview record (Philippine time)</h3>
                <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Date and time<input type="datetime-local" min={minimumInterviewAt} value={interviewAt} onChange={(event) => setInterviewAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
                <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Past dates and times are unavailable. Choose today or a future date.</p>
                <label className="mt-3 block text-xs font-medium text-[var(--oppa-text-muted)]">Interview type<select value={interviewType} onChange={(event) => setInterviewType(event.target.value as 'online' | 'onsite')} className="mt-1.5 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]"><option value="online">Online</option><option value="onsite">Onsite</option></select></label>
                {interviewType === 'online' ? <>
                  <label className="mt-3 block text-xs font-medium text-[var(--oppa-text-muted)]">Online meeting link<input type="url" maxLength={2048} value={interviewMeetingUrl} onChange={(event) => setInterviewMeetingUrl(event.target.value)} placeholder="https://meet.google.com/… or https://zoom.us/…" className="mt-1.5 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
                  <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">This link will be shared with the franchisee in their application portal.</p>
                </> : <label className="mt-3 block text-xs font-medium text-[var(--oppa-text-muted)]">Onsite interview location<input required maxLength={500} value={interviewLocation} onChange={(event) => setInterviewLocation(event.target.value)} placeholder="Enter the complete address or venue" className="mt-1.5 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /><span className="mt-1 block">This location will be shared with the franchisee in their application portal.</span></label>}
                <label className="mt-3 block text-xs font-medium text-[var(--oppa-text-muted)]">Internal interview notes<textarea value={interviewNotes} onChange={(event) => setInterviewNotes(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
              </div>
              <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:opacity-60"><Save size={16} />{saving ? 'Saving review…' : 'Save review updates'}</button>
            </form>
          </div>

          {['location_assessment', 'conditionally_approved', 'agreement_pending', 'requirements_pending', 'approved_for_opening'].includes(currentStatus) && (
            <FranchiseRequirementsForm application={application} onSaved={load} onDownload={(index, name) => void downloadDocument(index, name)} />
          )}
          <FranchiseActivationPanel application={application} onActivated={load} />
        </>
      )}
      {confirmationStatus && <ConfirmDialog
        title={confirmationStatus === 'rejected' ? 'Reject this application?' : 'Approve this application?'}
        description={confirmationStatus === 'rejected'
          ? 'The applicant will see that their application was not approved and any instructions you provide. This decision will be recorded in the application timeline.'
          : 'The applicant will be notified that they passed the review and may proceed to the agreement and final requirements.'}
        confirmLabel={confirmationStatus === 'rejected' ? 'Reject application' : 'Approve application'}
        onCancel={() => setConfirmationStatus(null)}
        onConfirm={() => {
          setConfirmationStatus(null);
          void saveReviewUpdates();
        }}
        busy={saving}
      />}
    </AdminLayout>
  );
};

const FranchiseActivationPanel: React.FC<{ application: FranchiseApplication; onActivated: () => Promise<void> }> = ({ application, onActivated }) => {
  const [managerName, setManagerName] = useState(application.contact_name);
  const [managerEmail, setManagerEmail] = useState(application.email);
  const [managerPhone, setManagerPhone] = useState(application.phone || '');
  const [managerPassword, setManagerPassword] = useState('');
  const [canProcessPos, setCanProcessPos] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (application.status === 'active') {
    return (
      <section className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
        <h2 className="font-semibold text-green-900">Franchise activated</h2>
        <p className="mt-1 text-sm text-green-800">Activated {application.activated_at ? new Date(application.activated_at).toLocaleString() : 'successfully'}.</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          {application.franchise_account_id && <Link to={`/admin/franchise-accounts/${application.franchise_account_id}`} className="text-[var(--oppa-green)] underline">Open franchise account</Link>}
          {application.franchise_id && <Link to={`/admin/franchises/${application.franchise_id}`} className="text-[var(--oppa-green)] underline">Open activated location</Link>}
        </div>
      </section>
    );
  }

  if (application.status !== 'approved_for_opening') return null;

  const handleActivate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!window.confirm('Activate this franchise, create its location and manager account, and enable access to franchise operations?')) return;
    setSaving(true);
    setError('');
    try {
      await activateFranchiseApplication(application.id, {
        manager_full_name: managerName,
        manager_email: managerEmail,
        manager_phone: managerPhone,
        manager_password: managerPassword,
        can_process_pos: canProcessPos,
      });
      setManagerPassword('');
      await onActivated();
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : 'Unable to activate this franchise.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Final authorization</p><h2 className="mt-1 font-serif text-xl font-bold text-[var(--oppa-text)]">Activate franchise operations</h2><p className="mt-1 text-sm leading-6 text-[var(--oppa-text-muted)]">This creates one active franchise account/location and a manager login. The server rechecks approval, signed agreement, payment disposition, and every opening requirement before activation.</p></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleActivate} className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium">Authorized manager name<input required maxLength={255} value={managerName} onChange={(event) => setManagerName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="block text-sm font-medium">Manager login email<input required type="email" maxLength={255} value={managerEmail} onChange={(event) => setManagerEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="block text-sm font-medium">Manager phone<input maxLength={50} value={managerPhone} onChange={(event) => setManagerPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
        <label className="block text-sm font-medium">Initial manager password<input required type="password" minLength={12} autoComplete="new-password" value={managerPassword} onChange={(event) => setManagerPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /><span className="mt-1 block text-xs font-normal text-[var(--oppa-text-muted)]">At least 12 characters. Share it with the manager through a separate secure channel.</span></label>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={canProcessPos} onChange={(event) => setCanProcessPos(event.target.checked)} />Authorize this manager to process POS transactions</label>
        <div className="rounded-xl bg-[var(--oppa-cream)] p-3 text-xs leading-5 text-[var(--oppa-text-muted)] md:col-span-2">No franchise record or dashboard/POS access is created until you confirm activation. Staff and cashier access remains subject to authorized setup for the activated location.</div>
        <button type="submit" disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:opacity-60 md:col-span-2">{saving ? 'Activating…' : 'Confirm and activate franchise'}</button>
      </form>
    </section>
  );
};

const Info: React.FC<{ label: string; value: string; wide?: boolean }> = ({ label, value, wide }) => <div className={wide ? 'sm:col-span-2' : ''}><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--oppa-text)]">{value}</p></div>;

export default AdminFranchiseApplicationDetailPage;

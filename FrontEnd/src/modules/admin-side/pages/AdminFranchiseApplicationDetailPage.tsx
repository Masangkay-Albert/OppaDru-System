import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Download, FileText, Loader2, Save } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import {
  activateFranchiseApplication,
  downloadFranchiseApplicationDocument,
  getFranchiseApplication,
  reviewFranchiseApplication,
  updateFranchiseApplicationRequirements,
  type FranchiseApplication,
} from '../../../services/franchiseAdminService';

const transitions: Record<string, string[]> = {
  pending: ['under_review', 'on_hold', 'rejected'],
  submitted: ['under_review', 'on_hold', 'rejected'],
  under_review: ['additional_information_required', 'for_interview', 'location_assessment', 'conditionally_approved', 'on_hold', 'rejected'],
  additional_information_required: ['under_review', 'on_hold', 'rejected'],
  for_interview: ['under_review', 'location_assessment', 'conditionally_approved', 'on_hold', 'rejected'],
  location_assessment: ['under_review', 'conditionally_approved', 'on_hold', 'rejected'],
  conditionally_approved: ['agreement_pending', 'requirements_pending', 'on_hold', 'rejected'],
  agreement_pending: ['requirements_pending', 'on_hold', 'rejected'],
  requirements_pending: ['agreement_pending', 'approved_for_opening', 'on_hold', 'rejected'],
  approved_for_opening: ['requirements_pending', 'on_hold'],
  on_hold: ['under_review', 'for_interview', 'location_assessment', 'conditionally_approved', 'agreement_pending', 'requirements_pending', 'approved_for_opening', 'rejected'],
};

const statusTitle = (status: string) => status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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

const todayInManila = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: manilaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((valuePart) => valuePart.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const minimumManilaDateTime = (): string =>
  toManilaDateTimeInput(new Date(Date.now() + 60_000).toISOString());

const AdminFranchiseApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<FranchiseApplication | null>(null);
  const [status, setStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [instructions, setInstructions] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [minimumInterviewAt, setMinimumInterviewAt] = useState(minimumManilaDateTime);
  const [interviewNotes, setInterviewNotes] = useState('');
  const [assessmentResult, setAssessmentResult] = useState('');
  const [assessmentNotes, setAssessmentNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await getFranchiseApplication(id);
      setApplication(data);
      setStatus(data.status === 'pending' ? 'submitted' : data.status || 'submitted');
      setInstructions(data.next_step_instructions || '');
      setInterviewAt(data.interview_at ? toManilaDateTimeInput(data.interview_at) : '');
      setInterviewNotes(data.interview_notes || '');
      setAssessmentResult(data.location_assessment?.result || '');
      setAssessmentNotes(data.location_assessment?.notes || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the application.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  useEffect(() => {
    const interval = window.setInterval(() => setMinimumInterviewAt(minimumManilaDateTime()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const currentStatus = application?.status === 'pending' ? 'submitted' : application?.status || 'submitted';
  const availableStatuses = useMemo(() => {
    const options = transitions[currentStatus] || [];
    return options.includes(status) ? [status, ...options.filter((option) => option !== status)] : options;
  }, [currentStatus, status]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    const savedInterviewAt = application?.interview_at ? toManilaDateTimeInput(application.interview_at) : '';
    const interviewChanged = interviewAt !== savedInterviewAt;
    const interviewAtIso = interviewAt ? manilaDateTimeInputToIso(interviewAt) : '';
    const interviewIsPast = Boolean(interviewAtIso) && new Date(interviewAtIso).getTime() < Date.now();
    if ((status === 'for_interview' || (interviewAt && interviewChanged)) && (!interviewAt || interviewIsPast)) {
      setError('Choose a current or future interview date and time.');
      return;
    }
    if ((status === 'conditionally_approved' || status === 'rejected') && !window.confirm(`Confirm ${statusTitle(status).toLowerCase()} for this application?`)) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await reviewFranchiseApplication(id, {
        status,
        admin_notes: adminNotes,
        next_step_instructions: instructions,
        ...(interviewAt && (status === 'for_interview' || interviewChanged) ? { interview_at: interviewAtIso } : {}),
        interview_notes: interviewNotes,
        location_assessment: {
          ...(assessmentResult ? { result: assessmentResult } : {}),
          ...(assessmentNotes ? { notes: assessmentNotes } : {}),
        },
      });
      setAdminNotes('');
      setMessage('Review updates saved.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save review updates.');
    } finally {
      setSaving(false);
    }
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
      {message && <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
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
                {!application.documents?.length ? <p className="text-sm text-[var(--oppa-text-muted)]">No supporting documents were provided.</p> : <ul className="space-y-2">{application.documents.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--oppa-cream)] p-3"><span className="flex min-w-0 items-center gap-2 text-sm"><FileText size={17} className="shrink-0 text-[var(--oppa-green)]" /><span className="truncate">{file.name}</span></span><button type="button" onClick={() => void downloadDocument(index, file.name)} disabled={downloading === index} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-60"><Download size={14} />{downloading === index ? 'Loading…' : 'Download'}</button></li>)}</ul>}
              </section>

              <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
                <h2 className="mb-4 font-semibold text-[var(--oppa-text)]">Application timeline</h2>
                {!application.events?.length ? <p className="text-sm text-[var(--oppa-text-muted)]">No review events have been recorded.</p> : <ol className="space-y-4">{application.events.map((event) => <li key={event.id} className="relative border-l border-[var(--oppa-border)] pl-4"><p className="text-sm font-semibold">{event.title} {event.is_internal && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-600">Internal</span>}</p>{event.message && <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--oppa-text-muted)]">{event.message}</p>}<p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{new Date(event.created_at).toLocaleString()}</p></li>)}</ol>}
              </section>
            </div>

            <form noValidate onSubmit={handleSave} className="h-fit space-y-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div><h2 className="font-semibold text-[var(--oppa-text)]">Review and decision</h2><p className="mt-1 text-xs leading-5 text-[var(--oppa-text-muted)]">Each status change is recorded. Approval does not create access; franchise activation is a separate gated action.</p></div>
              <label className="block text-sm font-medium">Application status<select value={status} onChange={(event) => setStatus(event.target.value)} required className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm">{[currentStatus, ...availableStatuses.filter((next) => next !== currentStatus)].map((option) => <option key={option} value={option}>{statusTitle(option)}</option>)}</select></label>
              <label className="block text-sm font-medium">Instructions for the applicant<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} maxLength={2000} placeholder="Explain the next step or the additional information needed." className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
              <div className="rounded-xl border border-[var(--oppa-border)] p-3">
                <h3 className="mb-3 text-sm font-semibold">Interview record (Philippine time)</h3>
                <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Date and time<input type="datetime-local" min={minimumInterviewAt} value={interviewAt} onChange={(event) => setInterviewAt(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
                <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Past dates and times are unavailable. Choose today or a future date.</p>
                <label className="mt-3 block text-xs font-medium text-[var(--oppa-text-muted)]">Internal interview notes<textarea value={interviewNotes} onChange={(event) => setInterviewNotes(event.target.value)} rows={2} className="mt-1.5 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
              </div>
              <div className="rounded-xl border border-[var(--oppa-border)] p-3">
                <h3 className="mb-3 text-sm font-semibold">Location assessment</h3>
                <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Assessment outcome<select value={assessmentResult} onChange={(event) => setAssessmentResult(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]"><option value="">Not assessed</option><option value="pending">Pending</option><option value="passed">Passed</option><option value="follow_up_required">Follow-up required</option><option value="not_suitable">Not suitable</option></select></label>
                <label className="mt-3 block text-xs font-medium text-[var(--oppa-text-muted)]">Internal assessment notes<textarea value={assessmentNotes} onChange={(event) => setAssessmentNotes(event.target.value)} rows={3} className="mt-1.5 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
              </div>
              <label className="block text-sm font-medium">Add an internal review note<textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} rows={3} maxLength={5000} placeholder="Visible to authorized administrators only." className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
              <button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:opacity-60"><Save size={16} />{saving ? 'Saving review…' : 'Save review updates'}</button>
            </form>
          </div>

          <RequirementsTrackingForm application={application} onSaved={load} />
          <FranchiseActivationPanel application={application} onActivated={load} />
        </>
      )}
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

const requirementStatuses: Record<string, string[]> = {
  location_readiness: ['pending', 'ready', 'not_applicable'],
  permit_compliance_status: ['pending', 'verified', 'not_applicable'],
  training_status: ['pending', 'scheduled', 'complete', 'not_applicable'],
  operational_preparation_status: ['pending', 'in_progress', 'complete', 'not_applicable'],
};

const RequirementsTrackingForm: React.FC<{ application: FranchiseApplication; onSaved: () => Promise<void> }> = ({ application, onSaved }) => {
  const [agreementStatus, setAgreementStatus] = useState(application.agreement_status || 'not_started');
  const [agreementPreparedAt, setAgreementPreparedAt] = useState(application.agreement_prepared_at?.slice(0, 10) || '');
  const [agreementSignedAt, setAgreementSignedAt] = useState(application.agreement_signed_at?.slice(0, 10) || '');
  const [feeAmount, setFeeAmount] = useState(application.franchise_fee_amount ? String(application.franchise_fee_amount) : '');
  const [feeStatus, setFeeStatus] = useState(application.franchise_fee_payment_status || 'not_configured');
  const [feeReference, setFeeReference] = useState(application.franchise_fee_payment_reference || '');
  const [requiredDocuments, setRequiredDocuments] = useState(application.required_documents || []);
  const [locationReadiness, setLocationReadiness] = useState(application.location_readiness || 'pending');
  const [permitStatus, setPermitStatus] = useState(application.permit_compliance_status || 'pending');
  const [trainingStatus, setTrainingStatus] = useState(application.training_status || 'pending');
  const [operationsStatus, setOperationsStatus] = useState(application.operational_preparation_status || 'pending');
  const [internalNotes, setInternalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canEditRequirements = !['active', 'rejected', 'withdrawn'].includes(application.status || '');

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEditRequirements) return;
    if (agreementStatus === 'signed' && !window.confirm('Confirm that the franchise agreement has actually been signed?')) return;
    if (feeStatus === 'paid' && !window.confirm('Confirm the recorded franchise fee has been received and matched to the payment reference?')) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateFranchiseApplicationRequirements(application.id, {
        agreement_status: agreementStatus,
        agreement_prepared_at: agreementPreparedAt,
        agreement_signed_at: agreementSignedAt,
        franchise_fee_amount: feeAmount,
        franchise_fee_payment_status: feeStatus,
        franchise_fee_payment_reference: feeReference,
        required_documents: requiredDocuments,
        location_readiness: locationReadiness,
        permit_compliance_status: permitStatus,
        training_status: trainingStatus,
        operational_preparation_status: operationsStatus,
        internal_notes: internalNotes,
      });
      setInternalNotes('');
      setMessage('Agreement and requirements saved. No item was marked complete unless you selected and confirmed it.');
      await onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save requirements.');
    } finally {
      setSaving(false);
    }
  };

  const addDocument = () => setRequiredDocuments((current) => [...current, { label: '', required: true, status: 'pending' }]);
  const updateDocument = (index: number, field: 'label' | 'required' | 'status', value: string | boolean) => {
    setRequiredDocuments((current) => current.map((document, position) => position === index ? { ...document, [field]: value } : document));
  };

  return (
    <section className="mt-6 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4"><h2 className="font-serif text-xl font-bold text-[var(--oppa-text)]">Franchise requirements and agreement</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Only record requirements that apply. “Pending” or “not configured” will continue to block activation.</p></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      <p className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Admins may prepare this checklist at any review stage. Saving it does not change the application status or approve the applicant. Activation remains blocked until the application is approved for opening and every applicable requirement is complete.
      </p>
      {!canEditRequirements && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Requirements are read-only for active, rejected, or withdrawn applications.</p>}
      <form onSubmit={handleSave} className="grid gap-5 lg:grid-cols-2">
        <fieldset disabled={!canEditRequirements || saving} className="contents">
          <div className="space-y-3 rounded-xl border border-[var(--oppa-border)] p-4">
            <h3 className="text-sm font-semibold">Agreement</h3>
            <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Preparation and signing status<select value={agreementStatus} onChange={(event) => setAgreementStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)]"><option value="not_started">Not started</option><option value="drafting">Drafting</option><option value="sent">Sent for signing</option><option value="signed">Signed</option></select></label>
            <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Agreement prepared on<input type="date" min={todayInManila()} value={agreementPreparedAt} onChange={(event) => setAgreementPreparedAt(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
            <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Agreement signed on<input type="date" min={todayInManila()} value={agreementSignedAt} onChange={(event) => setAgreementSignedAt(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--oppa-border)] p-4">
            <h3 className="text-sm font-semibold">Applicable franchise fee</h3>
            <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Amount (PHP)<input type="number" min="0" step="0.01" value={feeAmount} onChange={(event) => setFeeAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
            <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Payment status<select value={feeStatus} onChange={(event) => setFeeStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)]"><option value="not_configured">Not configured</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="waived">Waived</option><option value="not_applicable">Not applicable</option></select></label>
            <label className="block text-xs font-medium text-[var(--oppa-text-muted)]">Payment reference (required if paid)<input value={feeReference} onChange={(event) => setFeeReference(event.target.value)} maxLength={255} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
          </div>

          <div className="space-y-3 rounded-xl border border-[var(--oppa-border)] p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Required documents for this application</h3><button type="button" onClick={addDocument} className="rounded-lg border border-[var(--oppa-border)] px-3 py-1.5 text-xs font-semibold">Add requirement</button></div>
            {!requiredDocuments.length && <p className="text-xs leading-5 text-[var(--oppa-text-muted)]">No extra documents listed. Add only items that apply; activation still requires you to save this review explicitly.</p>}
            {requiredDocuments.map((document, index) => <div key={index} className="grid gap-2 rounded-lg bg-[var(--oppa-cream)] p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
              <input required aria-label="Required document name" value={document.label} onChange={(event) => updateDocument(index, 'label', event.target.value)} placeholder="e.g. Business registration" className="rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm" />
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={document.required} onChange={(event) => updateDocument(index, 'required', event.target.checked)} />Required</label>
              <select aria-label="Document verification status" value={document.status} onChange={(event) => updateDocument(index, 'status', event.target.value)} className="rounded-lg border border-[var(--oppa-border)] bg-white px-2 py-2 text-xs"><option value="pending">Pending</option><option value="received">Received</option><option value="verified">Verified</option><option value="not_applicable">Not applicable</option></select>
              <button type="button" onClick={() => setRequiredDocuments((current) => current.filter((_, position) => position !== index))} className="text-xs font-semibold text-red-700">Remove</button>
            </div>)}
          </div>

          <div className="grid gap-3 rounded-xl border border-[var(--oppa-border)] p-4 lg:col-span-2 sm:grid-cols-2">
            <h3 className="text-sm font-semibold sm:col-span-2">Opening preparation checks</h3>
            {([
              ['location_readiness', 'Location readiness', locationReadiness, setLocationReadiness],
              ['permit_compliance_status', 'Permits and compliance', permitStatus, setPermitStatus],
              ['training_status', 'Training', trainingStatus, setTrainingStatus],
              ['operational_preparation_status', 'Operational preparation', operationsStatus, setOperationsStatus],
            ] as const).map(([key, label, value, setter]) => <label key={key} className="text-xs font-medium text-[var(--oppa-text-muted)]">{label}<select value={value} onChange={(event) => setter(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)]">{requirementStatuses[key].map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>)}
          </div>

          <label className="block text-xs font-medium text-[var(--oppa-text-muted)] lg:col-span-2">Internal note (for audit trail)<textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={2} maxLength={5000} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm text-[var(--oppa-text)]" /></label>
          <div className="lg:col-span-2"><p className="text-xs text-[var(--oppa-text-muted)]">{application.requirements_reviewed_at ? `Last reviewed: ${new Date(application.requirements_reviewed_at).toLocaleString()}` : 'Requirements have not yet been reviewed.'}</p><button type="submit" disabled={!canEditRequirements || saving} className="mt-3 inline-flex items-center justify-center rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save agreement and requirements'}</button></div>
        </fieldset>
      </form>
    </section>
  );
};

const Info: React.FC<{ label: string; value: string; wide?: boolean }> = ({ label, value, wide }) => <div className={wide ? 'sm:col-span-2' : ''}><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--oppa-text)]">{value}</p></div>;

export default AdminFranchiseApplicationDetailPage;

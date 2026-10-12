import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, FileText, Mail, MapPin, Phone, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { franchiseApplicantAuthService } from '../../../services/franchiseApplicantAuthService';

type ApplicationForm = {
  franchise_name: string;
  contact_name: string;
  email: string;
  phone: string;
  applicant_address: string;
  business_experience: string;
  investment_capacity: string;
  location: string;
  has_proposed_property: '' | 'yes' | 'no';
  opening_timeline: string;
  business_information: string;
  notes: string;
};

const initialForm: ApplicationForm = {
  franchise_name: '',
  contact_name: '',
  email: '',
  phone: '',
  applicant_address: '',
  business_experience: '',
  investment_capacity: '',
  location: '',
  has_proposed_property: '',
  opening_timeline: '',
  business_information: '',
  notes: '',
};

const draftKey = 'franchise-application-draft';
const steps = ['Your details', 'Business plan', 'Review'];
const maxSupportingDocuments = 8;
const maxSupportingDocumentSize = 10 * 1024 * 1024;
type ApiPayload = Record<string, unknown>;

const asPayload = (value: unknown): ApiPayload | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ApiPayload : null;

const getReferenceNumber = (value: unknown): string => {
  const payload = asPayload(value);
  if (!payload) return '';
  if (typeof payload.reference_number === 'string') return payload.reference_number;
  return getReferenceNumber(payload.data)
    || getReferenceNumber(payload.application)
    || getReferenceNumber(payload.result);
};

const timelineLabels: Record<string, string> = {
  within_6_months: 'Within 6 months',
  '6_to_12_months': '6–12 months',
  '12_to_18_months': '12–18 months',
  more_than_18_months: 'More than 18 months',
  not_sure: 'Not sure yet',
};

const FranchiseApplicationPage: React.FC = () => {
  const [form, setForm] = useState<ApplicationForm>(() => {
    const saved = sessionStorage.getItem(draftKey);
    if (!saved) return initialForm;
    const savedDraft = JSON.parse(saved) as Partial<ApplicationForm> & { contactEmailEntered?: boolean };
    return {
      ...initialForm,
      ...savedDraft,
      email: savedDraft.contactEmailEntered ? savedDraft.email || '' : '',
    };
  });
  const [documents, setDocuments] = useState<File[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false);
  const [canTrackInPortal, setCanTrackInPortal] = useState(false);
  const activeFieldsRef = useRef<HTMLDivElement>(null);

  const handleChange = (field: keyof ApplicationForm, value: string) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    sessionStorage.setItem(draftKey, JSON.stringify({
      ...updated,
      contactEmailEntered: field === 'email' || form.email.length > 0,
    }));
  };

  const handleDocumentSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    setError('');

    const invalidFile = selected.find((file) => file.size > maxSupportingDocumentSize);
    if (invalidFile) {
      setError(`${invalidFile.name} is larger than the 10 MB limit.`);
      return;
    }

    const uniqueSelection = selected.filter((file, index) =>
      !documents.some((existing) =>
        existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified,
      )
      && selected.findIndex((candidate) =>
        candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified,
      ) === index,
    );
    const availableSlots = maxSupportingDocuments - documents.length;
    if (uniqueSelection.length > availableSlots) {
      setError(`You can upload up to ${maxSupportingDocuments} files total. ${availableSlots} slot(s) remain.`);
    }
    setDocuments((current) => [...current, ...uniqueSelection.slice(0, availableSlots)]);
  };

  const removeDocument = (indexToRemove: number) => {
    setDocuments((current) => current.filter((_, index) => index !== indexToRemove));
  };

  const continueToNextStep = () => {
    const fields = activeFieldsRef.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input[required], textarea[required], select[required]',
    );
    const invalidField = fields && Array.from(fields).find((field) => !field.checkValidity());
    if (invalidField) {
      invalidField.reportValidity();
      return;
    }
    setError('');
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleSubmit = async () => {
    if (step !== steps.length - 1 || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    const body = new FormData();
    body.append('franchise_name', form.franchise_name);
    body.append('contact_name', form.contact_name);
    body.append('email', form.email);
    body.append('phone', form.phone);
    body.append('applicant_address', form.applicant_address);
    body.append('business_experience', form.business_experience);
    body.append('investment_capacity', form.investment_capacity);
    body.append('location', form.location);
    body.append('has_proposed_property', form.has_proposed_property === 'yes' ? '1' : '0');
    body.append('opening_timeline', form.opening_timeline);
    body.append('business_information', form.business_information);
    body.append('notes', form.notes);
    documents.forEach((file) => body.append('documents[]', file));

    try {
      const response = await fetch(`${API_URL}/franchise-applications`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(franchiseApplicantAuthService.getToken() ? { Authorization: `Bearer ${franchiseApplicantAuthService.getToken()}` } : {}),
        },
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const validationMessages = result.errors ? Object.values(result.errors).flat().join(' ') : '';
        throw new Error(validationMessages || result.message || 'Unable to submit your application.');
      }
      const reference = getReferenceNumber(result);
      sessionStorage.removeItem(draftKey);
      setReferenceNumber(reference);
      setCanTrackInPortal(true);
      setSubmissionConfirmed(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submissionConfirmed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--oppa-cream)] px-4 py-10">
        <section className="w-full max-w-xl rounded-3xl border border-[var(--oppa-border)] bg-white p-8 text-center shadow-lg sm:p-10">
          <CheckCircle2 className="mx-auto mb-4 size-14 text-[var(--oppa-green)]" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--oppa-green)]">Application received</p>
          <h1 className="mt-2 font-serif text-3xl font-bold text-[var(--oppa-text)]">Thank you, {form.contact_name}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--oppa-text-muted)]">
            Your application has been submitted and is now under review. Keep this reference number for your records. You can follow updates in your applicant account.
          </p>
          {referenceNumber ? (
            <div className="mt-6 rounded-2xl bg-[var(--oppa-cream)] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">Application reference</p>
              <p className="mt-1 font-mono text-xl font-bold tracking-wide text-[var(--oppa-green)]">{referenceNumber}</p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-[var(--oppa-text)]">
                <span className="size-2 rounded-full bg-amber-500" /> Under Review
              </p>
            </div>
          ) : (
            <p role="status" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              Your application was received. Keep your reference number; the franchise team can use the contact email you provided for updates. Please do not submit it again.
            </p>
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/franchise/track-application" state={{ referenceNumber, email: form.email }} className="rounded-xl bg-[var(--oppa-green)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">Track application status</Link>
            {canTrackInPortal && <Link to="/franchise/my-applications" className="rounded-xl bg-[var(--oppa-green)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">View My Applications</Link>}
            <Link to="/franchise-opportunities" className="rounded-xl border border-[var(--oppa-border)] px-5 py-3 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">Back to opportunities</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[var(--oppa-border)] bg-white p-5 shadow-lg sm:p-9">
        <Link to="/franchise-opportunities" className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)]">
          <ArrowLeft size={16} /> Back to opportunities
        </Link>
        <header className="mb-7">
          <div className="mb-3 flex items-center gap-2 text-[var(--oppa-green)]">
            <Building2 size={20} aria-hidden="true" />
            <span className="text-sm font-semibold uppercase tracking-[.12em]">Franchise application</span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-[var(--oppa-text)]">Tell us about your plans</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">Your application is reviewed by our team. Submission does not guarantee approval or authorize franchise operations.</p>
        </header>

        <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Application form progress">
          {steps.map((label, index) => (
            <li key={label} className={`border-t-2 pt-2 text-xs font-semibold sm:text-sm ${index <= step ? 'border-[var(--oppa-green)] text-[var(--oppa-green)]' : 'border-[var(--oppa-border)] text-[var(--oppa-text-muted)]'}`}>
              <span className="mr-1.5 inline-flex size-5 items-center justify-center rounded-full bg-[var(--oppa-cream)] text-[11px]">{index < step ? <Check size={12} /> : index + 1}</span>{label}
            </li>
          ))}
        </ol>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div>
          {step === 0 && (
            <div ref={activeFieldsRef} className="grid gap-5 md:grid-cols-2">
              <Field label="Full name" icon={<UserRound size={16} />}>
                <input required maxLength={255} autoComplete="name" value={form.contact_name} onChange={(event) => handleChange('contact_name', event.target.value)} placeholder="Your full legal name" className={inputClass} />
              </Field>
              <Field label="Contact email" icon={<Mail size={16} />}>
                <input required maxLength={255} type="email" autoComplete="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder="you@example.com" className={inputClass} />
              </Field>
              <Field label="Contact number" icon={<Phone size={16} />}>
                <input required maxLength={50} type="tel" autoComplete="tel" value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} placeholder="09XX XXX XXXX" className={inputClass} />
              </Field>
              <Field label="Applicant address" icon={<MapPin size={16} />}>
                <input required maxLength={2000} autoComplete="street-address" value={form.applicant_address} onChange={(event) => handleChange('applicant_address', event.target.value)} placeholder="City, province, and street address" className={inputClass} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div ref={activeFieldsRef} className="grid gap-5">
              <Field label="Proposed franchise location" icon={<MapPin size={16} />}>
                <input required maxLength={2000} value={form.location} onChange={(event) => handleChange('location', event.target.value)} placeholder="City, district, or specific area" className={inputClass} />
              </Field>
              <Field label="Relevant business or management experience" icon={<Building2 size={16} />}>
                <textarea required maxLength={5000} rows={4} value={form.business_experience} onChange={(event) => handleChange('business_experience', event.target.value)} placeholder="Describe your experience operating a business, managing teams, or working in food service." className={inputClass} />
              </Field>
              <Field label="Estimated investment capacity (PHP)">
                <input required min="0" max="9999999999.99" step="0.01" type="number" value={form.investment_capacity} onChange={(event) => handleChange('investment_capacity', event.target.value)} placeholder="e.g. 2500000" className={inputClass} />
              </Field>
              <Field label="Do you have a proposed property?">
                <select required value={form.has_proposed_property} onChange={(event) => handleChange('has_proposed_property', event.target.value as ApplicationForm['has_proposed_property'])} className={inputClass}>
                  <option value="">Choose one</option><option value="yes">Yes, I have a proposed property</option><option value="no">Not yet</option>
                </select>
              </Field>
              <Field label="Expected opening timeline">
                <select required value={form.opening_timeline} onChange={(event) => handleChange('opening_timeline', event.target.value)} className={inputClass}>
                  <option value="">Choose a timeframe</option>
                  {Object.entries(timelineLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="Proposed business name (optional)">
                <input maxLength={255} value={form.franchise_name} onChange={(event) => handleChange('franchise_name', event.target.value)} placeholder="Optional name for your proposed location" className={inputClass} />
              </Field>
              <Field label="Other relevant business information">
                <textarea maxLength={5000} rows={3} value={form.business_information} onChange={(event) => handleChange('business_information', event.target.value)} placeholder="Partners, operating plans, or other details the review team should know." className={inputClass} />
              </Field>
              <Field label="Additional notes">
                <textarea maxLength={5000} rows={3} value={form.notes} onChange={(event) => handleChange('notes', event.target.value)} placeholder="Anything else you would like to include." className={inputClass} />
              </Field>
              <div>
                <label htmlFor="supporting-documents" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">Supporting documents (optional)</label>
                <p className="mb-2 text-xs text-[var(--oppa-text-muted)]">You may attach up to {maxSupportingDocuments} files total: a business profile, proof of funds, or proposed-site information. PDF, JPG, PNG, DOC, or DOCX; up to 10 MB each.</p>
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--oppa-border)] p-4">
                  <FileText size={20} className="shrink-0 text-[var(--oppa-green)]" />
                  <input id="supporting-documents" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleDocumentSelection} className="min-w-0 text-sm" />
                </div>
                {documents.length > 0 && (
                  <ul className="mt-3 space-y-2" aria-label="Selected supporting documents">
                    {documents.map((file, index) => (
                      <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--oppa-cream)] px-3 py-2 text-sm">
                        <span className="min-w-0 break-all text-[var(--oppa-text)]">{file.name}<span className="ml-2 text-xs text-[var(--oppa-text-muted)]">({(file.size / 1024 / 1024).toFixed(2)} MB)</span></span>
                        <button type="button" onClick={() => removeDocument(index)} className="shrink-0 text-xs font-semibold text-red-700 underline">Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm leading-6 text-[var(--oppa-text-muted)]">Review all your information and open each supporting file below before confirming. Nothing is submitted until you press “Confirm and submit application”.</p>
              <div className="grid gap-3 rounded-2xl bg-[var(--oppa-cream)] p-5 sm:grid-cols-2">
                <ReviewItem label="Full name" value={form.contact_name} />
                <ReviewItem label="Contact email" value={form.email || 'Not provided'} />
                <ReviewItem label="Contact number" value={form.phone} />
                <ReviewItem label="Address" value={form.applicant_address} />
                <ReviewItem label="Proposed location" value={form.location} />
                <ReviewItem label="Investment capacity" value={`₱${Number(form.investment_capacity || 0).toLocaleString('en-PH')}`} />
                <ReviewItem label="Proposed property" value={form.has_proposed_property === 'yes' ? 'Yes' : 'No'} />
                <ReviewItem label="Expected opening" value={timelineLabels[form.opening_timeline] || ''} />
                <ReviewItem label="Business experience" value={form.business_experience} />
                <ReviewItem label="Other information" value={form.business_information || form.notes || 'Not provided'} />
              </div>
              <section className="space-y-3" aria-labelledby="review-supporting-documents">
                <div>
                  <h2 id="review-supporting-documents" className="flex items-center gap-2 text-sm font-semibold text-[var(--oppa-text)]"><FileText size={16} /> Supporting documents ({documents.length}/{maxSupportingDocuments})</h2>
                  <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Check the selected files before you confirm. You can go back to add or remove files.</p>
                </div>
                {documents.length ? documents.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}-${index}`} className="rounded-xl border border-[var(--oppa-border)] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="min-w-0 break-all text-sm font-medium text-[var(--oppa-text)]">{file.name}<span className="ml-2 text-xs font-normal text-[var(--oppa-text-muted)]">{(file.size / 1024 / 1024).toFixed(2)} MB</span></p>
                      <button type="button" onClick={() => removeDocument(index)} className="shrink-0 text-xs font-semibold text-red-700 underline">Remove</button>
                    </div>
                    <SupportingDocumentPreview file={file} />
                  </div>
                )) : <p className="rounded-xl bg-[var(--oppa-cream)] p-3 text-sm text-[var(--oppa-text-muted)]">No supporting documents attached.</p>}
              </section>
              <p className="rounded-xl bg-[var(--oppa-cream)] p-4 text-sm text-[var(--oppa-text-muted)]">No account or sign-in is required. Enter an email address you can access so the franchise team can contact you about this application.</p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--oppa-border)] pt-5">
            <button type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} className="rounded-xl border border-[var(--oppa-border)] px-4 py-2.5 text-sm font-medium text-[var(--oppa-text)] disabled:invisible">
              Back
            </button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={continueToNextStep} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)]">
                {step === 1 ? 'Review application' : 'Continue'} <ArrowRight size={16} />
              </button>
            ) : (
              <button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting} className="rounded-xl bg-[var(--oppa-green)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:cursor-not-allowed disabled:opacity-55">
                {isSubmitting ? 'Submitting application…' : 'Confirm and submit application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

const inputClass = 'w-full rounded-xl border border-[var(--oppa-border)] px-3.5 py-3 text-sm text-[var(--oppa-text)] placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/15';

const Field: React.FC<{ label: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <label className="block text-sm font-medium text-[var(--oppa-green)]">
    <span className="mb-1.5 flex items-center gap-2">{icon}{label}</span>
    {children}
  </label>
);

const ReviewItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--oppa-text)]">{value}</p></div>
);

const SupportingDocumentPreview: React.FC<{ file: File }> = ({ file }) => (
  <button
    type="button"
    onClick={() => {
      const previewUrl = URL.createObjectURL(file);
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    }}
    className="text-sm font-medium text-[var(--oppa-green)] underline"
  >
    Open this document to review
  </button>
);

export default FranchiseApplicationPage;

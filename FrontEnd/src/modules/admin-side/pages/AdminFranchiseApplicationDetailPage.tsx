import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Download, Eye, FileText, Loader2, MoreHorizontal, Plus, Save, Upload, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { ConfirmDialog } from '../components/AdminUI';
import {
  activateFranchiseApplication,
  downloadFranchiseApplicationDocument,
  downloadFranchiseRequirementTemplate,
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

type FranchiseRequirementDocument = {
  label: string;
  required: boolean;
  status: string;
  category?: string;
  name_is_custom?: boolean;
  template_name?: string | null;
  template_size_bytes?: number | null;
  template_uploaded_at?: string | null;
  submitted_document_name?: string | null;
  submitted_document_index?: number | null;
  reject_reason?: string | null;
};

const requirementCategories = [
  ['application_documents', 'Choose a file', ''],
  ['agreement_signing', 'Agreement and signing', 'Agreement and Signing'],
  ['payment', 'Payment receipt/reference', 'Payment Receipt / Reference'],
  ['permits_compliance', 'Permits and compliance', 'Permits and Compliance'],
  ['other', 'Other', ''],
] as const;

const requirementStatusStyles: Record<string, string> = {
  pending: 'border-slate-200 bg-slate-100 text-slate-700',
  submitted: 'border-sky-200 bg-sky-50 text-sky-800',
  received: 'border-amber-200 bg-amber-50 text-amber-800',
  verified: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rejected: 'border-red-200 bg-red-50 text-red-800',
  not_applicable: 'border-slate-200 bg-slate-100 text-slate-600',
};

const requirementStatusLabel = (status: string) => ({
  pending: 'Pending',
  submitted: 'Submitted',
  received: 'Under review',
  verified: 'Verified',
  rejected: 'Rejected',
  not_applicable: 'Not applicable',
}[status] || status.replace(/[_-]+/g, ' '));

const defaultRequirementName = (category?: string) =>
  requirementCategories.find(([value]) => value === (category || ''))?.[2] || '';

const fileNameSuggestion = (fileName: string) => fileName
  .replace(/\.[^.]+$/, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
  .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

const formatFileSize = (size: number) => {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const formatUploadDate = (value: string) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeZone: 'Asia/Manila',
}).format(new Date(value));

const templateFileError = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const allowedMimeTypes: Record<string, string[]> = {
    pdf: ['application/pdf'],
    doc: ['application/msword'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    jpg: ['image/jpeg'],
    jpeg: ['image/jpeg'],
    png: ['image/png'],
  };

  if (!extension || !allowedMimeTypes[extension]) return 'File type not allowed. Choose a PDF, DOC, DOCX, JPG, or PNG file.';
  if (!allowedMimeTypes[extension].includes(file.type)) return 'The file type does not match its extension. Choose a valid PDF, DOC, DOCX, JPG, or PNG file.';
  if (file.size > 10 * 1024 * 1024) return 'File is larger than 10 MB.';
  return '';
};

const FranchiseRequirementsForm: React.FC<{
  application: FranchiseApplication;
  onSaved: () => Promise<void>;
  onDownload: (index: number, name: string) => void;
  onDownloadTemplate: (index: number, name: string) => void;
  onPreview: (index: number) => Promise<Blob>;
}> = ({ application, onSaved, onDownload, onDownloadTemplate, onPreview }) => {
  const [documents, setDocuments] = useState<FranchiseRequirementDocument[]>(
    (application.required_documents || []).map((document) => ({
      ...document,
      name_is_custom: document.name_is_custom ?? document.label !== defaultRequirementName(document.category),
    })),
  );
  const [documentTemplates, setDocumentTemplates] = useState<Record<number, File>>({});
  const [templateErrors, setTemplateErrors] = useState<Record<number, string>>({});
  const [draggingTemplate, setDraggingTemplate] = useState<number | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>(
    Object.fromEntries((application.required_documents || []).map((document, index) => [index, document.status !== 'verified'])),
  );
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<number | null>(null);
  const [nameErrors, setNameErrors] = useState<Record<number, string>>({});
  const [rejectErrors, setRejectErrors] = useState<Record<number, string>>({});
  const [duplicateNameErrors, setDuplicateNameErrors] = useState<Record<number, string>>({});
  const [preview, setPreview] = useState<{ url: string; name: string; mimeType: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [nameAnnouncement, setNameAnnouncement] = useState('');
  const [missingTemplateWarning, setMissingTemplateWarning] = useState<string[]>([]);
  const nameInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const saveRequirements = async (documentsToSave = documents) => {
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const result = await updateFranchiseApplicationRequirements(application.id, {
        required_documents: documentsToSave,
        required_document_templates: documentTemplates,
      });
      setDocumentTemplates({});
      setSavedMessage(result.message || 'Required documents saved.');
      await onSaved();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unable to save required documents.';
      const failedTemplate = message.match(/required_document_templates\.(\d+).*failed to upload/i);
      if (failedTemplate) {
        const failedIndex = Number(failedTemplate[1]);
        setTemplateErrors((current) => ({
          ...current,
          [failedIndex]: 'The server could not receive this file. Try selecting it again; if it keeps failing, check the server upload-size and temporary-storage limits.',
        }));
        setError('A template upload failed. Your requirement changes were not saved.');
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const nextNameErrors: Record<number, string> = {};
    const nextRejectErrors: Record<number, string> = {};
    const nextDuplicateErrors: Record<number, string> = {};
    const labels = new Map<string, number[]>();
    documents.forEach((document, index) => {
      if (!document.label.trim()) nextNameErrors[index] = 'Enter a name for this requirement.';
      if (document.status === 'rejected' && !document.reject_reason?.trim()) {
        nextRejectErrors[index] = 'Add a reason for rejecting this submission.';
      }
      const normalizedLabel = document.label.trim().toLocaleLowerCase();
      if (normalizedLabel) labels.set(normalizedLabel, [...(labels.get(normalizedLabel) || []), index]);
    });
    labels.forEach((indices) => {
      if (indices.length > 1) {
        indices.forEach((index) => { nextDuplicateErrors[index] = 'Requirement names must be unique. Add a distinguishing name.'; });
      }
    });
    setNameErrors(nextNameErrors);
    setRejectErrors(nextRejectErrors);
    setDuplicateNameErrors(nextDuplicateErrors);
    if (Object.keys(nextNameErrors).length || Object.keys(nextRejectErrors).length || Object.keys(nextDuplicateErrors).length) {
      const firstInvalidIndex = Math.min(
        ...Object.keys({ ...nextNameErrors, ...nextRejectErrors, ...nextDuplicateErrors }).map(Number),
      );
      if (nextNameErrors[firstInvalidIndex]) nameInputs.current[firstInvalidIndex]?.focus();
      else nameInputs.current[firstInvalidIndex]?.focus();
      return;
    }
    const missingTemplates = documents
      .filter((document, index) => document.label.trim() && !document.template_name && !documentTemplates[index])
      .map((document) => document.label.trim());
    if (missingTemplates.length) {
      setMissingTemplateWarning(missingTemplates);
      return;
    }
    void saveRequirements();
  };

  const updateDocument = (index: number, patch: Partial<FranchiseRequirementDocument>) =>
    setDocuments((current) => current.map((document, position) => position === index ? { ...document, ...patch } : document));
  const setDocumentStatus = (index: number, status: string) => {
    const updatedDocuments = documents.map((document, position) => position === index
      ? { ...document, status, reject_reason: status === 'rejected' ? document.reject_reason : null }
      : document);
    setDocuments(updatedDocuments);
    if (status === 'verified') void saveRequirements(updatedDocuments);
  };
  const changeCategory = (index: number, category: string) => {
    const current = documents[index];
    const nameIsCustom = current.name_is_custom ?? true;
    const defaultName = defaultRequirementName(category);
    let nextName = current.label;
    if (!nameIsCustom) {
      nextName = defaultName;
      if (defaultName) {
        const duplicateCount = documents.filter((document, position) => position !== index && document.category === category).length;
        if (duplicateCount) nextName = `${defaultName} ${duplicateCount + 1}`;
      }
    }
    updateDocument(index, { category: category || undefined, label: nextName, name_is_custom: nameIsCustom });
    setNameErrors((currentErrors) => ({ ...currentErrors, [index]: '' }));
    if (!defaultName) {
      setNameAnnouncement('Enter a custom name for this requirement.');
      window.setTimeout(() => nameInputs.current[index]?.focus(), 0);
    } else if (!nameIsCustom) {
      setNameAnnouncement(`Requirement name set to ${nextName}.`);
    }
  };
  const selectTemplate = (index: number, file?: File) => {
    if (!file) return;
    const fileError = templateFileError(file);
    setTemplateErrors((current) => ({ ...current, [index]: fileError }));
    if (fileError) return;
    setDocumentTemplates((current) => ({ ...current, [index]: file }));
    if (!documents[index].name_is_custom) {
      const suggestedName = fileNameSuggestion(file.name);
      updateDocument(index, { label: suggestedName, name_is_custom: false });
      setNameAnnouncement(`Suggested requirement name: ${suggestedName}. You can edit it.`);
    }
    updateDocument(index, { template_name: file.name, template_size_bytes: file.size, template_uploaded_at: new Date().toISOString() });
  };
  const removeRequirement = () => {
    if (removeTarget === null) return;
    const removedIndex = removeTarget;
    setDocuments((current) => current.filter((_, index) => index !== removedIndex));
    setDocumentTemplates((current) => Object.fromEntries(Object.entries(current)
      .filter(([key]) => Number(key) !== removedIndex)
      .map(([key, file]) => [Number(key) > removedIndex ? String(Number(key) - 1) : key, file])));
    setTemplateErrors((current) => Object.fromEntries(Object.entries(current)
      .filter(([key]) => Number(key) !== removedIndex)
      .map(([key, message]) => [Number(key) > removedIndex ? String(Number(key) - 1) : key, message])));
    setNameErrors((current) => Object.fromEntries(Object.entries(current)
      .filter(([key]) => Number(key) !== removedIndex)
      .map(([key, message]) => [Number(key) > removedIndex ? String(Number(key) - 1) : key, message])));
    setDuplicateNameErrors((current) => Object.fromEntries(Object.entries(current)
      .filter(([key]) => Number(key) !== removedIndex)
      .map(([key, message]) => [Number(key) > removedIndex ? String(Number(key) - 1) : key, message])));
    setRejectErrors((current) => Object.fromEntries(Object.entries(current)
      .filter(([key]) => Number(key) !== removedIndex)
      .map(([key, message]) => [Number(key) > removedIndex ? String(Number(key) - 1) : key, message])));
    setExpandedCards((current) => Object.fromEntries(Object.entries(current)
      .filter(([key]) => Number(key) !== removedIndex)
      .map(([key, expanded]) => [Number(key) > removedIndex ? String(Number(key) - 1) : key, expanded])));
    setRemoveTarget(null);
  };
  const showPreview = async (index: number, name: string, mimeType: string) => {
    setPreviewLoading(index);
    try {
      const blob = await onPreview(index);
      setPreview({ url: URL.createObjectURL(blob), name, mimeType: blob.type || mimeType });
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Unable to preview the submitted document.');
    } finally {
      setPreviewLoading(null);
    }
  };
  return (
    <section className="mt-6 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4"><h2 className="font-serif text-xl font-bold text-[var(--oppa-text)]">Documents and final review</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Add each document the franchisee must complete. Attach a blank form or instructions if available; a template is optional, and the franchisee can still upload the requested document directly.</p></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {savedMessage && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{savedMessage}</p>}
      <p className="sr-only" aria-live="polite">{nameAnnouncement}</p>
      {missingTemplateWarning.length > 0 && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) setMissingTemplateWarning([]);
      }}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="missing-template-title" aria-describedby="missing-template-description" onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) setMissingTemplateWarning([]);
        }} className="w-full max-w-lg rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-2xl">
          <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-900"><FileText size={21} aria-hidden="true" /></div>
          <h3 id="missing-template-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">Some requirements have no file attached</h3>
          <p id="missing-template-description" className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">Without an attached file, the franchisee cannot download a form for these requirements:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-medium text-amber-900">{missingTemplateWarning.map((label) => <li key={label}>No file is attached to “{label}”. This cannot be downloaded by the franchisee.</li>)}</ul>
          <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <button type="button" disabled={saving} onClick={() => setMissingTemplateWarning([])} className="min-h-10 rounded-lg border border-[var(--oppa-border)] px-4 py-2 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] disabled:opacity-60">Go back and attach file</button>
            <button type="button" disabled={saving} onClick={() => { setMissingTemplateWarning([]); void saveRequirements(); }} className="min-h-10 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:opacity-60">Save without file</button>
          </div>
        </section>
      </div>}
      <form noValidate onSubmit={save} className="space-y-3">
        <fieldset className="space-y-3">
          <legend className="sr-only">Requirements and files for the franchisee</legend>
          {documents.map((document, index) => {
            const submission = application.documents
              ?.map((file, documentIndex) => ({ ...file, documentIndex }))
              .reverse()
              .find((file) => file.required_document_label === document.label);
            const submittedName = submission?.name || document.submitted_document_name;
            const submittedIndex = submission?.documentIndex ?? document.submitted_document_index;
            const submittedFile = typeof submittedIndex === 'number' ? application.documents?.[submittedIndex] : undefined;
            const submittedMime = submittedFile?.mime_type || '';
            const submittedDate = submittedFile?.uploaded_at;
            const templateFile = documentTemplates[index];
            const templatePersisted = Boolean(document.template_name && !templateFile);
            const templateAttached = Boolean(templateFile || document.template_name);
            const templateInputId = `franchise-template-${application.id}-${index}`;
            const nameInputId = `franchise-requirement-name-${application.id}-${index}`;
            const statusLabel = requirementStatusLabel(document.status);
            const expanded = expandedCards[index] ?? document.status !== 'verified';
            const verificationEvent = document.status === 'verified'
              ? [...(application.events || [])].reverse().find((event) => event.title === 'Document verified'
                && event.message?.includes(`verified your submitted document: ${document.label}.`))
              : undefined;
            const verifiedText = verificationEvent?.created_at
              ? `Verified by franchise team on ${formatUploadDate(verificationEvent.created_at)}`
              : 'Verified · save to record this review.';

            return <article key={`${index}-${document.category || 'other'}`} className="overflow-visible rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)] p-3 sm:p-4">
              <header className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(170px,.7fr)_minmax(200px,1.3fr)]">
                  <label className="sr-only" htmlFor={`${templateInputId}-category`}>Requirement category</label>
                  <select id={`${templateInputId}-category`} value={document.category || ''} disabled={saving} onChange={(event) => changeCategory(index, event.target.value)} className="min-h-10 rounded-lg border border-[var(--oppa-border)] bg-white px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">
                    {document.category && !requirementCategories.some(([value]) => value === document.category) && <option value={document.category}>Legacy category</option>}
                    {requirementCategories.map(([value, label]) => <option key={`${value}-${label}`} value={value}>{label}</option>)}
                  </select>
                  <div className="min-w-0">
                    <label className="sr-only" htmlFor={nameInputId}>Requirement name</label>
                    <input id={nameInputId} ref={(element) => { nameInputs.current[index] = element; }} value={document.label} onChange={(event) => {
                      updateDocument(index, { label: event.target.value, name_is_custom: true });
                      setNameErrors((current) => ({ ...current, [index]: '' }));
                      setDuplicateNameErrors((current) => ({ ...current, [index]: '' }));
                    }} disabled={saving} placeholder="Enter a custom requirement name" title={document.label} aria-invalid={Boolean(nameErrors[index] || duplicateNameErrors[index])} aria-describedby={nameErrors[index] ? `${nameInputId}-error` : duplicateNameErrors[index] ? `${nameInputId}-duplicate-error` : undefined} className="min-h-10 w-full min-w-0 rounded-lg border border-[var(--oppa-border)] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]" />
                    {nameErrors[index] && <p id={`${nameInputId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-700">{nameErrors[index]}</p>}
                    {duplicateNameErrors[index] && <p id={`${nameInputId}-duplicate-error`} role="alert" className="mt-1 text-xs font-medium text-red-700">{duplicateNameErrors[index]}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:pr-1">
                  <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold ${requirementStatusStyles[document.status] || requirementStatusStyles.pending}`} aria-live="polite">{statusLabel}</span>
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--oppa-border)] bg-white px-3 text-xs font-semibold text-[var(--oppa-text)]">
                    <input type="checkbox" role="switch" aria-label={`${document.label || 'Requirement'} is required`} checked={document.required} disabled={saving} onChange={(event) => updateDocument(index, { required: event.target.checked })} className="size-4 accent-[var(--oppa-green)]" />
                    Required
                  </label>
                  <label className="sr-only" htmlFor={`${templateInputId}-status`}>Document status</label>
                  <select id={`${templateInputId}-status`} value={document.status} disabled={saving} onChange={(event) => setDocumentStatus(index, event.target.value)} className="min-h-9 rounded-lg border border-[var(--oppa-border)] bg-white px-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">
                    <option value="pending">Pending</option><option value="submitted">Submitted</option><option value="received">Under review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="not_applicable">Not applicable</option>
                  </select>
                  <div className="relative">
                    <button type="button" aria-label="Requirement actions" aria-haspopup="menu" aria-expanded={openMenu === index} onClick={() => setOpenMenu(openMenu === index ? null : index)} className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--oppa-border)] bg-white text-[var(--oppa-text)] hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"><MoreHorizontal size={18} /></button>
                    {openMenu === index && <div role="menu" className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-[var(--oppa-border)] bg-white p-1 shadow-lg">
                      <button type="button" role="menuitem" disabled={saving} onClick={() => { setRemoveTarget(index); setOpenMenu(null); }} className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Remove requirement</button>
                    </div>}
                  </div>
                  <button type="button" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${document.label || 'requirement'}`} aria-expanded={expanded} onClick={() => setExpandedCards((current) => ({ ...current, [index]: !expanded }))} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[var(--oppa-text-muted)] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">
                    <ChevronDown size={18} className={expanded ? '' : '-rotate-90'} />
                  </button>
                </div>
              </header>
              {!expanded && document.status === 'verified' ? <p className="mt-2 truncate pl-1 text-xs text-emerald-800" title={document.label}>{document.label} · {verifiedText}</p> : expanded && <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <section className="min-w-0 rounded-xl border border-[var(--oppa-border)] bg-white p-3 sm:p-4">
                  <div className="mb-3"><h3 className="text-sm font-semibold text-[var(--oppa-text)]">Template from admin</h3><p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">File to send to franchisee</p></div>
                  <input id={templateInputId} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png" className="peer sr-only" disabled={saving} onChange={(event) => { selectTemplate(index, event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} />
                  {!templateAttached ? <label htmlFor={templateInputId} onDragOver={(event) => { event.preventDefault(); if (!saving) setDraggingTemplate(index); }} onDragLeave={(event) => {
                    const nextTarget = event.relatedTarget;
                    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setDraggingTemplate(null);
                  }} onDrop={(event) => { event.preventDefault(); setDraggingTemplate(null); if (!saving) selectTemplate(index, event.dataTransfer.files[0]); }} className={`flex min-h-36 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--oppa-green)] peer-focus-visible:ring-offset-2 ${draggingTemplate === index ? 'border-[var(--oppa-green)] bg-emerald-50' : 'border-amber-400 bg-amber-50/70 hover:border-[var(--oppa-green)] hover:bg-emerald-50'}`}>
                    <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-white text-[var(--oppa-green)] shadow-sm"><Upload size={20} aria-hidden="true" /></span>
                    <span className="text-sm font-semibold text-[var(--oppa-text)]">Upload file or form for the franchisee</span>
                    <span className="mt-1 text-xs text-[var(--oppa-text-muted)]">PDF, DOC, DOCX, JPG, PNG · max 10MB · drag and drop supported</span>
                    <span className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white">Choose file</span>
                  </label> : <div aria-live="polite" className="flex min-w-0 flex-col gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 sm:flex-row sm:items-center">
                    <FileText size={20} className="shrink-0 text-[var(--oppa-green)]" aria-hidden="true" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold" title={templateFile?.name || document.template_name || ''}>{templateFile?.name || document.template_name}</p><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{templateFile ? `${formatFileSize(templateFile.size)} · selected; save to finish attaching` : `${document.template_size_bytes ? `${formatFileSize(document.template_size_bytes)} · ` : ''}${document.template_uploaded_at ? `Uploaded ${formatUploadDate(document.template_uploaded_at)}` : 'File attached'}`}</p>{saving && templateFile && <p className="mt-1 flex items-center gap-1 text-xs text-[var(--oppa-green)]"><Loader2 size={13} className="animate-spin" />Uploading securely…</p>}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {templatePersisted && <button type="button" onClick={() => onDownloadTemplate(index, document.template_name || 'franchisee-form')} disabled={saving} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-white px-2.5 text-xs font-semibold text-[var(--oppa-green)] disabled:opacity-50"><Download size={13} />Download</button>}
                      <label htmlFor={templateInputId} className={`inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-white px-2.5 text-xs font-semibold ${saving ? 'pointer-events-none opacity-50' : ''}`}><Upload size={13} />Replace</label>
                      <button type="button" disabled={saving} onClick={() => {
                        setDocumentTemplates((current) => { const next = { ...current }; delete next[index]; return next; });
                        setTemplateErrors((current) => ({ ...current, [index]: '' }));
                        updateDocument(index, { template_name: null, template_size_bytes: null, template_uploaded_at: null });
                      }} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 disabled:opacity-50"><X size={13} />Remove</button>
                    </div>
                  </div>}
                  {templateErrors[index] && <p role="alert" aria-live="assertive" className="mt-2 text-sm font-medium text-red-700">{templateErrors[index]}</p>}
                </section>
                <section className="min-w-0 rounded-xl border border-[var(--oppa-border)] bg-white p-3 sm:p-4">
                  <div className="mb-3"><h3 className="text-sm font-semibold text-[var(--oppa-text)]">Franchisee submission</h3><p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">Completed document uploaded by the applicant</p></div>
                  {submittedName && typeof submittedIndex === 'number' ? <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 sm:flex-row sm:items-center">
                    <FileText size={20} className="shrink-0 text-sky-800" aria-hidden="true" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--oppa-text)]" title={submittedName}>{submittedName}</p><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{submittedFile?.size ? `${formatFileSize(submittedFile.size)} · ` : ''}{submittedDate ? `Uploaded ${formatUploadDate(submittedDate)}` : 'Submitted by franchisee'}</p></div>
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => onDownload(submittedIndex, submittedName)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-white px-2.5 text-xs font-semibold text-[var(--oppa-green)]"><Download size={13} />Download</button>
                      {(submittedMime === 'application/pdf' || submittedMime.startsWith('image/')) && <button type="button" disabled={previewLoading === index} onClick={() => void showPreview(submittedIndex, submittedName, submittedMime)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-white px-2.5 text-xs font-semibold text-[var(--oppa-text)] disabled:opacity-50"><Eye size={13} />{previewLoading === index ? 'Loading…' : 'Preview'}</button>}
                    </div>
                  </div> : <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-4 text-center text-sm text-[var(--oppa-text-muted)]">Not submitted yet</div>}
                  {document.status === 'rejected' && document.reject_reason && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><span className="font-semibold">Rejection reason: </span>{document.reject_reason}</p>}
                </section>
                <footer className="flex flex-col gap-2 border-t border-[var(--oppa-border)] pt-3 sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!submittedName || saving} onClick={() => {
                      setDocumentStatus(index, 'verified');
                      setExpandedCards((current) => ({ ...current, [index]: false }));
                    }} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:cursor-not-allowed disabled:opacity-50"><Check size={15} />Verify</button>
                    <button type="button" disabled={!submittedName || saving} onClick={() => {
                      updateDocument(index, { status: 'rejected', reject_reason: document.reject_reason || '' });
                      setRejectErrors((current) => ({ ...current, [index]: 'Add a reason for rejecting this submission.' }));
                    }} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">Reject</button>
                  </div>
                  {document.status === 'verified' && <p role="status" className="text-xs font-medium text-emerald-800">{verifiedText}</p>}
                  {document.status === 'rejected' && <label className="w-full text-xs font-semibold text-red-800 sm:max-w-md">Reason shown to the franchisee
                    <textarea value={document.reject_reason || ''} onChange={(event) => {
                      updateDocument(index, { reject_reason: event.target.value });
                      if (event.target.value.trim()) setRejectErrors((current) => ({ ...current, [index]: '' }));
                    }} rows={2} maxLength={2000} aria-invalid={Boolean(rejectErrors[index])} className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-normal text-[var(--oppa-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500" placeholder="Explain what needs to be corrected" />
                    {rejectErrors[index] && <span role="alert" className="mt-1 block">{rejectErrors[index]}</span>}
                  </label>}
                </footer>
              </div>}
            </article>;
          })}
        </fieldset>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button type="button" disabled={documents.length >= 8 || saving} onClick={() => {
            const category = 'agreement_signing';
            const defaultName = defaultRequirementName(category);
            const duplicates = documents.filter((document) => document.category === category).length;
            const label = duplicates ? `${defaultName} ${duplicates + 1}` : defaultName;
            setDocuments((current) => [...current, { label, category, required: true, status: 'pending', name_is_custom: false }]);
            setExpandedCards((current) => ({ ...current, [documents.length]: true }));
          }} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-[var(--oppa-border)] bg-white px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} />Add requirement</button>
          {documents.length >= 8 && <p role="status" className="text-xs font-medium text-amber-800">Maximum of 8 requirements reached.</p>}
        </div>
        <button type="submit" disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving requirements…' : 'Save document requirements'}</button>
        <p className="text-xs text-[var(--oppa-text-muted)]">{application.requirements_reviewed_at ? `Last reviewed ${new Date(application.requirements_reviewed_at).toLocaleString()}.` : 'Not yet reviewed. Saving records the current checklist and review.'}</p>
      </form>
      {removeTarget !== null && <ConfirmDialog title={`Remove "${documents[removeTarget]?.label || 'this requirement'}"?`} description="This requirement and its attached template will be removed from the applicant checklist." confirmLabel="Remove requirement" onCancel={() => setRemoveTarget(null)} onConfirm={removeRequirement} />}
      {preview && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Preview ${preview.name}`} onMouseDown={(event) => {
        if (event.target === event.currentTarget) { URL.revokeObjectURL(preview.url); setPreview(null); }
      }}>
        <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--oppa-border)] px-4 py-3"><h2 className="truncate text-sm font-semibold" title={preview.name}>{preview.name}</h2><button type="button" aria-label="Close preview" onClick={() => { URL.revokeObjectURL(preview.url); setPreview(null); }} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"><X size={18} /></button></header>
          {preview.mimeType.startsWith('image/') ? <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-stone-100 p-3"><img src={preview.url} alt={`Preview of ${preview.name}`} className="max-h-[78vh] max-w-full object-contain" /></div> : <iframe title={`Preview of ${preview.name}`} src={preview.url} className="min-h-[70vh] w-full flex-1" />}
        </section>
      </div>}
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
  const [downloading, setDownloading] = useState<number | string | null>(null);
  const [error, setError] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState<string | null>(null);
  const formDirty = useRef(false);
  const requestInFlight = useRef(false);
  const refreshQueued = useRef(false);
  const mounted = useRef(false);

  const load = async (showLoading = true) => {
    if (!id) return;
    if (requestInFlight.current) {
      if (showLoading) refreshQueued.current = true;
      return;
    }
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
      if (mounted.current && refreshQueued.current) {
        refreshQueued.current = false;
        void load(false);
      }
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
      setApplication((current) => current
        ? { ...current, status, next_step_instructions: instructions }
        : current);
      formDirty.current = false;
      await load();
      if (status === 'location_assessment') {
        window.setTimeout(() => {
          document.getElementById('franchise-requirements-panel')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 0);
      }
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

  const previewDocument = async (index: number) => {
    if (!id) throw new Error('Application is not available.');
    return downloadFranchiseApplicationDocument(id, index);
  };

  const downloadTemplate = async (index: number, name: string) => {
    if (!id) return;
    const key = `template-${index}`;
    setDownloading(key);
    setError('');
    try {
      const blob = await downloadFranchiseRequirementTemplate(id, index);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the franchisee template.');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <AdminLayout>
      <div className="rounded-2xl bg-[var(--oppa-surface)] p-3 sm:p-5">
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
              {currentStatus === 'for_interview' && <p className="rounded-xl bg-[var(--oppa-cream)] p-3 text-xs leading-5 text-[var(--oppa-text-muted)]">After the interview is completed, select Location Assessment. This begins the combined final stage (site inspection, financial evaluation, and agreement). Add the required-document checklist in the panel below. A blank form is optional; saving the requirements automatically opens the applicant's upload area.</p>}
              {currentStatus === 'location_assessment' && <p className="rounded-xl bg-[var(--oppa-cream)] p-3 text-xs leading-5 text-[var(--oppa-text-muted)]">Complete the site and financial assessment and prepare the final decision/agreement in the requirements panel below. Saving the checklist opens the applicant's document upload area, whether or not templates are attached. The application remains in Location Assessment while documents are submitted.</p>}
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
            <div id="franchise-requirements-panel" className="scroll-mt-6">
              <FranchiseRequirementsForm application={application} onSaved={load} onDownload={(index, name) => void downloadDocument(index, name)} onDownloadTemplate={(index, name) => void downloadTemplate(index, name)} onPreview={previewDocument} />
            </div>
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
      </div>
    </AdminLayout>
  );
};

const FranchiseActivationPanel: React.FC<{ application: FranchiseApplication; onActivated: () => Promise<void> }> = ({ application, onActivated }) => {
  const registeredApplicant = application.franchise_applicant;
  const [managerName, setManagerName] = useState(registeredApplicant?.full_name || application.contact_name);
  const [managerEmail, setManagerEmail] = useState(registeredApplicant?.email || application.email);
  const [managerPhone, setManagerPhone] = useState(registeredApplicant?.phone || application.phone || '');
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
    if (!window.confirm('Activate this franchise, create its location and franchisee dashboard access, and enable franchise operations?')) return;
    setSaving(true);
    setError('');
    try {
      await activateFranchiseApplication(application.id, {
        ...(registeredApplicant ? {} : {
          manager_full_name: managerName,
          manager_email: managerEmail,
          manager_phone: managerPhone,
          manager_password: managerPassword,
        }),
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
      <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Final authorization</p><h2 className="mt-1 font-serif text-xl font-bold text-[var(--oppa-text)]">Activate franchise operations</h2><p className="mt-1 text-sm leading-6 text-[var(--oppa-text-muted)]">This creates one active franchise account/location and dashboard access. The server rechecks approval, signed agreement, payment disposition, and every opening requirement before activation.</p></div>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form onSubmit={handleActivate} className="grid gap-4 md:grid-cols-2">
        {registeredApplicant ? <>
          <label className="block text-sm font-medium">Franchisee login name<input readOnly value={registeredApplicant.full_name} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 py-2.5 text-sm" /></label>
          <label className="block text-sm font-medium">Franchisee login email<input readOnly value={registeredApplicant.email} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 py-2.5 text-sm" /></label>
          <p className="rounded-xl bg-[var(--oppa-cream)] p-3 text-xs leading-5 text-[var(--oppa-text-muted)] md:col-span-2">The franchisee will sign in with the same email and password used for their applicant account. No new password is created or shown here.</p>
        </> : <>
          <label className="block text-sm font-medium">Authorized manager name<input required maxLength={255} value={managerName} onChange={(event) => setManagerName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
          <label className="block text-sm font-medium">Manager login email<input required type="email" maxLength={255} value={managerEmail} onChange={(event) => setManagerEmail(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
          <label className="block text-sm font-medium">Manager phone<input maxLength={50} value={managerPhone} onChange={(event) => setManagerPhone(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /></label>
          <label className="block text-sm font-medium">Initial manager password<input required type="password" minLength={12} autoComplete="new-password" value={managerPassword} onChange={(event) => setManagerPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5 text-sm" /><span className="mt-1 block text-xs font-normal text-[var(--oppa-text-muted)]">At least 12 characters. Share it with the manager through a separate secure channel.</span></label>
        </>}
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={canProcessPos} onChange={(event) => setCanProcessPos(event.target.checked)} />Authorize this manager to process POS transactions</label>
        <div className="rounded-xl bg-[var(--oppa-cream)] p-3 text-xs leading-5 text-[var(--oppa-text-muted)] md:col-span-2">No franchise record or dashboard/POS access is created until you confirm activation. Staff and cashier access remains subject to authorized setup for the activated location.</div>
        <button type="submit" disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:opacity-60 md:col-span-2">{saving ? 'Activating…' : 'Confirm and activate franchise'}</button>
      </form>
    </section>
  );
};

const Info: React.FC<{ label: string; value: string; wide?: boolean }> = ({ label, value, wide }) => <div className={wide ? 'sm:col-span-2' : ''}><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--oppa-text)]">{value}</p></div>;

export default AdminFranchiseApplicationDetailPage;

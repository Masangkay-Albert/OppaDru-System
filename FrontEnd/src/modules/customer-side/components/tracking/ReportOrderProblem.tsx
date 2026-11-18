import React, { useMemo, useState } from 'react';
import { getReplacementStatusLabel, submitReplacementRequest, type ReplacementIssueType, type ReplacementOrderState } from '../../../../services/replacementService';

interface ReplacementItem {
  id: number;
  name: string;
  quantity: number;
}

interface ReportOrderProblemProps {
  orderId: string;
  items: ReplacementItem[];
  policy?: ReplacementOrderState;
  onSubmitted: () => Promise<void>;
}

const issueOptions: Array<{ value: ReplacementIssueType; label: string }> = [
  { value: 'hair_or_foreign_object', label: 'Hair or foreign object' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'missing_item', label: 'Missing item' },
  { value: 'spilled_or_damaged', label: 'Spilled or damaged' },
  { value: 'not_fresh', label: 'Not fresh' },
  { value: 'other', label: 'Other' },
];
const photoRequiredIssues = new Set<ReplacementIssueType>(['hair_or_foreign_object', 'spilled_or_damaged', 'not_fresh']);

const ReportOrderProblem: React.FC<ReportOrderProblemProps> = ({ orderId, items, policy, onSubmitted }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [issueType, setIssueType] = useState<ReplacementIssueType>('wrong_item');
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const selectedIssueLabel = useMemo(
    () => issueOptions.find((option) => option.value === issueType)?.label ?? 'Other',
    [issueType],
  );
  const replacementRequest = policy?.request;

  const updatePhotos = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []);
    if (nextFiles.length > 3) {
      setError('Choose no more than 3 photos.');
      setPhotos(nextFiles.slice(0, 3));
      return;
    }
    if (nextFiles.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setError('Photos must be JPG, PNG, or WebP and no larger than 5 MB each.');
      setPhotos([]);
      return;
    }
    setError('');
    setPhotos(nextFiles);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!selectedItems.length) {
      setError('Choose at least one affected item.');
      return;
    }
    if (description.trim().length < 3 || description.trim().length > 255) {
      setError('Description must be between 3 and 255 characters.');
      return;
    }
    if (photoRequiredIssues.has(issueType) && photos.length === 0) {
      setError('Please add at least one photo for this issue.');
      return;
    }
    setSending(true);
    try {
      await submitReplacementRequest(orderId, issueType, selectedItems, description.trim(), photos);
      setSubmitted(true);
      setIsOpen(false);
      await onSubmitted();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The request could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-card" aria-labelledby="replacement-policy-title">
      <h2 id="replacement-policy-title" className="mb-3 font-serif text-lg font-semibold text-[var(--oppa-text)]">Quality &amp; Replacement Policy</h2>
      <p className="text-sm leading-6 text-[var(--oppa-text-muted)]">
        We don&apos;t offer returns or exchanges. We make sure our food is good quality. If something is wrong, tell us and we&apos;ll replace it right away, no need to return the food.
      </p>

      {replacementRequest && (
        <div className="mt-4 rounded-xl border border-[var(--oppa-green)]/20 bg-[var(--oppa-green-soft)] p-3" role="status">
          <p className="text-sm font-bold text-[var(--oppa-available-text)]">
            {getReplacementStatusLabel(replacementRequest.status)}
          </p>
          {replacementRequest.replacement_order_number && (
            <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Replacement order {replacementRequest.replacement_order_number}</p>
          )}
          {replacementRequest.reject_reason && (
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Reason: {replacementRequest.reject_reason}</p>
          )}
        </div>
      )}
      {submitted && (
        <p role="status" className="mt-3 rounded-xl bg-[var(--oppa-green-soft)] p-3 text-sm font-medium text-[var(--oppa-available-text)]">
          Sorry about that! We&apos;ll send a replacement. You don&apos;t need to return the food.
        </p>
      )}
      {policy?.can_report_problem && !replacementRequest && !submitted && (
        <button type="button" onClick={() => setIsOpen((open) => !open)} className="mt-4 min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2">
          {isOpen ? 'Close report form' : 'Report a problem'}
        </button>
      )}
      {policy?.report_window_ended && !replacementRequest && (
        <p className="mt-3 text-sm text-[var(--oppa-text-muted)]">The reporting window has ended. Please contact your branch for help.</p>
      )}
      {!policy && null}

      {isOpen && (
        <form onSubmit={submit} className="mt-4 space-y-4 border-t border-[var(--oppa-border)] pt-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-[var(--oppa-text)]">Which items were affected?</legend>
            <div className="space-y-2">
              {items.map((item) => (
                <label key={item.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--oppa-border)] px-3 text-sm text-[var(--oppa-text)]">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={(event) => setSelectedItems((current) => event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id))}
                  />
                  <span>{item.quantity}x {item.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-semibold text-[var(--oppa-text)]">
            Issue type
            <select value={issueType} onChange={(event) => setIssueType(event.target.value as ReplacementIssueType)} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 font-normal text-[var(--oppa-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">
              {issueOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-[var(--oppa-text)]">
            Tell us what happened
            <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 255))} minLength={3} maxLength={255} required rows={3} className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 font-normal text-[var(--oppa-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]" aria-describedby="replacement-description-count" />
            <span id="replacement-description-count" className="mt-1 block text-right text-xs font-normal text-[var(--oppa-text-muted)]">{description.length}/255</span>
          </label>
          <label className="block text-sm font-semibold text-[var(--oppa-text)]">
            Photos {photoRequiredIssues.has(issueType) ? '(required)' : '(optional)'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => updatePhotos(event.target.files)} className="mt-1 block w-full text-sm font-normal text-[var(--oppa-text)] file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[var(--oppa-green-soft)] file:px-3 file:font-semibold file:text-[var(--oppa-available-text)]" />
            <span className="mt-1 block text-xs font-normal text-[var(--oppa-text-muted)]">Up to 3 JPG, PNG, or WebP photos, 5 MB each.</span>
          </label>
          {photos.length > 0 && <p className="text-xs text-[var(--oppa-text-muted)]">{photos.map((photo) => photo.name).join(', ')}</p>}
          {error && <p role="alert" className="text-sm text-[var(--promo-danger-text)]">{error}</p>}
          <button type="submit" disabled={sending} className="min-h-11 w-full rounded-xl bg-[var(--oppa-green)] px-4 font-semibold text-white transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            {sending ? 'Sending…' : `Send report · ${selectedIssueLabel}`}
          </button>
        </form>
      )}
    </section>
  );
};

export default ReportOrderProblem;

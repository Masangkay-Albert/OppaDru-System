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
    <section className="mt-4 rounded-2xl border border-white/80 bg-white p-4 shadow-lg">
      <h3 className="mb-3 font-semibold text-gray-800">Quality &amp; Replacement Policy</h3>
      <p className="text-sm leading-6 text-gray-600">
        We don&apos;t offer returns or exchanges. We make sure our food is good quality. If something is wrong, tell us and we&apos;ll replace it right away, no need to return the food.
      </p>

      {replacementRequest && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-[#f3f8f3] p-3" role="status">
          <p className="text-sm font-bold text-[#1c3d2e]">
            {getReplacementStatusLabel(replacementRequest.status)}
          </p>
          {replacementRequest.replacement_order_number && (
            <p className="mt-1 text-xs text-gray-600">Replacement order {replacementRequest.replacement_order_number}</p>
          )}
          {replacementRequest.reject_reason && (
            <p className="mt-1 text-sm text-gray-600">Reason: {replacementRequest.reject_reason}</p>
          )}
        </div>
      )}
      {submitted && (
        <p role="status" className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          Sorry about that! We&apos;ll send a replacement. You don&apos;t need to return the food.
        </p>
      )}
      {policy?.can_report_problem && !replacementRequest && !submitted && (
        <button type="button" onClick={() => setIsOpen((open) => !open)} className="mt-4 min-h-11 rounded-xl bg-[#2d6a4f] px-4 text-sm font-semibold text-white transition hover:bg-[#1c3d2e]">
          {isOpen ? 'Close report form' : 'Report a problem'}
        </button>
      )}
      {policy?.report_window_ended && !replacementRequest && (
        <p className="mt-3 text-sm text-gray-600">The reporting window has ended. Please contact your branch for help.</p>
      )}
      {!policy && null}

      {isOpen && (
        <form onSubmit={submit} className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-gray-800">Which items were affected?</legend>
            <div className="space-y-2">
              {items.map((item) => (
                <label key={item.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm text-gray-700">
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
          <label className="block text-sm font-semibold text-gray-800">
            Issue type
            <select value={issueType} onChange={(event) => setIssueType(event.target.value as ReplacementIssueType)} className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 font-normal">
              {issueOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-gray-800">
            Tell us what happened
            <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 255))} minLength={3} maxLength={255} required rows={3} className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-normal" aria-describedby="replacement-description-count" />
            <span id="replacement-description-count" className="mt-1 block text-right text-xs font-normal text-gray-500">{description.length}/255</span>
          </label>
          <label className="block text-sm font-semibold text-gray-800">
            Photos {photoRequiredIssues.has(issueType) ? '(required)' : '(optional)'}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => updatePhotos(event.target.files)} className="mt-1 block w-full text-sm font-normal file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[#e7f1e8] file:px-3 file:font-semibold file:text-[#276343]" />
            <span className="mt-1 block text-xs font-normal text-gray-500">Up to 3 JPG, PNG, or WebP photos, 5 MB each.</span>
          </label>
          {photos.length > 0 && <p className="text-xs text-gray-500">{photos.map((photo) => photo.name).join(', ')}</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={sending} className="min-h-11 w-full rounded-xl bg-[#2d6a4f] px-4 font-semibold text-white disabled:opacity-50">
            {sending ? 'Sending…' : `Send report · ${selectedIssueLabel}`}
          </button>
        </form>
      )}
    </section>
  );
};

export default ReportOrderProblem;

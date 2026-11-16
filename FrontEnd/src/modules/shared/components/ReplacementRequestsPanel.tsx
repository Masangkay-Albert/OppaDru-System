import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, RefreshCw, X } from 'lucide-react';
import type { ReplacementRequestListItem, ReplacementStats } from '../../../services/replacementService';
import { formatCurrency } from '../../../utils/formatters';

type RequestTab = 'pending' | 'done' | 'all';
type ReplacementResponse = {
  data?: ReplacementRequestListItem[];
  waiting_count?: number;
  replacements?: ReplacementStats;
};

interface ReplacementRequestsPanelProps {
  endpoint: string;
  fetcher: (input: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
}

const issueLabels: Record<string, string> = {
  hair_or_foreign_object: 'Hair or foreign object',
  wrong_item: 'Wrong item',
  missing_item: 'Missing item',
  spilled_or_damaged: 'Spilled or damaged',
  not_fresh: 'Not fresh',
  other: 'Other',
};

const statusLabels: Record<string, string> = {
  pending: 'Waiting for review',
  approved: 'Replacement being prepared',
  replacement_sent: 'Replacement on the way',
  replaced: 'Replaced',
  rejected: 'Not approved',
};

const ReplacementRequestsPanel: React.FC<ReplacementRequestsPanelProps> = ({ endpoint, fetcher, onClose }) => {
  const [tab, setTab] = useState<RequestTab>('pending');
  const [requests, setRequests] = useState<ReplacementRequestListItem[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [stats, setStats] = useState<ReplacementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState<ReplacementRequestListItem | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const response = await fetcher(`${endpoint}?status=${tab}`);
    const payload = await response.json() as ReplacementResponse & { message?: string };
    if (!response.ok) throw new Error(payload.message || 'Could not load replacement requests.');
    return payload;
  }, [endpoint, fetcher, tab]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await fetchRequests();
      setRequests(Array.isArray(payload.data) ? payload.data : []);
      setWaitingCount(Number(payload.waiting_count || 0));
      setStats(payload.replacements || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load replacement requests.');
    } finally {
      setLoading(false);
    }
  }, [fetchRequests]);

  useEffect(() => {
    let active = true;
    fetchRequests()
      .then((payload) => {
        if (!active) return;
        setRequests(Array.isArray(payload.data) ? payload.data : []);
        setWaitingCount(Number(payload.waiting_count || 0));
        setStats(payload.replacements || null);
        setError('');
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load replacement requests.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchRequests]);

  const action = async (item: ReplacementRequestListItem, nextAction: 'approve' | 'reject', rejectReason?: string) => {
    setBusyId(item.id);
    setError('');
    try {
      const response = await fetcher(`${endpoint}/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: nextAction,
          ...(rejectReason ? { reject_reason: rejectReason } : {}),
        }),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'The replacement request could not be updated.');
      setRejecting(null);
      setReason('');
      await loadRequests();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'The replacement request could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const tabCounts = useMemo(() => ({
    pending: requests.filter((request) => request.status === 'pending').length,
    done: requests.filter((request) => request.status !== 'pending').length,
  }), [requests]);

  return (
    <section className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-sm sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-bold text-[var(--oppa-text)]">Replacement requests</h2>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Review quality issues and arrange no-charge replacements.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadRequests()} aria-label="Refresh replacement requests" className="grid size-10 place-items-center rounded-lg border border-[var(--oppa-border)]"><RefreshCw size={16} /></button>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-lg border border-[var(--oppa-border)]" aria-label="Close replacement requests"><X size={17} /></button>
        </div>
      </header>

      {stats && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-sm font-bold text-emerald-900">Replacements · {stats.count} · {stats.item_count} items · {formatCurrency(stats.cost)}</p>
          {Object.keys(stats.by_issue_type).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(stats.by_issue_type).map(([issue, value]) => (
                <span key={issue} className="rounded-full bg-white px-3 py-1 text-xs text-emerald-900">
                  {issueLabels[issue] || issue.replaceAll('_', ' ')}: {value.count} · {formatCurrency(value.cost)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div role="tablist" aria-label="Replacement request status" className="mt-4 flex flex-wrap gap-2 border-b border-[var(--oppa-border)] pb-3">
        {([
          ['pending', 'Waiting'],
          ['done', 'Done'],
          ['all', 'All'],
        ] as Array<[RequestTab, string]>).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setLoading(true); }} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${tab === value ? 'bg-[var(--oppa-green)] text-white' : 'border border-[var(--oppa-border)] text-[var(--oppa-text)]'}`}>
            {label}{value === 'pending' && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{waitingCount || tabCounts.pending}</span>}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading ? <p className="py-8 text-center text-sm text-[var(--oppa-text-muted)]">Loading requests…</p>
        : requests.length === 0 ? <p className="py-8 text-center text-sm text-[var(--oppa-text-muted)]">No replacement requests in this tab.</p>
          : <div className="mt-4 space-y-3">
            {requests.map((item) => (
              <article key={item.id} className="rounded-xl border border-[var(--oppa-border)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--oppa-text)]">{item.order_number || item.order_id}</p>
                    <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{item.customer_name} · {item.customer_email || 'No email'}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.status === 'pending' ? 'bg-amber-100 text-amber-900' : item.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-900'}`}>
                    {statusLabels[item.status] || item.status}
                  </span>
                </div>
                <p className="mt-3 text-sm"><strong>Issue:</strong> {issueLabels[item.issue_type] || item.issue_type}</p>
                <p className="mt-1 text-sm"><strong>Items:</strong> {item.affected_items.map((affected) => `${affected.quantity}x ${affected.name}`).join(', ')}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--oppa-text-muted)]">{item.description}</p>
                <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">Admin note: {item.past_request_count} previous request{item.past_request_count === 1 ? '' : 's'}.</p>
                {item.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.photos.map((photo) => <button key={photo} type="button" onClick={() => setZoomPhoto(photo)} className="relative size-16 overflow-hidden rounded-lg border border-[var(--oppa-border)]" aria-label="Enlarge customer photo"><img src={photo} alt="Customer-provided issue" className="size-full object-cover" /><Image size={14} className="absolute bottom-1 right-1 rounded bg-white p-0.5 text-gray-700" /></button>)}
                  </div>
                )}
                {item.reject_reason && <p className="mt-2 text-sm text-red-700"><strong>Reason:</strong> {item.reject_reason}</p>}
                {item.status === 'pending' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" disabled={busyId === item.id} onClick={() => void action(item, 'approve')} className="min-h-10 rounded-lg bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white disabled:opacity-50">Send replacement</button>
                    <button type="button" disabled={busyId === item.id} onClick={() => { setRejecting(item); setReason(''); }} className="min-h-10 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-700 disabled:opacity-50">Not approved</button>
                  </div>
                )}
              </article>
            ))}
          </div>}

      {rejecting && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={(event) => { event.preventDefault(); void action(rejecting, 'reject', reason.trim()); }} className="w-full max-w-md rounded-2xl bg-[var(--oppa-surface)] p-5 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--oppa-text)]">Not approved</h3>
            <label className="mt-3 block text-sm font-medium">Reason (3–200 characters)
              <textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, 200))} minLength={3} maxLength={200} required rows={3} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-transparent p-3" />
            </label>
            <p className="mt-1 text-right text-xs text-[var(--oppa-text-muted)]">{reason.length}/200</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="min-h-10 rounded-lg border border-[var(--oppa-border)] px-4">Cancel</button>
              <button type="submit" disabled={busyId === rejecting.id || reason.trim().length < 3} className="min-h-10 rounded-lg bg-red-700 px-4 font-semibold text-white disabled:opacity-50">Confirm</button>
            </div>
          </form>
        </div>
      )}

      {zoomPhoto && (
        <button type="button" onClick={() => setZoomPhoto(null)} className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4" aria-label="Close enlarged photo">
          <img src={zoomPhoto} alt="Enlarged customer issue" className="max-h-full max-w-full rounded-xl object-contain" />
          <span className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white text-gray-900"><X size={20} /></span>
        </button>
      )}
    </section>
  );
};

export default ReplacementRequestsPanel;

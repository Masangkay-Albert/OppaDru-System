import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Image as ImageIcon,
  LoaderCircle,
  Package,
  Search,
  X,
} from 'lucide-react';
import type { ReplacementRequestListItem, ReplacementStats } from '../../../services/replacementService';
import { INPUT_LIMITS } from '../../../constants/inputLimits';
import { formatCurrency } from '../../../utils/formatters';

type RequestTab = 'pending' | 'done' | 'all';
type ActionKind = 'approve' | 'reject';
type ActionError = { message: string; detail?: string };
type ReplacementResponse = {
  data?: ReplacementRequestListItem[];
  waiting_count?: number;
  monthly_replacements?: ReplacementStats;
};
type ApiPayload = {
  message?: string;
  errors?: Record<string, unknown>;
  replacement_order?: { order_number?: string };
};

interface ReplacementRequestsPanelProps {
  endpoint: string;
  fetcher: (input: string, init?: RequestInit) => Promise<Response>;
  onHandled: () => void;
  onOpenOrder: (orderId: string) => void;
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

const readPayload = async (response: Response): Promise<ApiPayload> =>
  response.json().catch(() => ({})) as Promise<ApiPayload>;

const apiDetail = (payload: ApiPayload): string | undefined => {
  const messages = Object.values(payload.errors || {}).flatMap((value) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [],
  );
  return messages[0] || payload.message;
};

const relativeTime = (value?: string | null): string => {
  if (!value) return 'Date unavailable';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Date unavailable';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const fullDate = (value?: string | null): string => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const waitTone = (value?: string | null): string => {
  const elapsed = value ? Date.now() - new Date(value).getTime() : 0;
  if (elapsed >= 24 * 60 * 60 * 1000) return 'border-red-200 bg-red-50 text-red-800';
  if (elapsed >= 6 * 60 * 60 * 1000) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-[var(--oppa-border)] bg-[var(--oppa-cream)] text-[var(--oppa-text-muted)]';
};

const itemSummary = (request: ReplacementRequestListItem): string => {
  const first = request.affected_items[0];
  if (!first) return 'Items unavailable';
  const label = `${first.quantity}x ${first.name}`;
  return request.affected_items.length > 1 ? `${label} +${request.affected_items.length - 1} more` : label;
};

const statusTone = (status: string): string => {
  if (status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (status === 'rejected') return 'border-red-200 bg-red-50 text-red-800';
  if (status === 'replaced') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  return 'border-blue-200 bg-blue-50 text-blue-900';
};

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'pending') return <Clock3 size={14} aria-hidden="true" />;
  if (status === 'rejected') return <AlertCircle size={14} aria-hidden="true" />;
  if (status === 'replaced') return <CheckCircle2 size={14} aria-hidden="true" />;
  return <Package size={14} aria-hidden="true" />;
};

const ReplacementRequestsPanel: React.FC<ReplacementRequestsPanelProps> = ({
  endpoint,
  fetcher,
  onHandled,
  onOpenOrder,
}) => {
  const [tab, setTab] = useState<RequestTab>('pending');
  const [issueFilter, setIssueFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [requests, setRequests] = useState<ReplacementRequestListItem[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [monthlyStats, setMonthlyStats] = useState<ReplacementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<ReplacementRequestListItem | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [toast, setToast] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const focusRequestId = useRef<number | null>(null);
  const busyRef = useRef(false);
  const retryAction = useRef<{ request: ReplacementRequestListItem; action: ActionKind; reason?: string } | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);
  const photoTrigger = useRef<HTMLElement | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetcher(`${endpoint}?status=${tab}`);
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(response.status >= 500 ? 'Could not load replacement requests. Please try again.' : payload.message || 'Could not load replacement requests.');
      }
      const data = payload as ReplacementResponse;
      setRequests(Array.isArray(data.data) ? data.data : []);
      setWaitingCount(Number(data.waiting_count || 0));
      setMonthlyStats(data.monthly_replacements || null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load replacement requests.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, fetcher, tab]);

  useEffect(() => {
    void Promise.resolve().then(loadRequests);
  }, [loadRequests]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (selected) {
      const drawer = drawerRef.current;
      const focusable = drawer?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      focusable?.[0]?.focus();
      return;
    }
    if (loading || focusRequestId.current === null) return;
    const request = requests.find((item) => item.id === focusRequestId.current);
    if (tab === 'done' && request?.status === 'pending') return;
    const target = document.querySelector<HTMLElement>(`[data-replacement-request-id="${focusRequestId.current}"]`);
    target?.focus();
    if (target) focusRequestId.current = null;
  }, [loading, requests, selected, tab]);

  useEffect(() => {
    if (lightboxIndex !== null) lightboxRef.current?.focus();
    else photoTrigger.current?.focus();
  }, [lightboxIndex]);

  const visibleRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return requests.filter((request) => {
      const requestText = `${request.order_number || request.order_id} ${request.customer_name} ${request.customer_email || ''}`.toLowerCase();
      return (issueFilter === 'all' || request.issue_type === issueFilter)
        && (!normalizedSearch || requestText.includes(normalizedSearch));
    });
  }, [issueFilter, requests, search]);

  const openRequest = (request: ReplacementRequestListItem, trigger: HTMLElement) => {
    focusRequestId.current = request.id;
    trigger.focus();
    setSelected(request);
    setActionError(null);
    setRejectMode(false);
    setReason('');
  };

  const closeDrawer = () => {
    if (busy) return;
    setSelected(null);
    setConfirmSend(false);
    setRejectMode(false);
    setActionError(null);
  };

  const performAction = async (request: ReplacementRequestListItem, action: ActionKind, rejectReason?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setActionError(null);
    retryAction.current = { request, action, reason: rejectReason };
    try {
      const response = await fetcher(`${endpoint}/${request.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          ...(rejectReason ? { reject_reason: rejectReason } : {}),
        }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        const detail = response.status === 409 || response.status === 422 ? apiDetail(payload) : undefined;
        throw {
          message: action === 'approve'
            ? 'We couldn’t send the replacement. Please try again.'
            : 'We couldn’t update this request. Please try again.',
          detail,
        };
      }

      const orderNumber = payload.replacement_order?.order_number;
      focusRequestId.current = request.id;
      setToast(action === 'approve' && orderNumber
        ? `Replacement order ${orderNumber} created.`
        : 'Request updated.');
      setSelected(null);
      setConfirmSend(false);
      setRejectMode(false);
      setReason('');
      setTab('done');
      window.dispatchEvent(new Event('replacement-requests-updated'));
      onHandled();
    } catch (error) {
      setActionError(!(error instanceof Error) && typeof error === 'object' && error !== null
        && 'message' in error && typeof error.message === 'string' && 'detail' in error
        ? error as ActionError
        : { message: action === 'approve' ? 'We couldn’t send the replacement. Please try again.' : 'We couldn’t update this request. Please try again.' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const retry = () => {
    const action = retryAction.current;
    if (action) void performAction(action.request, action.action, action.reason);
  };

  const tabLabels: Array<{ value: RequestTab; label: string }> = [
    { value: 'pending', label: 'Waiting' },
    { value: 'done', label: 'Done' },
    { value: 'all', label: 'All' },
  ];

  return (
    <section className="replacement-request-ui space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Waiting" value={String(waitingCount)} helper="Needs review" />
        <StatCard label="Replaced this month" value={String(monthlyStats?.count || 0)} helper="Replacement orders sent" />
        <StatCard
          label="Cost this month"
          value={formatCurrency(monthlyStats?.cost || 0)}
          helper={`${monthlyStats?.item_count || 0} items replaced`}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--oppa-border)] p-4 sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--oppa-text)]">Replacement requests</h2>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Review a report and arrange a no-charge replacement.</p>
          </div>
        </header>

        <div className="flex flex-col gap-3 border-b border-[var(--oppa-border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div role="tablist" aria-label="Replacement request status" className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--oppa-cream)] p-1">
            {tabLabels.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={`min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold transition ${tab === value ? 'bg-[var(--oppa-surface)] text-[var(--oppa-text)] shadow-sm' : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'}`}
              >
                {label}
                {value === 'pending' && waitingCount > 0 && <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">{waitingCount > 99 ? '99+' : waitingCount}</span>}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            <label className="relative min-w-0 sm:w-64">
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order ID or customer" aria-label="Search order ID or customer" className="min-h-10 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] pl-9 pr-3 text-sm text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)]" />
            </label>
            <select value={issueFilter} onChange={(event) => setIssueFilter(event.target.value)} aria-label="Filter by issue type" className="min-h-10 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]">
              <option value="all">All issue types</option>
              {Object.entries(issueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>

        {loadError && <div role="alert" className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>{loadError}</span>
          <button type="button" onClick={() => void loadRequests()} className="font-semibold underline">Try again</button>
        </div>}

        {loading ? (
          <div role="status" className="p-10 text-center text-sm text-[var(--oppa-text-muted)]"><LoaderCircle size={20} className="mx-auto mb-2 animate-spin" />Loading requests…</div>
        ) : visibleRequests.length === 0 ? (
          <p className="p-10 text-center text-sm text-[var(--oppa-text-muted)]">{tab === 'pending' ? 'No requests waiting. You’re all caught up.' : 'No replacement requests found.'}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-[var(--oppa-cream)] text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">
                  <tr><th className="px-4 py-3">Order ID</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Issue</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right"> </th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--oppa-border)]">
                  {visibleRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-[var(--oppa-cream)]/50">
                      <td className="max-w-40 truncate px-4 py-3 font-mono text-xs font-semibold text-[var(--oppa-text)]" title={request.order_number || request.order_id}>{request.order_number || request.order_id}</td>
                      <td className="max-w-48 px-4 py-3">
                        <span className="block truncate font-medium text-[var(--oppa-text)]" title={request.customer_name}>{request.customer_name}</span>
                        <span className="block truncate text-xs text-[var(--oppa-text-muted)]" title={request.customer_email || ''}>{request.customer_email || 'No email'}</span>
                      </td>
                      <td className="px-4 py-3"><IssueChip issue={request.issue_type} /></td>
                      <td className="max-w-52 truncate px-4 py-3 text-[var(--oppa-text-muted)]" title={request.affected_items.map((item) => `${item.quantity}x ${item.name}`).join(', ')}>{itemSummary(request)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span title={fullDate(request.created_at)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${request.status === 'pending' ? waitTone(request.created_at) : 'border-transparent text-[var(--oppa-text-muted)]'}`}>
                          {request.status === 'pending' && <Clock3 size={13} aria-hidden="true" />}
                          {request.status === 'pending' ? `Waiting ${relativeTime(request.created_at).replace(' ago', '')}` : relativeTime(request.created_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusPill status={request.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" data-replacement-request-id={request.id} onClick={(event) => openRequest(request, event.currentTarget)} className="min-h-10 rounded-lg border border-[var(--oppa-border)] px-3 text-sm font-semibold text-[var(--oppa-text)] hover:border-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]">Review</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-[var(--oppa-border)] md:hidden">
              {visibleRequests.map((request) => (
                <article key={request.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-mono text-sm font-bold text-[var(--oppa-text)]" title={request.order_number || request.order_id}>{request.order_number || request.order_id}</p><p className="mt-1 truncate text-sm text-[var(--oppa-text-muted)]" title={request.customer_name}>{request.customer_name}</p></div>
                    <StatusPill status={request.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2"><IssueChip issue={request.issue_type} /><span title={fullDate(request.created_at)} className={`rounded-full border px-2.5 py-1 text-xs ${request.status === 'pending' ? waitTone(request.created_at) : 'border-[var(--oppa-border)] text-[var(--oppa-text-muted)]'}`}>{request.status === 'pending' ? `Waiting ${relativeTime(request.created_at).replace(' ago', '')}` : relativeTime(request.created_at)}</span></div>
                  <p className="truncate text-sm text-[var(--oppa-text-muted)]">{itemSummary(request)}</p>
                  <button type="button" data-replacement-request-id={request.id} onClick={(event) => openRequest(request, event.currentTarget)} className="min-h-10 w-full rounded-lg border border-[var(--oppa-border)] px-3 text-sm font-semibold text-[var(--oppa-text)] hover:border-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]">Review</button>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {toast && <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-[140] -translate-x-1/2 rounded-xl bg-[var(--oppa-green-dark)] px-4 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>}

      {selected && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/50" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="replacement-review-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                if (lightboxIndex !== null) setLightboxIndex(null);
                else if (confirmSend) setConfirmSend(false);
                else closeDrawer();
              }
              if (event.key === 'Tab') {
                const elements = drawerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])');
                if (!elements?.length) return;
                const first = elements[0];
                const last = elements[elements.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
            className="flex h-dvh w-full flex-col overflow-hidden border-l border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] shadow-2xl sm:max-w-xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 py-4 sm:px-5" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
              <div className="min-w-0">
                <h2 id="replacement-review-title" className="text-lg font-bold text-[var(--oppa-text)]">Replacement request</h2>
                <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                  <span className="max-w-56 truncate font-mono text-xs font-semibold text-[var(--oppa-text-muted)] sm:max-w-64" title={selected.order_number || selected.order_id}>{selected.order_number || selected.order_id}</span>
                  <button type="button" onClick={() => onOpenOrder(selected.order_id)} aria-label={`Open original order ${selected.order_number || selected.order_id}`} className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">
                    Open original order <ExternalLink size={13} aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2"><StatusPill status={selected.status} /><IssueChip issue={selected.issue_type} /></div>
              </div>
              <button type="button" onClick={closeDrawer} aria-label="Close replacement request details" className="grid size-10 shrink-0 place-items-center rounded-lg border border-[var(--oppa-border)] text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"><X size={18} aria-hidden="true" /></button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              <section className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4">
                <DetailLabel>Affected items</DetailLabel>
                <ul className="divide-y divide-[var(--oppa-border)]">
                  {selected.affected_items.map((item) => <li key={`${selected.id}-${item.order_item_id}`} className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"><span className="font-semibold text-[var(--oppa-text)]">{item.name}</span><span className="shrink-0 font-semibold text-[var(--oppa-text)]">Qty {item.quantity}</span></li>)}
                </ul>
                <div className="mt-4 border-t border-[var(--oppa-border)] pt-3">
                  <DetailLabel>Customer’s description</DetailLabel>
                  <blockquote className="mt-2 whitespace-pre-wrap rounded-r-xl border-l-4 border-[var(--oppa-green)] bg-[var(--oppa-cream)] px-4 py-3 text-base leading-7 text-[var(--oppa-text)]">{selected.description}</blockquote>
                </div>
              </section>

              <section className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4">
                <div className="flex items-center justify-between gap-2"><DetailLabel>Photos</DetailLabel><span className="text-xs text-[var(--oppa-text-muted)]">{selected.photos.length} photo{selected.photos.length === 1 ? '' : 's'}</span></div>
                {selected.photos.length ? <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(96px,112px))] gap-2">{selected.photos.map((photo, index) => <ReplacementPhotoThumbnail key={`${photo}-${index}`} photo={photo} index={index} onClick={(event) => { photoTrigger.current = event.currentTarget; setLightboxIndex(index); setZoomed(false); }} />)}</div>
                  : <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">No photos attached.</p>}
              </section>

              <section className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4">
                <div>
                  <DetailLabel>Customer</DetailLabel>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                    <DetailValue label="Name"><span className="font-semibold">{selected.customer_name}</span></DetailValue>
                    <DetailValue label="Email">
                      {selected.customer_email
                        ? <a href={`mailto:${selected.customer_email}`} className="break-all hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]" aria-label={`Email ${selected.customer_email}`}>{selected.customer_email}</a>
                        : 'Not provided'}
                    </DetailValue>
                    <DetailValue label="Phone">
                      {selected.customer_phone
                        ? <a href={`tel:${selected.customer_phone}`} className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]" aria-label={`Call ${selected.customer_phone}`}>{selected.customer_phone}</a>
                        : 'Not provided'}
                    </DetailValue>
                    <DetailValue label="Submitted" valueTitle={fullDate(selected.created_at)}>{relativeTime(selected.created_at)}</DetailValue>
                    <DetailValue label="Customer history">
                      {selected.past_request_count === 0 ? 'First report' : `${selected.past_request_count} previous report${selected.past_request_count === 1 ? '' : 's'}`}
                      {selected.past_request_count > 0 && <button type="button" onClick={() => { setSearch(selected.customer_email || selected.customer_name); setTab('all'); setSelected(null); }} className="mt-1 block font-semibold text-[var(--oppa-green-dark)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">View customer’s requests</button>}
                    </DetailValue>
                  </dl>
                </div>
                <div className="my-4 border-t border-[var(--oppa-border)]" />
                <div>
                  <DetailLabel>Delivery</DetailLabel>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                    <DetailValue label="Delivery address" className="sm:col-span-2"><span className="whitespace-pre-line break-words">{selected.delivery_address || 'Address unavailable'}</span></DetailValue>
                    <DetailValue label="Delivered">{fullDate(selected.delivered_at)}</DetailValue>
                  </dl>
                </div>
              </section>

              {(selected.handled_at || selected.reject_reason || selected.replacement_order_number) && <section className="space-y-3 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4">
                {selected.handled_at && <p className="text-xs text-[var(--oppa-text-muted)]">Handled by {selected.handled_by_name || 'staff'} · {fullDate(selected.handled_at)}</p>}
                {selected.reject_reason && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><strong>Not approved:</strong> {selected.reject_reason}</p>}
                {selected.replacement_order_number && <button type="button" onClick={() => selected.replacement_order_id && onOpenOrder(selected.replacement_order_id)} className="text-sm font-semibold text-[var(--oppa-green-dark)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">Replacement order {selected.replacement_order_number}</button>}
              </section>}

              {rejectMode && selected.status === 'pending' && <label className="block text-sm font-semibold">
                Not approved reason ({INPUT_LIMITS.reason.min}–{INPUT_LIMITS.reason.max} characters)
                <textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, INPUT_LIMITS.reason.max))} minLength={INPUT_LIMITS.reason.min} maxLength={INPUT_LIMITS.reason.max} required rows={3} aria-describedby="replacement-reason-counter" className="mt-2 w-full resize-y rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 text-sm font-normal text-[var(--oppa-text)]" />
                <span id="replacement-reason-counter" className="mt-1 block text-right text-xs font-normal text-[var(--oppa-text-muted)]">{reason.length}/{INPUT_LIMITS.reason.max}</span>
              </label>}
            </div>

            <footer className="shrink-0 border-t border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)]" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              {actionError && <div role="alert" aria-live="assertive" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p>{actionError.message}</p>
                {actionError.detail && <p className="mt-1">{actionError.detail}</p>}
                <button type="button" onClick={retry} disabled={busy} className="mt-2 font-semibold underline disabled:opacity-50">Retry</button>
              </div>}
              {selected.status === 'pending' ? rejectMode ? (
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => { setRejectMode(false); setActionError(null); }} className="min-h-11 flex-1 rounded-xl border border-[var(--oppa-border)] px-3 text-sm font-semibold">Cancel</button>
                  <button type="button" disabled={busy || reason.trim().length < INPUT_LIMITS.reason.min} onClick={() => void performAction(selected, 'reject', reason.trim())} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-3 text-sm font-semibold text-red-800 disabled:opacity-50">
                    {busy ? <LoaderCircle size={16} className="animate-spin" /> : null} Not approved
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => { setRejectMode(true); setReason(''); setActionError(null); }} className="min-h-11 flex-1 rounded-xl border border-red-300 px-3 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">Not approved</button>
                  <button type="button" disabled={busy} onClick={() => setConfirmSend(true)} className="inline-flex min-h-11 flex-[1.15] items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-3 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 disabled:opacity-50">
                    <CheckCircle2 size={16} aria-hidden="true" /> Send replacement
                  </button>
                </div>
              ) : <button type="button" onClick={closeDrawer} className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] px-3 text-sm font-semibold">Close</button>}
            </footer>
          </aside>
        </div>
      )}

      {confirmSend && selected && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmSend(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="replacement-confirm-title" className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 text-[var(--oppa-text)] shadow-2xl">
            <h3 id="replacement-confirm-title" className="text-lg font-bold">Send a free replacement?</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">Send a free replacement to {selected.customer_name}? It will create a new ₱0 order for: {selected.affected_items.map((item) => `${item.quantity}x ${item.name}`).join(', ')} and go to the kitchen.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={busy} onClick={() => setConfirmSend(false)} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold">Cancel</button>
              <button type="button" disabled={busy} onClick={() => void performAction(selected, 'approve')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white disabled:opacity-50">
                {busy ? <LoaderCircle size={16} className="animate-spin" /> : null} Yes, send replacement
              </button>
            </div>
          </section>
        </div>
      )}

      {lightboxIndex !== null && selected && selected.photos[lightboxIndex] && (
        <div
          ref={lightboxRef}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-3 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`Customer photo ${lightboxIndex + 1} of ${selected.photos.length}`}
          tabIndex={-1}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
              event.preventDefault();
              setLightboxIndex(null);
            }
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              setLightboxIndex((index) => index === null ? 0 : (index + 1) % selected.photos.length);
            }
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              setLightboxIndex((index) => index === null ? 0 : (index - 1 + selected.photos.length) % selected.photos.length);
            }
          }}
        >
          <button type="button" onClick={() => setLightboxIndex(null)} aria-label="Close photo lightbox" className="absolute right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-white text-gray-900"><X size={20} /></button>
          {selected.photos.length > 1 && <button type="button" onClick={() => setLightboxIndex((index) => index === null ? 0 : (index - 1 + selected.photos.length) % selected.photos.length)} aria-label="Previous photo" className="absolute left-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-gray-900 sm:left-6"><ArrowLeft size={20} /></button>}
          <ReplacementLightboxPhoto key={`${selected.id}-${lightboxIndex}`} photo={selected.photos[lightboxIndex]} index={lightboxIndex} zoomed={zoomed} onToggleZoom={() => setZoomed((value) => !value)} />
          <button type="button" onClick={() => setZoomed((value) => !value)} className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900">{zoomed ? 'Zoom out' : 'Zoom in'}</button>
          {selected.photos.length > 1 && <button type="button" onClick={() => setLightboxIndex((index) => index === null ? 0 : (index + 1) % selected.photos.length)} aria-label="Next photo" className="absolute right-3 top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-gray-900 sm:right-6"><ArrowRight size={20} /></button>}
        </div>
      )}
    </section>
  );
};

const StatCard: React.FC<{ label: string; value: string; helper: string }> = ({ label, value, helper }) => (
  <article className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-sm">
    <p className="text-sm font-semibold text-[var(--oppa-text-muted)]">{label}</p>
    <p className="mt-1 truncate text-2xl font-bold text-[var(--oppa-text)]" title={value}>{value}</p>
    <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">{helper}</p>
  </article>
);

const DetailLabel: React.FC<React.PropsWithChildren> = ({ children }) => (
  <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--oppa-text-muted)]">{children}</p>
);

const DetailValue: React.FC<React.PropsWithChildren<{
  label: string;
  valueTitle?: string;
  className?: string;
}>> = ({ label, valueTitle, className = '', children }) => (
  <div className={`min-w-0 ${className}`}>
    <dt><DetailLabel>{label}</DetailLabel></dt>
    <dd title={valueTitle} className="break-words text-sm font-medium leading-5 text-[var(--oppa-text)]">{children}</dd>
  </div>
);

const ReplacementPhotoThumbnail: React.FC<{
  photo: string;
  index: number;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}> = ({ photo, index, onClick }) => {
  const [unavailable, setUnavailable] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open customer photo ${index + 1}`}
      className="group relative aspect-square w-full overflow-hidden rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
    >
      {unavailable
        ? <span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-[var(--oppa-text-muted)]"><ImageIcon size={20} aria-hidden="true" /><span>Photo unavailable</span></span>
        : <img src={photo} alt={`Customer issue photo ${index + 1}`} onError={() => setUnavailable(true)} className="size-full object-cover transition group-hover:scale-105" />}
      {!unavailable && <span className="absolute bottom-2 right-2 rounded-md bg-black/65 p-1.5 text-white"><ImageIcon size={15} aria-hidden="true" /></span>}
    </button>
  );
};

const ReplacementLightboxPhoto: React.FC<{
  photo: string;
  index: number;
  zoomed: boolean;
  onToggleZoom: () => void;
}> = ({ photo, index, zoomed, onToggleZoom }) => {
  const [unavailable, setUnavailable] = useState(false);

  if (unavailable) {
    return <div className="flex size-64 flex-col items-center justify-center gap-2 rounded-xl bg-white/10 text-sm text-white"><ImageIcon size={28} aria-hidden="true" /><span>Photo unavailable</span></div>;
  }

  return <img src={photo} alt={`Customer issue photo ${index + 1}`} className={`max-h-full max-w-full rounded-lg object-contain transition-transform ${zoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'}`} onError={() => setUnavailable(true)} onClick={onToggleZoom} />;
};

const IssueChip: React.FC<{ issue: string }> = ({ issue }) => {
  const tone = issue === 'hair_or_foreign_object' || issue === 'not_fresh'
    ? 'border-red-200 bg-red-50 text-red-800'
    : issue === 'wrong_item' || issue === 'missing_item'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-blue-200 bg-blue-50 text-blue-900';
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}><AlertCircle size={13} aria-hidden="true" /><span className="truncate">{issueLabels[issue] || issue.replaceAll('_', ' ')}</span></span>;
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(status)}`}><StatusIcon status={status} /><span className="truncate">{statusLabels[status] || status.replaceAll('_', ' ')}</span></span>
);

export default ReplacementRequestsPanel;

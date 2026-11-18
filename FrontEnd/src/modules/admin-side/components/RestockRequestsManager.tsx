import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ClipboardList, LoaderCircle, MessageSquareText, PackageCheck, X } from 'lucide-react';
import { AdminDate } from './AdminUI';
import {
  fulfillRestockRequest,
  getRestockRequests,
  rejectRestockRequest,
} from '../../../services/mainBranchInventoryService';
import type { AdminRestockRequest } from '../../../services/mainBranchInventoryService';
import { formatInventoryQuantity } from '../../../utils/inventoryFormatters';

const getStatusStyles = (status: string) => {
  if (status === 'pending') return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300';
  if (status === 'fulfilled') return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300';
  return 'bg-[var(--oppa-cream)] text-[var(--oppa-text-muted)]';
};

export const RestockRequestsManager: React.FC<{
  onClose: () => void;
  onChanged: () => void;
}> = ({ onClose, onChanged }) => {
  const [requests, setRequests] = useState<AdminRestockRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getRestockRequests();
      setRequests(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load branch restock requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const fulfill = async (restockRequest: AdminRestockRequest) => {
    setBusyId(restockRequest.id);
    setError('');
    try {
      await fulfillRestockRequest(restockRequest);
      onChanged();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to fulfill this request.');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (restockRequest: AdminRestockRequest) => {
    const notes = window.prompt('Reason for rejecting this restock request?');
    if (notes === null) return;
    setBusyId(restockRequest.id);
    setError('');
    try {
      await rejectRestockRequest(restockRequest.id, notes);
      onChanged();
      await load();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to reject this request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/45 px-4 pb-4 pt-[calc(68px+1rem)] sm:px-6 sm:pb-6 sm:pt-[calc(68px+1.5rem)]"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="restock-manager-title"
        className="flex max-h-[calc(100dvh-100px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-2xl sm:max-h-[calc(100dvh-116px)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--oppa-border)] bg-[var(--oppa-surface-raised)] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]">
              <ClipboardList size={21} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--oppa-text-muted)]">Inventory · Branch requests</p>
              <h2 id="restock-manager-title" className="mt-1 font-serif text-xl font-bold text-[var(--oppa-text)] sm:text-2xl">
                Branch restock requests
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--oppa-text-muted)]">
                Fulfill a request to record the main-branch issue and branch receipt together.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close restock requests"
            className="shrink-0 rounded-xl p-2 text-[var(--oppa-text-muted)] transition-colors hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {error && (
            <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </p>
          )}

          {loading ? (
            <div role="status" className="space-y-3">
              <span className="sr-only">Loading requests…</span>
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-36 animate-pulse rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/60" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-surface-raised)] px-5 py-8 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]">
                <PackageCheck size={23} aria-hidden="true" />
              </span>
              <p className="mt-3 font-semibold text-[var(--oppa-text)]">No branch requests yet</p>
              <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">New restock requests will appear here.</p>
            </div>
          ) : (
            <ul className="space-y-3.5">
              {requests.map((restockRequest) => {
                const isBusy = busyId === restockRequest.id;
                const statusLabel = restockRequest.status.replace(/_/g, ' ');

                return (
                  <li
                    key={restockRequest.id}
                    className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-sm"
                  >
                    <div className="flex flex-col gap-4 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--oppa-green-dark)]">
                              Request #{restockRequest.id}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${getStatusStyles(restockRequest.status)}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <h3 className="mt-2 text-base font-bold text-[var(--oppa-text)] sm:text-lg">
                            {restockRequest.branch.name}
                          </h3>
                          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--oppa-text-muted)]">
                            <CalendarDays size={13} aria-hidden="true" />
                            <AdminDate value={restockRequest.created_at} />
                          </p>
                        </div>

                        {restockRequest.status === 'pending' && (
                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void fulfill(restockRequest)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isBusy ? <LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> : <PackageCheck size={14} aria-hidden="true" />}
                              {isBusy ? 'Working…' : 'Fulfill / transfer'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void reject(restockRequest)}
                              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl bg-[var(--oppa-cream)]/70 p-3.5 sm:p-4">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--oppa-text-muted)]">
                          Requested items
                        </p>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {restockRequest.items.map((item) => (
                            <li
                              key={item.id}
                              className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--oppa-border)]/70 bg-[var(--oppa-surface)] px-3 py-2.5 text-sm"
                            >
                              <span className="min-w-0 truncate font-medium text-[var(--oppa-text)]">{item.ingredient.name}</span>
                              <span className="shrink-0 font-semibold text-[var(--oppa-text)]">
                                {formatInventoryQuantity(item.requested_quantity, item.ingredient.unit)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {restockRequest.notes && (
                        <p className="flex items-start gap-2 text-sm leading-relaxed text-[var(--oppa-text-muted)]">
                          <MessageSquareText size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <span>{restockRequest.notes}</span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex shrink-0 justify-end border-t border-[var(--oppa-border)] bg-[var(--oppa-surface-raised)] px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-5 py-2 text-sm font-semibold text-[var(--oppa-text)] transition-colors hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
};

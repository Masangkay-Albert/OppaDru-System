import React, { useCallback, useEffect, useState } from 'react';
import { AdminDate } from './AdminUI';
import {
  fulfillRestockRequest,
  getRestockRequests,
  rejectRestockRequest,
} from '../../../services/mainBranchInventoryService';
import type { AdminRestockRequest } from '../../../services/mainBranchInventoryService';

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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="restock-manager-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="restock-manager-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">Branch restock requests</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Fulfilling a request records the main-branch issue and branch receipt as a transfer.</p></div>
          <button type="button" onClick={onClose} aria-label="Close restock requests" className="rounded-lg px-3 py-1 text-[var(--oppa-text-muted)]">×</button>
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? <p role="status" className="py-8 text-sm text-[var(--oppa-text-muted)]">Loading requests…</p> : requests.length === 0 ? <p className="py-8 text-sm text-[var(--oppa-text-muted)]">No branch restock requests.</p> : <ul className="mt-4 divide-y divide-[var(--oppa-border)]">
          {requests.map((restockRequest) => <li key={restockRequest.id} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold text-[var(--oppa-text)]">{restockRequest.branch.name} · Request #{restockRequest.id}</p><p className="mt-1 text-xs text-[var(--oppa-text-muted)]"><AdminDate value={restockRequest.created_at} /> · {restockRequest.status}</p>
                <ul className="mt-2 space-y-1 text-sm text-[var(--oppa-text)]">{restockRequest.items.map((item) => <li key={item.id}>{item.ingredient.name}: {item.requested_quantity} {item.ingredient.unit}</li>)}</ul>
                {restockRequest.notes && <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">{restockRequest.notes}</p>}
              </div>
              {restockRequest.status === 'pending' && <div className="flex gap-2"><button type="button" disabled={busyId === restockRequest.id} onClick={() => void fulfill(restockRequest)} className="rounded-lg bg-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{busyId === restockRequest.id ? 'Working…' : 'Fulfill / transfer'}</button><button type="button" disabled={busyId === restockRequest.id} onClick={() => void reject(restockRequest)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-60">Reject</button></div>}
            </div>
          </li>)}
        </ul>}
        <div className="mt-4 flex justify-end border-t border-[var(--oppa-border)] pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-[var(--oppa-border)] px-4 py-2 text-sm font-semibold">Close</button></div>
      </section>
    </div>
  );
};

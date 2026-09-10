import React, { useEffect, useState } from 'react';
import { BadgeCheck, CheckCircle, RefreshCw, X, XCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { listDiscountApplications, updateDiscountApplicationStatus, type DiscountApplicationRequest } from '../../../services/discountApplicationService';

const AdminDiscountApprovalsPage: React.FC = () => {
  const [applications, setApplications] = useState<DiscountApplicationRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReason, setSelectedReason] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [selectedProof, setSelectedProof] = useState<DiscountApplicationRequest | null>(null);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const data = await listDiscountApplications();
      const pendingOnly = Array.isArray(data) ? data.filter((application) => application.status === 'pending') : [];
      setApplications(pendingOnly);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadApplications();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (actionLoading[id]) return;

    setActionLoading((prev) => ({ ...prev, [id]: true }));

    try {
      await updateDiscountApplicationStatus(
        id,
        action,
        action === 'reject' ? (selectedReason[id] || 'No reason provided.') : undefined,
      );
      await loadApplications();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update discount request.';
      window.alert(message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--oppa-text-muted)]">Admin</p>
          <h1 className="mt-1 font-serif text-3xl font-bold text-[var(--oppa-text)]">Discount Approvals</h1>
        </div>
        <button
          type="button"
          onClick={() => void loadApplications()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2 text-amber-700">
            <BadgeCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-semibold text-[var(--oppa-text)]">Customer discount verification</h2>
            <p className="text-sm text-[var(--oppa-text-muted)]">Review uploaded proof and approve or reject each request.</p>
          </div>
        </div>

        {loading && applications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-cream)] p-8 text-center text-sm text-[var(--oppa-text-muted)]">
            Loading requests...
          </div>
        ) : applications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-cream)] p-8 text-center text-sm text-[var(--oppa-text-muted)]">
            No pending discount applications.
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => (
              <div key={application.id} className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/40 p-4">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 space-y-3 text-sm text-[var(--oppa-text)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                        {application.discount_type}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        application.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : application.status === 'rejected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700'
                      }`}>
                        {application.status}
                      </span>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <p><span className="font-semibold">Customer:</span> {application.full_name}</p>
                      <p><span className="font-semibold">Email:</span> {application.user?.email || 'N/A'}</p>
                      <p><span className="font-semibold">ID Number:</span> {application.id_number}</p>
                      <p><span className="font-semibold">Expiry:</span> {application.expiry_date ? new Date(application.expiry_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila' }) : 'N/A'}</p>
                      <p><span className="font-semibold">Submitted:</span> {application.submitted_at ? new Date(application.submitted_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' }) : 'N/A'}</p>
                      {application.rejection_reason && (
                        <p className="md:col-span-2"><span className="font-semibold">Reason:</span> {application.rejection_reason}</p>
                      )}
                    </div>
                  </div>

                  <div className="w-full max-w-md space-y-3">
                    {application.proof_image_url ? (
                      <img
                        src={application.proof_image_url}
                        alt={`${application.discount_type} proof`}
                        className="h-40 w-full cursor-zoom-in rounded-xl border border-[var(--oppa-border)] bg-white object-cover"
                        onClick={() => setSelectedProof(application)}
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-[var(--oppa-border)] bg-white text-xs text-[var(--oppa-text-muted)]">
                        No proof uploaded
                      </div>
                    )}

                    <textarea
                      value={selectedReason[application.id] ?? ''}
                      onChange={(event) => setSelectedReason((prev) => ({ ...prev, [application.id]: event.target.value }))}
                      rows={3}
                      placeholder="Rejection reason (optional)"
                      className="w-full rounded-xl border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)]"
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleAction(application.id, 'approve')}
                        disabled={actionLoading[application.id]}
                        className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                      >
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle className="h-3.5 w-3.5" />
                          {actionLoading[application.id] ? 'Approving...' : 'Approve'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleAction(application.id, 'reject')}
                        disabled={actionLoading[application.id]}
                        className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        <span className="inline-flex items-center gap-2">
                          <XCircle className="h-3.5 w-3.5" />
                          {actionLoading[application.id] ? 'Rejecting...' : 'Reject'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedProof?.proof_image_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Discount proof preview"
          onClick={() => setSelectedProof(null)}
        >
          <div className="relative max-h-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <img
              src={selectedProof.proof_image_url}
              alt={`${selectedProof.discount_type} proof enlarged`}
              className="max-h-[90vh] max-w-full rounded-xl bg-white object-contain shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setSelectedProof(null)}
              aria-label="Close proof preview"
              className="absolute -right-3 -top-3 rounded-full bg-white p-2 text-gray-700 shadow-lg hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminDiscountApprovalsPage;

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, UserRound, XCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { getFranchiseApplications, reviewFranchiseApplication } from '../../../services/franchiseAdminService';

interface FranchiseApplicationRow {
  id: string | number;
  franchise_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  location?: string;
  notes?: string;
  status?: string;
  admin_notes?: string;
  created_at?: string;
}

const AdminFranchiseApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<FranchiseApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getFranchiseApplications();
      setApplications(data as FranchiseApplicationRow[]);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleReview = async (id: string | number, action: 'approve' | 'reject') => {
    setProcessingId(id);
    try {
      await reviewFranchiseApplication(id, action, action === 'approve' ? 'Approved by admin.' : 'Rejected by admin.');
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to review the franchise application');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Franchise Applications</h1>
        <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Review new franchise partner requests before approval.</p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <Loader2 className="mx-auto size-6 animate-spin text-[var(--oppa-green)]" />
          <p className="mt-3">Loading applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <AlertCircle className="mx-auto h-12 w-12 text-[var(--oppa-text-muted)]/30" />
          <p className="mt-2">No franchise applications yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((application) => (
            <div key={String(application.id)} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--oppa-text)]">{application.franchise_name}</h2>
                  <p className="text-sm text-[var(--oppa-text-muted)]">Contact: {application.contact_name} · {application.email}</p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
                  application.status === 'approved'
                    ? 'bg-green-100 text-green-700'
                    : application.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {application.status || 'pending'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <InfoRow icon={UserRound} label="Contact" value={application.contact_name} />
                <InfoRow icon={AlertCircle} label="Phone" value={application.phone || 'N/A'} />
                <InfoRow icon={AlertCircle} label="Location" value={application.location || 'N/A'} />
                <InfoRow icon={AlertCircle} label="Submitted" value={application.created_at ? new Date(application.created_at).toLocaleDateString() : 'N/A'} />
              </div>

              {application.notes && (
                <div className="mt-4 rounded-xl bg-[var(--oppa-cream)] p-3 text-sm text-[var(--oppa-text)]">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--oppa-text-muted)]">Notes</div>
                  {application.notes}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleReview(application.id, 'approve')}
                  disabled={processingId === application.id || application.status === 'approved'}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--oppa-green-dark)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CheckCircle2 size={16} /> {processingId === application.id ? 'Processing...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => handleReview(application.id, 'reject')}
                  disabled={processingId === application.id || application.status === 'rejected'}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle size={16} /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
};

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl bg-[var(--oppa-cream)] p-3">
    <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-[var(--oppa-text-muted)]">
      <Icon size={14} /> {label}
    </div>
    <div className="text-sm font-medium text-[var(--oppa-text)]">{value}</div>
  </div>
);

export default AdminFranchiseApplicationsPage;

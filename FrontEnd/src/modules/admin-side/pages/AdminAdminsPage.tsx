// src/modules/admin-side/pages/AdminAdminsPage.tsx
import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountCreationModal, { type AccountCreationValues } from '../components/AccountCreationModal';
import { useToast } from '../../customer-side/components/ToastProvider';
import { apiGetAdmins, apiRegisterAdmin, type StoredAccount } from '../../../services/adminAuthService';

const AdminAdminsPage: React.FC = () => {
  const [admins, setAdmins] = useState<StoredAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { showToast } = useToast();

  const refresh = async () => {
    try {
      const list = await apiGetAdmins();
      setAdmins(Array.isArray(list) ? list : []);
    } catch {
      setAdmins([]);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async (values: AccountCreationValues) => {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      await apiRegisterAdmin({
        full_name: values.fullName,
        email: values.email,
        password: values.password,
        password_confirmation: values.confirmPassword,
      });

      setShowModal(false);
      setIsSubmitting(false);
      await refresh();
      showToast('Admin account created successfully.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create the account. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Registered Admins</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Manage administrator accounts for the admin panel.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
        >
          <UserPlus size={16} /> Add Admin
        </button>
      </div>

      {admins.length === 0 && (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">No registered admins yet.</div>
      )}

      {admins.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Full Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{a.fullName}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{a.email}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{new Date(a.dateRegistered || a.created_at || '').toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AccountCreationModal
        mode="admin"
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleAdd}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />
    </AdminLayout>
  );
};

export default AdminAdminsPage;

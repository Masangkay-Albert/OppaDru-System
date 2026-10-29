import React, { useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountCreationModal, { type AccountCreationValues } from '../components/AccountCreationModal';
import { useToast } from '../../customer-side/components/ToastProvider';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { apiGetAdmins, apiRegisterAdmin, type StoredAccount } from '../../../services/adminAuthService';
import { AdminDate, Avatar, EmptyState, PageHeader, RowActionsMenu } from '../components/AdminUI';
import SearchInput from '../../../components/ui/SearchInput';

const AdminAdminsPage: React.FC = () => {
  const [admins, setAdmins] = useState<StoredAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [search, setSearch] = useState('');
  const { showToast } = useToast();
  const { admin } = useAdminAuth();

  const refresh = async () => {
    try {
      const list = await apiGetAdmins();
      setAdmins(Array.isArray(list) ? list : []);
    } catch {
      setAdmins([]);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeout);
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
      await refresh();
      showToast('Admin account created successfully.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create the account. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAdmins = useMemo(() => admins.filter((item) => `${item.fullName} ${item.email}`.toLowerCase().includes(search.trim().toLowerCase())), [admins, search]);

  return (
    <AdminLayout>
      <PageHeader title="Registered Admins" subtitle="Manage administrator accounts for the admin panel." actions={<button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--oppa-green-dark)]"><UserPlus size={16} />Add Admin</button>} />
      <SearchInput aria-label="Search administrators" value={search} onChange={setSearch} placeholder="Search name or email…" wrapperClassName="mb-3" />
      {filteredAdmins.length === 0 ? <div className="admin-card"><EmptyState title={search ? 'No administrators match your search' : 'No registered admins yet'} description={search ? 'Try a different name or email.' : 'New administrator accounts will appear here.'} /></div> :
        <div className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-[var(--shadow-card)]">
          <table className="admin-table w-full text-sm">
            <thead><tr className="sticky top-0 border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] text-left text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]"><th className="px-5 py-3">Administrator</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Joined</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody>{filteredAdmins.map((item) => {
              const isCurrent = item.id === admin?.id || item.email.toLowerCase() === admin?.email.toLowerCase();
              return <tr key={item.id} className="border-b border-[var(--oppa-border)]/70 last:border-0 hover:bg-[var(--oppa-cream)]">
                <td data-label="Administrator" className="px-5 py-3"><div className="flex min-w-0 items-center gap-3"><Avatar name={item.fullName} /><div className="min-w-0"><p className="truncate font-semibold text-[var(--oppa-text)]">{item.fullName}{isCurrent && <span className="ml-2 rounded-full bg-[var(--oppa-green-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--oppa-green-dark)]">You</span>}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{item.email}</p></div></div></td>
                <td data-label="Role" className="px-5 py-3"><span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold capitalize text-violet-900">{item.role || 'Admin'}</span></td>
                <td data-label="Joined" className="px-5 py-3 text-[var(--oppa-text-muted)]"><AdminDate value={item.dateRegistered || item.created_at} /></td>
                <td data-label="Actions" className="px-5 py-3"><div className="flex justify-end"><RowActionsMenu label={item.fullName} items={[
                  { label: 'Edit admin', disabled: true, title: 'Admin editing is not available in the current service.', onSelect: () => undefined },
                  { label: 'Delete admin', destructive: true, disabled: true, title: isCurrent ? 'You cannot delete your own account.' : 'Admin deletion is not available in the current service.', onSelect: () => undefined },
                ]} /></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
      <AccountCreationModal mode="admin" isOpen={showModal} onClose={() => setShowModal(false)} onSubmit={handleAdd} isSubmitting={isSubmitting} submitError={submitError} />
    </AdminLayout>
  );
};

export default AdminAdminsPage;

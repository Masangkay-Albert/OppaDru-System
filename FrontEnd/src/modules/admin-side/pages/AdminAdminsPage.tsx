import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountCreationModal, { type AccountCreationValues } from '../components/AccountCreationModal';
import { useToast } from '../../customer-side/components/ToastProvider';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import {
  apiDeleteAdmin,
  apiGetAdmins,
  apiRegisterAdmin,
  apiResetAdminPassword,
  apiUpdateAdmin,
  apiUpdateAdminRole,
  type AdminRole,
  type StoredAccount,
} from '../../../services/adminAuthService';
import { AdminDate, Avatar, ConfirmDialog, EmptyState, PageHeader, RowActionsMenu } from '../components/AdminUI';
import SearchInput from '../../../components/ui/SearchInput';
import Select from '../../../components/ui/Select';

type PendingAction =
  | { kind: 'role'; admin: StoredAccount; role: AdminRole }
  | { kind: 'delete'; admin: StoredAccount }
  | { kind: 'reset-password'; admin: StoredAccount };

const AdminAdminsPage: React.FC = () => {
  const [admins, setAdmins] = useState<StoredAccount[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRole>('all');
  const [pageError, setPageError] = useState('');
  const [editTarget, setEditTarget] = useState<StoredAccount | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editError, setEditError] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState('');
  const [resetError, setResetError] = useState('');
  const [passwordConfirmationReady, setPasswordConfirmationReady] = useState(false);
  const { showToast } = useToast();
  const { admin, refreshAdmin } = useAdminAuth();

  const refresh = useCallback(async () => {
    try {
      const list = await apiGetAdmins();
      setAdmins(list);
      setPageError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load administrator accounts.';
      setPageError(message);
      throw error;
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh().catch(() => undefined); }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const handleAdd = async (values: AccountCreationValues) => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await apiRegisterAdmin({
        full_name: values.fullName,
        email: values.email,
        password: values.password,
        password_confirmation: values.confirmPassword,
        role: values.role || 'admin',
      });
      setShowModal(false);
      await refresh();
      showToast('Administrator account created successfully.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create the account. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginEdit = (account: StoredAccount) => {
    setEditTarget(account);
    setEditName(account.fullName);
    setEditEmail(account.email);
    setEditError('');
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editTarget) return;
    setIsSubmitting(true);
    setEditError('');
    try {
      await apiUpdateAdmin(editTarget.id, { full_name: editName.trim(), email: editEmail.trim() });
      setEditTarget(null);
      await refresh();
      showToast('Administrator details updated.', 'success');
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Unable to update administrator details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginResetPassword = (account: StoredAccount) => {
    setResetPassword('');
    setResetPasswordConfirmation('');
    setResetError('');
    setPasswordConfirmationReady(false);
    setPendingAction({ kind: 'reset-password', admin: account });
  };

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    setIsSubmitting(true);
    try {
      if (pendingAction.kind === 'role') {
        await apiUpdateAdminRole(pendingAction.admin.id, pendingAction.role);
        if (pendingAction.admin.id === admin?.id) await refreshAdmin();
      } else if (pendingAction.kind === 'delete') {
        await apiDeleteAdmin(pendingAction.admin.id);
      } else {
        await apiResetAdminPassword(pendingAction.admin.id, resetPassword, resetPasswordConfirmation);
      }
      setPendingAction(null);
      setResetPassword('');
      setResetPasswordConfirmation('');
      setPasswordConfirmationReady(false);
      showToast(
        pendingAction.kind === 'role' ? 'Administrator role updated.'
          : pendingAction.kind === 'delete' ? 'Administrator deleted.'
            : 'Administrator password reset.',
        'success',
      );
      await refresh().catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to complete this administrator action.';
      if (pendingAction.kind === 'reset-password') {
        setPasswordConfirmationReady(false);
        setResetError(message);
        showToast(message, 'error');
      } else {
        showToast(message, 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAdmins = useMemo(() => admins.filter((item) => {
    const matchesSearch = `${item.fullName} ${item.email}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (roleFilter === 'all' || item.role === roleFilter);
  }), [admins, roleFilter, search]);

  const roleFilterOptions = [
    { value: 'all', label: `All roles (${admins.length})` },
    { value: 'system_administrator', label: `System Administrator (${admins.filter((item) => item.role === 'system_administrator').length})` },
    { value: 'admin', label: `Admin (${admins.filter((item) => item.role === 'admin').length})` },
  ];

  return (
    <AdminLayout>
      <PageHeader
        title="Registered Admins"
        subtitle="Manage administrator accounts and access levels."
        actions={<button onClick={() => setShowModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--oppa-green-dark)]"><UserPlus size={16} />Add Admin</button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput aria-label="Search administrators" value={search} onChange={setSearch} placeholder="Search name or email…" wrapperClassName="w-full sm:max-w-sm" />
        <Select
          aria-label="Filter administrators by role"
          value={roleFilter}
          onChange={(value) => setRoleFilter(value as 'all' | AdminRole)}
          options={roleFilterOptions}
          triggerClassName="min-h-11 w-full sm:w-64"
        />
      </div>
      {pageError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pageError}</div>}
      {filteredAdmins.length === 0 ? <div className="admin-card"><EmptyState title={search || roleFilter !== 'all' ? 'No administrators match these filters' : 'No registered admins yet'} description={search || roleFilter !== 'all' ? 'Try another search or role filter.' : 'New administrator accounts will appear here.'} /></div> :
        <div className="overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-[var(--shadow-card)]">
          <table className="admin-table w-full min-w-[720px] text-sm">
            <thead><tr className="sticky top-0 border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] text-left text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]"><th className="px-5 py-3">Administrator</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Joined</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody>{filteredAdmins.map((item) => {
              const isCurrent = item.id === admin?.id || item.email.toLowerCase() === admin?.email.toLowerCase();
              const isSystemAdmin = item.role === 'system_administrator';
              const systemAdminCount = admins.filter((account) => account.role === 'system_administrator').length;
              const isLastSystemAdmin = isSystemAdmin && systemAdminCount <= 1;
              return <tr key={item.id} className="border-b border-[var(--oppa-border)]/70 last:border-0 hover:bg-[var(--oppa-cream)]">
                <td data-label="Administrator" className="px-5 py-3"><div className="flex min-w-0 items-center gap-3"><Avatar name={item.fullName} /><div className="min-w-0"><p className="truncate font-semibold text-[var(--oppa-text)]">{item.fullName}{isCurrent && <span className="ml-2 rounded-full bg-[var(--oppa-green-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--oppa-green-dark)]">You</span>}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{item.email}</p></div></div></td>
                <td data-label="Role" className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isSystemAdmin ? 'bg-emerald-100 text-emerald-900' : 'bg-violet-100 text-violet-900'}`}>{isSystemAdmin ? 'System Administrator' : 'Admin'}</span></td>
                <td data-label="Joined" className="px-5 py-3 text-[var(--oppa-text-muted)]"><AdminDate value={item.dateRegistered || item.created_at} /></td>
                <td data-label="Actions" className="px-5 py-3"><div className="flex justify-end"><RowActionsMenu label={item.fullName} items={[
                  { label: 'Edit admin', onSelect: () => beginEdit(item) },
                  { label: 'Reset password', onSelect: () => beginResetPassword(item) },
                  {
                    label: isSystemAdmin ? 'Demote to Admin' : 'Promote to System Administrator',
                    disabled: isLastSystemAdmin,
                    title: isLastSystemAdmin ? 'The last System Administrator cannot be demoted.' : undefined,
                    onSelect: () => setPendingAction({ kind: 'role', admin: item, role: isSystemAdmin ? 'admin' : 'system_administrator' }),
                  },
                  {
                    label: 'Delete admin',
                    destructive: true,
                    disabled: isCurrent || isLastSystemAdmin,
                    title: isCurrent ? 'You cannot delete your own account.' : isLastSystemAdmin ? 'The last System Administrator cannot be deleted.' : undefined,
                    onSelect: () => setPendingAction({ kind: 'delete', admin: item }),
                  },
                ]} /></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}

      <AccountCreationModal
        mode="admin"
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleAdd}
        isSubmitting={isSubmitting}
        submitError={submitError}
      />

      {editTarget && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4">
        <form onSubmit={saveEdit} className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-6 shadow-2xl">
          <h2 className="font-serif text-xl font-bold text-[var(--oppa-text)]">Edit administrator</h2>
          <label className="mt-4 block text-sm font-medium text-[var(--oppa-text)]">Full name<input required value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-transparent px-3 py-2" /></label>
          <label className="mt-3 block text-sm font-medium text-[var(--oppa-text)]">Email<input required type="email" value={editEmail} onChange={(event) => setEditEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-transparent px-3 py-2" /></label>
          {editError && <p role="alert" className="mt-3 text-sm text-red-700">{editError}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setEditTarget(null)} disabled={isSubmitting} className="rounded-lg border border-[var(--oppa-border)] px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={isSubmitting} className="rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isSubmitting ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </div>}

      {pendingAction?.kind === 'reset-password' && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4">
        <form onSubmit={(event) => { event.preventDefault(); setResetError(''); if (resetPassword.length < 8) { setResetError('Use at least 8 characters.'); return; } if (resetPassword !== resetPasswordConfirmation) { setResetError('Passwords do not match.'); return; } setPasswordConfirmationReady(true); }} className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-6 shadow-2xl">
          <h2 className="font-serif text-xl font-bold text-[var(--oppa-text)]">Reset administrator password</h2>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{pendingAction.admin.fullName}</p>
          <label className="mt-4 block text-sm font-medium text-[var(--oppa-text)]">New password<input required minLength={8} type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-transparent px-3 py-2" /></label>
          <label className="mt-3 block text-sm font-medium text-[var(--oppa-text)]">Confirm password<input required minLength={8} type="password" value={resetPasswordConfirmation} onChange={(event) => setResetPasswordConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--oppa-border)] bg-transparent px-3 py-2" /></label>
          {resetError && <p role="alert" className="mt-3 text-sm text-red-700">{resetError}</p>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => { setPendingAction(null); setResetPassword(''); setResetPasswordConfirmation(''); setPasswordConfirmationReady(false); }} className="rounded-lg border border-[var(--oppa-border)] px-4 py-2 text-sm">Cancel</button><button type="submit" className="rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white">Continue</button></div>
        </form>
      </div>}

      {pendingAction && (pendingAction.kind !== 'reset-password' || passwordConfirmationReady) && <ConfirmDialog
        title={pendingAction.kind === 'role' ? 'Confirm role change' : pendingAction.kind === 'delete' ? 'Delete administrator?' : 'Reset password?'}
        description={pendingAction.kind === 'role'
          ? `Change ${pendingAction.admin.fullName}'s role to ${pendingAction.role === 'system_administrator' ? 'System Administrator' : 'Admin'}?`
          : pendingAction.kind === 'delete'
            ? `Permanently delete ${pendingAction.admin.fullName}'s administrator account?`
            : `Reset the password for ${pendingAction.admin.fullName}?`}
        confirmLabel={pendingAction.kind === 'role' ? 'Confirm role change' : pendingAction.kind === 'delete' ? 'Delete admin' : 'Reset password'}
        onConfirm={() => { void confirmPendingAction(); }}
        onCancel={() => {
          if (pendingAction.kind === 'reset-password') setPasswordConfirmationReady(false);
          else setPendingAction(null);
        }}
        busy={isSubmitting}
      />}
    </AdminLayout>
  );
};

export default AdminAdminsPage;

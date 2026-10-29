import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import AccountCreationModal, { type AccountCreationValues } from '../../admin-side/components/AccountCreationModal';
import { AdminDate, Avatar, DataTable, EmptyState, PageHeader, RowActionsMenu, StatusBadge } from '../../admin-side/components/AdminUI';
import { RoleBadge } from '../components/FranchisePortalUI';
import { useToast } from '../../customer-side/components/ToastProvider';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import Select from '../../../components/ui/Select';
import SearchInput from '../../../components/ui/SearchInput';

interface BranchUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  user_type?: 'employee' | 'driver';
  franchise_id?: string | null;
  branch_name?: string | null;
  created_at: string | null;
}

const FranchiseUsersPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<BranchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [editingRoleUser, setEditingRoleUser] = useState<BranchUser | null>(null);
  const [roleDraft, setRoleDraft] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');

  const loadUsers = useCallback(async (showLoading = true) => {
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/users`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch users.');
      setError('');
      setUsers(Array.isArray(payload.data) ? payload.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load branch users.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadUsers(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadUsers]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadUsers(false);
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadUsers]);

  const isOwner = (franchiseUser?.role || '').toLowerCase().includes('owner');
  const managerRole = (franchiseUser?.role || '').toLowerCase();
  const canManageStaff = managerRole.includes('owner') || managerRole.includes('manager');
  const branchName = franchiseUser?.branch?.name || franchiseUser?.franchise?.name || 'Current branch';
  const currentBranchId = String(franchiseUser?.franchise_id || '');
  const isMainBranch = Boolean(franchiseUser?.franchise?.is_main);

  const addStaff = async (values: AccountCreationValues) => {
    setSaving(true);
    setSubmitError('');
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/users`, {
        method: 'POST',
        body: JSON.stringify({
          name: values.fullName,
          email: values.email,
          phone: values.phone || null,
          password: values.password,
          role: values.position || 'cashier',
          vehicle_type: values.position === 'driver' ? values.vehicle_type : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not create branch staff account.');
      setShowAdd(false);
      await loadUsers(false);
      const roleName = values.position === 'kitchen_staff' ? 'Kitchen Staff' : (values.position || 'cashier');
      showToast(`${values.fullName} added as ${roleName} to ${branchName}.`, 'success');
    } catch (createError) {
      setSubmitError(createError instanceof Error ? createError.message : 'Could not create branch staff account.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user: BranchUser) => {
    if (!user.user_type) return;
    setError('');
    try {
      const response = await fetchWithFranchiseAuth(
        `${API_URL}/franchise/users/${user.user_type}/${encodeURIComponent(user.id)}/status`,
        { method: 'PATCH', body: JSON.stringify({ is_active: user.status !== 'active' }) },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not update staff status.');
      await loadUsers(false);
      showToast(`Staff account ${user.status === 'active' ? 'deactivated' : 'activated'}.`, 'success');
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update staff status.');
    }
  };

  const updateEmployeeRole = async (user: BranchUser, role: string) => {
    setError('');
    setSavingRole(true);
    try {
      const position = role === 'kitchen_staff' ? 'kitchen staff' : role;
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/users/employee/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ position }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not update staff role.');
      await loadUsers(false);
      setEditingRoleUser(null);
      showToast('Staff position updated.', 'success');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update staff role.');
    } finally {
      setSavingRole(false);
    }
  };

  const resetPassword = async (user: BranchUser) => {
    if (!user.user_type) return;
    const password = window.prompt(`Enter a new password for ${user.name} (at least 8 characters):`);
    if (password === null) return;
    if (password.length < 8) {
      setError('The new password must be at least 8 characters.');
      return;
    }
    setError('');
    try {
      const response = await fetchWithFranchiseAuth(
        `${API_URL}/franchise/users/${user.user_type}/${encodeURIComponent(user.id)}/password`,
        { method: 'PUT', body: JSON.stringify({ password }) },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not reset the staff password.');
      showToast(`Password reset for ${user.name}.`, 'success');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Could not reset the staff password.');
    }
  };

  const removeStaff = async (user: BranchUser) => {
    if (!user.user_type || !window.confirm(`Remove ${user.name}'s staff account from this branch?`)) return;
    setError('');
    try {
      const response = await fetchWithFranchiseAuth(
        `${API_URL}/franchise/users/${user.user_type}/${encodeURIComponent(user.id)}`,
        { method: 'DELETE' },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not remove staff account.');
      await loadUsers(false);
      showToast(`${user.name} was removed from branch staff.`, 'success');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove staff account.');
    }
  };

  const managers = useMemo(() => users.filter((user) => !user.user_type), [users]);
  const staff = useMemo(() => users.filter((user) => Boolean(user.user_type)), [users]);
  const filteredStaff = useMemo(() => staff.filter((user) => {
    const matchesSearch = `${user.name} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesPosition = positionFilter === 'all' || user.role.toLowerCase().replaceAll('_', ' ') === positionFilter;
    return matchesSearch && matchesPosition;
  }), [staff, search, positionFilter]);

  const positionOptions = [
    { value: 'all', label: 'All positions' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'kitchen staff', label: 'Kitchen Staff' },
    { value: 'driver', label: 'Driver' },
  ];

  return (
    <>
      {error && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => void loadUsers()} className="font-semibold underline">Retry</button></div>}
      <PageHeader
        title="Branch Users"
        subtitle={isMainBranch ? 'Manage Main Branch staff and view employees from other branches.' : 'Manage cashier, kitchen, and driver accounts for this branch.'}
        actions={canManageStaff ? <button type="button" onClick={() => { setSubmitError(''); setShowAdd(true); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--oppa-green-dark)]"><UserPlus size={16} />Add Staff</button> : undefined}
      />
      {managers.length > 0 && <section className="admin-card mb-4 overflow-hidden">
        <div className="border-b border-[var(--oppa-border)] px-4 py-3"><h2 className="font-semibold text-[var(--oppa-text)]">Branch management</h2><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Owner and manager accounts are shown for reference and cannot be changed here.</p></div>
        <div className="divide-y divide-[var(--oppa-border)]">
          {managers.map((manager) => {
            const currentUser = String(manager.id) === String(franchiseUser?.id);
            const label = currentUser && isOwner ? 'Owner' : 'Manager';
            return <div key={`manager-${manager.id}`} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={manager.name} />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold text-[var(--oppa-text)]">{manager.name}{currentUser && <span className="ml-2 text-xs font-normal text-[var(--oppa-text-muted)]">(You)</span>}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{manager.email}</p></div>
              <RoleBadge role={label} />
              <StatusBadge status={manager.status} />
            </div>;
          })}
        </div>
      </section>}

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-[var(--oppa-text-muted)]">
          <Search size={17} aria-hidden="true" />
          <SearchInput aria-label="Search branch users by name or email" value={search} onChange={setSearch} placeholder="Search name or email..." />
        </label>
        <Select<string> aria-label="Filter branch users by position" value={positionFilter} onChange={setPositionFilter} options={positionOptions} className="w-full sm:w-48" />
      </div>

      <DataTable
        headers={['Employee', 'Position', ...(isMainBranch ? ['Branch'] : []), 'Status', 'Joined', 'Actions']}
        caption="Branch staff accounts"
        columnWidths={isMainBranch ? ['30%', '16%', '18%', '12%', '14%', '10%'] : ['38%', '20%', '14%', '16%', '12%']}
        loading={loading}
        emptyState={<EmptyState title={search || positionFilter !== 'all' ? 'No staff match these filters' : 'No staff yet. Add your first cashier, kitchen, or driver account.'} description={search || positionFilter !== 'all' ? 'Try another name, email, or position.' : 'Staff accounts for this branch will appear here after they are added.'} />}
      >
        {filteredStaff.map((user) => <tr key={`${user.user_type}-${user.id}`} className="border-b border-[var(--oppa-border)]/70 last:border-0 hover:bg-[var(--oppa-cream)]">
          <td data-label="Employee" className="px-4 py-3"><div className="flex min-w-0 items-center gap-3"><Avatar name={user.name} /><div className="min-w-0"><p className="truncate font-semibold text-[var(--oppa-text)]">{user.name}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{user.email}</p></div></div></td>
          <td data-label="Position" className="px-4 py-3">
            <RoleBadge role={user.role} />
          </td>
          {isMainBranch && <td data-label="Branch" className="px-4 py-3 text-xs text-[var(--oppa-text-muted)]">{user.branch_name || 'Branch not found'}</td>}
          <td data-label="Status" className="px-4 py-3"><StatusBadge status={user.status} /></td>
          <td data-label="Joined" className="px-4 py-3 text-[var(--oppa-text-muted)]"><AdminDate value={user.created_at} /></td>
          <td data-label="Actions" className="px-4 py-3"><div className="flex justify-end">{currentBranchId && String(user.franchise_id || '') === currentBranchId ? <RowActionsMenu label={user.name} items={[
            ...(user.user_type === 'employee' && ['cashier', 'kitchen_staff'].includes(user.role) ? [{ label: 'Edit role', onSelect: () => { setRoleDraft(user.role); setEditingRoleUser(user); } }] : []),
            { label: user.status === 'active' ? 'Deactivate staff' : 'Activate staff', onSelect: () => void toggleStatus(user) },
            { label: 'Reset password', onSelect: () => void resetPassword(user) },
            { label: 'Remove staff', onSelect: () => void removeStaff(user), destructive: true },
          ]} /> : <span className="text-xs text-[var(--oppa-text-muted)]">Read only</span>}</div></td>
        </tr>)}
      </DataTable>

      <AccountCreationModal
        mode="branch-staff"
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setSubmitError(''); }}
        onSubmit={addStaff}
        isSubmitting={saving}
        submitError={submitError}
        branchName={branchName}
        positionPreview={(role) => <RoleBadge role={role} />}
      />
      {editingRoleUser && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !savingRole) setEditingRoleUser(null);
      }}>
        <section role="dialog" aria-modal="true" aria-labelledby="edit-role-title" onKeyDown={(event) => {
          if (event.key === 'Escape' && !savingRole) setEditingRoleUser(null);
        }} className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-6 shadow-2xl">
          <h2 id="edit-role-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">Edit staff role</h2>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Choose a position for {editingRoleUser.name}.</p>
          <div className="mt-2"><RoleBadge role={roleDraft} /></div>
          <Select<string> id="branch-user-role" label="Position" autoFocus value={roleDraft} onChange={setRoleDraft} disabled={savingRole} options={[{ value: 'cashier', label: 'Cashier' }, { value: 'kitchen_staff', label: 'Kitchen Staff' }]} className="mt-5" />
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setEditingRoleUser(null)} disabled={savingRole} className="franchise-button-secondary">Cancel</button>
            <button type="button" onClick={() => void updateEmployeeRole(editingRoleUser, roleDraft)} disabled={savingRole || roleDraft === editingRoleUser.role} className="franchise-button-primary">{savingRole ? 'Saving…' : 'Save role'}</button>
          </div>
        </section>
      </div>}
    </>
  );
};

export default FranchiseUsersPage;

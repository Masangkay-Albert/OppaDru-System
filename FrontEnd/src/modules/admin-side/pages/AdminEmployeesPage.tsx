import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountModal from '../components/AccountModal';
import AccountCreationModal, { type AccountCreationValues } from '../components/AccountCreationModal';
import { useToast } from '../../customer-side/components/ToastProvider';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithAdminAuth } from '../../../services/adminAuthService';
import { AdminDate, Avatar, ConfirmDialog, EmptyState, PageHeader, RowActionsMenu } from '../components/AdminUI';

export interface EmployeeAccount {
  id: string;
  fullName: string;
  email: string;
  position: string;
  created_at?: string;
}

const positionStyle = (position: string) => {
  const normalized = position.toLowerCase();
  if (normalized.includes('kitchen')) return 'bg-orange-100 text-orange-900';
  if (normalized.includes('manager')) return 'bg-violet-100 text-violet-900';
  return 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]';
};

const formatPositionLabel = (position: string) => {
  const normalized = position.trim().toLowerCase().replaceAll('_', ' ');
  if (normalized === 'cashier') return 'Cashier';
  if (normalized === 'kitchen' || normalized === 'kitchen staff') return 'Kitchen Staff';
  return normalized.replace(/\b\w/g, (character) => character.toUpperCase());
};

const AdminEmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [selected, setSelected] = useState<EmployeeAccount | null>(null);
  const [resetTarget, setResetTarget] = useState<EmployeeAccount | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const { showToast } = useToast();

  const refresh = async () => {
    try {
      const response = await fetchWithAdminAuth(`${API_URL}/employees`, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };
  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const handleAdd = async (values: AccountCreationValues) => {
    setIsLoading(true);
    setSubmitError('');
    try {
      const response = await fetchWithAdminAuth(`${API_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ fullName: values.fullName, email: values.email, password: values.password, position: values.position || 'cashier' }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Unable to create the account. Please try again.');
      }
      setShowModal(false);
      await refresh();
      showToast('Employee account created successfully.', 'success');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create the account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmDeleteEmployee = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetchWithAdminAuth(`${API_URL}/employees/${deleteTarget.id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Unable to delete this employee.');
      await refresh();
      showToast('Employee account deleted.', 'success');
    } catch (error) {
      console.error('Delete error:', error);
      showToast(error instanceof Error ? error.message : 'Unable to delete employee.', 'error');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleReset = async (id: string, newPassword: string) => {
    try {
      const response = await fetchWithAdminAuth(`${API_URL}/employees/${id}/reset-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      if (response.ok) {
        showToast('Password updated successfully.', 'success');
        setSelected(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        showToast(errorData.message || 'Failed to reset password.', 'error');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      showToast('Failed to reset password. Please try again.', 'error');
    }
  };

  const positions = useMemo(() => [...new Set(employees.map((employee) => employee.position).filter(Boolean))].sort(), [employees]);
  const filtered = useMemo(() => employees.filter((employee) =>
    `${employee.fullName} ${employee.email}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (positionFilter === 'all' || employee.position === positionFilter)
  ), [employees, positionFilter, search]);

  return (
    <AdminLayout>
      <PageHeader title="Registered Employees" subtitle="Manage employee accounts and information." actions={<button onClick={() => { setShowModal(true); setSubmitError(''); }} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--oppa-green-dark)]"><UserPlus size={16} />Add Employee</button>} />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-[var(--oppa-text-muted)]"><Search size={17} aria-hidden="true" /><input aria-label="Search employees by name or email" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email…" className="admin-embedded-input w-full text-sm" /></label>
        <label className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text-muted)]">Position<select aria-label="Filter employees by position" value={positionFilter} onChange={(event) => setPositionFilter(event.target.value)} className="admin-embedded-input max-w-36 font-medium text-[var(--oppa-text)]"><option value="all">All positions</option>{positions.map((position) => <option key={position} value={position}>{formatPositionLabel(position)}</option>)}</select></label>
      </div>
      {filtered.length === 0 ? <div className="admin-card"><EmptyState title={search || positionFilter !== 'all' ? 'No employees match these filters' : 'No registered employees yet'} description={search || positionFilter !== 'all' ? 'Try another name, email, or position.' : 'New employee accounts will appear here.'} /></div> :
        <div className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-[var(--shadow-card)]">
          <table className="admin-table w-full text-sm">
            <thead><tr className="sticky top-0 border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] text-left text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]"><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Position</th><th className="px-5 py-3">Joined</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
            <tbody>{filtered.map((employee) => <tr key={employee.id} className="border-b border-[var(--oppa-border)]/70 last:border-0 hover:bg-[var(--oppa-cream)]">
              <td data-label="Employee" className="px-5 py-3"><div className="flex min-w-0 items-center gap-3"><Avatar name={employee.fullName} /><div className="min-w-0"><p className="truncate font-semibold text-[var(--oppa-text)]">{employee.fullName}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{employee.email}</p></div></div></td>
              <td data-label="Position" className="px-5 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${positionStyle(employee.position || '')}`}>{employee.position ? formatPositionLabel(employee.position) : '—'}</span></td>
              <td data-label="Joined" className="px-5 py-3 text-[var(--oppa-text-muted)]"><AdminDate value={employee.created_at} /></td>
              <td data-label="Actions" className="px-5 py-3"><div className="flex justify-end"><RowActionsMenu label={employee.fullName} items={[{ label: 'View details', onSelect: () => setSelected(employee) }, { label: 'Reset password', onSelect: () => setResetTarget(employee) }, { label: 'Delete employee', destructive: true, onSelect: () => setDeleteTarget({ id: employee.id, fullName: employee.fullName }) }]} /></div></td>
            </tr>)}</tbody>
          </table>
        </div>}
      {deleteTarget && <ConfirmDialog title={`Delete ${deleteTarget.fullName}?`} description="This action will remove the employee account from the system." confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDeleteEmployee()} />}
      {resetTarget && <ConfirmDialog title={`Reset ${resetTarget.fullName}’s password?`} description="Continue to the password reset form for this employee." confirmLabel="Continue" onCancel={() => setResetTarget(null)} onConfirm={() => { setSelected(resetTarget); setResetTarget(null); }} />}
      <AccountCreationModal mode="employee" isOpen={showModal} onClose={() => setShowModal(false)} onSubmit={handleAdd} isSubmitting={isLoading} submitError={submitError} />
      {selected && <AccountModal account={selected} onClose={() => setSelected(null)} onResetPassword={handleReset} />}
    </AdminLayout>
  );
};

export default AdminEmployeesPage;

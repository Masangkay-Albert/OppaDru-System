import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus, KeyRound } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountModal from '../components/AccountModal';
import AccountCreationModal, { type AccountCreationValues } from '../components/AccountCreationModal';
import { useToast } from '../../customer-side/components/ToastProvider';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithAdminAuth } from '../../../services/adminAuthService';

export interface EmployeeAccount {
  id: string;
  fullName: string;
  email: string;
  position: string;
}

const chipBase = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap';
const chipInfo = `${chipBase} bg-blue-50 text-blue-600 hover:bg-blue-100`;
const iconDangerBtn = 'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700';

const AdminEmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeAccount[]>([]);
  const [selected, setSelected] = useState<EmployeeAccount | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fullName: string } | null>(null);
  const { showToast } = useToast();

  const refresh = async () => {
    try {
      const response = await fetchWithAdminAuth(`${API_URL}/employees`, {
        headers: { Accept: 'application/json' },
      });
      const data = await response.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async (values: AccountCreationValues) => {
    setIsLoading(true);
    setSubmitError('');

    try {
      const response = await fetchWithAdminAuth(`${API_URL}/employees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          position: values.position || 'cashier',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Unable to create the account. Please try again.');
      }

      setShowModal(false);
      await refresh();
      showToast('Employee account created successfully.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create the account. Please try again.';
      setSubmitError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = (id: string, fullName: string) => {
    setDeleteTarget({ id, fullName });
  };

  const confirmDeleteEmployee = async () => {
    if (!deleteTarget) return;

    try {
      await fetchWithAdminAuth(`${API_URL}/employees/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      await refresh();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleReset = async (id: string, newPassword: string) => {
    try {
      const response = await fetchWithAdminAuth(`${API_URL}/employees/${id}/reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
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

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Registered Employees</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Manage employee accounts and information.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
        >
          <UserPlus size={16} /> Add Employee
        </button>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-2xl">
            <p className="text-base font-semibold text-[var(--oppa-text)]">Delete "{deleteTarget.fullName}"?</p>
            <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">This action will remove the employee account from the system.</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-full border border-[var(--oppa-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteEmployee}
                className="rounded-full bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {employees.length === 0 && (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          No registered employees yet.
        </div>
      )}

      {/* Mobile view */}
      {employees.length > 0 && (
        <div className="space-y-3 md:hidden">
          {employees.map((emp) => (
            <div key={emp.id} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--oppa-text)]">{emp.fullName}</p>
                  <p className="truncate text-xs text-[var(--oppa-text-muted)]">{emp.email}</p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 capitalize">
                  {emp.position || '—'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--oppa-border)] pt-3">
                <button onClick={() => setSelected(emp)} className={chipInfo}>
                  <KeyRound size={13} /> View / Reset
                </button>
                <button onClick={() => handleDelete(emp.id, emp.fullName)} className={iconDangerBtn} title="Delete employee">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop view */}
      {employees.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-gray-50 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Full Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Position</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{emp.fullName}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{emp.email}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)] capitalize">{emp.position || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelected(emp)} className={chipInfo}>
                        <KeyRound size={13} /> View / Reset
                      </button>
                      <button onClick={() => handleDelete(emp.id, emp.fullName)} className={iconDangerBtn} title="Delete employee">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AccountCreationModal
        mode="employee"
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleAdd}
        isSubmitting={isLoading}
        submitError={submitError}
      />

      {selected && (
        <AccountModal account={selected} onClose={() => setSelected(null)} onResetPassword={handleReset} />
      )}
    </AdminLayout>
  );
};

export default AdminEmployeesPage;
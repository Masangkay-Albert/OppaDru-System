// src/modules/admin-side/pages/AdminEmployeesPage.tsx
import React, { useEffect, useState } from 'react';
import { Trash2, UserPlus, KeyRound } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountModal from '../components/AccountModal';
import {
  getAccountsByRole,
  resetAccountPassword,
  addEmployeeAccount,
  deleteAccount,
  type StoredAccount,
} from '../../../services/adminAuthService';

// Shared action-button styles so every list/table here uses one consistent toolbar look.
const chipBase = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap';
const chipInfo = `${chipBase} bg-blue-50 text-blue-600 hover:bg-blue-100`;
const iconDangerBtn = 'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700';

const AdminEmployeesPage: React.FC = () => {
  const [employees, setEmployees] = useState<StoredAccount[]>([]);
  const [selected, setSelected] = useState<StoredAccount | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', position: 'Cashier', contactNumber: '' });

  const refresh = () => setEmployees(getAccountsByRole('employee'));

  useEffect(() => {
    refresh();
  }, []);

  const handleReset = (id: string, newPassword: string) => {
    resetAccountPassword(id, newPassword);
    refresh();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this employee account?')) {
      deleteAccount(id);
      refresh();
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addEmployeeAccount(form);
    setForm({ fullName: '', email: '', password: '', position: 'Cashier', contactNumber: '' });
    setShowForm(false);
    refresh();
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Registered Employees</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Manage staff accounts and access.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-oppa-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <UserPlus size={16} /> Add Employee
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
        >
          <input
            required
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
          />
          <input
            required
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
          />
          <select
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
          >
            <option>Cashier</option>
            <option>Kitchen Staff</option>
          </select>
          <button
            type="submit"
            className="bg-oppa-gradient rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 sm:col-span-2 lg:col-span-1"
          >
            Save Employee
          </button>
        </form>
      )}

      {employees.length === 0 && (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          No registered employees yet.
        </div>
      )}

      {/* Mobile / tablet: tidy stacked cards */}
      {employees.length > 0 && (
        <div className="space-y-3 md:hidden">
          {employees.map((emp) => (
            <div key={emp.id} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--oppa-text)]">{emp.fullName}</p>
                  <p className="truncate text-xs text-[var(--oppa-text-muted)]">{emp.email}</p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-[var(--oppa-green-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--oppa-text)]">
                  {emp.position || '—'}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--oppa-border)] pt-3">
                <button onClick={() => setSelected(emp)} className={chipInfo}>
                  <KeyRound size={13} /> View / Reset
                </button>
                <button onClick={() => handleDelete(emp.id)} className={iconDangerBtn} title="Delete employee">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop: full data table */}
      {employees.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Full Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Position</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{emp.fullName}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{emp.email}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{emp.position || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelected(emp)} className={chipInfo}>
                        <KeyRound size={13} /> View / Reset
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className={iconDangerBtn} title="Delete employee">
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

      {selected && (
        <AccountModal account={selected} onClose={() => setSelected(null)} onResetPassword={handleReset} />
      )}
    </AdminLayout>
  );
};

export default AdminEmployeesPage;

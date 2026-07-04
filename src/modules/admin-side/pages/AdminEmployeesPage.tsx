// src/modules/admin-side/pages/AdminEmployeesPage.tsx
import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountModal from '../components/AccountModal';
import {
  getAccountsByRole,
  resetAccountPassword,
  addEmployeeAccount,
  type StoredAccount,
} from '../../../services/adminAuthService';

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

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    addEmployeeAccount(form);
    setForm({ fullName: '', email: '', password: '', position: 'Cashier', contactNumber: '' });
    setShowForm(false);
    refresh();
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registered Employees</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-lime-700 hover:bg-lime-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          <UserPlus size={16} /> Add Employee
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
        >
          <input
            required
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option>Cashier</option>
            <option>Kitchen Staff</option>
            <option>Delivery Rider</option>
          </select>
          <button type="submit" className="bg-gray-900 text-white text-sm rounded-lg px-4 py-2">
            Save Employee
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
              <th className="px-5 py-3">Full Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Position</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-gray-400">
                  No registered employees yet.
                </td>
              </tr>
            )}
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3 font-medium text-gray-800">{emp.fullName}</td>
                <td className="px-5 py-3 text-gray-600">{emp.email}</td>
                <td className="px-5 py-3 text-gray-600">{emp.position || '—'}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => setSelected(emp)}
                    className="text-blue-600 hover:underline text-xs font-medium"
                  >
                    View / Reset Password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <AccountModal account={selected} onClose={() => setSelected(null)} onResetPassword={handleReset} />
      )}
    </AdminLayout>
  );
};

export default AdminEmployeesPage;

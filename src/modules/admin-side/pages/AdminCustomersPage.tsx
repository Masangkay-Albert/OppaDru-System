// src/modules/admin-side/pages/AdminCustomersPage.tsx
import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountModal from '../components/AccountModal';
import { getAccountsByRole, resetAccountPassword, deleteAccount, type StoredAccount } from '../../../services/adminAuthService';

const AdminCustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<StoredAccount[]>([]);
  const [selected, setSelected] = useState<StoredAccount | null>(null);

  const refresh = () => setCustomers(getAccountsByRole('customer'));

  useEffect(() => {
    refresh();
  }, []);

  const handleReset = (id: string, newPassword: string) => {
    resetAccountPassword(id, newPassword);
    refresh();
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this customer account?')) {
      deleteAccount(id);
      refresh();
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-[var(--oppa-text)] sm:text-3xl">Registered Customers</h1>
        <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">View accounts and manage customer passwords.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
              <th className="px-5 py-3">Full Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-[var(--oppa-text-muted)]">
                  No registered customers yet.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{c.fullName}</td>
                <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{c.email}</td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setSelected(c)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      View / Reset Password
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Delete customer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
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

export default AdminCustomersPage;
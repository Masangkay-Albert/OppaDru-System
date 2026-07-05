// src/modules/admin-side/pages/AdminCustomersPage.tsx
import React, { useEffect, useState } from 'react';
import { Trash2, KeyRound } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountModal from '../components/AccountModal';
import { getAccountsByRole, resetAccountPassword, deleteAccount, type StoredAccount } from '../../../services/adminAuthService';

// Shared action-button styles so every list/table here uses one consistent toolbar look.
const chipBase = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap';
const chipInfo = `${chipBase} bg-blue-50 text-blue-600 hover:bg-blue-100`;
const iconDangerBtn = 'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700';

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

      {customers.length === 0 && (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          No registered customers yet.
        </div>
      )}

      {/* Mobile / tablet: tidy stacked cards */}
      {customers.length > 0 && (
        <div className="space-y-3 md:hidden">
          {customers.map((c) => (
            <div key={c.id} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm">
              <p className="truncate font-medium text-[var(--oppa-text)]">{c.fullName}</p>
              <p className="truncate text-xs text-[var(--oppa-text-muted)]">{c.email}</p>
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--oppa-border)] pt-3">
                <button onClick={() => setSelected(c)} className={chipInfo}>
                  <KeyRound size={13} /> View / Reset
                </button>
                <button onClick={() => handleDelete(c.id)} className={iconDangerBtn} title="Delete customer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop: full data table */}
      {customers.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Full Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{c.fullName}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{c.email}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelected(c)} className={chipInfo}>
                        <KeyRound size={13} /> View / Reset
                      </button>
                      <button onClick={() => handleDelete(c.id)} className={iconDangerBtn} title="Delete customer">
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

export default AdminCustomersPage;

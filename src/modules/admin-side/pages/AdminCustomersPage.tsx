// src/modules/admin-side/pages/AdminCustomersPage.tsx
import React, { useEffect, useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import AccountModal from '../components/AccountModal';
import { getAccountsByRole, resetAccountPassword, type StoredAccount } from '../../../services/adminAuthService';

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

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Registered Customers</h1>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
              <th className="px-5 py-3">Full Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                  No registered customers yet.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3 font-medium text-gray-800">{c.fullName}</td>
                <td className="px-5 py-3 text-gray-600">{c.email}</td>
                <td className="px-5 py-3">
                  <button
                    onClick={() => setSelected(c)}
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

export default AdminCustomersPage;

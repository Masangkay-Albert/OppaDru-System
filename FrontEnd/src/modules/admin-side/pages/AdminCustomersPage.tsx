import React, { useEffect, useState } from 'react';
import { Trash2, KeyRound, Users, ShoppingBag } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountModal from '../components/AccountModal';
import { getAccountsByRole, resetAccountPassword, deleteAccount, type StoredAccount } from '../../../services/adminAuthService';
import { getAllCustomers } from '../../../services/adminOrderService';
import { formatCurrency } from '../../../utils/formatters';

const chipBase = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition whitespace-nowrap';
const chipInfo = `${chipBase} bg-blue-50 text-blue-600 hover:bg-blue-100`;
const iconDangerBtn = 'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700';

interface CustomerWithStats extends StoredAccount {
  order_count?: number;
  total_spent?: number;
  date_registered?: string;
}

const AdminCustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<StoredAccount | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const localCustomers = getAccountsByRole('customer');
      const apiCustomers = await getAllCustomers();
      
      const merged: CustomerWithStats[] = apiCustomers.map((api: any) => ({
        id: api.id,
        fullName: api.full_name || api.fullName || 'Customer',
        email: api.email,
        password: '********',
        role: 'customer',
        order_count: api.order_count || 0,
        total_spent: api.total_spent || 0,
        date_registered: api.date_registered || api.created_at,
      }));
      
      setCustomers(merged.length > 0 ? merged : localCustomers.map(c => ({ ...c, order_count: 0, total_spent: 0 })));
    } catch (error) {
      console.error('Failed to load customers:', error);
      const localCustomers = getAccountsByRole('customer');
      setCustomers(localCustomers.map(c => ({ ...c, order_count: 0, total_spent: 0 })));
    } finally {
      setLoading(false);
    }
  };

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Registered Customers</h1>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">View accounts and manage customer passwords.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[var(--oppa-green-soft)] px-3 py-1.5">
            <Users size={16} className="text-[var(--oppa-green)]" />
            <span className="text-sm font-medium text-[var(--oppa-text)]">{customers.length} Customers</span>
          </div>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-12 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <Users className="mx-auto h-12 w-12 text-[var(--oppa-text-muted)]/30" />
          <p className="mt-2">No registered customers yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Full Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Orders</th>
                <th className="px-5 py-3">Total Spent</th>
                <th className="px-5 py-3">Registered</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{c.fullName}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{c.email}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                      <ShoppingBag size={12} />
                      {c.order_count || 0}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">
                    {formatCurrency(c.total_spent || 0)}
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--oppa-text-muted)]">
                    {c.date_registered ? new Date(c.date_registered).toLocaleDateString() : 'N/A'}
                  </td>
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
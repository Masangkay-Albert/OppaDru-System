import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShoppingBag, Users } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import AccountModal from '../components/AccountModal';
import { AdminDate, Avatar, ConfirmDialog, DataTable, EmptyState, PageHeader, RowActionsMenu, Toast } from '../components/AdminUI';
import { getAccountsByRole, resetAccountPassword, deleteAccount, fetchWithAdminAuth, type StoredAccount } from '../../../services/adminAuthService';
import { getAllCustomers } from '../../../services/adminOrderService';
import { API_URL } from '../../../services/apiConfig';
import { formatCurrency } from '../../../utils/formatters';

interface CustomerWithStats extends StoredAccount {
  order_count?: number;
  total_spent?: number;
  date_registered?: string;
}

interface ApiCustomerRecord {
  id: string;
  full_name?: string;
  fullName?: string;
  email: string;
  order_count?: number;
  total_spent?: number;
  date_registered?: string;
  created_at?: string;
}

const AdminCustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [selected, setSelected] = useState<StoredAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fullName: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<StoredAccount | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'spent' | 'orders' | 'registered'>('spent');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    try {
      const localCustomers = getAccountsByRole('customer');
      const apiCustomers = await getAllCustomers();
      const merged: CustomerWithStats[] = apiCustomers.map((api: ApiCustomerRecord) => ({
        id: api.id,
        fullName: api.full_name || api.fullName || 'Customer',
        email: api.email,
        password: '********',
        role: 'customer',
        order_count: api.order_count || 0,
        total_spent: api.total_spent || 0,
        date_registered: api.date_registered || api.created_at,
      }));
      setCustomers(merged.length > 0 ? merged : localCustomers.map((customer) => ({ ...customer, order_count: 0, total_spent: 0 })));
    } catch {
      const localCustomers = getAccountsByRole('customer');
      setCustomers(localCustomers.map((customer) => ({ ...customer, order_count: 0, total_spent: 0 })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const filtered = useMemo(() => customers
    .filter((customer) => `${customer.fullName} ${customer.email}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => sortBy === 'spent' ? Number(b.total_spent || 0) - Number(a.total_spent || 0) : sortBy === 'orders' ? Number(b.order_count || 0) - Number(a.order_count || 0) : new Date(b.date_registered || b.created_at || 0).getTime() - new Date(a.date_registered || a.created_at || 0).getTime()), [customers, search, sortBy]);
  const pageSize = 10;
  const visibleCustomers = filtered.slice((page - 1) * pageSize, page * pageSize);
  const titleCase = (value: string) => value.toLocaleLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase());

  const handleReset = (id: string, newPassword: string) => {
    resetAccountPassword(id, newPassword);
    setNotice('Customer password reset.');
    void refresh();
  };

  const confirmDeleteCustomer = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetchWithAdminAuth(`${API_URL}/admin/customers/${deleteTarget.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Failed to delete customer');
      }
      deleteAccount(deleteTarget.id);
      await refresh();
      setNotice(`${deleteTarget.fullName} was deleted.`);
    } catch (error) {
      console.error('Delete customer error:', error);
      setNotice(error instanceof Error ? error.message : 'Failed to delete customer');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <AdminLayout>
      <PageHeader title="Registered Customers" subtitle="View accounts and manage customer passwords." actions={<div className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 py-2"><Users size={16} className="text-[var(--oppa-green)]" /><span className="text-sm font-semibold text-[var(--oppa-text)]">{customers.length} customers</span></div>} />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-[var(--oppa-text-muted)]"><Search size={17} aria-hidden="true" /><input aria-label="Search customers by name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search customers…" className="admin-embedded-input w-full text-sm" /></label>
        <label className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text-muted)]">Sort by<select aria-label="Sort customers" value={sortBy} onChange={(event) => { setSortBy(event.target.value as typeof sortBy); setPage(1); }} className="admin-embedded-input max-w-32 font-medium text-[var(--oppa-text)]"><option value="spent">Total spent</option><option value="orders">Orders</option><option value="registered">Registered</option></select></label>
      </div>
      {notice && <Toast message={notice} tone={notice.toLowerCase().includes('failed') ? 'error' : 'success'} onDismiss={() => setNotice('')} />}
      <DataTable
        className="customers-table"
        caption="Registered customers"
        columnWidths={['32%', '12%', '18%', '21%', '17%']}
        columnAlignments={['left', 'center', 'right', 'left', 'right']}
        headers={['Customer', 'Orders', 'Total spent', 'Registered', 'Actions']}
        loading={loading}
        emptyState={<EmptyState icon={<Users size={23} />} title={search ? 'No customers match your search' : 'No registered customers yet'} description={search ? 'Try a different name or email.' : 'Customer accounts will appear here after registration.'} />}
        pagination={{ page, pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)), onPageChange: setPage }}
      >
        {visibleCustomers.map((customer) => <tr key={customer.id} className="border-b border-[var(--oppa-border)]/70 last:border-0 hover:bg-[var(--oppa-cream)]">
          <td data-label="Customer" className="col-left"><div className="flex min-w-0 items-center gap-3"><Avatar name={customer.fullName} /><div className="min-w-0"><p className="truncate font-semibold text-[var(--oppa-text)]">{titleCase(customer.fullName)}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{customer.email}</p></div></div></td>
          <td data-label="Orders" className="col-center"><span className="inline-flex items-center gap-1 rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--oppa-green-dark)]"><ShoppingBag size={12} />{customer.order_count || 0}</span></td>
          <td data-label="Total spent" className="col-right tabular-nums whitespace-nowrap font-semibold text-[var(--oppa-text)]">{formatCurrency(customer.total_spent || 0)}</td>
          <td data-label="Registered" className="col-left whitespace-nowrap text-[var(--oppa-text-muted)]"><AdminDate value={customer.date_registered || customer.created_at} /></td>
          <td data-label="Actions" className="col-right"><div className="flex items-center justify-end gap-2 whitespace-nowrap"><button onClick={() => setSelected(customer)} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]">View</button><RowActionsMenu label={customer.fullName} items={[{ label: 'Reset password', onSelect: () => setResetTarget(customer) }, { label: 'Delete customer', destructive: true, onSelect: () => setDeleteTarget({ id: customer.id, fullName: customer.fullName }) }]} /></div></td>
        </tr>)}
      </DataTable>
      {deleteTarget && <ConfirmDialog title={`Delete ${deleteTarget.fullName}?`} description="This will remove the customer account from the system." confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDeleteCustomer()} />}
      {resetTarget && <ConfirmDialog title={`Reset ${resetTarget.fullName}’s password?`} description="Continue to the password reset form for this customer." confirmLabel="Continue" onCancel={() => setResetTarget(null)} onConfirm={() => { setSelected(resetTarget); setResetTarget(null); }} />}
      {selected && <AccountModal account={selected} onClose={() => setSelected(null)} onResetPassword={handleReset} />}
    </AdminLayout>
  );
};

export default AdminCustomersPage;

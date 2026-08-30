// src/modules/admin-side/pages/AdminAdminsPage.tsx
import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { apiGetAdmins, apiRegisterAdmin, type StoredAccount } from '../../../services/adminAuthService';

const AdminAdminsPage: React.FC = () => {
  const [admins, setAdmins] = useState<StoredAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', password_confirmation: '' });

  const refresh = async () => {
    try {
      const list = await apiGetAdmins();
      setAdmins(Array.isArray(list) ? list : []);
    } catch {
      setAdmins([]);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRegisterAdmin({ full_name: form.fullName, email: form.email, password: form.password, password_confirmation: form.password_confirmation });
      setForm({ fullName: '', email: '', password: '', password_confirmation: '' });
      setShowForm(false);
      refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[var(--oppa-text)] sm:text-3xl">Registered Admins</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Manage administrator accounts for the admin panel.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-oppa-gradient flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <UserPlus size={16} /> Add Admin
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <input required placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" />
          <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" />
          <input required placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" />
          <input required placeholder="Confirm password" value={form.password_confirmation} onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" />
          <button type="submit" className="bg-oppa-gradient rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 sm:col-span-2 lg:col-span-1">Save Admin</button>
        </form>
      )}

      {admins.length === 0 && (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">No registered admins yet.</div>
      )}

      {admins.length > 0 && (
        <div className="hidden overflow-x-auto rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/40 text-left text-xs uppercase text-[var(--oppa-text-muted)]">
                <th className="px-5 py-3">Full Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 hover:bg-[var(--oppa-cream)]">
                  <td className="px-5 py-3 font-medium text-[var(--oppa-text)]">{a.fullName}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{a.email}</td>
                  <td className="px-5 py-3 text-[var(--oppa-text-muted)]">{new Date(a.dateRegistered || a.created_at || '').toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminAdminsPage;

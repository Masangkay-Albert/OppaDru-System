import React, { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, RefreshCw, Users, X } from 'lucide-react';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';

interface BranchUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  created_at: string | null;
}

const FranchiseUsersPage: React.FC = () => {
  const [users, setUsers] = useState<BranchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });

  const loadUsers = useCallback(async () => {
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/users`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch users.');
      setError('');
      setUsers(Array.isArray(payload.data) ? payload.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load branch users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadUsers); }, [loadUsers, reload]);

  const addManager = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/users`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not create branch manager.');
      setForm({ full_name: '', email: '', phone: '', password: '' });
      setShowAdd(false);
      setLoading(true);
      setReload((value) => value + 1);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create branch manager.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div><h1 className="text-2xl font-semibold">Branch users</h1><p className="mt-1 text-sm text-gray-500">View team members and manage branch portal managers.</p></div>
          <div className="flex gap-2"><button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-border)] px-4 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button><button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> Add manager</button></div>
        </header>
        {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} className="font-semibold underline">Retry</button></div>}
        <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading branch users...</p> : users.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">No managers or staff are assigned to this branch yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#edf5ef] text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date added</th></tr></thead><tbody className="divide-y divide-gray-100">{users.map((user) => <tr key={`${user.role}-${user.id}`}><td className="px-4 py-4 font-medium">{user.name}</td><td className="px-4 py-4">{user.email}</td><td className="px-4 py-4">{user.role}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{user.status}</span></td><td className="px-4 py-4 text-gray-500">{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div>
          )}
        </section>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">New accounts created here are branch managers with full portal permissions. Cashier/staff logins remain managed by HQ until their employee login and POS workflows support branch-specific access.</p>
      </div>
      {showAdd && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAdd(false); }}>
        <form onSubmit={addManager} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <div className="mb-5 flex items-start justify-between"><div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green-soft)] p-2 text-[var(--oppa-green)]"><Users size={20} /></span><div><h2 className="font-semibold">Add branch manager</h2><p className="text-sm text-gray-500">Access will be limited to this branch.</p></div></div><button type="button" aria-label="Close dialog" onClick={() => setShowAdd(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={18} /></button></div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Full name<input required maxLength={255} value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>
            <label className="block text-sm font-medium">Email<input required type="email" maxLength={255} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>
            <label className="block text-sm font-medium">Phone<input maxLength={50} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>
            <label className="block text-sm font-medium">Initial password<input required type="password" minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 font-normal" /></label>
          </div>
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowAdd(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Creating…' : 'Create manager'}</button></div>
        </form>
      </div>}
    </main>
  );
};

export default FranchiseUsersPage;

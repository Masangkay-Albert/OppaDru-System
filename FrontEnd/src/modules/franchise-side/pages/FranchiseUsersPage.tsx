import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
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

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div><Link to="/franchise/dashboard" className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--oppa-green)] hover:underline"><ArrowLeft size={16} /> Dashboard</Link><h1 className="text-2xl font-semibold">Branch users</h1><p className="mt-1 text-sm text-gray-500">Managers and staff assigned to this branch. User access is managed by HQ.</p></div>
          <button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-border)] px-4 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button>
        </header>
        {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} className="font-semibold underline">Retry</button></div>}
        <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
          {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading branch users...</p> : users.length === 0 ? <p className="p-10 text-center text-sm text-gray-500">No managers or staff are assigned to this branch yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#edf5ef] text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Date added</th></tr></thead><tbody className="divide-y divide-gray-100">{users.map((user) => <tr key={`${user.role}-${user.id}`}><td className="px-4 py-4 font-medium">{user.name}</td><td className="px-4 py-4">{user.email}</td><td className="px-4 py-4">{user.role}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{user.status}</span></td><td className="px-4 py-4 text-gray-500">{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</td></tr>)}</tbody></table></div>
          )}
        </section>
      </div>
    </main>
  );
};

export default FranchiseUsersPage;

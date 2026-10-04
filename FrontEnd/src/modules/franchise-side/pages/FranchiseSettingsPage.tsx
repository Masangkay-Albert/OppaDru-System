import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';

interface BranchSettings {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: string;
  operating_hours: string | Record<string, unknown> | null;
}

const FranchiseSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<BranchSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/settings`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch settings.');
      setError('');
      setSettings(payload.data as BranchSettings);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load branch settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadSettings); }, [loadSettings, reload]);

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div><Link to="/franchise/dashboard" className="mb-2 inline-flex items-center gap-2 text-sm text-[var(--oppa-green)] hover:underline"><ArrowLeft size={16} /> Dashboard</Link><h1 className="text-2xl font-semibold">Branch settings</h1><p className="mt-1 text-sm text-gray-500">Branch profile and operational information.</p></div>
          <button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-border)] px-4 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button>
        </header>
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} className="ml-3 font-semibold underline">Retry</button></div>}
        {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading branch settings...</p> : settings && (
          <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4 border-b pb-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Branch</p><h2 className="mt-1 text-xl font-semibold">{settings.name}</h2></div><span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold capitalize text-green-800">{settings.status}</span></div>
            <dl className="grid gap-5 sm:grid-cols-2">{[['Branch ID', settings.id], ['Contact email', settings.email], ['Phone', settings.phone], ['Address', settings.address], ['Operating hours', settings.operating_hours ? typeof settings.operating_hours === 'string' ? settings.operating_hours : JSON.stringify(settings.operating_hours) : 'Not set']].map(([label, value]) => <div key={label}><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{value || 'Not provided'}</dd></div>)}</dl>
            <p className="mt-6 rounded-xl bg-[#edf5ef] p-4 text-sm text-gray-700">For changes to official branch contact details, operating hours, or access status, contact HQ. These details are read-only in the franchise portal.</p>
          </section>
        )}
      </div>
    </main>
  );
};

export default FranchiseSettingsPage;

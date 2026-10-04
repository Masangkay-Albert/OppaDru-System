import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, RefreshCw, Save, Store } from 'lucide-react';
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
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [operatingHours, setOperatingHours] = useState('');

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/settings`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch settings.');
      setError('');
      setSettings(payload.data as BranchSettings);
      setPhone(payload.data?.phone || '');
      setOperatingHours(typeof payload.data?.operating_hours === 'string'
        ? payload.data.operating_hours
        : payload.data?.operating_hours ? JSON.stringify(payload.data.operating_hours) : '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load branch settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(loadSettings); }, [loadSettings, reload]);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/settings`, {
        method: 'PUT',
        body: JSON.stringify({ phone: phone.trim() || null, operating_hours: operatingHours.trim() || null }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not save branch settings.');
      setSettings(payload.data as BranchSettings);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save branch settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--oppa-green)]">Franchise Portal · Settings</p><h1 className="mt-1 text-2xl font-semibold">Branch settings</h1><p className="mt-1 text-sm text-gray-500">Review branch information and operating details.</p></div>
          <div className="flex gap-2">
            <button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-border)] px-4 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button>
            {settings && !editing && <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white"><Edit3 size={15} /> Edit</button>}
          </div>
        </header>
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} className="ml-3 font-semibold underline">Retry</button></div>}
        {loading ? <p className="p-10 text-center text-sm text-gray-500">Loading branch settings...</p> : settings && (
          <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4 border-b pb-5"><div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green-soft)] p-3 text-[var(--oppa-green)]"><Store size={20} /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Branch profile</p><h2 className="mt-1 text-xl font-semibold">{settings.name}</h2></div></div><span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold capitalize text-green-800">{settings.status}</span></div>
            {editing ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label htmlFor="branch-phone" className="text-xs font-medium uppercase tracking-wide text-gray-500">Branch phone</label><input id="branch-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={50} className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" /></div>
                <div><label htmlFor="branch-hours" className="text-xs font-medium uppercase tracking-wide text-gray-500">Operating hours</label><input id="branch-hours" value={operatingHours} onChange={(event) => setOperatingHours(event.target.value)} maxLength={255} placeholder="e.g. Daily, 10:00 AM – 9:00 PM" className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm" /></div>
                <div className="flex gap-2 sm:col-span-2"><button onClick={() => void saveSettings()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Save size={15} />{saving ? 'Saving…' : 'Save changes'}</button><button onClick={() => { setEditing(false); setPhone(settings.phone || ''); setOperatingHours(typeof settings.operating_hours === 'string' ? settings.operating_hours : settings.operating_hours ? JSON.stringify(settings.operating_hours) : ''); }} disabled={saving} className="rounded-xl border px-4 py-2 text-sm">Cancel</button></div>
              </div>
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2">{[['Branch ID', settings.id], ['Contact email', settings.email], ['Phone', settings.phone], ['Address', settings.address], ['Operating hours', settings.operating_hours ? typeof settings.operating_hours === 'string' ? settings.operating_hours : JSON.stringify(settings.operating_hours) : 'Not set']].map(([label, value]) => <div key={label}><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{value || 'Not provided'}</dd></div>)}</dl>
            )}
            <p className="mt-6 rounded-xl bg-[#edf5ef] p-4 text-sm text-gray-700">You can edit your branch phone and operating hours here. Official branch name, email, address, and access status are managed by HQ.</p>
          </section>
        )}
      </div>
    </main>
  );
};

export default FranchiseSettingsPage;

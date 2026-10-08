import React, { useCallback, useEffect, useState } from 'react';
import { Building2, MapPin, RefreshCw, Store } from 'lucide-react';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';

interface ManagementLocation {
  id: string;
  name: string;
  address?: string | null;
  status: string;
  email?: string | null;
  phone?: string | null;
}

interface ManagementData {
  franchise?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    status: string;
  } | null;
  assigned_location?: ManagementLocation | null;
  locations: ManagementLocation[];
}

const FranchiseManagementPage: React.FC = () => {
  const [data, setData] = useState<ManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/management`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load authorized franchise information.');
      setError('');
      setData(payload.data as ManagementData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load franchise information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load, reload]);

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--oppa-green)]">Franchise Portal · Access</p><h1 className="mt-1 text-2xl font-semibold">My franchise</h1><p className="mt-1 text-sm text-gray-500">Franchise information and locations authorized for your manager account.</p></div>
          <button onClick={() => { setError(''); setLoading(true); setReload((value) => value + 1); }} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-border)] px-4 py-2 text-sm disabled:opacity-50"><RefreshCw size={15} /> Refresh</button>
        </header>
        {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<button onClick={() => { setLoading(true); setReload((value) => value + 1); }} className="font-semibold underline">Retry</button></div>}
        {loading ? <p className="rounded-2xl border bg-white p-10 text-center text-sm text-gray-500">Loading your franchise information...</p> : data && (
          <>
            {data.franchise ? (
              <section className="mb-5 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green-soft)] p-3 text-[var(--oppa-green)]"><Building2 size={22} /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Authorized franchise</p><h2 className="text-xl font-semibold">{data.franchise.name}</h2></div><span className="ml-auto rounded-full bg-green-100 px-3 py-1 text-xs font-semibold capitalize text-green-800">{data.franchise.status}</span></div>
                <dl className="grid gap-4 sm:grid-cols-2"><Info label="Franchise ID" value={data.franchise.id} /><Info label="Email" value={data.franchise.email} /><Info label="Phone" value={data.franchise.phone} /><Info label="Head office address" value={data.franchise.address} /></dl>
              </section>
            ) : <section className="mb-5 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm"><p className="text-sm text-gray-600">Your account is assigned to a location. Franchise account information has not been assigned to this manager.</p></section>}

            <section className="mb-5 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green-soft)] p-2 text-[var(--oppa-green)]"><Store size={18} /></span><div><h2 className="font-semibold">Your assigned location</h2><p className="text-xs text-gray-500">Operational access remains limited to this assigned location.</p></div></div>
              {data.assigned_location ? <LocationCard location={data.assigned_location} assigned /> : <p className="text-sm text-gray-500">No location is assigned to your account.</p>}
            </section>

            <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div className="mb-4"><h2 className="font-semibold">Authorized franchise locations</h2><p className="text-xs text-gray-500">{data.locations.length} location{data.locations.length === 1 ? '' : 's'} are associated with your franchise account.</p></div>
              {data.locations.length ? <div className="grid gap-3 md:grid-cols-2">{data.locations.map((location) => <LocationCard key={location.id} location={location} assigned={location.id === data.assigned_location?.id} />)}</div> : <p className="rounded-xl bg-[var(--oppa-cream)] p-5 text-center text-sm text-gray-500">No franchise locations are associated with your account.</p>}
            </section>
          </>
        )}
      </div>
    </main>
  );
};

const LocationCard: React.FC<{ location: ManagementLocation; assigned: boolean }> = ({ location, assigned }) => (
  <article className="rounded-xl bg-[var(--oppa-cream)] p-4">
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><MapPin size={16} className="shrink-0 text-[var(--oppa-green)]" /><div className="min-w-0"><h3 className="truncate font-medium">{location.name}</h3><p className="text-xs text-gray-500">{location.id}</p></div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${location.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{assigned ? 'Assigned' : location.status}</span></div>
    <p className="mt-3 text-sm text-gray-600">{location.address || 'Address not provided'}</p>
    <p className="mt-1 text-xs text-gray-500">{location.email || 'No email'}{location.phone ? ` · ${location.phone}` : ''}</p>
  </article>
);

const Info: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => <div><dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-900">{value || 'Not provided'}</dd></div>;

export default FranchiseManagementPage;

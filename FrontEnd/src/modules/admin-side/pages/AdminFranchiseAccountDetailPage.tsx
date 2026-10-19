import React, { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, Building2, Loader2, MapPin, Plus, Save, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import {
  createAccountFranchiseManager,
  createFranchiseLocation,
  getFranchiseAccountOverview,
  updateFranchiseAccount,
} from '../../../services/franchiseAdminService';
import type { FranchiseAccountOverview } from '../../../services/franchiseAdminService';
import { updateFranchise } from '../../../services/franchiseAdminService';
import { formatCurrency } from '../../../utils/formatters';
import { geocodeAddress } from '../../../services/geocodingService';
import { useToast } from '../../customer-side/components/ToastProvider';
import LocationPicker from '../../customer-side/components/common/LocationPicker';

const AdminFranchiseAccountDetailPage: React.FC = () => {
  const { id = '' } = useParams();
  const { showToast } = useToast();
  const [overview, setOverview] = useState<FranchiseAccountOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showLocation, setShowLocation] = useState(false);
  const [showLocationPinPicker, setShowLocationPinPicker] = useState(false);
  const [newLocationAddress, setNewLocationAddress] = useState('');
  const [newLocationCoordinates, setNewLocationCoordinates] = useState({ latitude: '', longitude: '' });
  const [backfillingCoordinates, setBackfillingCoordinates] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState('');
  const [showManager, setShowManager] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOverview(await getFranchiseAccountOverview(id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load franchise details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const saveAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateFranchiseAccount(id, {
        name: String(form.get('name') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        address: String(form.get('address') || ''),
        status: String(form.get('status') || 'active'),
      });
      setNotice('Franchise information saved.');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save franchise information.');
    } finally {
      setSaving(false);
    }
  };

  const addLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    let latitude = newLocationCoordinates.latitude ? Number(newLocationCoordinates.latitude) : null;
    let longitude = newLocationCoordinates.longitude ? Number(newLocationCoordinates.longitude) : null;
    setSaving(true);
    setError('');
    try {
      if (latitude === null || longitude === null) {
        const address = newLocationAddress.trim();
        if (!address) {
          throw new Error('Enter the branch address so we can find its location.');
        }

        const coordinates = await geocodeAddress(address);
        if (!coordinates || !Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)
          || coordinates.lat < 4 || coordinates.lat > 22 || coordinates.lng < 116 || coordinates.lng > 127) {
          throw new Error('We could not find this branch address in the Philippines. Pin the exact location or enter latitude and longitude manually before saving.');
        }

        latitude = coordinates.lat;
        longitude = coordinates.lng;
      }

      await createFranchiseLocation(id, {
        name: String(form.get('name') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        address: newLocationAddress,
        status: String(form.get('status') || 'active'),
        latitude,
        longitude,
        is_active: form.get('is_active') === 'on',
        delivery_radius_km: form.get('delivery_radius_km') ? Number(form.get('delivery_radius_km')) : null,
      });
      setShowLocation(false);
      setNewLocationAddress('');
      setNewLocationCoordinates({ latitude: '', longitude: '' });
      setNotice('Franchise location added.');
      await load();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Could not add location.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addManager = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      await createAccountFranchiseManager(id, {
        franchise_id: String(form.get('franchise_id') || ''),
        full_name: String(form.get('full_name') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        password: String(form.get('password') || ''),
        can_process_pos: form.get('can_process_pos') === 'on',
      });
      setShowManager(false);
      setNotice('Franchise manager account created and assigned to the selected location.');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create franchise manager.');
    } finally {
      setSaving(false);
    }
  };

  const geocodeMissingAccountLocations = async () => {
    const missingLocations = (overview?.locations || []).filter((location) =>
      location.latitude == null || location.longitude == null
    );
    if (!missingLocations.length) {
      setNotice('All franchise locations already have coordinates.');
      return;
    }

    setBackfillingCoordinates(true);
    setBackfillProgress('');
    setError('');
    setNotice('');
    const failedLocations: string[] = [];
    let savedCount = 0;
    try {
      for (const [index, location] of missingLocations.entries()) {
        setBackfillProgress(`Geocoding ${index + 1} of ${missingLocations.length}: ${location.name}`);
        if (!location.address?.trim()) {
          failedLocations.push(`${location.name} (missing address)`);
          continue;
        }
        const coordinates = await geocodeAddress(location.address);
        if (!coordinates) {
          failedLocations.push(`${location.name} (address not located)`);
          continue;
        }
        try {
          await updateFranchise(location.id, {
            latitude: coordinates.lat,
            longitude: coordinates.lng,
          });
          savedCount += 1;
        } catch (updateError) {
          failedLocations.push(`${location.name} (${updateError instanceof Error ? updateError.message : 'save failed'})`);
        }
      }
      await load();
      if (failedLocations.length) {
        const message = `Saved coordinates for ${savedCount} location(s). Could not update: ${failedLocations.join('; ')}.`;
        setError(message);
        showToast(message, 'error');
      } else {
        setNotice(`Saved coordinates for all ${savedCount} location(s).`);
      }
    } catch (backfillError) {
      setError(backfillError instanceof Error ? backfillError.message : 'Could not backfill franchise coordinates.');
    } finally {
      setBackfillingCoordinates(false);
      setBackfillProgress('');
    }
  };

  const toggleLocation = async (locationId: string, currentStatus: string) => {
    setSaving(true);
    setError('');
    try {
      await updateFranchise(locationId, { status: currentStatus === 'active' ? 'inactive' : 'active' });
      setNotice('Location status updated.');
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update location status.');
    } finally {
      setSaving(false);
    }
  };

  const data = overview;
  const account = data?.account;
  const locationName = (locationId?: string | null) => data?.locations.find((location) => location.id === locationId)?.name || 'Not assigned';

  return (
    <AdminLayout>
      <div className="mb-5"><Link to="/admin/franchises" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--oppa-green)] hover:underline"><ArrowLeft size={16} /> Franchise list</Link></div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
      {loading ? <div className="rounded-2xl border bg-white p-12 text-center text-sm text-gray-500"><Loader2 className="mx-auto mb-3 animate-spin" />Loading franchise details...</div> : account && data && (
        <>
          <header className="mb-5 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green-soft)] p-3 text-[var(--oppa-green)]"><Building2 size={22} /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Franchise account</p><h1 className="text-2xl font-semibold">{account.name}</h1><p className="text-sm text-gray-500">{account.id} · {account.address || 'No head office address'}</p></div></div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${account.status === 'active' ? 'bg-green-100 text-green-800' : account.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>{account.status}</span>
          </header>

          <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Locations" value={data.performance.total_locations} />
            <Metric label="Managers" value={data.performance.total_managers} />
            <Metric label="Staff" value={data.performance.total_staff} />
            <Metric label="Orders" value={data.performance.total_orders} />
            <Metric label="Sales" value={formatCurrency(data.performance.total_sales)} />
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Franchise information</h2><p className="text-xs text-gray-500">Account contact details and activation status.</p></div><Building2 size={18} className="text-[var(--oppa-green)]" /></div>
              <form onSubmit={saveAccount} className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">Franchise name<input name="name" required defaultValue={account.name} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
                <label className="text-sm font-medium">Status<select name="status" defaultValue={account.status} className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select></label>
                <label className="text-sm font-medium">Email<input name="email" type="email" defaultValue={account.email || ''} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
                <label className="text-sm font-medium">Phone<input name="phone" defaultValue={account.phone || ''} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
                <label className="text-sm font-medium sm:col-span-2">Head office address<textarea name="address" rows={2} defaultValue={account.address || ''} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>
                <button disabled={saving} className="inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Save size={15} /> Save changes</button>
              </form>
            </section>

            <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Locations / stores</h2><p className="text-xs text-gray-500">Online delivery activates automatically for active locations with valid coordinates.</p>{backfillProgress && <p role="status" className="mt-1 text-xs text-[var(--oppa-green)]">{backfillProgress}</p>}</div><div className="flex flex-wrap gap-2">{overview.locations.some((location) => location.latitude == null || location.longitude == null) && <button type="button" disabled={backfillingCoordinates || saving} onClick={() => void geocodeMissingAccountLocations()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green)] disabled:opacity-50">{backfillingCoordinates ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}{backfillingCoordinates ? 'Geocoding locations…' : 'Fill missing coordinates'}</button>}<button onClick={() => { setNewLocationAddress(''); setNewLocationCoordinates({ latitude: '', longitude: '' }); setShowLocation(true); }} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> Add location</button></div></div>
              {data.locations.length ? <div className="space-y-2">{data.locations.map((location) => {
                const hasValidCoordinates = Number(location.latitude) >= 4 && Number(location.latitude) <= 22
                  && Number(location.longitude) >= 116 && Number(location.longitude) <= 127;
                const deliveryReady = location.status === 'active'
                  && location.is_active !== false
                  && hasValidCoordinates;
                const deliveryIssue = !hasValidCoordinates
                  ? 'Delivery unavailable: add a valid map pin.'
                  : location.is_active === false
                    ? 'Location is inactive.'
                    : 'Location is inactive.';

                return <article key={location.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--oppa-cream)] p-3"><div className="min-w-0"><p className="font-medium">{location.name}</p><p className="truncate text-xs text-gray-500">{location.address || location.id} · {location.id}</p><p className={`mt-1 text-xs ${deliveryReady ? 'text-green-700' : 'text-amber-700'}`}>{deliveryReady ? 'Online delivery ready' : location.status === 'active' ? deliveryIssue : 'Location is inactive.'}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-xs capitalize">{location.status}</span><Link to={`/admin/franchises/${location.id}?tab=settings`} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium">Edit</Link><button disabled={saving} onClick={() => void toggleLocation(location.id, location.status)} className="rounded-lg border bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50">{location.status === 'active' ? 'Deactivate' : 'Activate'}</button></div></article>;
              })}</div> : <p className="rounded-xl bg-[var(--oppa-cream)] p-5 text-center text-sm text-gray-500">No locations have been added yet.</p>}
            </section>

            <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Franchise managers</h2><p className="text-xs text-gray-500">Manager access is tied to an assigned location.</p></div><button onClick={() => setShowManager(true)} disabled={!data.locations.length} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Plus size={14} /> Add manager</button></div>
              {data.managers.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-gray-500"><th className="py-2">Manager</th><th className="py-2">Location</th><th className="py-2">Status</th><th className="py-2">POS</th></tr></thead><tbody className="divide-y">{data.managers.map((manager) => <tr key={String(manager.id)}><td className="py-3"><p className="font-medium">{manager.full_name}</p><p className="text-xs text-gray-500">{manager.email}</p></td><td className="py-3">{locationName(manager.franchise_id)}</td><td className="py-3">{manager.is_active ? 'Active' : 'Inactive'}</td><td className="py-3">{manager.can_process_pos ? 'Allowed' : 'No'}</td></tr>)}</tbody></table></div> : <p className="rounded-xl bg-[var(--oppa-cream)] p-5 text-center text-sm text-gray-500">No managers assigned.</p>}
            </section>

            <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green-soft)] p-2 text-[var(--oppa-green)]"><Users size={18} /></span><div><h2 className="font-semibold">Franchise staff</h2><p className="text-xs text-gray-500">Employees and drivers across this franchise’s locations.</p></div></div>
              {data.staff.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-gray-500"><th className="py-2">Staff member</th><th className="py-2">Location</th><th className="py-2">Role</th><th className="py-2">Status</th></tr></thead><tbody className="divide-y">{data.staff.map((staff) => <tr key={`${staff.role}-${staff.id}`}><td className="py-3"><p className="font-medium">{staff.name}</p><p className="text-xs text-gray-500">{staff.email}</p></td><td className="py-3">{locationName(staff.franchise_id)}</td><td className="py-3 capitalize">{staff.role.replaceAll('_', ' ')}</td><td className="py-3">{staff.is_active ? 'Active' : 'Inactive'}</td></tr>)}</tbody></table></div> : <p className="rounded-xl bg-[var(--oppa-cream)] p-5 text-center text-sm text-gray-500">No staff assigned to these locations.</p>}
            </section>
          </div>

          <section className="mt-5 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
            <div className="mb-4"><h2 className="font-semibold">Franchise performance</h2><p className="text-xs text-gray-500">Sales include orders counted as revenue by the existing order rules.</p></div>
            <div className="mb-4 grid gap-3 sm:grid-cols-3"><Metric label="Total orders" value={data.performance.total_orders} /><Metric label="Total sales" value={formatCurrency(data.performance.total_sales)} /><Metric label="Average order value" value={formatCurrency(data.performance.average_order_value)} /></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs uppercase text-gray-500"><th className="py-2">Location</th><th className="py-2">Orders</th><th className="py-2">Sales</th><th className="py-2">Inventory records</th></tr></thead><tbody className="divide-y">{data.performance.locations.map((location) => <tr key={location.franchise_id}><td className="py-3">{location.location_name}</td><td className="py-3">{location.total_orders}</td><td className="py-3">{formatCurrency(location.total_sales)}</td><td className="py-3">{location.inventory_items}</td></tr>)}</tbody></table></div>
          </section>
        </>
      )}

      {showLocation && <Modal title="Add franchise location" onClose={() => setShowLocation(false)}><form onSubmit={addLocation} className="space-y-3"><label className="block text-sm font-medium">Location name<input required name="name" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Email<input name="email" type="email" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="text-sm font-medium">Phone<input name="phone" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label></div><label className="block text-sm font-medium">Address<textarea name="address" value={newLocationAddress} onChange={(event) => setNewLocationAddress(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>{error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}<div className="rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Map pin</p><p className="text-xs text-gray-500">{newLocationCoordinates.latitude && newLocationCoordinates.longitude ? `${newLocationCoordinates.latitude}, ${newLocationCoordinates.longitude}` : 'We will find coordinates from the address when you save. Pin the map for a more exact location.'}</p></div><button type="button" onClick={() => setShowLocationPinPicker(true)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-[var(--oppa-green)]"><MapPin size={14} />Pin location</button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Latitude<input type="number" min="4" max="22" step="any" value={newLocationCoordinates.latitude} onChange={(event) => setNewLocationCoordinates((current) => ({ ...current, latitude: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="text-sm font-medium">Longitude<input type="number" min="116" max="127" step="any" value={newLocationCoordinates.longitude} onChange={(event) => setNewLocationCoordinates((current) => ({ ...current, longitude: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label></div></div><label className="flex items-center gap-2 text-sm"><input name="is_active" type="checkbox" defaultChecked />Active</label><p className="text-xs text-gray-500">Online delivery turns on automatically once this location is active and its coordinates are saved.</p><label className="block text-sm font-medium">Delivery radius (km, optional)<input name="delivery_radius_km" type="number" min="0" step="any" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="block text-sm font-medium">Status<select name="status" defaultValue="active" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select></label><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowLocation(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Finding location…' : 'Save'}</button></div></form>{showLocationPinPicker && <LocationPicker initialAddress={newLocationAddress} onClose={() => setShowLocationPinPicker(false)} onSelectLocation={(location) => { setNewLocationAddress(location.address); setNewLocationCoordinates({ latitude: String(location.lat), longitude: String(location.lng) }); setShowLocationPinPicker(false); }} />}</Modal>}
      {showManager && <Modal title="Add franchise manager" onClose={() => setShowManager(false)}><form onSubmit={addManager} className="space-y-3"><label className="block text-sm font-medium">Assigned location<select required name="franchise_id" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">{data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="block text-sm font-medium">Full name<input required name="full_name" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Email<input required name="email" type="email" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="text-sm font-medium">Phone<input name="phone" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label></div><label className="block text-sm font-medium">Initial password<input required name="password" type="password" minLength={8} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="flex items-center gap-2 text-sm"><input name="can_process_pos" type="checkbox" /> Allow this manager to use POS</label><ModalActions saving={saving} onCancel={() => setShowManager(false)} /></form></Modal>}
    </AdminLayout>
  );
};

const Metric: React.FC<{ label: string; value: string | number }> = ({ label, value }) => <div className="rounded-xl bg-[var(--oppa-cream)] p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg border px-3 py-1 text-sm">Close</button></div>{children}</section></div>;
const ModalActions: React.FC<{ saving: boolean; onCancel: () => void }> = ({ saving, onCancel }) => <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button></div>;

export default AdminFranchiseAccountDetailPage;

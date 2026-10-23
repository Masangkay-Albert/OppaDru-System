import React, { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, Building2, Check, Copy, Download, Loader2, MapPin, Plus, Save, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import {
  createAccountFranchiseManager,
  createFranchiseLocation,
  getFranchiseAccountOverview,
  updateFranchiseAccount,
} from '../../../services/franchiseAdminService';
import type { FranchiseAccountDetailedReport, FranchiseAccountOverview } from '../../../services/franchiseAdminService';
import { updateFranchise } from '../../../services/franchiseAdminService';
import { geocodeAddress } from '../../../services/geocodingService';
import { useToast } from '../../customer-side/components/ToastProvider';
import LocationPicker from '../../customer-side/components/common/LocationPicker';
import FranchiseAccountReportSection from './FranchiseAccountReport';
import '../styles/franchise-account-detail.css';

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
  const [accountFormDirty, setAccountFormDirty] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [locationStats, setLocationStats] = useState<FranchiseAccountDetailedReport['sales_by_location']>([]);

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
      showToast('Franchise information saved.', 'success');
      setAccountFormDirty(false);
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
      const activeDelivery = form.get('is_active') === 'on'
        && form.get('status') === 'active'
        && form.get('delivery_enabled') === 'on';
      const deliveryRadius = form.get('delivery_radius_km');
      if (activeDelivery && deliveryRadius && (!Number.isFinite(Number(deliveryRadius))
        || Number(deliveryRadius) <= 0 || Number(deliveryRadius) > 100)) {
        throw new Error('Enter a delivery radius greater than zero and no more than 100 km.');
      }
      if (latitude === null || longitude === null) {
        const address = newLocationAddress.trim();
        if (!address) {
          throw new Error('Enter the branch address so we can find its location.');
        }

        const coordinates = await geocodeAddress(address);
        if (!coordinates || coordinates.isBroad || !Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)
          || coordinates.lat < 4 || coordinates.lat > 22 || coordinates.lng < 116 || coordinates.lng > 127) {
          throw new Error('This address only identifies a broad area or could not be located. Pin the exact branch location before saving.');
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
        accepts_online_orders: form.get('accepts_online_orders') === 'on',
        delivery_enabled: form.get('delivery_enabled') === 'on',
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

  const toggleAccountStatus = async () => {
    if (!account) return;
    const nextStatus = account.status === 'active' ? 'inactive' : 'active';
    if (nextStatus === 'inactive' && !window.confirm(`Deactivate ${account.name}? Existing records are retained.`)) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateFranchiseAccount(id, { status: nextStatus });
      setNotice(`Franchise ${nextStatus === 'active' ? 'activated' : 'deactivated'}.`);
      await load();
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : 'Could not update franchise status.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1500);
      showToast(`${label} copied.`, 'success');
    } catch {
      showToast(`Could not copy ${label.toLowerCase()}.`, 'error');
    }
  };

  const onReportData = useCallback((report: FranchiseAccountDetailedReport) => {
    setLocationStats(report.sales_by_location);
  }, []);

  const data = overview;
  const account = data?.account;
  const locationName = (locationId?: string | null) => data?.locations.find((location) => location.id === locationId)?.name || 'Not assigned';

  return (
    <AdminLayout>
      <div className="franchise-account-page min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-[var(--oppa-text-muted)]"><Link to="/admin/franchises" className="font-semibold text-[var(--oppa-green)]">Franchises</Link> / {account?.name || 'Franchise detail'}</p><Link to="/admin/franchises" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--oppa-green)] hover:underline"><ArrowLeft size={16} /> Franchise list</Link></div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
      {loading ? <div className="franchise-account-card p-12 text-center text-sm text-gray-500"><Loader2 className="mx-auto mb-3 animate-spin" />Loading franchise details...</div> : account && data && (
        <>
          <header className="franchise-account-hero mb-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-sm">
            <div className="flex min-w-0 items-center gap-4"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]"><Building2 size={24} /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">Franchise account</p><h1 className="franchise-account-heading truncate text-2xl font-bold text-[var(--oppa-text)]">{account.name}</h1><p className="flex flex-wrap items-center gap-1 text-xs text-[var(--oppa-text-muted)]"><span>Code: {account.id}</span><button type="button" aria-label="Copy franchise code" onClick={() => void copyCode(account.id, 'Franchise code')} className="inline-flex min-h-8 items-center gap-1 rounded px-2 text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]">{copiedCode ? <Check size={13} /> : <Copy size={13} />}</button><span>· {account.address || 'No head office address'}</span></p><p className="text-xs text-[var(--oppa-text-muted)]">Date created: {account.created_at ? new Date(account.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }) : '—'}</p></div></div>
            <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${account.status === 'active' ? 'bg-green-100 text-green-800' : account.status === 'inactive' ? 'bg-gray-100 text-gray-700' : 'bg-amber-100 text-amber-900'}`}>{account.status}</span><button type="button" onClick={() => document.getElementById('franchise-information')?.scrollIntoView({ behavior: 'smooth' })} className="franchise-secondary-button">Edit</button><button type="button" onClick={() => void toggleAccountStatus()} className="franchise-secondary-button">{account.status === 'active' ? 'Deactivate' : 'Activate'}</button><button type="button" onClick={() => document.getElementById('franchise-report-export')?.click()} className="franchise-action-button"><Download size={15} /> Export Report</button></div>
          </header>
          <nav className="franchise-account-nav mb-4" aria-label="Franchise detail sections"><a href="#franchise-overview">Overview</a><a href="#franchise-report">Report</a><a href="#franchise-locations">Locations</a><a href="#franchise-team">Team</a></nav>
          <div id="franchise-overview" className="scroll-mt-32"><FranchiseAccountReportSection accountId={id} locations={data.locations.map((location) => ({ id: location.id, name: location.name }))} managers={data.performance.total_managers} staff={data.performance.total_staff} allOrders={data.performance.total_orders} allSales={data.performance.total_sales} onData={onReportData} /></div>

          <div className="mt-6 grid items-stretch gap-5 xl:grid-cols-2">
            <section id="franchise-information" className="franchise-account-card flex h-full scroll-mt-32 flex-col">
              <div className="mb-4 flex items-center justify-between"><div><h2 className="font-serif text-lg font-semibold">Franchise information</h2><p className="text-xs text-[var(--oppa-text-muted)]">Account contact details and activation status.</p></div><Building2 size={18} className="text-[var(--oppa-green)]" /></div>
              <form key={`${account.id}:${account.name}:${account.email}:${account.phone}:${account.address}:${account.status}`} onInput={() => setAccountFormDirty(true)} onSubmit={saveAccount} className="grid flex-1 content-start gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">Franchise name<input name="name" required defaultValue={account.name} className="admin-embedded-input mt-1.5 w-full font-normal" /></label>
                <label className="text-xs font-semibold">Status<select name="status" defaultValue={account.status} onChange={() => setAccountFormDirty(true)} className="admin-embedded-input mt-1.5 w-full bg-[var(--oppa-surface)] font-normal"><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select></label>
                <label className="text-xs font-semibold">Email<span className="relative mt-1.5 block"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]">@</span><input name="email" type="email" defaultValue={account.email || ''} className="admin-embedded-input w-full pl-9 font-normal" /></span><small className="mt-1 block font-normal text-[var(--oppa-text-muted)]">Used for franchise correspondence.</small></label>
                <label className="text-xs font-semibold">Phone<span className="relative mt-1.5 block"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]">☎</span><input name="phone" defaultValue={account.phone || ''} className="admin-embedded-input w-full pl-9 font-normal" /></span><small className="mt-1 block font-normal text-[var(--oppa-text-muted)]">Include the area code.</small></label>
                <label className="text-xs font-semibold sm:col-span-2">Head office address<span className="relative mt-1.5 block"><MapPin size={15} className="absolute left-3 top-3 text-[var(--oppa-text-muted)]" /><textarea name="address" rows={2} defaultValue={account.address || ''} className="admin-embedded-input w-full pl-9 font-normal" /></span></label>
                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--oppa-border)] pt-4 sm:col-span-2"><small className="text-[var(--oppa-text-muted)]">Changes apply to this franchise account only.</small><button disabled={saving || !accountFormDirty} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"><Save size={15} /> Save changes</button></div>
              </form>
            </section>

            <section id="franchise-locations" className="franchise-account-card h-full scroll-mt-32">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-serif text-lg font-semibold">Locations / stores</h2><p className="text-xs text-[var(--oppa-text-muted)]">Online delivery activates automatically for active locations with valid coordinates.</p>{backfillProgress && <p role="status" className="mt-1 text-xs text-[var(--oppa-green)]">{backfillProgress}</p>}</div><div className="flex flex-wrap gap-2">{overview.locations.some((location) => location.latitude == null || location.longitude == null) && <button type="button" disabled={backfillingCoordinates || saving} onClick={() => void geocodeMissingAccountLocations()} className="franchise-secondary-button">{backfillingCoordinates ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}{backfillingCoordinates ? 'Geocoding…' : 'Fill missing coordinates'}</button>}<button onClick={() => { setNewLocationAddress(''); setNewLocationCoordinates({ latitude: '', longitude: '' }); setShowLocation(true); }} className="franchise-action-button"><Plus size={14} /> Add location</button></div></div>
              {data.locations.length ? <div className="space-y-2">{data.locations.map((location) => {
                const hasValidCoordinates = Number(location.latitude) >= 4 && Number(location.latitude) <= 22
                  && Number(location.longitude) >= 116 && Number(location.longitude) <= 127;
                const deliveryReady = location.status === 'active'
                  && location.is_active !== false
                  && hasValidCoordinates;
                const stats = locationStats.find((item) => item.location_id === location.id);

                return <article key={location.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/50 p-3"><div className="flex min-w-0 items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]"><Building2 size={17} /></span><div className="min-w-0"><p className="font-medium">{location.name}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{location.address || 'Address not set'}</p><div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[var(--oppa-text-muted)]"><span>{location.id}</span><button type="button" aria-label={`Copy ${location.name} code`} onClick={() => void copyCode(location.id, 'Location code')} className="rounded p-1 text-[var(--oppa-green)]"><Copy size={12} /></button><span className={deliveryReady ? 'text-green-700' : 'text-amber-700'}>{deliveryReady ? 'Online delivery ready' : 'Delivery unavailable: check location status and map pin.'}</span></div><p className="mt-1 text-[10px] text-[var(--oppa-text-muted)]">{stats ? `${stats.orders} orders · ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(stats.sales)}` : 'Sales stats load from the report.'}</p></div></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs ${location.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{location.status}</span><Link to={`/admin/franchises/${location.id}?tab=settings`} className="franchise-secondary-button">Edit</Link><button disabled={saving} onClick={() => void toggleLocation(location.id, location.status)} className="franchise-secondary-button disabled:opacity-50">{location.status === 'active' ? 'Deactivate' : 'Activate'}</button></div></article>;
              })}</div> : <p className="rounded-xl bg-[var(--oppa-cream)] p-5 text-center text-sm text-gray-500">No locations have been added yet.</p>}
            </section>

            <section id="franchise-team" className="franchise-account-card h-full scroll-mt-32">
              <div className="mb-4 flex items-center justify-between gap-2"><div><h2 className="font-serif text-lg font-semibold">Franchise managers</h2><p className="text-xs text-[var(--oppa-text-muted)]">Manager access is tied to an assigned location.</p></div><button onClick={() => setShowManager(true)} disabled={!data.locations.length} className="franchise-action-button disabled:opacity-50"><Plus size={14} /> Add manager</button></div>
              {data.managers.length ? <><div className="franchise-soft-table-wrap overflow-x-auto"><table className="franchise-soft-table"><thead><tr><th>Manager</th><th>Location</th><th>Status</th><th>POS</th></tr></thead><tbody>{data.managers.map((manager) => <tr key={String(manager.id)}><td><div className="flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-900">{manager.full_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong className="block">{manager.full_name}</strong><small className="text-[var(--oppa-text-muted)]">{manager.email}</small></span></div></td><td>{locationName(manager.franchise_id)}</td><td><span className={`rounded-full px-2 py-1 text-xs ${manager.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{manager.is_active ? 'Active' : 'Inactive'}</span></td><td><span className="rounded-full bg-[var(--oppa-cream)] px-2 py-1 text-xs">{manager.can_process_pos ? 'Yes' : 'No'}</span></td></tr>)}</tbody></table></div><div className="franchise-mobile-row">{data.managers.map((manager) => <article key={`mobile-${manager.id}`} className="rounded-xl border border-[var(--oppa-border)] p-3"><strong>{manager.full_name}</strong><p className="text-xs text-[var(--oppa-text-muted)]">{manager.email}</p><p className="mt-2 text-xs">{locationName(manager.franchise_id)} · POS {manager.can_process_pos ? 'Yes' : 'No'}</p></article>)}</div></> : <p className="rounded-xl bg-[var(--oppa-cream)] p-5 text-center text-sm text-[var(--oppa-text-muted)]">No managers assigned. Add a manager to provide franchise access.</p>}
            </section>

            <section className="franchise-account-card h-full">
              <div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]"><Users size={18} /></span><div><h2 className="font-serif text-lg font-semibold">Franchise staff</h2><p className="text-xs text-[var(--oppa-text-muted)]">Employees and drivers across franchise locations.</p></div></div>
              <div className="mb-4 flex flex-wrap gap-2">{(['cashier', 'kitchen_staff', 'driver'] as const).map((role) => { const count = data.staff.filter((person) => person.role.toLowerCase().replaceAll(' ', '_') === role).length; return <span key={role} className="rounded-full bg-[var(--oppa-cream)] px-2.5 py-1 text-[10px]">{count} {role === 'kitchen_staff' ? 'Kitchen' : role[0].toUpperCase() + role.slice(1)}</span>; })}</div>
              {data.staff.length ? <><div className="franchise-soft-table-wrap overflow-x-auto"><table className="franchise-soft-table"><thead><tr><th>Staff member</th><th>Location</th><th>Role</th><th>Status</th></tr></thead><tbody>{data.staff.map((person) => { const role = person.role.replaceAll('_', ' '); const tone = role.toLowerCase().includes('cashier') ? 'bg-green-100 text-green-800' : role.toLowerCase().includes('driver') ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'; return <tr key={`${person.role}-${person.id}`}><td><div className="flex items-center gap-2"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--oppa-green-soft)] text-xs font-bold text-[var(--oppa-green)]">{person.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><span><strong className="block">{person.name}</strong><small className="text-[var(--oppa-text-muted)]">{person.email}</small></span></div></td><td>{locationName(person.franchise_id)}</td><td><span className={`rounded-full px-2 py-1 text-xs capitalize ${tone}`}>{role}</span></td><td><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs ${person.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}><i className={`h-1.5 w-1.5 rounded-full ${person.is_active ? 'bg-green-600' : 'bg-gray-500'}`} />{person.is_active ? 'Active' : 'Inactive'}</span></td></tr>; })}</tbody></table></div><div className="franchise-mobile-row">{data.staff.map((person) => <article key={`mobile-${person.id}`} className="rounded-xl border border-[var(--oppa-border)] p-3"><strong>{person.name}</strong><p className="text-xs text-[var(--oppa-text-muted)]">{person.email}</p><p className="mt-2 text-xs capitalize">{locationName(person.franchise_id)} · {person.role.replaceAll('_', ' ')} · {person.is_active ? 'Active' : 'Inactive'}</p></article>)}</div></> : <p className="rounded-xl bg-[var(--oppa-cream)] p-5 text-center text-sm text-[var(--oppa-text-muted)]">No staff assigned to these locations yet.</p>}
            </section>
          </div>

        </>
      )}

      {showLocation && <Modal title="Add franchise location" onClose={() => setShowLocation(false)}><form onSubmit={addLocation} className="space-y-3"><label className="block text-sm font-medium">Location name<input required name="name" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Email<input name="email" type="email" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="text-sm font-medium">Phone<input name="phone" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label></div><label className="block text-sm font-medium">Address<textarea name="address" value={newLocationAddress} onChange={(event) => { setNewLocationAddress(event.target.value); setNewLocationCoordinates({ latitude: '', longitude: '' }); }} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label>{error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p>}<div className="rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Map pin</p><p className="text-xs text-gray-500">{newLocationCoordinates.latitude && newLocationCoordinates.longitude ? `${newLocationCoordinates.latitude}, ${newLocationCoordinates.longitude}` : 'Pin the exact branch entrance or provide a specific street address.'}</p></div><button type="button" onClick={() => setShowLocationPinPicker(true)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold text-[var(--oppa-green)]"><MapPin size={14} />Pin location</button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Latitude<input type="number" min="4" max="22" step="any" value={newLocationCoordinates.latitude} onChange={(event) => setNewLocationCoordinates((current) => ({ ...current, latitude: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="text-sm font-medium">Longitude<input type="number" min="116" max="127" step="any" value={newLocationCoordinates.longitude} onChange={(event) => setNewLocationCoordinates((current) => ({ ...current, longitude: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label></div></div><label className="flex items-center gap-2 text-sm"><input name="is_active" type="checkbox" defaultChecked />Active</label><label className="flex items-center gap-2 text-sm"><input name="accepts_online_orders" type="checkbox" defaultChecked />Accept online orders</label><label className="flex items-center gap-2 text-sm"><input name="delivery_enabled" type="checkbox" defaultChecked />Enable delivery</label><label className="block text-sm font-medium">Delivery radius (km)<input name="delivery_radius_km" type="number" min="0.1" max="100" step="any" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="block text-sm font-medium">Status<select name="status" defaultValue="active" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal"><option value="active">Active</option><option value="pending">Pending</option><option value="inactive">Inactive</option></select></label><div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowLocation(false)} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Finding location…' : 'Save'}</button></div></form>{showLocationPinPicker && <LocationPicker initialAddress={newLocationAddress} onClose={() => setShowLocationPinPicker(false)} onSelectLocation={(location) => { setNewLocationAddress(location.address); setNewLocationCoordinates({ latitude: String(location.lat), longitude: String(location.lng) }); setShowLocationPinPicker(false); }} />}</Modal>}
      {showManager && <Modal title="Add franchise manager" onClose={() => setShowManager(false)}><form onSubmit={addManager} className="space-y-3"><label className="block text-sm font-medium">Assigned location<select required name="franchise_id" className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 font-normal">{data?.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label className="block text-sm font-medium">Full name<input required name="full_name" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Email<input required name="email" type="email" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="text-sm font-medium">Phone<input name="phone" className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label></div><label className="block text-sm font-medium">Initial password<input required name="password" type="password" minLength={8} className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal" /></label><label className="flex items-center gap-2 text-sm"><input name="can_process_pos" type="checkbox" /> Allow this manager to use POS</label><ModalActions saving={saving} onCancel={() => setShowManager(false)} /></form></Modal>}
      </div>
    </AdminLayout>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><button type="button" onClick={onClose} className="rounded-lg border px-3 py-1 text-sm">Close</button></div>{children}</section></div>;
const ModalActions: React.FC<{ saving: boolean; onCancel: () => void }> = ({ saving, onCancel }) => <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2 text-sm">Cancel</button><button disabled={saving} className="rounded-xl bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button></div>;

export default AdminFranchiseAccountDetailPage;

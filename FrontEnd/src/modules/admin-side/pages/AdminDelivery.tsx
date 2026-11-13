import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, Car, Mail, Phone, Plus, Trash2, X } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { AvailabilitySwitch, ConfirmDialog, EmptyState, PageHeader, StatusBadge, Toast } from '../components/AdminUI';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithAdminAuth } from '../../../services/adminAuthService';
import Select from '../../../components/ui/Select';
import SearchInput from '../../../components/ui/SearchInput';
import { ValidatedForm } from '../../../components/ui/FormValidation';

export interface DeliveryPartner {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  isActive: boolean;
}

const displayName = (name: string) => name.trim().toLocaleLowerCase().replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase());
const avatarColor = (name: string) => {
  const colors = ['bg-emerald-700', 'bg-sky-700', 'bg-violet-700', 'bg-amber-700', 'bg-rose-700'];
  const hash = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default function AdminDelivery() {
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', vehicleType: '' });
  const [formError, setFormError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/drivers`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Unable to load delivery partners (${res.status}).`);
      const data = await res.json();
      setPartners(Array.isArray(data) ? data : []);
      setError('');
    } catch (fetchError) {
      console.error('Failed to fetch drivers:', fetchError);
      setError('Delivery partners could not be loaded. Please refresh and try again.');
    } finally {
      setLoadingPartners(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const filteredPartners = useMemo(() => partners.filter((partner) => {
    const matchesQuery = `${partner.name} ${partner.email} ${partner.phone}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? partner.isActive : !partner.isActive);
    return matchesQuery && matchesStatus;
  }), [partners, query, statusFilter]);
  const activeCount = partners.filter((partner) => partner.isActive).length;
  const inactiveCount = partners.length - activeCount;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanedName = form.name.trim();
    if (cleanedName.length < 2) {
      setFormError('Enter the partner’s full name.');
      return;
    }
    if (!/^(09\d{9}|\+639\d{9})$/.test(form.phone)) {
      setFormError('Use a valid PH mobile number: 09XXXXXXXXX or +639XXXXXXXXX.');
      return;
    }
    setIsLoading(true);
    setFormError('');
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...form, name: cleanedName, phone: form.phone.replace(/^\+63/, '0'), isActive: true }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        setFormError(errorData.message || 'Failed to add partner. Please check the details and retry.');
        return;
      }
      const createdPartner: DeliveryPartner = await res.json();
      setPartners((current) => [
        createdPartner,
        ...current.filter((partner) => partner.id !== createdPartner.id),
      ]);
      setForm({ name: '', email: '', password: '', phone: '', vehicleType: '' });
      setShowForm(false);
      setFeedback(`${displayName(cleanedName)} added as a delivery partner.`);
      void refresh();
    } catch (requestError) {
      console.error('Add driver error:', requestError);
      setFormError('The partner could not be added. Check your connection and retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (partner: DeliveryPartner) => {
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/drivers/${partner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ isActive: !partner.isActive }),
      });
      if (!res.ok) throw new Error(`Unable to update partner status (${res.status}).`);
      setFeedback(`${displayName(partner.name)} is now ${partner.isActive ? 'inactive' : 'active'}.`);
      await refresh();
    } catch (toggleError) {
      console.error('Toggle error:', toggleError);
      setError('Partner status could not be updated. Please try again.');
    }
  };

  const confirmDeletePartner = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/drivers/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Unable to remove partner (${res.status}).`);
      setFeedback(`${displayName(deleteTarget.name)} was removed.`);
      await refresh();
    } catch (deleteError) {
      console.error('Delete error:', deleteError);
      setError('Partner could not be removed. Please try again.');
    } finally {
      setDeleteTarget(null);
      setIsDeleting(false);
    }
  };

  const renderPartner = (partner: DeliveryPartner, compact = false) => {
    const VehicleIcon = /bike|motorcycle/i.test(partner.vehicleType) ? Bike : Car;
    return (
      <article key={partner.id} className={`admin-card p-4 sm:p-5 ${compact ? '' : 'grid grid-cols-[minmax(220px,1.2fr)_minmax(250px,1.5fr)_minmax(130px,.7fr)_minmax(150px,.7fr)] items-center gap-4 rounded-none border-0 border-b border-b-[var(--oppa-border)] p-4 shadow-none last:border-0 hover:translate-y-0 hover:shadow-none'}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white ${avatarColor(partner.name)}`}>{displayName(partner.name).charAt(0) || 'D'}</div>
          <div className="min-w-0"><p title={displayName(partner.name)} className="truncate font-semibold text-[var(--oppa-text)]">{displayName(partner.name)}</p><p className="mt-1 flex items-center gap-1.5 text-xs capitalize text-[var(--oppa-text-muted)]"><VehicleIcon size={14} aria-hidden="true" />{partner.vehicleType || 'Vehicle not specified'}</p></div>
        </div>
        <div className="min-w-0 space-y-2 text-sm">
          <a href={`mailto:${partner.email}`} title={`Email ${displayName(partner.name)}`} className="flex min-w-0 items-center gap-2 text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green-dark)]"><Mail size={15} className="shrink-0" /><span className="truncate">{partner.email}</span></a>
          <a href={`tel:${partner.phone}`} title={`Call ${displayName(partner.name)}`} className="flex items-center gap-2 text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green-dark)]"><Phone size={15} className="shrink-0" />{partner.phone}</a>
        </div>
        <div className="flex items-center">
          <StatusBadge status={partner.isActive ? 'active' : 'inactive'} />
        </div>
        <div className="flex items-center justify-end gap-3">
          <AvailabilitySwitch
            checked={partner.isActive}
            label={`${partner.isActive ? 'Deactivate' : 'Activate'} ${displayName(partner.name)}`}
            activeText="Active"
            inactiveText="Inactive"
            onChange={() => void handleToggle(partner)}
          />
          <button
            type="button"
            aria-label={`Remove ${displayName(partner.name)}`}
            title={`Remove ${displayName(partner.name)}`}
            onClick={() => setDeleteTarget({ id: partner.id, name: displayName(partner.name) })}
            className="inline-flex size-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </article>
    );
  };

  return (
    <AdminLayout>
      <PageHeader title="Delivery Partners" subtitle="Manage your delivery fleet and riders." actions={<button onClick={() => { setShowForm(true); setFormError(''); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--oppa-green-dark)]"><Plus size={17} />Add Partner</button>} />

      <section aria-label="Partner summary" className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[['Total riders', partners.length, 'text-[var(--oppa-text)]'], ['Active', activeCount, 'text-emerald-700'], ['Inactive', inactiveCount, 'text-[var(--oppa-text-muted)]']].map(([label, value, color]) => <div key={String(label)} className="admin-card flex items-center justify-between p-4"><span className="text-sm font-medium text-[var(--oppa-text-muted)]">{label}</span><strong className={`tabular-nums text-2xl ${color}`}>{value}</strong></div>)}
      </section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <SearchInput aria-label="Search delivery partners" value={query} onChange={setQuery} placeholder="Search name, email, or phone…" wrapperClassName="min-w-0 flex-1" />
        <Select label="Status" aria-label="Filter partners by status" value={statusFilter} onChange={(value) => setStatusFilter(value as typeof statusFilter)} options={[{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} className="w-full sm:w-44" />
      </div>
      {error && <div role="alert" className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}<button aria-label="Dismiss message" onClick={() => setError('')} className="ml-3 rounded p-1 hover:bg-black/5"><X size={15} /></button></div>}
      {feedback && <Toast message={feedback} onDismiss={() => setFeedback('')} />}

      {loadingPartners ? <div role="status" aria-busy="true" aria-label="Loading partners" className="min-h-48" /> :
        partners.length === 0 ? <div className="admin-card"><EmptyState title="No delivery partners yet" description="Add your first rider to start managing deliveries." action={<button onClick={() => setShowForm(true)} className="mt-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white">Add Partner</button>} /></div> :
          filteredPartners.length === 0 ? <div className="admin-card"><EmptyState title="No partners match these filters" description="Try another search or show all statuses." action={<button onClick={() => { setQuery(''); setStatusFilter('all'); }} className="mt-2 rounded-lg border border-[var(--oppa-border)] px-4 py-2 text-sm font-medium text-[var(--oppa-text)]">Clear filters</button>} /></div> :
            <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-[var(--shadow-card)]">
              <div className="hidden grid-cols-[minmax(220px,1.2fr)_minmax(250px,1.5fr)_minmax(130px,.7fr)_minmax(150px,.7fr)] items-center gap-4 border-b border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/60 px-5 py-3 text-xs font-bold uppercase tracking-wider text-[var(--oppa-text-muted)] md:grid"><span>Partner</span><span>Contact</span><span>Status</span><span className="text-right">Actions</span></div>
              <div className="hidden md:block">{filteredPartners.map((partner) => renderPartner(partner))}</div>
              <div className="grid gap-3 p-3 md:hidden">{filteredPartners.map((partner) => renderPartner(partner, true))}</div>
            </section>}

      {deleteTarget && <ConfirmDialog title={`Remove ${deleteTarget.name}?`} description="This will permanently remove this delivery partner." busy={isDeleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDeletePartner()} />}
      {showForm && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !isLoading) setShowForm(false); }}>
        <ValidatedForm role="dialog" aria-modal="true" onKeyDown={(event) => { if (event.key === 'Escape' && !isLoading) setShowForm(false); }} onSubmit={(event) => void handleSubmit(event)} aria-labelledby="partner-form-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-6 shadow-2xl sm:p-8">
          <div className="mb-6 flex items-start justify-between"><div><h2 id="partner-form-title" className="font-serif text-2xl font-bold text-[var(--oppa-text)]">Add delivery partner</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Enter the rider’s contact and vehicle details.</p></div><button type="button" aria-label="Close form" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]"><X size={18} /></button></div>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-[var(--oppa-text)]">Full name<input type="text" autoComplete="name" data-required="true" data-min-length={2} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]" /></label>
            <label className="block text-sm font-medium text-[var(--oppa-text)]">Email<input type="email" autoComplete="email" data-required="true" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]" /></label>
            <label className="block text-sm font-medium text-[var(--oppa-text)]">Password<input type="password" autoComplete="new-password" data-min-length={6} data-required="true" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="mt-1.5 h-11 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]" /><span className="mt-1 block text-xs text-[var(--oppa-text-muted)]">Use at least 6 characters.</span></label>
            <label className="block text-sm font-medium text-[var(--oppa-text)]">Phone number<input type="tel" inputMode="tel" autoComplete="tel" placeholder="09XXXXXXXXX" maxLength={13} data-required="true" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value.replace(/[^\d+]/g, '').slice(0, 13) })} className="mt-1.5 h-11 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]" /><span className="mt-1 block text-xs text-[var(--oppa-text-muted)]">Philippine mobile format: 09XXXXXXXXX or +639XXXXXXXXX.</span></label>
            <Select label="Vehicle type" data-required="true" value={form.vehicleType} onChange={(vehicleType) => setForm({ ...form, vehicleType })} placeholder="Select vehicle" options={[{ value: 'bike', label: 'Bike' }, { value: 'motorcycle', label: 'Motorcycle' }]} />
            {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{formError}</p>}
            <div className="flex justify-end gap-2 pt-2"><button type="button" disabled={isLoading} onClick={() => setShowForm(false)} className="rounded-lg border border-[var(--oppa-border)] px-4 py-2.5 text-sm font-medium text-[var(--oppa-text)]">Cancel</button><button type="submit" disabled={isLoading} className="rounded-lg bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:opacity-60">{isLoading ? 'Saving…' : 'Create Partner'}</button></div>
          </div>
        </ValidatedForm>
      </div>}
    </AdminLayout>
  );
}

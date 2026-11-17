import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Eye, EyeOff, Loader2, MapPin, Search, X } from 'lucide-react';
import { ValidatedForm } from '../../../components/ui/FormValidation';
import { createCompanyBranch, getCompanyBranchManagers } from '../../../services/franchiseAdminService';
import type { CompanyBranchManagerOption, FranchiseSummary } from '../../../services/franchiseAdminService';
import { geocodeAddress } from '../../../services/geocodingService';
import LocationPicker from '../../customer-side/components/common/LocationPicker';
import { INPUT_LIMITS } from '../../../constants/inputLimits';

type ManagerMode = 'existing' | 'create';
type FieldErrors = Partial<Record<'name' | 'address' | 'email' | 'manager_id' | 'manager_name' | 'manager_email' | 'manager_password', string>>;
type FieldName = keyof FieldErrors;

interface CreateCompanyBranchModalProps {
  onClose: () => void;
  onCreated: (branch: FranchiseSummary) => void;
}

const DEFAULT_DELIVERY_RADIUS_KM = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fieldClass = 'mt-1.5 h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-white px-3 text-sm text-[var(--oppa-text)] focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20';
const labelClass = 'block text-sm font-medium text-[var(--oppa-text)]';

const CreateCompanyBranchModal: React.FC<CreateCompanyBranchModalProps> = ({ onClose, onCreated }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const showLocationPickerRef = useRef(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number; locationStatus: 'manual' | 'geocoded' } | null>(null);
  const [managerMode, setManagerMode] = useState<ManagerMode>('create');
  const [managerSearch, setManagerSearch] = useState('');
  const [managerId, setManagerId] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [managers, setManagers] = useState<CompanyBranchManagerOption[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managerLoadError, setManagerLoadError] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [formError, setFormError] = useState('');
  savingRef.current = saving;
  showLocationPickerRef.current = showLocationPicker;

  useEffect(() => {
    let active = true;
    setManagersLoading(true);
    getCompanyBranchManagers()
      .then((result) => {
        if (active) setManagers(result);
      })
      .catch((error: unknown) => {
        if (active) setManagerLoadError(error instanceof Error ? error.message : 'Existing managers could not be loaded.');
      })
      .finally(() => {
        if (active) setManagersLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      modalRef.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    }, 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showLocationPickerRef.current) return;
        event.preventDefault();
        if (!savingRef.current) onClose();
        return;
      }
      if (showLocationPickerRef.current || event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!showLocationPicker) return;
    const closeLocationPicker = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowLocationPicker(false);
      }
    };
    document.addEventListener('keydown', closeLocationPicker);
    return () => document.removeEventListener('keydown', closeLocationPicker);
  }, [showLocationPicker]);

  const visibleManagers = useMemo(() => {
    const query = managerSearch.trim().toLocaleLowerCase();
    const matching = managers.filter((manager) => (
      !query || `${manager.full_name} ${manager.email} ${manager.branch_name || ''}`.toLocaleLowerCase().includes(query)
    ));
    const selected = managers.find((manager) => manager.id === managerId);
    if (selected && !matching.some((manager) => manager.id === selected.id)) {
      return [selected, ...matching];
    }
    return matching;
  }, [managerId, managerSearch, managers]);

  const clearError = (field: FieldName) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError('');
  };

  const validateFields = (): FieldErrors => {
    const validationErrors: FieldErrors = {};
    if (!name.trim()) validationErrors.name = 'Enter a branch name.';
    if (!address.trim()) validationErrors.address = 'Enter a branch address.';
    if (email.trim() && (email.trim().length > INPUT_LIMITS.email.max || !EMAIL_PATTERN.test(email.trim()))) {
      validationErrors.email = 'Enter a valid email address.';
    }
    if (managerMode === 'existing' && !managerId) {
      validationErrors.manager_id = 'Choose an existing manager.';
    }
    if (managerMode === 'create') {
      const trimmedName = managerName.trim();
      const trimmedEmail = managerEmail.trim();
      if (trimmedName.length < INPUT_LIMITS.personName.min) validationErrors.manager_name = 'Enter the manager name.';
      else if (trimmedName.length > INPUT_LIMITS.personName.max) validationErrors.manager_name = `Use no more than ${INPUT_LIMITS.personName.max} characters.`;
      if (!trimmedEmail) validationErrors.manager_email = 'Enter the manager email.';
      else if (trimmedEmail.length > INPUT_LIMITS.email.max || !EMAIL_PATTERN.test(trimmedEmail)) validationErrors.manager_email = 'Enter a valid email address.';
      if (!managerPassword) validationErrors.manager_password = 'Enter the manager password.';
      else if (managerPassword.length < INPUT_LIMITS.password.min) validationErrors.manager_password = `Use a password with at least ${INPUT_LIMITS.password.min} characters.`;
      else if (managerPassword.length > INPUT_LIMITS.password.max) validationErrors.manager_password = `Use a password with no more than ${INPUT_LIMITS.password.max} characters.`;
    }
    return validationErrors;
  };

  const fieldError = (field: FieldName): string | undefined =>
    errors[field] || (touched[field] ? validateFields()[field] : undefined);

  const formIsValid = Object.keys(validateFields()).length === 0
    && !Object.values(errors).some(Boolean)
    && (managerMode !== 'existing' || managers.some((manager) => manager.id === managerId))
    && !saving;

  const markTouched = (field: FieldName) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const submit = async () => {
    const nextErrors = validateFields();
    (Object.keys(errors) as FieldName[]).forEach((field) => {
      if (errors[field]) nextErrors[field] = errors[field];
    });
    setErrors(nextErrors);
    setTouched({
      name: true,
      address: true,
      email: true,
      manager_id: true,
      manager_name: true,
      manager_email: true,
      manager_password: true,
    });
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      let location = coordinates;
      if (!location) {
        let geocoded: Awaited<ReturnType<typeof geocodeAddress>>;
        try {
          geocoded = await geocodeAddress(address.trim());
        } catch {
          setErrors({ address: 'Location not found. Please pin it on the map.' });
          setTouched((current) => ({ ...current, address: true }));
          return;
        }
        if (!geocoded || geocoded.isBroad) {
          setErrors({ address: 'Location not found. Please pin it on the map.' });
          setTouched((current) => ({ ...current, address: true }));
          return;
        }
        location = { latitude: geocoded.lat, longitude: geocoded.lng, locationStatus: 'geocoded' };
        setCoordinates(location);
      }

      const branch = await createCompanyBranch({
        name: name.trim(),
        address: address.trim(),
        delivery_radius_km: DEFAULT_DELIVERY_RADIUS_KM,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        status,
        latitude: location.latitude,
        longitude: location.longitude,
        location_status: location.locationStatus,
        manager_mode: managerMode,
        ...(managerMode === 'existing' ? { manager_id: managerId } : {}),
        ...(managerMode === 'create' ? {
          manager_name: managerName.trim(),
          manager_email: managerEmail.trim(),
          manager_password: managerPassword,
        } : {}),
      });
      onCreated(branch);
    } catch (createError: unknown) {
      const error = createError instanceof Error
        ? createError as Error & { fieldErrors?: Record<string, unknown> }
        : null;
      const apiErrors = error?.fieldErrors || {};
      const readMessage = (key: string): string | undefined => {
        const value = apiErrors[key];
        return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
      };
      const apiFieldErrors: FieldErrors = {
        name: readMessage('name'),
        address: readMessage('address') || readMessage('latitude') || readMessage('longitude'),
        email: readMessage('email'),
        manager_id: readMessage('manager_id'),
        manager_name: readMessage('manager_name'),
        manager_email: readMessage('manager_email'),
        manager_password: readMessage('manager_password'),
      };
      setErrors(apiFieldErrors);
      setFormError(error?.message || 'Unable to create the branch.');
    } finally {
      setSaving(false);
    }
  };

  const errorText = (field: FieldName) => fieldError(field)
    ? <p id={`${field}-error`} role="alert" className="mt-1 text-xs text-red-700">{fieldError(field)}</p>
    : null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-0 sm:p-4"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) onClose();
        }}
      >
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-company-branch-title"
          className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:rounded-2xl"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--oppa-border)] px-5 py-4 sm:px-6">
            <div>
              <h2 id="create-company-branch-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">Add branch</h2>
              <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Create a company-owned branch, then assign its manager.</p>
            </div>
            <button type="button" onClick={onClose} disabled={saving} aria-label="Close add branch dialog" className="rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] disabled:opacity-50">
              <X size={19} aria-hidden="true" />
            </button>
          </header>

          <ValidatedForm noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
              {formError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</p>}

              <section className="space-y-4 border-b border-[var(--oppa-border)] pb-5">
                <h3 className="text-sm font-semibold text-[var(--oppa-text)]">Branch details</h3>
                <label htmlFor="company-branch-name" className={labelClass}>
                  Branch name <span aria-hidden="true" className="text-red-600">*</span>
                  <input
                    id="company-branch-name"
                    value={name}
                    onChange={(event) => { setName(event.target.value); clearError('name'); }}
                    onBlur={() => markTouched('name')}
                    maxLength={255}
                    required
                    aria-invalid={Boolean(fieldError('name'))}
                    aria-describedby={fieldError('name') ? 'name-error' : undefined}
                    className={fieldClass}
                  />
                  {errorText('name')}
                </label>

                <div>
                  <label htmlFor="company-branch-address" className={labelClass}>
                    Branch address <span aria-hidden="true" className="text-red-600">*</span>
                  </label>
                  <textarea
                    id="company-branch-address"
                    value={address}
                    onChange={(event) => { setAddress(event.target.value); setCoordinates(null); clearError('address'); }}
                    onBlur={() => markTouched('address')}
                    rows={2}
                    required
                    aria-invalid={Boolean(fieldError('address'))}
                    aria-describedby={fieldError('address') ? 'address-error' : undefined}
                    className={`${fieldClass} h-[4.5rem] resize-y py-2.5`}
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {fieldError('address') ? (
                      <p id="address-error" role="alert" className="text-xs text-red-700">{fieldError('address')}</p>
                    ) : coordinates ? (
                      <p role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--oppa-green-dark)]">
                        <Check size={14} aria-hidden="true" />Location set
                      </p>
                    ) : (
                      <p role="status" className="text-xs text-[var(--oppa-text-muted)]">Enter a specific address or pin the location on the map.</p>
                    )}
                    <button type="button" onClick={() => setShowLocationPicker(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">
                      <MapPin size={14} aria-hidden="true" />Pin on map
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-b border-[var(--oppa-border)] pb-5">
                <h3 className="text-sm font-semibold text-[var(--oppa-text)]">Contact and status</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label htmlFor="company-branch-phone" className={labelClass}>
                    Branch phone <span className="font-normal text-[var(--oppa-text-muted)]">(Optional)</span>
                    <input id="company-branch-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={50} className={fieldClass} />
                  </label>
                  <label htmlFor="company-branch-email" className={labelClass}>
                    Branch email <span className="font-normal text-[var(--oppa-text-muted)]">(Optional)</span>
                    <input
                      id="company-branch-email"
                      type="email"
                      value={email}
                      onChange={(event) => { setEmail(event.target.value); clearError('email'); }}
                      onBlur={() => markTouched('email')}
                      maxLength={INPUT_LIMITS.email.max}
                      aria-invalid={Boolean(fieldError('email'))}
                      aria-describedby={fieldError('email') ? 'email-error' : undefined}
                      className={fieldClass}
                    />
                    {errorText('email')}
                  </label>
                  <label htmlFor="company-branch-status" className={labelClass}>
                    Status
                    <span className="relative block">
                      <select id="company-branch-status" value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')} className={`${fieldClass} appearance-none pr-10`}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
                    </span>
                  </label>
                </div>
              </section>

              <fieldset aria-required="true" className="rounded-xl border border-[var(--oppa-border)] p-4">
                <legend className="px-1 text-sm font-semibold text-[var(--oppa-text)]">
                  Branch manager <span aria-hidden="true" className="text-red-600">*</span>
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ['existing', 'Choose existing manager'],
                    ['create', 'Create new manager account'],
                  ] as const).map(([value, label]) => (
                    <label key={value} className={`flex min-h-[4.5rem] cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--oppa-green)] ${managerMode === value ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]' : 'border-[var(--oppa-border)] text-[var(--oppa-text)]'}`}>
                      <input
                        type="radio"
                        name="manager-mode"
                        value={value}
                        checked={managerMode === value}
                        onChange={() => {
                          setManagerMode(value);
                          setErrors((current) => ({ ...current, manager_id: undefined, manager_name: undefined, manager_email: undefined, manager_password: undefined }));
                          setTouched((current) => ({ ...current, manager_id: false, manager_name: false, manager_email: false, manager_password: false }));
                          setFormError('');
                        }}
                        className="accent-[var(--oppa-green)]"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                {managerMode === 'existing' && <div className="mt-4 space-y-3">
                  <label htmlFor="company-branch-manager-search" className={labelClass}>Search existing managers
                    <span className="relative block">
                      <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
                      <input id="company-branch-manager-search" value={managerSearch} onChange={(event) => setManagerSearch(event.target.value)} placeholder="Search name, email, or branch" className={`${fieldClass} pl-9`} />
                    </span>
                  </label>
                  <label htmlFor="company-branch-manager" className={labelClass}>Manager account
                    <select
                      id="company-branch-manager"
                      value={managerId}
                      onChange={(event) => { setManagerId(event.target.value); clearError('manager_id'); }}
                      onBlur={() => markTouched('manager_id')}
                      required
                      aria-invalid={Boolean(fieldError('manager_id'))}
                      aria-describedby={fieldError('manager_id') ? 'manager_id-error' : undefined}
                      className={fieldClass}
                    >
                      <option value="">{managersLoading ? 'Loading managers…' : 'Choose a manager'}</option>
                      {visibleManagers.map((manager) => (
                        <option key={manager.id} value={manager.id}>{manager.full_name} · {manager.email} · {manager.branch_name || 'Company branch'}</option>
                      ))}
                    </select>
                    {errorText('manager_id')}
                  </label>
                  <p className="text-xs text-[var(--oppa-text-muted)]">Their Franchise Portal access will be limited to this branch.</p>
                  {managerLoadError && <p role="alert" className="text-xs text-red-700">{managerLoadError}</p>}
                  {!managersLoading && managers.length === 0 && !managerLoadError && <p className="text-xs text-[var(--oppa-text-muted)]">No existing managers are available.</p>}
                </div>}

                {managerMode === 'create' && <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label htmlFor="company-branch-manager-name" className={labelClass}>Name <span aria-hidden="true" className="text-red-600">*</span>
                    <input
                      id="company-branch-manager-name"
                      value={managerName}
                      onChange={(event) => { setManagerName(event.target.value); clearError('manager_name'); }}
                      onBlur={() => markTouched('manager_name')}
                      maxLength={INPUT_LIMITS.personName.max}
                      required
                      aria-invalid={Boolean(fieldError('manager_name'))}
                      aria-describedby={fieldError('manager_name') ? 'manager_name-error' : undefined}
                      className={fieldClass}
                    />
                    {errorText('manager_name')}
                  </label>
                  <label htmlFor="company-branch-manager-email" className={labelClass}>Email <span aria-hidden="true" className="text-red-600">*</span>
                    <input
                      id="company-branch-manager-email"
                      type="email"
                      value={managerEmail}
                      onChange={(event) => { setManagerEmail(event.target.value); clearError('manager_email'); }}
                      onBlur={() => markTouched('manager_email')}
                      maxLength={INPUT_LIMITS.email.max}
                      required
                      aria-invalid={Boolean(fieldError('manager_email'))}
                      aria-describedby={fieldError('manager_email') ? 'manager_email-error' : undefined}
                      className={fieldClass}
                    />
                    {errorText('manager_email')}
                  </label>
                  <label htmlFor="company-branch-manager-password" className={`${labelClass} sm:col-span-2`}>Password <span aria-hidden="true" className="text-red-600">*</span>
                    <span className="relative block">
                      <input
                        id="company-branch-manager-password"
                        type={showManagerPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={managerPassword}
                        onChange={(event) => { setManagerPassword(event.target.value); clearError('manager_password'); }}
                        onBlur={() => markTouched('manager_password')}
                        maxLength={INPUT_LIMITS.password.max}
                        required
                        aria-invalid={Boolean(fieldError('manager_password'))}
                        aria-describedby={fieldError('manager_password') ? 'manager_password-error' : undefined}
                        className={`${fieldClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowManagerPassword((visible) => !visible)}
                        aria-label={showManagerPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
                      >
                        {showManagerPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                      </button>
                    </span>
                    {errorText('manager_password')}
                  </label>
                </div>}
              </fieldset>
            </div>

            <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--oppa-border)] bg-white px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
              <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-[var(--oppa-border)] px-4 py-2.5 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] disabled:opacity-50">Cancel</button>
              <button type="submit" disabled={!formIsValid} className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                {saving ? 'Creating…' : 'Create branch'}
              </button>
            </footer>
          </ValidatedForm>
        </div>
      </div>

      {showLocationPicker && <LocationPicker
        initialLat={coordinates?.latitude}
        initialLng={coordinates?.longitude}
        initialAddress={address}
        onClose={() => setShowLocationPicker(false)}
        onSelectLocation={(location) => {
          setAddress(location.address);
          setCoordinates({ latitude: location.lat, longitude: location.lng, locationStatus: 'manual' });
          clearError('address');
          setShowLocationPicker(false);
        }}
      />}
    </>
  );
};

export default CreateCompanyBranchModal;

import React, { useEffect, useState } from 'react';
import { BriefcaseBusiness, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User, X } from 'lucide-react';

export type AccountCreationMode = 'admin' | 'employee' | 'branch-staff';

export interface AccountCreationValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  position?: string;
  phone?: string;
  vehicle_type?: string;
}

interface AccountCreationModalProps {
  mode: AccountCreationMode;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: AccountCreationValues) => Promise<void> | void;
  isSubmitting?: boolean;
  submitError?: string;
  branchName?: string;
  extraFields?: React.ReactNode;
  positionPreview?: (position: string) => React.ReactNode;
}

const defaultValues: AccountCreationValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  position: 'cashier',
  phone: '',
  vehicle_type: '',
};

const fieldClass =
  'w-full rounded-xl border border-[var(--oppa-border)] bg-white px-3 py-2.5 pl-10 text-sm text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)]/70 transition focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20';

const errorClass = 'mt-1.5 text-xs font-medium text-red-600';

const getValidationErrors = (values: AccountCreationValues, mode: AccountCreationMode) => {
  const errors: Partial<Record<keyof AccountCreationValues, string>> = {};

  if (!values.fullName.trim()) {
    errors.fullName = 'Full name is required.';
  }

  if (!values.email.trim()) {
    errors.email = 'Email address is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (mode === 'branch-staff' && values.password.length < 8) {
    errors.password = 'Use at least 8 characters.';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if ((mode === 'employee' || mode === 'branch-staff') && !values.position) {
    errors.position = 'Please choose a position.';
  }
  if (mode === 'branch-staff' && values.position === 'driver' && !values.vehicle_type?.trim()) {
    errors.vehicle_type = 'Vehicle type is required for drivers.';
  }

  return errors;
};

const AccountCreationModal: React.FC<AccountCreationModalProps> = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  submitError,
  branchName,
  extraFields,
  positionPreview,
}) => {
  const [form, setForm] = useState<AccountCreationValues>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof AccountCreationValues, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setForm({ ...defaultValues, ...(['employee', 'branch-staff'].includes(mode) ? { position: 'cashier' } : {}) });
      setErrors({});
      setShowPassword(false);
      setShowConfirmPassword(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [isOpen, mode]);

  if (!isOpen) {
    return null;
  }

  const updateField = (field: keyof AccountCreationValues, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = getValidationErrors(form, mode);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSubmit({
      ...form,
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      position: mode === 'admin' ? undefined : form.position || 'cashier',
      phone: isBranchStaff ? form.phone?.trim() || '' : undefined,
      vehicle_type: isBranchStaff && form.position === 'driver' ? form.vehicle_type?.trim() || '' : undefined,
    });
  };

  const isBranchStaff = mode === 'branch-staff';
  const emailServerError = isBranchStaff && submitError?.toLowerCase().includes('email')
    ? submitError
    : undefined;
  const title = mode === 'admin' ? 'Add New Administrator' : isBranchStaff ? 'Add Branch Staff' : 'Add New Employee';
  const subtitle = mode === 'admin' ? 'Create an account for the admin panel.' : isBranchStaff ? 'Create an account limited to this branch.' : 'Create an employee account.';
  const submitLabel = mode === 'admin' ? 'Create Admin' : isBranchStaff ? 'Add Staff' : 'Create Employee';
  const loadingLabel = mode === 'admin' ? 'Creating Admin...' : isBranchStaff ? 'Adding Staff...' : 'Creating Employee...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173826]/20 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-creation-title"
        className="relative z-10 w-full max-w-[520px] rounded-[22px] border border-[var(--oppa-border)] bg-[#fffdf9] p-5 shadow-[0_18px_45px_rgba(19,38,28,0.14)] animate-fadeIn sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="account-creation-title" className="font-serif text-[1.8rem] font-bold leading-tight text-[var(--oppa-text)]">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--oppa-border)] bg-white text-[var(--oppa-text-muted)] transition hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
          >
            <X size={18} />
          </button>
        </div>

        {submitError && !emailServerError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
          {extraFields}
          {isBranchStaff && (
            <div className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 py-2.5 text-sm text-[var(--oppa-text-muted)]">
              <span className="font-semibold text-[var(--oppa-text)]">Adding to:</span> {branchName || 'Current branch'}
            </div>
          )}
          <div>
            <label htmlFor="account-full-name" className="mb-1.5 block text-sm font-medium text-[var(--oppa-text)]">
              Full Name
            </label>
            <div className="relative">
              <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
              <input
                id="account-full-name"
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={(event) => updateField('fullName', event.target.value)}
                placeholder="Enter full name"
                className={fieldClass}
                aria-invalid={Boolean(errors.fullName)}
              />
            </div>
            {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
          </div>

          <div>
            <label htmlFor="account-email" className="mb-1.5 block text-sm font-medium text-[var(--oppa-text)]">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
              <input
                id="account-email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField('email', event.target.value)}
                placeholder="Enter email address"
                className={fieldClass}
                aria-invalid={Boolean(errors.email)}
              />
            </div>
            {errors.email && <p className={errorClass}>{errors.email}</p>}
            {emailServerError && <p className={errorClass}>{emailServerError}</p>}
          </div>

          {isBranchStaff && (
            <div>
              <label htmlFor="account-phone" className="mb-1.5 block text-sm font-medium text-[var(--oppa-text)]">Phone (optional)</label>
              <input id="account-phone" name="phone" type="tel" value={form.phone || ''} onChange={(event) => updateField('phone', event.target.value)} placeholder="09XX XXX XXXX" className={fieldClass.replace('pl-10', 'pl-3')} />
            </div>
          )}
          {(mode === 'employee' || isBranchStaff) && (
            <div>
              <label htmlFor="account-position" className="mb-1.5 block text-sm font-medium text-[var(--oppa-text)]">
                Position
              </label>
              <div className="relative">
                <BriefcaseBusiness size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
                <select
                  id="account-position"
                  name="position"
                  value={form.position || 'cashier'}
                  onChange={(event) => updateField('position', event.target.value)}
                  className={`${fieldClass} appearance-none pl-10`}
                  aria-invalid={Boolean(errors.position)}
                >
                  <option value="cashier">Cashier</option>
                  <option value={isBranchStaff ? 'kitchen_staff' : 'kitchen staff'}>Kitchen Staff</option>
                  {isBranchStaff && <option value="driver">Driver</option>}
                </select>
              </div>
              {positionPreview && <div className="mt-2">{positionPreview(form.position || 'cashier')}</div>}
              {errors.position && <p className={errorClass}>{errors.position}</p>}
            </div>
          )}
          {isBranchStaff && form.position === 'driver' && (
            <div>
              <label htmlFor="account-vehicle-type" className="mb-1.5 block text-sm font-medium text-[var(--oppa-text)]">Vehicle type</label>
              <select
                id="account-vehicle-type"
                name="vehicle_type"
                value={form.vehicle_type || ''}
                onChange={(event) => updateField('vehicle_type', event.target.value)}
                className={fieldClass.replace('pl-10', 'pl-3')}
                aria-invalid={Boolean(errors.vehicle_type)}
              >
                <option value="" disabled>Select vehicle type</option>
                <option value="motorcycle">Motor</option>
                <option value="bike">Bike</option>
              </select>
              {errors.vehicle_type && <p className={errorClass}>{errors.vehicle_type}</p>}
            </div>
          )}

          <div>
            <label htmlFor="account-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-text)]">
              Password
            </label>
            {isBranchStaff && <p className="mb-1.5 text-xs text-[var(--oppa-text-muted)]">Use at least 8 characters.</p>}
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
              <input
                id="account-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder="Enter password"
                className={`${fieldClass} pr-10`}
                aria-invalid={Boolean(errors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)] transition hover:text-[var(--oppa-text)] focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className={errorClass}>{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="account-confirm-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-text)]">
              Confirm Password
            </label>
            <div className="relative">
              <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
              <input
                id="account-confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(event) => updateField('confirmPassword', event.target.value)}
                placeholder="Confirm password"
                className={`${fieldClass} pr-10`}
                aria-invalid={Boolean(errors.confirmPassword)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)] transition hover:text-[var(--oppa-text)] focus:outline-none"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword}</p>}
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--oppa-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--oppa-text)] transition hover:bg-[var(--oppa-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {loadingLabel}
                </>
              ) : (
                <>
                  {mode === 'admin' ? <ShieldCheck size={16} /> : <BriefcaseBusiness size={16} />}
                  {submitLabel}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccountCreationModal;

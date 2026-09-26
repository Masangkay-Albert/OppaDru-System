import React, { useEffect, useState } from 'react';
import { BriefcaseBusiness, Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, User, X } from 'lucide-react';

export type AccountCreationMode = 'admin' | 'employee';

export interface AccountCreationValues {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  position?: string;
}

interface AccountCreationModalProps {
  mode: AccountCreationMode;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: AccountCreationValues) => Promise<void> | void;
  isSubmitting?: boolean;
  submitError?: string;
}

const defaultValues: AccountCreationValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  position: 'cashier',
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
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  if (mode === 'employee' && !values.position) {
    errors.position = 'Please choose a position.';
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
}) => {
  const [form, setForm] = useState<AccountCreationValues>(defaultValues);
  const [errors, setErrors] = useState<Partial<Record<keyof AccountCreationValues, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setForm({ ...defaultValues, ...(mode === 'employee' ? { position: 'cashier' } : {}) });
    setErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
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
      position: mode === 'employee' ? form.position || 'cashier' : undefined,
    });
  };

  const title = mode === 'admin' ? 'Add New Administrator' : 'Add New Employee';
  const subtitle = mode === 'admin' ? 'Create an account for the admin panel.' : 'Create an employee account.';
  const submitLabel = mode === 'admin' ? 'Create Admin' : 'Create Employee';
  const loadingLabel = mode === 'admin' ? 'Creating Admin...' : 'Creating Employee...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-[1px]">
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

        {submitError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
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
          </div>

          {mode === 'employee' && (
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
                  <option value="kitchen staff">Kitchen Staff</option>
                </select>
              </div>
              {errors.position && <p className={errorClass}>{errors.position}</p>}
            </div>
          )}

          <div>
            <label htmlFor="account-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-text)]">
              Password
            </label>
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

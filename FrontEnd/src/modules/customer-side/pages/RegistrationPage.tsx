import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/Authcontext";
import { UserPlus, Eye, EyeOff, Phone, Mail, Lock, User, X } from "lucide-react";
import LoginBrandPanel from "../../../components/LoginBrandPanel";
import { INPUT_LIMITS, normalizePhilippinePhone } from "../../../constants/inputLimits";
import { LimitedInput } from "../../../components/ui/LimitedInput";
import { FormAlert, ValidatedForm } from '../../../components/ui/FormValidation';

const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [termsAttempted, setTermsAttempted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const termsTriggerRef = useRef<HTMLButtonElement>(null);
  const termsDialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const returnTo = new URLSearchParams(location.search).get("returnTo");
    if (returnTo && returnTo.startsWith("/franchise")) {
      navigate(`/franchise/register?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (!termsOpen) return undefined;
    termsDialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const trigger = termsTriggerRef.current;
    return () => trigger?.focus();
  }, [termsOpen]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.currentTarget.value.replace(/\D/g, "").slice(0, 11));
  };

  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    const normalized = digits.startsWith("63") && digits.length === 12
      ? `0${digits.slice(2)}`
      : digits.slice(0, 11);
    setPhone(normalized);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (confirmPasswordRef.current && passwordConfirmation) {
      confirmPasswordRef.current.setCustomValidity(passwordConfirmation !== value ? "Passwords do not match" : "");
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPasswordConfirmation(value);
    e.target.setCustomValidity(value !== password ? "Passwords do not match" : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAgreed) {
      setTermsAttempted(true);
      return;
    }
    setError("");
    setIsLoading(true);

    try {
      const success = await register({
        full_name: fullName,
        email,
        phone: normalizePhilippinePhone(phone),
        password,
        password_confirmation: passwordConfirmation,
      });

      if (success) {
        navigate("/login?registered=1");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputBaseClass =
    "min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20";

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Join Oppa Dru" description="Sauced, tossed, and straight-up obsessed." />

      <div className="flex min-h-screen items-center justify-center bg-[var(--oppa-cream)] px-4 py-4 sm:py-6">
        <div className="w-full max-w-md">
          <div className="mb-4 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <UserPlus className="size-7 text-[var(--oppa-green)]" />
              <span className="text-2xl font-semibold text-[var(--oppa-green)]">
                Oppa Dru
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--oppa-green)]">
              Create Account
            </h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">
              Sign up to get started
            </p>
          </div>

          {error && (
            <FormAlert className="p-4">
              {error}
            </FormAlert>
          )}

          <ValidatedForm
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-lg sm:p-6"
          >
            <div>
              <label htmlFor="registration-full-name" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Full Name <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-full-name"
                  name="full_name"
                  type="text"
                  required
                  minLength={INPUT_LIMITS.personName.min}
                  maxLength={INPUT_LIMITS.personName.max}
                  inputFilter="personName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputBaseClass}
                  placeholder="Juan Dela Cruz"
                />
              </div>
            </div>

            <div>
              <label htmlFor="registration-email" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Email Address <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-email"
                  name="email"
                  type="email"
                  required
                  maxLength={INPUT_LIMITS.registrationEmail.max}
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  autoComplete="email"
                  className={inputBaseClass}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="registration-phone" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Phone Number <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  pattern="(\+?63|0)?9\d{9}"
                  maxLength={11}
                  inputFilter="digits"
                  value={phone}
                  onChange={handlePhoneChange}
                  onPaste={handlePhonePaste}
                  className={inputBaseClass}
                  placeholder="09123456789"
                  title="09XX XXX XXXX"
                />
              </div>
            </div>

            <div>
              <label htmlFor="registration-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Password <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={INPUT_LIMITS.password.min}
                  maxLength={INPUT_LIMITS.password.max}
                  autoComplete="new-password"
                  value={password}
                  onChange={handlePasswordChange}
                  className={`${inputBaseClass} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--oppa-green)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="registration-password-confirmation" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Confirm Password <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-password-confirmation"
                  ref={confirmPasswordRef}
                  name="password_confirmation"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  maxLength={INPUT_LIMITS.password.max}
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={handleConfirmPasswordChange}
                  className={`${inputBaseClass} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-pressed={showConfirmPassword}
                  className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--oppa-green)]"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <div className="flex items-start gap-2">
                <input
                  id="registration-terms"
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(event) => {
                    setTermsAgreed(event.target.checked);
                    if (event.target.checked) setTermsAttempted(false);
                  }}
                  aria-labelledby="registration-terms-intro registration-terms-link"
                  aria-describedby={termsAttempted && !termsAgreed ? "registration-terms-error" : undefined}
                  className="mt-1 size-4 shrink-0 accent-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
                />
                <div className="text-sm leading-6 text-[var(--oppa-text)]">
                  <label id="registration-terms-intro" htmlFor="registration-terms">I agree to the</label>{" "}
                  <button
                    ref={termsTriggerRef}
                    id="registration-terms-link"
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="font-semibold text-[var(--oppa-green)] hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
                  >
                    Terms and Conditions
                  </button>
                </div>
              </div>
              {termsAttempted && !termsAgreed && (
                <p id="registration-terms-error" role="alert" className="mt-1 text-xs text-red-700">
                  Please agree to the Terms and Conditions to continue.
                </p>
              )}
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isLoading || !termsAgreed}
                className="min-h-12 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Creating Account..." : "Sign Up"}
              </button>
            </div>
          </ValidatedForm>

          {termsOpen && (
            <div
              className="fixed inset-0 z-[150] flex items-center justify-center bg-black/55 p-0 sm:p-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setTermsOpen(false);
              }}
            >
              <section
                ref={termsDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="registration-terms-title"
                tabIndex={-1}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setTermsOpen(false);
                    return;
                  }
                  if (event.key !== "Tab") return;
                  const focusable = termsDialogRef.current?.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
                  );
                  if (!focusable?.length) return;
                  const first = focusable[0];
                  const last = focusable[focusable.length - 1];
                  if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                  } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                  }
                }}
                className="flex h-dvh w-full flex-col overflow-hidden border border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl"
              >
                <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--oppa-border)] px-5 py-4">
                  <h2 id="registration-terms-title" className="text-lg font-bold text-[var(--oppa-green)]">Terms and Conditions</h2>
                  <button
                    type="button"
                    onClick={() => setTermsOpen(false)}
                    aria-label="Close Terms and Conditions"
                    className="grid size-10 shrink-0 place-items-center rounded-lg text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </header>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-sm leading-6">
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">1. Who we are</h3><p>Oppa Dru Korean Fried Chicken is a platform for ordering Korean fried chicken and related food from Oppa Dru Korean Fried Chicken and its franchise branches. By creating an account, you agree to these Terms.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">2. Eligibility and your account</h3><p>You must be at least 18 years old, or have the consent of a parent or legal guardian. Give accurate and complete details (name, email, phone number). Keep your password private. You are responsible for all activity and orders under your account. Tell us right away if you notice unauthorized access.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">3. Orders</h3><p>Review your items, address, and total before placing an order. Once an order is placed and accepted by the branch, it is treated as a confirmed order. Photos on the platform are for illustration only and the actual food may look different. We will try to follow your special instructions, but we cannot guarantee them. If you have allergies, please contact the branch before ordering, as we cannot guarantee that any item is allergen-free.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">4. Prices and payment</h3><p>Prices are shown in Philippine pesos. Delivery fees and other charges are shown before checkout, and the final total is the amount you agree to pay. Prices and charges may change.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">5. Delivery</h3><p>Delivery times are estimates and may change because of traffic, weather, or order volume. Please make sure someone can receive your order. If we cannot reach you or no one receives the order, it may be cancelled without a refund.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">6. Cancellations, refunds, and replacements</h3><p>You can cancel an order only before the branch accepts it. Orders cancelled after acceptance are not refundable. If your order is wrong, missing items, or not fresh, report it as soon as possible with a clear description and photos. After review, we may arrange a replacement or refund at our discretion.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">7. Vouchers and promos</h3><p>Vouchers and promos have limits and expiry dates. They cannot be exchanged for cash or transferred. We may cancel or reject a voucher that is misused or suspected of fraud.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">8. Acceptable use</h3><p>Do not use the platform for anything unlawful, to harass others, to post harmful or false content, to collect other people's data, or to attempt fraud or abuse of the system.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">9. Account suspension</h3><p>We may suspend or close an account that breaks these Terms or shows suspicious or fraudulent activity.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">10. Liability</h3><p>The platform is provided "as is". To the extent allowed by law, Oppa Dru Korean Fried Chicken is not liable for indirect or consequential losses. Nothing here limits your rights under Philippine consumer laws.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">11. Privacy</h3><p>We collect and use your personal data to run your account and process your orders, in line with our Privacy Policy and applicable Philippine data privacy law.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">12. Changes</h3><p>We may update these Terms at any time. Continued use of the platform means you accept the updated Terms.</p></section>
                  <section><h3 className="font-semibold text-[var(--oppa-text)]">13. Governing law</h3><p>These Terms are governed by the laws of the Republic of the Philippines.</p></section>
                </div>

                <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.06)]">
                  <button
                    type="button"
                    onClick={() => setTermsOpen(false)}
                    className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTermsAgreed(true);
                      setTermsAttempted(false);
                      setTermsOpen(false);
                    }}
                    className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
                  >
                    I agree
                  </button>
                </footer>
              </section>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3">
            <p className="text-center text-sm text-[var(--oppa-text-muted)]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-[var(--oppa-green)] font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full text-sm text-[var(--oppa-text-muted)] transition-colors hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;

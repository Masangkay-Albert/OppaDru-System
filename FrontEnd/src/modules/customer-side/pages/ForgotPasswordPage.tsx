import React, { useEffect, useState } from "react";
import { ArrowLeft, Clock3, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoginBrandPanel from "../../../components/LoginBrandPanel";
import { authService } from "../../../services/authService";

const FORGOT_PASSWORD_COOLDOWN_KEY = "oppa_dru_forgot_password_cooldown";
const COOLDOWN_SECONDS = 60;

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [countdown, setCountdown] = useState<number>(() => {
    const expiry = Number(sessionStorage.getItem(FORGOT_PASSWORD_COOLDOWN_KEY) || "0");
    if (!expiry || expiry <= Date.now()) {
      sessionStorage.removeItem(FORGOT_PASSWORD_COOLDOWN_KEY);
      return 0;
    }

    return Math.max(0, Math.ceil((expiry - Date.now()) / 1000));
  });

  useEffect(() => {
    if (countdown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setCountdown((current) => {
        const next = Math.max(0, current - 1);

        if (next === 0) {
          sessionStorage.removeItem(FORGOT_PASSWORD_COOLDOWN_KEY);
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown]);

  const startCooldown = () => {
    const expiry = Date.now() + COOLDOWN_SECONDS * 1000;
    sessionStorage.setItem(FORGOT_PASSWORD_COOLDOWN_KEY, String(expiry));
    setCountdown(COOLDOWN_SECONDS);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setIsLoading(true);

    try {
      const message = await authService.forgotPassword(normalizedEmail);
      setSuccessMessage(message);
      startCooldown();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to send the password reset link.");
    } finally {
      setIsLoading(false);
    }
  };

  const isCooldownActive = countdown > 0;

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Reset Your Password" description="We’ll send you a secure link to get back into your account." />

      <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-serif text-3xl font-semibold text-[var(--oppa-green)]">Forgot Password</h1>
            <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">
              Enter the email linked to your account.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert" aria-live="assertive">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-800" role="status" aria-live="polite">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
            <div>
              <label htmlFor="forgot-password-email" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="forgot-password-email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  autoFocus
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isCooldownActive}
              className="min-h-11 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Sending..." : isCooldownActive ? `Send again in 00:${String(countdown).padStart(2, "0")}` : "Send reset link"}
            </button>
          </form>

          {isCooldownActive && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--oppa-text-muted)]">
              <Clock3 className="size-3.5" aria-hidden="true" />
              <span>Resend is available in {countdown}s.</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--oppa-green)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to login
          </button>
        </div>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;

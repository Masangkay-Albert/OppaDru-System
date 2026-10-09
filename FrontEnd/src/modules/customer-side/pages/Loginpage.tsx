import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/Authcontext";
import { authService } from "../../../services/authService";
import { LogIn, Mail, Lock, Eye, EyeOff, ChevronDown, ArrowLeft, Shield, Truck, BriefcaseBusiness, ChefHat, Store } from "lucide-react";
import LoginBrandPanel from "../../../components/LoginBrandPanel";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showStaffPortals, setShowStaffPortals] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [isResending, setIsResending] = useState(false);
  const isVerificationError = error === "Please verify your email address before logging in.";

  const registeredMessage = new URLSearchParams(location.search).get("registered") === "1"
    ? "Account created. Check your email to verify your account before signing in."
    : new URLSearchParams(location.search).get("verified") === "1"
      ? "Email verified. You can now sign in."
      : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        const returnTo = new URLSearchParams(location.search).get("returnTo");
        navigate(returnTo?.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/customer");
      } else {
        setError("Invalid email or password.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendMessage("");
    try {
      setResendMessage(await authService.resendVerification(email));
    } catch (err: unknown) {
      setResendMessage(err instanceof Error ? err.message : "Unable to resend verification email");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Welcome Back!" description="Sauced, tossed, and straight-up obsessed." />

      <main className="relative flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="w-full max-w-[430px] rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:p-7">
          <header className="mb-6 text-center sm:mb-7">
            <div className="mb-4 flex items-center justify-center gap-2.5 text-[var(--oppa-green)]">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)]">
                <LogIn className="size-5" aria-hidden="true" />
              </span>
              <span className="text-xl font-semibold">Oppa Dru</span>
            </div>
            <h1 className="mb-1.5 font-serif text-3xl font-semibold text-[var(--oppa-green)]">
              Welcome Back
            </h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">
              Sign in to continue to your account
            </p>
          </header>

          {error && (
            <div id="login-error" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert" aria-live="assertive">
              {error}
              {isVerificationError && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={!email || isResending}
                  className="mt-2 block font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  {isResending ? "Sending..." : "Resend verification email"}
                </button>
              )}
            </div>
          )}

          {registeredMessage && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-800" role="status">
              {registeredMessage}
            </div>
          )}

          {resendMessage && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-800" role="status">
              {resendMessage}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            aria-busy={isLoading}
            className="space-y-4"
          >
            <div>
              <label htmlFor="customer-email" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="customer-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-error" : undefined}
                  className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="customer-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="customer-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-error" : undefined}
                  className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-12 text-sm transition-colors placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20"
                  placeholder="Enter your password"
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

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-11 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--oppa-text-muted)]">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="font-semibold text-[var(--oppa-green)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
            >
              Sign Up
            </button>
          </p>

          <section className="mt-6 border-t border-[var(--oppa-border)] pt-4">
            <button
              type="button"
              aria-expanded={showStaffPortals}
              aria-controls="staff-portal-options"
              onClick={() => setShowStaffPortals((visible) => !visible)}
              className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md text-sm text-[var(--oppa-text-muted)] transition-colors hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
            >
              <span className="text-left">
                <span className="block text-sm font-medium text-[var(--oppa-text)]">Admin &amp; Staff Access</span>
                <span className="mt-0.5 block text-xs text-[var(--oppa-text-muted)]">Access your work portal</span>
              </span>
              <ChevronDown
                size={15}
                aria-hidden="true"
                className={`transition-transform duration-200 ${showStaffPortals ? "rotate-180" : ""}`}
              />
            </button>

            <div id="staff-portal-options" hidden={!showStaffPortals} className="pt-3">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate("/admin/login")}
                  className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--oppa-border)] bg-white px-3 text-sm font-medium text-[var(--oppa-text)] shadow-[0_1px_2px_rgba(30,43,34,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--oppa-green)]/50 hover:bg-[var(--oppa-green-soft)]/35 hover:text-[var(--oppa-green)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] active:translate-y-0"
                >
                  <Shield size={16} aria-hidden="true" className="shrink-0 text-[var(--oppa-green)]/75 transition-colors group-hover:text-[var(--oppa-green)]" />
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/delivery/login")}
                  className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--oppa-border)] bg-white px-3 text-sm font-medium text-[var(--oppa-text)] shadow-[0_1px_2px_rgba(30,43,34,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--oppa-green)]/50 hover:bg-[var(--oppa-green-soft)]/35 hover:text-[var(--oppa-green)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] active:translate-y-0"
                >
                  <Truck size={16} aria-hidden="true" className="shrink-0 text-[var(--oppa-green)]/75 transition-colors group-hover:text-[var(--oppa-green)]" />
                  Delivery
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/employee/login")}
                  className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--oppa-border)] bg-white px-3 text-sm font-medium text-[var(--oppa-text)] shadow-[0_1px_2px_rgba(30,43,34,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--oppa-green)]/50 hover:bg-[var(--oppa-green-soft)]/35 hover:text-[var(--oppa-green)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] active:translate-y-0"
                >
                  <BriefcaseBusiness size={16} aria-hidden="true" className="shrink-0 text-[var(--oppa-green)]/75 transition-colors group-hover:text-[var(--oppa-green)]" />
                  Cashier
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/kitchen/login")}
                  className="group inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--oppa-border)] bg-white px-3 text-sm font-medium text-[var(--oppa-text)] shadow-[0_1px_2px_rgba(30,43,34,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--oppa-green)]/50 hover:bg-[var(--oppa-green-soft)]/35 hover:text-[var(--oppa-green)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] active:translate-y-0"
                >
                  <ChefHat size={16} aria-hidden="true" className="shrink-0 text-[var(--oppa-green)]/75 transition-colors group-hover:text-[var(--oppa-green)]" />
                  Kitchen
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/franchise/login")}
                  className="group col-span-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-green-soft)] px-3 text-sm font-medium text-[var(--oppa-green)] shadow-[0_1px_2px_rgba(30,43,34,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--oppa-green)]/50 hover:bg-[var(--oppa-green-soft)]/80 hover:text-[var(--oppa-green)] hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] active:translate-y-0"
                >
                  <Store size={16} aria-hidden="true" className="shrink-0 text-[var(--oppa-green)]" />
                  Franchise
                </button>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-5 flex min-h-9 w-full items-center justify-center gap-1.5 text-sm text-[var(--oppa-text-muted)] transition-colors hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Home
          </button>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
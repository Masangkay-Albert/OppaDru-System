
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BikeIcon, Eye, EyeOff, Lock, Mail } from "lucide-react";
import LoginBrandPanel from "../../../components/LoginBrandPanel";
import { driverAuth } from "../../../services/driverAuth";

const DriverLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      
      const result = await driverAuth.login(email, password);

      if (result.success) {
        navigate("/delivery/dashboard");
      } else {
        setError(result.message || "Invalid email or password");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel
        title="Delivery Partner"
        description="Sauced, tossed, and straight-up obsessed."
      />

      <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-2 text-[var(--oppa-green)]">
              <BikeIcon className="size-6" />
              <span className="text-xl font-semibold">Oppa Dru</span>
            </div>
            <h1 className="mb-2 font-serif text-2xl font-semibold text-[var(--oppa-green)]">
              Delivery Partner Login
            </h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">
              Sign in to manage your deliveries
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-lg sm:p-8">
            <div>
              <label htmlFor="driver-email" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="driver-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                  placeholder="partner@oppadru.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="driver-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="driver-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-12 text-sm transition-colors focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 flex w-full items-center justify-center gap-1 text-sm text-[var(--oppa-text-muted)] transition-colors hover:text-[var(--oppa-green)]"
          >
            <ArrowLeft size={16} /> Back to login options
          </button>
        </div>
      </main>
    </div>
  );
};

export default DriverLoginPage;
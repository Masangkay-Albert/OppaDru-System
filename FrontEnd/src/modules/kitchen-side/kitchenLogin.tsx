// src/modules/kitchen-side/pages/KitchenLoginPage.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChefHat } from "lucide-react";
import { kitchenAuth } from "../../services/kitchenAuth";

const KitchenLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await kitchenAuth.login(email, password);

      if (result.success) {
        navigate("/kitchen/dashboard");
      } else {
        setError(result.message || "Invalid email or password");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Centered Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-[var(--oppa-cream)]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <ChefHat className="size-7 text-[var(--oppa-green)]" />
              <span className="text-2xl font-semibold text-[var(--oppa-green)]">
                Oppa Dru
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--oppa-green)] mb-2">
              Kitchen Staff Login
            </h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">
              Sign in to manage kitchen orders
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-8 space-y-5 shadow-lg border border-[var(--oppa-border)]"
          >
            <div>
              <label className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent"
                placeholder="chef@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[var(--oppa-green)] text-white font-semibold rounded-xl hover:bg-[var(--oppa-green-dark)] transition-colors disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <button
            onClick={() => navigate("/")}
            className="w-full mt-6 text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)] transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default KitchenLoginPage;
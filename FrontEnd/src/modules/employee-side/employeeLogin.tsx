// src/pages/StaffLoginPage.tsx (You can rename this file to reflect the unified login)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react"; // Changed icon to represent all staff
import { employeeAuth } from "../../services/employeeAuth"; // Unified service for both kitchen staff and cashiers

const EmployeeLoginPage: React.FC = () => {
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
      const result = await employeeAuth.login(email, password);

      if (result.success && result.position) {
        // Route them based on their exact database position
        if (result.position === 'kitchen staff') {
          navigate("/kitchen/dashboard");
        } else if (result.position === 'cashier') {
          // Placeholder navigation for the cashier/employee since the dashboard doesn't exist yet
          navigate("/cashier"); 
        } else {
          setError(`Position "${result.position}" is not recognized.`);
        }
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
              <Users className="size-7 text-[var(--oppa-green)]" />
              <span className="text-2xl font-semibold text-[var(--oppa-green)]">
                Oppa Dru
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--oppa-green)] mb-2">
              Staff Portal
            </h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">
              Sign in to access your employee account
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
                placeholder="staff@example.com"
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

export default EmployeeLoginPage;
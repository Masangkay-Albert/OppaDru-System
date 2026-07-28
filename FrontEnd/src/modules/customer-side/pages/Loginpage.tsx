import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/Authcontext";
import { LogIn, Mail, Lock, Eye, EyeOff, Shield, Truck, ArrowLeft } from "lucide-react";
import heroSectionImg from "../../../assets/herosection.png";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        navigate("/customer");
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[var(--oppa-green)] relative items-center justify-center overflow-hidden">
        <img
          src={heroSectionImg}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-10"
        />
        <div className="relative text-center px-12">
          <h2 className="text-4xl font-semibold text-white mb-4">
            Welcome Back!
          </h2>
          <p className="text-white/70 font-serif text-xl max-w-sm mx-auto">
            Sauced, tossed, and straight-up obsessed.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-[var(--oppa-cream)]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <LogIn className="size-7 text-[var(--oppa-green)]" />
              <span className="text-2xl font-semibold text-[var(--oppa-green)]">
                Oppa Dru
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--oppa-green)] mb-2">
              Welcome Back
            </h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">
              Login to your account
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-8 space-y-5 shadow-lg border border-[var(--oppa-border)]"
          >
            <div>
              <label className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent"
                  placeholder="username@gmail.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[var(--oppa-green)] text-white font-semibold rounded-xl hover:bg-[var(--oppa-green-dark)] transition-colors disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--oppa-text-muted)] mt-6">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/register")}
              className="text-[var(--oppa-green)] font-semibold hover:underline"
            >
              Sign Up
            </button>
          </p>

          <div className="mt-8 pt-6 border-t border-[var(--oppa-border)]">
            <p className="text-xs text-[var(--oppa-text-muted)] text-center mb-4 font-medium uppercase tracking-wider">
              Other Portals
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("/admin/login")}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white border-2 border-[var(--oppa-border)] text-[var(--oppa-green)] font-medium rounded-xl hover:bg-[var(--oppa-green)] hover:text-white hover:border-[var(--oppa-green)] transition-all duration-200"
              >
                <Shield size={18} />
                <span className="text-sm">Admin</span>
              </button>
              <button
                onClick={() => navigate("/delivery/login")}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white border-2 border-[var(--oppa-border)] text-[var(--oppa-green)] font-medium rounded-xl hover:bg-[var(--oppa-green)] hover:text-white hover:border-[var(--oppa-green)] transition-all duration-200"
              >
                <Truck size={18} />
                <span className="text-sm">Delivery</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate("/")}
            className="w-full mt-6 text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)] transition-colors flex items-center justify-center gap-1"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
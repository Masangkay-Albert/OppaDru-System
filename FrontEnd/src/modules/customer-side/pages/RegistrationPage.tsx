import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/Authcontext";
import { UserPlus, Eye, EyeOff, Phone, Mail, Lock, User } from "lucide-react";
import heroSectionImg from "../../../assets/herosection.png";

const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
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
  const [emailTouched, setEmailTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^(09|\+639)\d{9}$/;
    return phoneRegex.test(phone);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;
    return { hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar, isLongEnough };
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPhone(value);
  };

  const handlePhoneBlur = () => {
    setPhoneTouched(true);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (!passwordTouched) {
      setPasswordTouched(true);
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordConfirmation(e.target.value);
    if (!confirmPasswordTouched) {
      setConfirmPasswordTouched(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    setEmailTouched(true);
    setPhoneTouched(true);
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    if (!fullName || !email || !password) {
      setError("Please fill in all required fields");
      setIsLoading(false);
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isLongEnough) {
      setError("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }
    if (!passwordValidation.hasUpperCase) {
      setError("Password must contain at least one uppercase letter");
      setIsLoading(false);
      return;
    }
    if (!passwordValidation.hasLowerCase) {
      setError("Password must contain at least one lowercase letter");
      setIsLoading(false);
      return;
    }
    if (!passwordValidation.hasNumber) {
      setError("Password must contain at least one number");
      setIsLoading(false);
      return;
    }
    if (!passwordValidation.hasSpecialChar) {
      setError("Password must contain at least one special character");
      setIsLoading(false);
      return;
    }

    if (phone && !validatePhoneNumber(phone)) {
      setError("Please enter a valid Philippine number (e.g., 09123456789)");
      setIsLoading(false);
      return;
    }

    try {
      const success = await register({
        full_name: fullName,
        email,
        phone,
        password,
        password_confirmation: passwordConfirmation,
      });

      if (success) {
        navigate("/login?registered=1");
      } else {
        setError("Email already exists or registration failed");
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Registration failed");
      setIsLoading(false);
    }
  };

  const passwordValidation = validatePassword(password);
  const showEmailError = emailTouched && email && !validateEmail(email);
  const showPhoneError = phoneTouched && phone && !validatePhoneNumber(phone);
  const showConfirmPasswordError = confirmPasswordTouched && passwordConfirmation && password !== passwordConfirmation;

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
            Join Oppa Dru
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
              <UserPlus className="size-7 text-[var(--oppa-green)]" />
              <span className="text-2xl font-semibold text-[var(--oppa-green)]">
                Oppa Dru
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--oppa-green)] mb-2">
              Create Account
            </h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">
              Sign up to get started
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
                Full Name 
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[var(--oppa-border)] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent"
                  placeholder="Juan Dela Cruz"
                />
              </div>
            </div>

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
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent ${
                    showEmailError ? 'border-red-400 bg-red-50' : 'border-[var(--oppa-border)]'
                  }`}
                  placeholder="you@example.com"
                />
              </div>
              {showEmailError && (
                <p className="text-xs text-red-500 mt-1">
                  Please use a valid Gmail address (e.g., username@gmail.com)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent ${
                    showPhoneError ? 'border-red-400 bg-red-50' : 'border-[var(--oppa-border)]'
                  }`}
                  placeholder="09123456789"
                />
              </div>
              {showPhoneError && (
                <p className="text-xs text-red-500 mt-1">
                  Please enter a valid Philippine number (e.g., 09123456789)
                </p>
              )}
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
                  onChange={handlePasswordChange}
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
              {password && (
                <div className="mt-2 space-y-1">
                  <p className={`text-xs ${passwordValidation.isLongEnough ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordValidation.isLongEnough ? '✓' : '✗'} At least 8 characters
                  </p>
                  <p className={`text-xs ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordValidation.hasUpperCase ? '✓' : '✗'} At least one uppercase letter
                  </p>
                  <p className={`text-xs ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordValidation.hasLowerCase ? '✓' : '✗'} At least one lowercase letter
                  </p>
                  <p className={`text-xs ${passwordValidation.hasNumber ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordValidation.hasNumber ? '✓' : '✗'} At least one number
                  </p>
                  <p className={`text-xs ${passwordValidation.hasSpecialChar ? 'text-green-600' : 'text-red-500'}`}>
                    {passwordValidation.hasSpecialChar ? '✓' : '✗'} At least one special character
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--oppa-green)] mb-1.5">
                Confirm Password 
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-4" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={passwordConfirmation}
                  onChange={handleConfirmPasswordChange}
                  onPaste={(e) => e.preventDefault()}
                  onDrop={(e) => e.preventDefault()}
                  className={`w-full pl-10 pr-12 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)] focus:border-transparent ${
                    showConfirmPasswordError ? 'border-red-400 bg-red-50' : 'border-[var(--oppa-border)]'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {showConfirmPasswordError && (
                <p className="text-xs text-red-500 mt-1">
                  Passwords do not match
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[var(--oppa-green)] text-white font-semibold rounded-xl hover:bg-[var(--oppa-green-dark)] transition-colors disabled:opacity-60"
            >
              {isLoading ? "Creating Account..." : "Sign Up"}
            </button>
          </form>

          <p className="text-center text-sm text-[var(--oppa-text-muted)] mt-6">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-[var(--oppa-green)] font-semibold hover:underline"
            >
              Sign In
            </button>
          </p>

          <button
            onClick={() => navigate("/")}
            className="w-full mt-4 text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)] transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;
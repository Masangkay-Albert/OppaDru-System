import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/Authcontext";
import { useAdminAuth } from "../../../contexts/AdminAuthContext";
import * as adminAuthService from "../../../services/adminAuthService";
import oppaLogo from "../../../assets/oppadrulogo.jpg";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login: customerLogin } = useAuth();
  const { login: adminLogin } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const isAdminCredentials = adminAuthService.validateAdminCredentials(email, password);

    if (isAdminCredentials) {
      const success = await adminLogin(email, password);
      if (success) {
        navigate("/admin/dashboard");
      } else {
        setError("Invalid admin email or password");
        setIsLoading(false);
      }
      return;
    }

    const success = await customerLogin(email, password);
    if (success) {
      navigate("/customer");
    } else {
      setError("Invalid email or password");
      setIsLoading(false);
    }
  };

  const handleRegisterClick = () => {
    navigate("/register");
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${oppaLogo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-black/50"></div>
      
      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src={oppaLogo} 
              alt="Oppa Dru Logo" 
              className="w-20 h-20 rounded-full object-cover border-2 border-lime-700"
            />
          </div>
          <h1 className="text-3xl font-bold text-lime-700">Oppa Dru</h1>
          <p className="text-gray-600 mt-2">Login to your account</p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-gray-700 font-medium mb-2">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-lime-700"
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>
          
          <button 
            type="submit"
            disabled={isLoading}
            className={`w-full bg-lime-700 text-white py-3 rounded-xl font-semibold transition ${
              isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-lime-800"
            }`}
          >
            {isLoading ? "Logging in..." : "Sign In"}
          </button>
        </form>
        
        <p className="text-center text-gray-500 mt-6">
          Don't have an account?{" "}
          <button 
            onClick={handleRegisterClick}
            className="text-lime-700 font-semibold hover:underline"
          >
            Sign up
          </button>
        </p>

        <button 
          onClick={() => navigate("/admin/login")}
          className="w-full mt-4 text-lime-700 font-semibold hover:underline"
        >
          Go to Admin Portal
        </button>
        
        <button 
          onClick={() => navigate("/")}
          className="w-full mt-2 text-gray-500 hover:text-gray-700 transition"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
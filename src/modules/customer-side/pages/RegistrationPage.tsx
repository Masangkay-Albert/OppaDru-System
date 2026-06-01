import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import oppaLogo from "../../../assets/oppadrulogo.jpg";

const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const handleLoginClick = () => {
    navigate("/login");
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
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/50"></div>
      
      {/* Registration Form */}
      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img 
              src={oppaLogo} 
              alt="Oppa Dru Logo" 
              className="w-20 h-20 rounded-full object-cover border-2 border-lime-700"
            />
          </div>
          <h1 className="text-3xl font-bold text-lime-700">Create Account</h1>
          <p className="text-gray-600 mt-2">Sign up to get started</p>
        </div>
        
        <form className="space-y-4">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Full Name</label>
            <input 
              type="text" 
              placeholder="Enter your full name"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-2">Email Address</label>
            <input 
              type="email" 
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-gray-700 font-medium mb-2">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
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

          <div>
            <label className="block text-gray-700 font-medium mb-2">Confirm Password</label>
            <input 
              type="password" 
              placeholder="Confirm your password"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            />
          </div>
          
          <button 
            type="submit"
            className="w-full bg-lime-700 text-white py-3 rounded-xl font-semibold hover:bg-lime-800 transition"
          >
            Sign Up
          </button>
        </form>
        
        <p className="text-center text-gray-500 mt-6">
          Already have an account?{" "}
          <button 
            onClick={handleLoginClick}
            className="text-lime-700 font-semibold hover:underline"
          >
            Sign In
          </button>
        </p>
        
        <button 
          onClick={() => navigate("/")}
          className="w-full mt-4 text-gray-500 hover:text-gray-700 transition"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
};

export default RegistrationPage;
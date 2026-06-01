import React from "react";
import { useNavigate } from "react-router-dom";
import oppaLogo from "../../assets/oppadrulogo.jpg";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

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
        position: "relative",
      }}
    >
      {/* Dark Overlay para mabasa ang text */}
      <div className="absolute inset-0 bg-black/50"></div>
      
      {/* Login Form */}
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
        
        <form className="space-y-5">
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
            <input 
              type="password" 
              placeholder="Enter your password"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent"
            />
          </div>
          
          <button 
            type="submit"
            className="w-full bg-lime-700 text-white py-3 rounded-xl font-semibold hover:bg-lime-800 transition"
          >
            Sign In
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
          onClick={() => navigate("/")}
          className="w-full mt-4 text-gray-500 hover:text-gray-700 transition"
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
};

export default LoginPage;
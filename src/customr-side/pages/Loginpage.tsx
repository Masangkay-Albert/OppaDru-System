import React from "react";
import { useNavigate } from "react-router-dom";

const Loginpage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-100 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-lime-700">Oppa Dru</h1>
          <p className="text-gray-600 mt-2">Login to your account</p>
        </div>
        
        <form className="space-y-5">
          <div>
            <label className="block text-gray-700 font-medium mb-2">Email</label>
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
          <button className="text-lime-700 font-semibold hover:underline">
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

export default Loginpage;
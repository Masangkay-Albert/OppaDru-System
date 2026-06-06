// NavbarCustomer.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/Authcontext";
import oppaLogo from "../../../assets/oppadrulogo.jpg";

const NavbarCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleLogout = () => {
    logout();
    navigate("/login"); 
  };

  return (
    <nav className="bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/customer")}
          >
            <img 
              src={oppaLogo} 
              alt="Oppa Dru" 
              className="w-10 h-10 rounded-full object-cover border-2 border-[#e76f51]"
            />
            <span className="text-base sm:text-lg font-semibold text-white whitespace-nowrap">
              Oppa Dru Korean Fried Chicken
            </span>
          </div>

          {/* User Profile */}
          {user && (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 transition"
              >
                <div className="w-8 h-8 rounded-full bg-[#e76f51] flex items-center justify-center text-white font-bold text-sm">
                  {getInitials(user.fullName)}
                </div>
                <span className="text-white font-medium hidden md:block">
                  {user.fullName}
                </span>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50 border animate-fadeIn">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      navigate("/customer/favorites");
                    }}
                    className="w-full text-left px-4 py-2 text-[#2d6a4f] hover:bg-[#fff3e0] flex items-center gap-2"
                  >
                    <span>❤️</span> My Favorites
                  </button>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      navigate("/customer/orders");
                    }}
                    className="w-full text-left px-4 py-2 text-[#2d6a4f] hover:bg-[#fff3e0] flex items-center gap-2"
                  >
                    <span>📋</span> My Orders
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-[#e76f51] hover:bg-[#fff3e0] flex items-center gap-2"
                  >
                    <span>🚪</span> Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavbarCustomer;
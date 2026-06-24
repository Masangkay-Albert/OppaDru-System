import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../contexts/Authcontext";
import { useFavorites } from "../../../../contexts/FavoritesContext";
import { Heart, ChevronDown, Package, LogOut } from "lucide-react";
import oppaLogo from "../../../../assets/oppadrulogo.jpg";

const NavbarCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { favorites } = useFavorites();
  const [showDropdown, setShowDropdown] = useState(false);

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
    setShowDropdown(false);
  };

  return (
    <nav className="bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] sticky top-0 z-50 shadow-lg">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Left side */}
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-pointer flex-shrink-0"
            onClick={() => navigate("/customer")}
          >
            <img 
              src={oppaLogo} 
              alt="Oppa Dru" 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-white/20"
            />
            {/* Desktop: Full text, Mobile: Short text */}
            <span className="font-serif font-bold text-white text-sm sm:text-base md:text-lg whitespace-nowrap hidden sm:inline">
              Oppa Dru Korean Fried Chicken
            </span>
            <span className="font-serif font-bold text-white text-sm whitespace-nowrap sm:hidden">
              Oppa Dru
            </span>
          </div>

          {/* Right side - Favorites and Profile */}
          <div className="flex items-center gap-3 sm:gap-5 md:gap-6 flex-shrink-0">
            {/* Favorites */}
            <button
              onClick={() => navigate("/customer/favorites")}
              className="relative flex items-center gap-1 sm:gap-2 text-white font-sans font-medium hover:text-white/90 transition-colors duration-200"
            >
              <Heart size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
              <span className="text-sm sm:text-base">Favorites</span>
              {favorites.length > 0 && (
                <span className="absolute -top-2 -right-3 sm:-right-4 bg-[#e76f51] text-white text-xs font-bold rounded-full min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] flex items-center justify-center px-1">
                  {favorites.length}
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-1 sm:gap-2 text-white font-sans font-medium hover:text-white/90 transition-colors duration-200"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs sm:text-sm">
                    {getInitials(user.fullName)}
                  </div>
                  <span className="hidden sm:inline text-sm md:text-base">{user.fullName.split(' ')[0]}</span>
                  <ChevronDown size={14} className="sm:w-4 sm:h-4 md:w-[18px] md:h-[18px]" />
                </button>

                {showDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white rounded-xl shadow-xl py-2 z-50 border border-gray-100 animate-fadeIn">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-800 font-sans truncate">{user.fullName}</p>
                        <p className="text-xs text-gray-500 mt-0.5 font-sans truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          navigate("/customer/orders");
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-150 font-sans"
                      >
                        <Package size={16} className="text-gray-500" />
                        <span>My Orders</span>
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors duration-150 font-sans"
                      >
                        <LogOut size={16} className="text-red-500" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavbarCustomer;
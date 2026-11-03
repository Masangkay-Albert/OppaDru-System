import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../contexts/Authcontext";
import { useFavorites } from "../../../../contexts/FavoritesContext";
import { Heart, ChevronDown, Package, LogOut, Settings } from "lucide-react";
import oppaLogo from "../../../../assets/oppadrulogo.jpg";
import CustomerAnnouncementBell from "../common/CustomerAnnouncementBell";
import { useToast } from '../ToastProvider';

const NavbarCustomer: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { favoriteNotificationCount } = useFavorites();
  const { confirmDialog } = useToast();
  const [showDropdown, setShowDropdown] = useState(false);

  const getInitials = (name: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleLogout = async () => {
    const confirmed = await confirmDialog({
      title: 'Log out?',
      message: 'You can sign in again at any time. Your saved branch carts will remain on this device.',
      confirmLabel: 'Log out',
      danger: true,
    });
    if (!confirmed) return;
    await logout();
    setShowDropdown(false);
    navigate("/login");
  };

  const handleFavoritesClick = () => {
    navigate("/customer/favorites");
  };

  const showBadge = favoriteNotificationCount > 0;

  return (
    <nav className="bg-[var(--oppa-green-dark)] sticky top-0 z-50 shadow-md">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer flex-shrink-0"
            onClick={() => navigate("/customer")}
          >
            <img
              src={oppaLogo}
              alt="Oppa Dru"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-white/20 shadow-sm"
            />
            <span className="font-serif font-bold !text-white text-sm sm:text-base md:text-lg whitespace-nowrap hidden sm:inline">
              Oppa Dru Korean Fried Chicken
            </span>
            <span className="font-serif font-bold !text-white text-sm whitespace-nowrap sm:hidden">
              Oppa Dru
            </span>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 md:gap-6 flex-shrink-0">
            <button
              onClick={handleFavoritesClick}
              className="relative flex items-center gap-1 sm:gap-2 !text-white font-sans font-medium hover:text-white transition-colors duration-200"
            >
              <Heart size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
              <span className="text-sm sm:text-base">Favorites</span>
              {showBadge && (
                <span className="absolute -top-2 -right-3 sm:-right-4 bg-[var(--oppa-accent)] text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] sm:min-w-[20px] sm:h-[20px] flex items-center justify-center px-1.5">
                  {favoriteNotificationCount}
                </span>
              )}
            </button>

            {user ? (
              <>
                <CustomerAnnouncementBell />

                <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-1 sm:gap-2 !text-white font-sans font-medium hover:text-white transition-colors duration-200"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/15 flex items-center justify-center !text-white font-bold text-xs sm:text-sm">
                    {getInitials(user.full_name)}
                  </div>
                  <span className="hidden sm:inline text-sm md:text-base">
                    {user.full_name.split(' ')[0]}
                  </span>
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
                        <p className="text-sm font-semibold text-gray-800 font-sans truncate">
                          {user.full_name}
                        </p>
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
                        onClick={() => {
                          setShowDropdown(false);
                          navigate("/customer/settings");
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-150 font-sans"
                      >
                        <Settings size={16} className="text-gray-500" />
                        <span>Settings</span>
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
            </>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="px-4 py-1.5 rounded-full bg-[var(--oppa-yellow)] text-[#133824] font-bold text-xs sm:text-sm hover:bg-yellow-300 transition-all duration-150 shadow-xs"
            >
              Login
            </button>
          )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavbarCustomer;
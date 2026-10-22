import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Package, LogOut, Settings, ClipboardList, TrendingUp } from "lucide-react";
import oppaLogo from "../../../../assets/oppadrulogo.jpg";
import { employeeAuth } from "../../../../services/employeeAuth";

const NavbarEmployee: React.FC = () => {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [employee] = useState<{ full_name?: string; fullName?: string; email?: string; position?: string; franchise_id?: string | null; franchise?: { name?: string } | null } | null>(() => {
    try {
      const raw = localStorage.getItem("employee_auth");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const employeeName = employee?.fullName || employee?.full_name || "Cashier Staff";
  const employeeEmail = employee?.email || "staff@oppadru.com";
  const employeePosition = employee?.position ? employee.position.toUpperCase() : "REGISTER / POS";
  const popularMealsPath = employee?.franchise_id ? "/cashier/popular" : "/employee/popular";

  const getInitials = (name: string) => {
    if (!name) return "ST";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const handleLogout = () => {
    employeeAuth.logout();
    setShowDropdown(false);
    navigate("/employee/login");
  };

  return (
    <nav className="bg-[var(--oppa-green-dark)] sticky top-0 z-50 shadow-md">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div
            className="flex items-center gap-2 sm:gap-3 cursor-pointer flex-shrink-0"
            onClick={() => navigate("/employee")}
          >
            <img
              src={oppaLogo}
              alt="Oppa Dru"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-white/20 shadow-sm"
            />
            <div className="flex flex-col">
              <span className="font-serif font-bold text-[var(--oppa-cream)] text-sm sm:text-base md:text-lg whitespace-nowrap hidden sm:inline">
                Oppa Dru Korean Fried Chicken
              </span>
              <span className="font-serif font-bold text-[var(--oppa-cream)] text-sm whitespace-nowrap sm:hidden">
                Oppa Dru POS
              </span>
              <span className="text-[10px] uppercase font-semibold text-[var(--oppa-cream)]/75 tracking-wider hidden sm:inline">
                Onsite POS Register • {employeePosition} • {employee?.franchise?.name || 'Main system'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 md:gap-6 flex-shrink-0">
            <button
              onClick={() => navigate("/employee/orders")}
              className="relative flex items-center gap-1 sm:gap-2 text-[var(--oppa-cream)] font-sans font-medium hover:text-white transition-colors duration-200"
            >
              <ClipboardList size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
              <span className="text-sm sm:text-base hidden sm:inline">Onsite Orders</span>
            </button>

            <button
              onClick={() => navigate(popularMealsPath)}
              className="relative flex items-center gap-1 sm:gap-2 text-[var(--oppa-cream)] font-sans font-medium hover:text-white transition-colors duration-200"
              title="Most Popular Meal This Month"
            >
              <TrendingUp size={16} className="sm:w-[18px] sm:h-[18px] md:w-5 md:h-5 text-amber-300" />
              <span className="text-sm sm:text-base hidden lg:inline">Most Popular This Month</span>
              <span className="text-sm sm:text-base lg:hidden">Popular</span>
            </button>

            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-1 sm:gap-2 text-[var(--oppa-cream)] font-sans font-medium hover:text-white transition-colors duration-200"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/15 flex items-center justify-center text-[var(--oppa-cream)] font-bold text-xs sm:text-sm">
                  {getInitials(employeeName)}
                </div>
                <span className="hidden sm:inline text-sm md:text-base">
                  {employeeName.split(' ')[0]}
                </span>
                <ChevronDown size={14} className="sm:w-4 sm:h-4 md:w-[18px] md:h-[18px]" />
              </button>

              {showDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowDropdown(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 sm:w-60 bg-white rounded-xl shadow-xl py-2 z-50 border border-gray-100 animate-fadeIn">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-800 font-sans truncate">
                        {employeeName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 font-sans truncate">{employeeEmail}</p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E3EFE7] text-[var(--oppa-green)]">
                        {employeePosition}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("/employee");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-150 font-sans"
                    >
                      <Package size={16} className="text-gray-500" />
                      <span>Register / Menu</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("/employee/orders");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-150 font-sans"
                    >
                      <ClipboardList size={16} className="text-gray-500" />
                      <span>Onsite Orders</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("/employee/popular");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-150 font-sans"
                    >
                      <TrendingUp size={16} className="text-amber-500" />
                      <span>Most Popular This Month</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowDropdown(false);
                        navigate("/employee/settings");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors duration-150 font-sans"
                    >
                      <Settings size={16} className="text-gray-500" />
                      <span>Staff Settings</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors duration-150 font-sans border-t border-gray-50 mt-1"
                    >
                      <LogOut size={16} className="text-red-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavbarEmployee;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HiMenu, HiX } from "react-icons/hi";
import oppaLogo from "../../../../assets/oppadrulogo.jpg";

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate("/login");
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setIsOpen(false);
  };

  return (
    <nav className="bg-[#133824] px-[6%] py-5 sticky top-0 z-50 shadow-lg">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        
        {/* Logo Section */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
          <img 
            src={oppaLogo}  
            alt="Oppa Dru Logo" 
            className="w-12 h-12 rounded-full object-cover border-2 border-[#fcd34d]"
          />
          <div className="text-white font-serif font-bold leading-tight flex flex-col">
            <span className="text-xl tracking-wide">Oppa Dru</span>
            <span className="text-xl tracking-wide text-[#fcd34d]">Korean Fried Chicken</span>
          </div>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden text-[#fcd34d] focus:outline-none transition-transform active:scale-95"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <HiX size={28} /> : <HiMenu size={28} />}
        </button>

        {/* Desktop Links */}
        <div className={`absolute md:static top-[88px] left-0 w-full md:w-auto bg-[#133824] md:bg-transparent z-40 transition-all duration-300 ease-in-out ${isOpen ? "h-auto py-6 opacity-100 border-b border-white/10" : "h-0 opacity-0 md:h-auto md:opacity-100 overflow-hidden md:overflow-visible"}`}>
          <ul className="flex flex-col md:flex-row items-center gap-6 md:gap-8 justify-center">
            <li>
              <a href="#home" onClick={(e) => handleNavClick(e, "home")} className="text-white font-medium text-sm hover:text-[#fcd34d] transition-colors tracking-wide">
                Home
              </a>
            </li>
            <li>
              <a href="#menu" onClick={(e) => handleNavClick(e, "menu")} className="text-white font-medium text-sm hover:text-[#fcd34d] transition-colors tracking-wide">
                Menu
              </a>
            </li>
            <li>
              <a href="#about" onClick={(e) => handleNavClick(e, "about")} className="text-white font-medium text-sm hover:text-[#fcd34d] transition-colors tracking-wide">
                About
              </a>
            </li>
          </ul>
        </div>

        {/* Action Button */}
        <div className="hidden md:block">
          <button 
            onClick={handleLoginClick}
            className="px-7 py-2.5 rounded-full bg-[#fcd34d] text-[#133824] font-bold text-sm shadow-md hover:bg-yellow-300 hover:scale-105 active:scale-95 transition-all duration-200"
          >
            Login
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
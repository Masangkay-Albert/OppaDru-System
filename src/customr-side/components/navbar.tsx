import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import oppaLogo from "../../assets/oppadrulogo.jpg";

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
    <nav className="sticky top-0 z-50 bg-[#166534]/90 backdrop-blur-md">
      <div className="flex flex-col md:flex-row justify-between items-center px-[6%] py-[15px]">
        {/* Logo Section - LEFT SIDE */}
        <div className="flex items-center gap-3">
          <img 
            src={oppaLogo} 
            alt="Oppa Dru Logo" 
            className="w-[50px] h-[50px] rounded-full object-cover border-2 border-yellow-400"
          />
          <div className="text-[20px] font-bold text-white hidden lg:block">
            Oppa Dru Korean Fried Chicken
          </div>
          <div className="text-[16px] font-bold text-white md:hidden">
            Oppa Dru
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button 
          className="md:hidden text-white text-2xl absolute right-6 top-4"
          onClick={() => setIsOpen(!isOpen)}
        >
          ☰
        </button>

        {/* Navigation Links & Login - RIGHT SIDE */}
        <div className={`flex flex-col md:flex-row items-center gap-4 md:gap-6 mt-4 md:mt-0 ${isOpen ? "flex" : "hidden md:flex"} w-full md:w-auto`}>
          <ul className="flex flex-col md:flex-row items-center gap-4 md:gap-5">
            <li>
              <a 
                href="#home" 
                onClick={(e) => handleNavClick(e, "home")}
                className="text-white font-medium hover:text-[#fde047] transition block py-2 px-2"
              >
                Home
              </a>
            </li>
            <li>
              <a 
                href="#about" 
                onClick={(e) => handleNavClick(e, "about")}
                className="text-white font-medium hover:text-[#fde047] transition block py-2 px-2"
              >
                About Us
              </a>
            </li>
            <li>
              <a 
                href="#categories" 
                onClick={(e) => handleNavClick(e, "categories")}
                className="text-white font-medium hover:text-[#fde047] transition block py-2 px-2"
              >
                Food Categories
              </a>
            </li>
          </ul>
          
          <button 
            onClick={handleLoginClick}
            className="px-6 py-2 rounded-full bg-[#fde047] text-[#166534] font-semibold hover:bg-[#facc15] transition w-full md:w-auto mt-2 md:mt-0"
          >
            Login
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
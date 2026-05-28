import React, { useState } from "react";
import oppaLogo from "../assets/oppadrulogo.jpg";

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#166534]/90 backdrop-blur-md">
      <div className="flex flex-col md:flex-row justify-between items-center px-[6%] py-[15px]">
        <div className="flex items-center gap-3 w-full md:w-auto justify-between">
          <div className="flex items-center gap-3">
            <img src={oppaLogo} alt="Oppa Dru Logo" className="w-[45px] h-[45px] rounded-full" />
            <div className="text-[22px] font-bold text-white">Oppa Dru</div>
          </div>
          <button 
            className="md:hidden text-white text-2xl"
            onClick={() => setIsOpen(!isOpen)}
          >
            ☰
          </button>
        </div>

        <ul className={`flex flex-col md:flex-row gap-3 md:gap-[25px] mt-4 md:mt-0 ${isOpen ? "flex" : "hidden md:flex"} w-full md:w-auto text-center`}>
          <li><a href="#home" className="text-white font-medium hover:text-[#fde047] transition block py-2">Home</a></li>
          <li><a href="#about" className="text-white font-medium hover:text-[#fde047] transition block py-2">About Us</a></li>
          <li><a href="#categories" className="text-white font-medium hover:text-[#fde047] transition block py-2">Food Categories</a></li>
          <li><a href="#login" className="text-white font-medium hover:text-[#fde047] transition block py-2">Login</a></li>
        </ul>

        <button className="hidden md:block px-[26px] py-[10px] rounded-full bg-[#fde047] text-[#166534] font-semibold hover:bg-[#facc15] transition">
          Login
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
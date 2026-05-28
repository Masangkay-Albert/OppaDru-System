import { useState } from "react";
import { Menu, X } from "lucide-react";

import oppaLogo from "../assets/oppadrulogo.jpg";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="logo-section">
        <img
          src={oppaLogo}
          alt="Oppa Dru"
          className="logo-img"
        />

        <div>
          <h1 className="brand-title">
            OPPA DRU
          </h1>

          <p className="brand-subtitle">
            Korean Fried Chicken
          </p>
        </div>
      </div>

      <div
        className={`nav-links ${
          menuOpen ? "active" : ""
        }`}
      >
        <a href="#home">Home</a>
        <a href="#menu">Menu</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
      </div>

      <div className="nav-actions">
        <button className="login-btn">
          Login
        </button>

        <button
          className="mobile-menu-btn"
          onClick={() =>
            setMenuOpen(!menuOpen)
          }
        >
          {menuOpen ? (
            <X size={26} />
          ) : (
            <Menu size={26} />
          )}
        </button>
      </div>
    </nav>
  );
}
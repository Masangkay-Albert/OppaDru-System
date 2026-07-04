import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/navigation/navbar";
import oppaLogo from "../../../assets/oppadrulogo.jpg";
import oppaLocation from "../../../assets/oppadrulocation.jpg";
import fbLogo from "../../../assets/facebook-logoo.png";
import igLogo from "../../../assets/instagram-logoo.png";
import { FiArrowRight, FiPhone, FiMail, FiMapPin } from "react-icons/fi";
import { MdOutlineFastfood } from "react-icons/md";
import { landingCategories } from "../../../data/landingCategories";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const goToLogin = () => {
    navigate("/login");
  };

  return (
    <div className="overflow-x-hidden bg-[#fdfaf3] text-gray-800 antialiased selection:bg-lime-700 selection:text-white">
      <Navbar />

      <section
        id="home"
        className="grid md:grid-cols-2 items-center gap-12 px-[6%] pt-20 pb-28 bg-gradient-to-br from-yellow-100/70 to-orange-50/50 rounded-b-[60px] md:rounded-b-[100px] shadow-sm relative"
      >
        <div className="space-y-6 max-w-xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold tracking-wider text-lime-800 uppercase bg-lime-100 rounded-full">
            <MdOutlineFastfood /> Freshly Cooked Daily
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.15] text-gray-900 tracking-tight">
            Welcome to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-lime-700 to-emerald-600">
              Oppa Dru Korean Fried Chicken
            </span>
          </h1>
          <p className="text-lg text-gray-600 font-medium leading-relaxed">
            Authentic Korean Fried Chicken. <br />
            <span className="text-gray-500 font-normal">Sauced, tossed, and straight-up obsessed.</span>
          </p>
          <div className="flex flex-wrap gap-4 pt-2">
            <button 
              onClick={goToLogin}
              className="group bg-lime-700 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-lime-700/20 hover:bg-lime-800 transition-all duration-300 transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              Order Now 
              <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={goToLogin}
              className="border-2 border-lime-700/30 text-lime-700 px-8 py-3.5 rounded-xl font-bold hover:bg-lime-50 hover:border-lime-700 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              View Menu
            </button>
          </div>
        </div>
        <div className="flex justify-center relative">
          <div className="absolute inset-0 bg-yellow-200/40 rounded-[40px] blur-3xl -z-10 transform scale-95" />
          <img
            src={oppaLocation}
            alt="Oppa Dru Chicken"
            className="w-full max-w-[420px] rounded-[40px] shadow-2xl border-4 border-white object-cover transform hover:scale-[1.02] transition-transform duration-500"
          />
        </div>
      </section>

      <section id="categories" className="mt-[-50px] px-[6%] py-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 relative z-10">
        {landingCategories.map((cat) => (
          <div
            key={cat.id}
            onClick={goToLogin}
            className="group bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center"
          >
            <div className="relative mb-4 p-1 rounded-full border border-gray-100 group-hover:border-lime-200 transition-colors">
              <img
                src={cat.image}
                alt={cat.name}
                className="w-[64px] h-[64px] rounded-full object-cover transition-transform duration-300 group-hover:scale-110"
              />
            </div>
            <h4 className="font-bold text-gray-900 group-hover:text-lime-700 transition-colors">{cat.name}</h4>
            <p className="text-xs text-gray-400 mt-1 line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">{cat.desc}</p>
          </div>
        ))}
      </section>

      <section id="promos" className="px-[6%] py-12 grid sm:grid-cols-2 md:grid-cols-3 gap-8">
        <div 
          onClick={goToLogin}
          className="group rounded-[32px] p-8 bg-white border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between cursor-pointer hover:border-lime-200"
        >
          <div>
            <h3 className="text-2xl font-extrabold text-gray-900">Chicken Meal</h3>
            <p className="mt-2 text-gray-500 font-medium">Sulit Big Chicken</p>
          </div>
          <span className="block mt-6 text-4xl font-black text-lime-700 tracking-tight group-hover:scale-105 transition-transform origin-left">₱415</span>
        </div>
        <div 
          onClick={goToLogin}
          className="group rounded-[32px] p-8 bg-gray-900 text-white shadow-xl hover:shadow-2xl hover:bg-gray-800 transition-all duration-300 flex flex-col justify-between cursor-pointer"
        >
          <div>
            <h3 className="text-2xl font-extrabold">Rice Meal</h3>
            <p className="mt-2 text-gray-400 font-medium">Best seller combo</p>
          </div>
          <span className="block mt-6 text-4xl font-black text-yellow-400 tracking-tight group-hover:scale-105 transition-transform origin-left">₱198</span>
        </div>
        <div 
          onClick={goToLogin}
          className="group rounded-[32px] p-8 bg-gradient-to-br from-yellow-100 to-yellow-200 shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col justify-between border border-yellow-300/30 cursor-pointer hover:border-yellow-400"
        >
          <div>
            <h3 className="text-2xl font-extrabold text-gray-900">Fruity Soda & Fruity Milk</h3>
            <p className="mt-2 text-gray-700 font-medium">Perfect for refreshing drinks</p>
          </div>
          <span className="block mt-6 text-4xl font-black text-lime-800 tracking-tight group-hover:scale-105 transition-transform origin-left">₱109</span>
        </div>
      </section>

      <section id="about" className="mx-[6%] my-16 px-[6%] py-20 grid md:grid-cols-2 gap-12 bg-gradient-to-br from-[#f7f4ea] to-[#fdfaf3] rounded-[50px] items-center border border-yellow-600/5">
        <div className="relative">
          <div className="absolute -inset-1 bg-lime-700/10 rounded-[35px] blur-xl" />
          <img
            src={oppaLogo}
            alt="About Oppa Dru"
            className="w-full rounded-[35px] shadow-xl relative border-2 border-white"
          />
        </div>
        <div className="flex flex-col justify-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
            About Oppa Dru <br />
            <span className="text-lime-700">Korean Fried Chicken</span>
          </h2>
          <p className="text-gray-600 leading-relaxed font-medium">
            Oppa Dru Korean Fried Chicken is known for bold flavors, crispy
            textures, and authentic Korean-style recipes. Every dish is cooked
            fresh to satisfy your cravings.
          </p>
          <button 
            onClick={goToLogin}
            className="w-fit bg-lime-700 text-white px-8 py-3 rounded-xl font-bold hover:bg-lime-800 shadow-md hover:shadow-lg hover:shadow-lime-700/10 transition-all duration-300 transform hover:-translate-y-0.5"
          >
            Visit Store
          </button>
        </div>
      </section>

      <section className="mx-[6%] my-20 px-[6%] py-16 rounded-[40px] text-center text-white bg-gradient-to-r from-lime-700 to-emerald-600 shadow-xl shadow-lime-900/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent)] pointer-events-none" />
        <h2 className="text-4xl font-extrabold tracking-tight">Hungry already?</h2>
        <p className="mt-3 text-lime-100 font-medium max-w-md mx-auto text-base">
          Order now and experience Korean fried chicken goodness delivered straight to you.
        </p>
        <button 
          onClick={goToLogin}
          className="mt-8 bg-white text-lime-700 px-10 py-3.5 rounded-xl font-bold shadow-lg hover:bg-gray-50 hover:scale-105 transition-all duration-300"
        >
          Order Online
        </button>
      </section>

      <footer className="bg-[#1a2e1a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img 
                  src={oppaLogo} 
                  alt="Oppa Dru Logo" 
                  className="w-12 h-12 rounded-full object-cover border-2 border-yellow-400"
                />
                <h3 className="text-lg font-bold tracking-tight">Oppa Dru Korean Fried Chicken</h3>
              </div>
              <p className="text-gray-300/80 text-sm leading-relaxed">
                Authentic Korean fried chicken with bold flavors and crispy textures. Made fresh daily.
              </p>
            </div>

            <div>
              <h4 className="text-base font-bold mb-4 uppercase tracking-wider text-yellow-400">Quick Links</h4>
              <ul className="space-y-3 text-sm">
                <li>
                  <a 
                    href="#home" 
                    className="text-gray-300 hover:text-yellow-400 transition-colors"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a 
                    href="#about" 
                    className="text-gray-300 hover:text-yellow-400 transition-colors"
                  >
                    About Us
                  </a>
                </li>
                <li>
                  <a 
                    href="#categories" 
                    className="text-gray-300 hover:text-yellow-400 transition-colors"
                  >
                    Food Categories
                  </a>
                </li>
                <li>
                  <button 
                    onClick={goToLogin}
                    className="text-gray-300 hover:text-yellow-400 transition-colors"
                  >
                    Our Menu
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-base font-bold mb-4 uppercase tracking-wider text-yellow-400">Contact Us</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3 group">
                  <FiPhone className="text-yellow-400 shrink-0" />
                  <a href="tel:09473065526" className="text-gray-300 group-hover:text-white transition-colors">
                    0947 306 5526
                  </a>
                </li>
                <li className="flex items-center gap-3 group">
                  <FiMail className="text-yellow-400 shrink-0" />
                  <a href="mailto:oppadrukfc@gmail.com" className="text-gray-300 group-hover:text-white transition-colors">
                    oppadrukfc@gmail.com
                  </a>
                </li>
                <li className="flex gap-3 group">
                  <FiMapPin className="text-yellow-400 mt-0.5 shrink-0" />
                  <span className="text-gray-300 leading-relaxed group-hover:text-white transition-colors">
                    37 Malihan St. Barangay Zone 1<br />Dasmariñas, Cavite, Philippines
                  </span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-base font-bold uppercase tracking-wider text-yellow-400">Follow Us</h4>
              <div className="flex gap-3">
                <a 
                  href="https://www.facebook.com/oppadruKFC" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center overflow-hidden hover:border-yellow-400 hover:scale-105 transition-all duration-300"
                >
                  <img src={fbLogo} alt="Facebook" className="w-full h-full object-cover" />
                </a>
                <a 
                  href="https://www.instagram.com/oppadrukfc/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center overflow-hidden hover:border-yellow-400 hover:scale-105 transition-all duration-300"
                >
                  <img src={igLogo} alt="Instagram" className="w-full h-full object-cover" />
                </a>
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Business Hours</h4>
                <p className="text-gray-300 text-sm font-medium">Daily: 11:00 AM - 11:00 PM</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-6 py-5 text-center">
            <p className="text-gray-500 text-xs font-medium">© 2018 Oppa Dru Korean Fried Chicken. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
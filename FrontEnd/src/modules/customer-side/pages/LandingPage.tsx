import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/navigation/navbar";
import oppaLogo from "../../../assets/oppadrulogo.jpg";
import fbLogo from "../../../assets/facebook-logoo.png";
import igLogo from "../../../assets/instagram-logoo.png";
import { FiArrowRight, FiPhone, FiMail, FiMapPin } from "react-icons/fi";
import { MdOutlineFastfood } from "react-icons/md";
import { landingCategories } from "../../../data/landingCategories";
import heroSectionImg from "../../../assets/herosection.png";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const goToLogin = () => {
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] text-gray-800 antialiased selection:bg-lime-700 selection:text-white">
      <Navbar />

      <section id="home" className="min-h-[90vh] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroSectionImg}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-widest text-white uppercase bg-lime-700/80 backdrop-blur-sm rounded-full mb-8">
            <MdOutlineFastfood /> Freshly Cooked Daily
          </span>
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extrabold leading-[1.1] text-white tracking-tight">
            Oppa Dru
          </h1>
          <p className="text-xl sm:text-2xl md:text-3xl text-white/90 font-serif mt-4">
            Korean Fried Chicken
          </p>
          <p className="text-base sm:text-lg text-white/70 mt-4 max-w-2xl mx-auto leading-relaxed">
            Sauced, tossed, and straight-up obsessed. Authentic Korean fried chicken made fresh daily.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <button
              onClick={goToLogin}
              className="group bg-lime-700 text-white px-10 py-4 rounded-2xl font-bold text-base shadow-xl shadow-lime-700/30 hover:bg-lime-800 transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-3"
            >
              Order Now
              <FiArrowRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={goToLogin}
              className="bg-white/10 backdrop-blur-sm border-2 border-white/40 text-white px-10 py-4 rounded-2xl font-bold text-base hover:bg-white/20 hover:border-white/60 transition-all duration-300 transform hover:-translate-y-1"
            >
              View Menu
            </button>
            <button
              onClick={() => navigate('/franchise/apply')}
              className="bg-white text-lime-800 px-10 py-4 rounded-2xl font-bold text-base shadow-xl shadow-white/20 hover:bg-lime-50 transition-all duration-300 transform hover:-translate-y-1"
            >
              Franchise
            </button>
          </div>
        </div>
      </section>

      <section id="menu" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <span className="text-sm font-semibold text-lime-700 uppercase tracking-widest">Categories</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2">Our Menu Categories</h2>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">Choose from our wide variety of Korean fried chicken flavors</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
          {landingCategories.map((cat) => (
            <div
              key={cat.id}
              className="group bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300"
            >
              <div className="relative mb-4 mx-auto w-20 h-20 rounded-full border-2 border-gray-100 overflow-hidden group-hover:border-lime-200 transition-colors">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              </div>
              <h4 className="font-bold text-gray-900 text-sm group-hover:text-lime-700 transition-colors">{cat.name}</h4>
              <p className="text-xs text-gray-400 mt-1 line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">{cat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="promos" className="max-w-7xl mx-auto px-6 pb-20">
        <div className="text-center mb-14">
          <span className="text-sm font-semibold text-lime-700 uppercase tracking-widest">Promos</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2">Special Offers</h2>
          <p className="text-gray-500 mt-2">Get the best deals on your favorite meals</p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-8">
          <div
            className="rounded-[32px] p-8 bg-white border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <h3 className="text-2xl font-extrabold text-gray-900">Chicken Meal</h3>
              <p className="mt-2 text-gray-500 font-medium">Sulit Big Chicken</p>
            </div>
            <span className="block mt-6 text-4xl font-black text-lime-700 tracking-tight group-hover:scale-105 transition-transform origin-left">₱415</span>
          </div>
          <div
            className="rounded-[32px] p-8 bg-gray-900 text-white shadow-lg hover:shadow-2xl hover:bg-gray-800 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <h3 className="text-2xl font-extrabold">Rice Meal</h3>
              <p className="mt-2 text-gray-400 font-medium">Best seller combo</p>
            </div>
            <span className="block mt-6 text-4xl font-black text-yellow-400 tracking-tight group-hover:scale-105 transition-transform origin-left">₱198</span>
          </div>
          <div
            className="rounded-[32px] p-8 bg-gradient-to-br from-yellow-100 to-yellow-200 shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col justify-between border border-yellow-300/30"
          >
            <div>
              <h3 className="text-2xl font-extrabold text-gray-900">Fruity Soda & Milk</h3>
              <p className="mt-2 text-gray-700 font-medium">Perfect for refreshing drinks</p>
            </div>
            <span className="block mt-6 text-4xl font-black text-lime-800 tracking-tight group-hover:scale-105 transition-transform origin-left">₱109</span>
          </div>
        </div>
      </section>

      <section id="about" className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-12 bg-white rounded-[40px] p-8 md:p-12 shadow-lg border border-gray-100 items-center">
          <div className="relative">
            <div className="absolute -inset-2 bg-lime-700/10 rounded-[35px] blur-xl" />
            <img
              src={oppaLogo}
              alt="About Oppa Dru"
              className="w-full rounded-[30px] shadow-xl relative border-2 border-white"
            />
          </div>
          <div className="space-y-6">
            <span className="text-sm font-semibold text-lime-700 uppercase tracking-widest">About Us</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
              Oppa Dru <br />
              <span className="text-lime-700">Korean Fried Chicken</span>
            </h2>
            <p className="text-gray-600 leading-relaxed">
              Oppa Dru Korean Fried Chicken is known for bold flavors, crispy
              textures, and authentic Korean-style recipes. Every dish is cooked
              fresh to satisfy your cravings.
            </p>
            <button
              onClick={goToLogin}
              className="bg-lime-700 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-lime-800 shadow-lg shadow-lime-700/20 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Visit Store
            </button>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="rounded-[40px] text-center text-white bg-gradient-to-r from-lime-700 to-emerald-600 shadow-xl shadow-lime-900/20 p-12 md:p-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent)] pointer-events-none" />
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">Hungry already?</h2>
          <p className="mt-3 text-lime-100 font-medium max-w-md mx-auto text-base">
            Order now and experience Korean fried chicken goodness delivered straight to you.
          </p>
          <button
            onClick={goToLogin}
            className="mt-8 bg-white text-lime-700 px-10 py-3.5 rounded-xl font-bold shadow-lg hover:bg-gray-50 hover:scale-105 transition-all duration-300"
          >
            Order Online
          </button>
        </div>
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

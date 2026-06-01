import React from "react";
import Navbar from "../components/navbar";
import oppaLogo from "../../../assets/oppadrulogo.jpg";
import fbLogo from "../../../assets/facebook-logoo.png";
import igLogo from "../../../assets/instagram-logoo.png";

const categories = [
  { name: "Chicken", desc: "Crispy Korean fried chicken", image: "https://placehold.co/60x60" },
  { name: "Rice Meals", desc: "Busog meals everyday", image: "https://placehold.co/60x60" },
  { name: "Sulit Meals", desc: "Affordable & satisfying", image: "https://placehold.co/60x60" },
  { name: "Snacks", desc: "Perfect anytime bites", image: "https://placehold.co/60x60" },
  { name: "Beverages", desc: "Cold refreshing drinks", image: "https://placehold.co/60x60" },
  { name: "Sides", desc: "Add-ons you'll love", image: "https://placehold.co/60x60" },
];

const LandingPage: React.FC = () => {
  return (
    <div className="overflow-x-hidden bg-[#fdfaf3] text-gray-800">
      <Navbar />

      {/* HERO */}
      <section
        id="home"
        className="grid md:grid-cols-2 items-center gap-12 px-[6%] py-24 bg-gradient-to-br from-yellow-100 to-orange-50 rounded-b-[80px]"
      >
        <div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Welcome to <span className="text-lime-700">Oppa Dru Korean Fried Chicken</span>
          </h1>
          <p className="mt-6 text-lg text-gray-600 leading-relaxed">
            Authentic Korean Fried Chicken
            <br />
            Crispy. Juicy. Made Fresh Daily.
          </p>
          <div className="flex flex-wrap gap-4 mt-8">
            <button className="bg-lime-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-lime-800 transition">
              Order Now
            </button>
            <button className="border-2 border-lime-700 text-lime-700 px-6 py-3 rounded-xl font-semibold hover:bg-lime-100 transition">
              View Menu
            </button>
          </div>
        </div>
        <div className="flex justify-center">
          <img
            src="https://placehold.co/420x420"
            alt="Oppa Dru Chicken"
            className="w-full max-w-[420px] rounded-[30px] shadow-2xl"
          />
        </div>
      </section>

      {/* CATEGORIES */}
      <section id="categories" className="mt-[-40px] px-[6%] py-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        {categories.map((c) => (
          <div
            key={c.name}
            className="bg-white/80 backdrop-blur-md rounded-2xl p-6 text-center shadow-lg hover:-translate-y-2 transition cursor-pointer"
          >
            <img
              src={c.image}
              alt={c.name}
              className="w-[60px] h-[60px] rounded-full object-cover mx-auto mb-3"
            />
            <h4 className="font-semibold">{c.name}</h4>
          </div>
        ))}
      </section>

      {/* PROMOS */}
      <section className="px-[6%] py-20 grid md:grid-cols-3 gap-8">
        <div className="rounded-[26px] p-8 bg-white/80 shadow-2xl">
          <h3 className="text-2xl font-bold">Chicken Deal</h3>
          <p className="mt-3 text-gray-600">Get 20% OFF on first order</p>
          <span className="block mt-4 text-3xl font-bold text-lime-700">₱199</span>
        </div>
        <div className="rounded-[26px] p-8 bg-gray-900 text-white shadow-2xl">
          <h3 className="text-2xl font-bold">Rice Meal</h3>
          <p className="mt-3 text-gray-300">Best seller combo</p>
          <span className="block mt-4 text-3xl font-bold text-yellow-300">₱149</span>
        </div>
        <div className="rounded-[26px] p-8 bg-yellow-200 shadow-2xl">
          <h3 className="text-2xl font-bold">Sulit Meal</h3>
          <p className="mt-3 text-gray-700">Perfect for sharing</p>
          <span className="block mt-4 text-3xl font-bold text-lime-700">₱299</span>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="mx-[6%] my-16 px-[6%] py-20 grid md:grid-cols-2 gap-12 bg-gradient-to-br from-[#f7f4ea] to-[#fdfaf3] rounded-[60px]">
        <div>
          <img
            src="https://placehold.co/600x400"
            alt="About Oppa Dru"
            className="w-full rounded-[35px] shadow-2xl"
          />
        </div>
        <div className="flex flex-col justify-center">
          <h2 className="text-4xl font-bold">About Oppa Dru Korean Fried Chicken</h2>
          <p className="mt-6 text-gray-600 leading-8">
            Oppa Dru Korean Fried Chicken is known for bold flavors, crispy
            textures, and authentic Korean-style recipes. Every dish is cooked
            fresh to satisfy your cravings.
          </p>
          <button className="mt-8 w-fit bg-lime-700 text-white px-6 py-3 rounded-xl font-semibold hover:bg-lime-800 transition">
            Visit Store
          </button>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-[6%] my-20 px-[6%] py-20 rounded-[50px] text-center text-white bg-gradient-to-br from-lime-700 to-green-500">
        <h2 className="text-4xl font-bold">Hungry already?</h2>
        <p className="mt-4 text-lg">
          Order now and experience Korean fried chicken goodness.
        </p>
        <button className="mt-8 bg-white text-lime-700 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition">
          Order Online
        </button>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#1a2e1a] text-white">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Column 1 - Brand with Logo */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src={oppaLogo} 
                  alt="Oppa Dru Logo" 
                  className="w-12 h-12 rounded-full object-cover border-2 border-yellow-400"
                />
                <h3 className="text-xl font-bold">Oppa Dru Korean Fried Chicken</h3>
              </div>
              <p className="text-gray-300 text-sm leading-relaxed">
                Authentic Korean fried chicken with bold flavors and crispy textures. Made fresh daily.
              </p>
            </div>

            {/* Column 2 - Quick Links */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-yellow-400">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#home" className="text-gray-300 hover:text-yellow-400 transition">Home</a></li>
                <li><a href="#about" className="text-gray-300 hover:text-yellow-400 transition">About Us</a></li>
                <li><a href="#categories" className="text-gray-300 hover:text-yellow-400 transition">Food Categories</a></li>
                <li><a href="/menu" className="text-gray-300 hover:text-yellow-400 transition">Our Menu</a></li>
              </ul>
            </div>

            {/* Column 3 - Contact Info */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-yellow-400">Contact Us</h4>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <span>📞</span>
                  <span className="text-gray-300">0947 306 5526</span>
                </li>
                <li className="flex items-center gap-3">
                  <span>📧</span>
                  <span className="text-gray-300">oppadrukfc@gmail.com</span>
                </li>
                <li className="flex gap-3">
                  <span>📍</span>
                  <span className="text-gray-300">37 Malihan St. Barangay Zone 1<br />Dasmariñas, Cavite, Philippines</span>
                </li>
              </ul>
            </div>

            {/* Column 4 - Social & Hours */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-yellow-400">Follow Us</h4>
              <div className="flex gap-3 mb-6">
                <a 
                  href="https://www.facebook.com/oppadruKFC" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full overflow-hidden hover:opacity-80 transition"
                >
                  <img 
                    src={fbLogo} 
                    alt="Facebook" 
                    className="w-full h-full object-cover"
                  />
                </a>
                <a 
                  href="https://www.instagram.com/oppadrukfc/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full overflow-hidden hover:opacity-80 transition"
                >
                  <img 
                    src={igLogo} 
                    alt="Instagram" 
                    className="w-full h-full object-cover"
                  />
                </a>
              </div>
              <h4 className="text-lg font-semibold mb-3 text-yellow-400">Business Hours</h4>
              <p className="text-gray-300 text-sm">Daily: 11:00 AM - 11:00 PM</p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700">
          <div className="max-w-7xl mx-auto px-6 py-4 text-center">
            <p className="text-gray-400 text-sm">© 2018 Oppa Dru Korean Fried Chicken. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
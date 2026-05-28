import React from "react";
import Navbar from "../components/navbar";
import chickenImage from "../assets/chicken.jpg";

const categories = [
  { name: "Chicken", desc: "Crispy Korean fried chicken" },
  { name: "Rice Meals", desc: "Busog meals everyday" },
  { name: "Sulit Meals", desc: "Affordable & satisfying" },
  { name: "Snacks", desc: "Perfect anytime bites" },
  { name: "Beverages", desc: "Cold refreshing drinks" },
  { name: "Sides", desc: "Add-ons you'll love" },
];

const LandingPage: React.FC = () => {
  return (
    <div className="overflow-x-hidden bg-[#fdfaf3] text-gray-800">
      <Navbar />

      {/* HERO */}
      <section className="grid md:grid-cols-2 items-center gap-12 px-[6%] py-24 bg-gradient-to-br from-yellow-100 to-orange-50 rounded-b-[80px]">
        <div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Welcome to <span className="text-lime-700">Oppa Dru</span>
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
            src={chickenImage}
            alt="Oppa Dru Chicken"
            className="w-full max-w-[420px] rounded-[30px] shadow-2xl"
          />
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mt-[-40px] px-[6%] py-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
        {categories.map((c) => (
          <div
            key={c.name}
            className="bg-white/80 backdrop-blur-md rounded-2xl p-6 text-center shadow-lg hover:-translate-y-2 transition"
          >
            <img
              src={chickenImage}
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
      <section className="mx-[6%] my-16 px-[6%] py-20 grid md:grid-cols-2 gap-12 bg-gradient-to-br from-[#f7f4ea] to-[#fdfaf3] rounded-[60px]">
        <div>
          <img
            src={chickenImage}
            alt="About Oppa Dru"
            className="w-full rounded-[35px] shadow-2xl"
          />
        </div>
        <div className="flex flex-col justify-center">
          <h2 className="text-4xl font-bold">About Oppa Dru</h2>
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
      <footer className="bg-[#2f3e2e] text-white text-center py-10 px-5">
        <p>© 2026 Oppa Dru Korean Fried Chicken</p>
        <span className="block mt-3 text-sm text-gray-300">
          📞 0947 306 5526 | Facebook: Oppa Dru Korean Fried Chicken
        </span>
      </footer>
    </div>
  );
};

export default LandingPage;
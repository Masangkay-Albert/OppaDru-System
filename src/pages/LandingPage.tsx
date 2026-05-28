import {
  ArrowRight,
  Star,
  Clock3,
  Truck,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";

import Navbar from "../components/Navbar";

import heroImg from "../assets/hero.png";
import chickenImg from "../assets/chicken.jpg";
import landingImg from "../assets/landing page.jpg";

import "../styles/global.css";
import "../styles/navbar.css";
import "../styles/landingpage.css";

export default function LandingPage() {
  const categories = [
    "Rice Meals",
    "Sulit Meals",
    "Chicken",
    "Beverages",
    "Snack",
    "Side Dishes",
  ];

  const featuredProducts = [
    {
      title: "Soy Garlic Chicken",
      price: "₱299",
      image: chickenImg,
    },
    {
      title: "Spicy Korean Chicken",
      price: "₱329",
      image: chickenImg,
    },
    {
      title: "Kimchi Rice Meal",
      price: "₱149",
      image: chickenImg,
    },
  ];

  return (
    <div className="landing-page">
      <Navbar />

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-left">
          <span className="hero-tag">
            Authentic Korean Flavors
          </span>

          <h1>
            Crispy Korean
            <span> Fried Chicken</span>
          </h1>

          <p>
            Experience premium Korean fried chicken
            with bold flavors, crispy texture, and
            satisfying meals made fresh everyday.
          </p>

          <div className="hero-buttons">
            <button className="primary-btn">
              Explore Menu
              <ArrowRight size={18} />
            </button>

            <button className="secondary-btn">
              Learn More
            </button>
          </div>

          <div className="hero-stats">
            <div>
              <h3>10K+</h3>
              <p>Happy Customers</p>
            </div>

            <div>
              <h3>25+</h3>
              <p>Menu Items</p>
            </div>

            <div>
              <h3>4.9</h3>
              <p>Ratings</p>
            </div>
          </div>
        </div>

        <div className="hero-right">
          <img
            src={heroImg}
            alt="Hero"
            className="hero-image"
          />
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="categories-section">
        <div className="section-header">
          <span>MENU CATEGORIES</span>

          <h2>What We Serve</h2>
        </div>

        <div className="categories-grid">
          {categories.map((category) => (
            <div
              className="category-box"
              key={category}
            >
              {category}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="products-section">
        <div className="section-header">
          <span>FEATURED ITEMS</span>

          <h2>Customer Favorites</h2>
        </div>

        <div className="products-grid">
          {featuredProducts.map((product) => (
            <div
              className="product-card"
              key={product.title}
            >
              <img
                src={product.image}
                alt={product.title}
              />

              <div className="product-info">
                <div className="product-top">
                  <h3>{product.title}</h3>

                  <span>{product.price}</span>
                </div>

                <div className="rating">
                  <Star size={16} fill="gold" />
                  <Star size={16} fill="gold" />
                  <Star size={16} fill="gold" />
                  <Star size={16} fill="gold" />
                  <Star size={16} fill="gold" />
                </div>

                <p>
                  Crispy, juicy, and packed with
                  authentic Korean flavor.
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* WHY US */}
      <section className="why-section">
        <div className="why-container">
          <div className="why-card">
            <Truck size={34} />

            <h3>Fast Delivery</h3>

            <p>
              Freshly prepared meals delivered hot
              and crispy.
            </p>
          </div>

          <div className="why-card">
            <Clock3 size={34} />

            <h3>Fresh Everyday</h3>

            <p>
              Prepared daily using premium
              ingredients.
            </p>
          </div>

          <div className="why-card">
            <Star size={34} />

            <h3>Top Rated</h3>

            <p>
              Loved by customers for taste and
              quality.
            </p>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="about-section">
        <div className="about-image">
          <img
            src={landingImg}
            alt="About"
          />
        </div>

        <div className="about-content">
          <span>ABOUT OPPA DRU</span>

          <h2>
            Bringing Korean Street Food To Cavite
          </h2>

          <p>
            Oppa Dru Korean Fried Chicken offers
            authentic Korean-inspired meals with
            bold flavors, crispy chicken, and
            unforgettable taste.
          </p>

          <p>
            Our mission is to serve affordable,
            delicious, and satisfying food for
            everyone.
          </p>

          <button className="primary-btn">
            Discover More
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* CONTACT */}
      <section className="contact-section">
        <div className="section-header">
          <span>CONTACT US</span>

          <h2>Visit Or Contact Us</h2>
        </div>

        <div className="contact-grid">
          <div className="contact-card">
            <Phone size={28} />

            <h3>Phone</h3>

            <p>0947-306-5526</p>
          </div>

          <div className="contact-card">
            <Mail size={28} />

            <h3>Email</h3>

            <p>hello@oppadru.ph</p>
          </div>

          <div className="contact-card">
            <MapPin size={28} />

            <h3>Location</h3>

            <p>Dasmariñas, Cavite</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>
            Taste The Crunch Of Korea
          </h2>

          <p>
            Freshly cooked Korean fried chicken
            made with premium ingredients.
          </p>

          <button className="cta-btn">
            Explore Our Menu
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <p>
          © 2025 Oppa Dru Korean Fried Chicken.
          All rights reserved.
        </p>
      </footer>
    </div>
  );
}
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Clock3, CookingPot, CupSoda, Drumstick, GlassWater,
  MapPin, Phone, Sandwich, Soup, Truck, Utensils,
} from 'lucide-react';
import { BrandFooter, BrandNavbar } from '../../shared/components/BrandChrome';
import { getProductImage } from '../../../data/productImages';
import { getLandingHeroImage } from '../../../data/landingHeroImage';
import { productService, type Product } from '../../../services/productService';
import { formatCurrency } from '../../../utils/formatters';
import '../../../styles/LandingPage.css';
import oppaLogo from '../../../assets/oppadrulogo.jpg';

const categoryCards = [
  { name: 'Non-Coffee', text: 'Refreshing drinks for every mood.', fallbackPhoto: getProductImage('blueberry-milk.jpg'), icon: GlassWater },
  { name: 'Noodles', text: 'Comforting noodles with Korean-inspired flavor.', fallbackPhoto: getProductImage('samyang.jpg'), icon: Soup },
  { name: 'Fruity Soda', text: 'Colorful, cool sips to pair with your meal.', fallbackPhoto: getProductImage('strawberry-soda.jpg'), icon: CupSoda },
  { name: 'Snacks', text: 'Shareable bites for any time of day.', fallbackPhoto: getProductImage('tteokkboki.jpg'), icon: Sandwich },
  { name: 'Chicken Meal', text: 'Crispy Korean fried chicken with bold sauces.', fallbackPhoto: getProductImage('yangneomgarlic-chicken.jpg'), icon: Drumstick },
  { name: 'Rice Meal', text: 'Satisfying meals served with rice.', fallbackPhoto: getProductImage('original-rice.jpg'), icon: CookingPot },
];

const fallbackFeaturedProducts = [
  { name: 'Yangnyeom Boneless Chicken', description: 'Korean-style sweet and spicy yangnyeom boneless chicken.', price: '₱438', photo: getProductImage('yangyneom-chicken.jpg') },
  { name: 'Soy Garlic Boneless Chicken', description: 'Boneless chicken glazed with soy garlic sauce.', price: '₱428', photo: getProductImage('soygarlic-chicken.jpg') },
  { name: 'Classic BBQ Boneless Chicken', description: 'Boneless chicken tossed in classic BBQ sauce.', price: '₱428', photo: getProductImage('classicbbq-chicken.jpg') },
  { name: 'Tteokkboki (Ricecake + Fishcake)', description: 'Korean rice cakes and fishcake in spicy sauce.', price: '₱139', photo: getProductImage('tteokkboki.jpg') },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const goToLogin = () => navigate('/login');

  useEffect(() => {
    let active = true;
    productService.getAvailableProducts().then((availableProducts) => {
      if (active) setProducts(availableProducts);
    }).catch((error: unknown) => {
      console.error('Unable to load current menu products for the landing page.', error);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const featuredProducts = useMemo(() => {
    if (!products.length) return fallbackFeaturedProducts;

    const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const preferredNames = ['yangnyeom boneless', 'soy garlic boneless', 'classic bbq boneless', 'tteokkboki'];
    const selected = preferredNames
      .map((keyword) => products.find((product) => normalize(product.name).includes(keyword)))
      .filter((product): product is Product => Boolean(product));
    const chosenIds = new Set(selected.map((product) => product.id));
    const featured = [...selected, ...products.filter((product) => !chosenIds.has(product.id))]
      .slice(0, 4)
      .map((product) => ({
        name: product.name,
        description: product.description,
        price: formatCurrency(product.price),
        photo: product.image,
      }));

    return featured.length ? featured : fallbackFeaturedProducts;
  }, [products]);

  const getCategoryPhoto = (categoryName: string, fallbackPhoto: string) => {
    const normalizedCategory = categoryName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '');
    const match = products.find((product) => {
      const category = product.category.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '');
      const name = product.name.toLocaleLowerCase();
      if (normalizedCategory === 'noncoffee') {
        return category.includes('noncoffee') || (category.includes('beverage') && !name.includes('soda'));
      }
      if (normalizedCategory === 'fruitysoda') {
        return category.includes('fruitysoda') || name.includes('soda');
      }
      return category.includes(normalizedCategory.replace('meal', '')) || name.includes(normalizedCategory.replace('meal', ''));
    });
    return match?.image || fallbackPhoto;
  };

  return (
    <div className="oppa-landing-page">
      <BrandNavbar />

      <section id="home" className="oppa-home-hero">
        <div className="oppa-hero-watermark" aria-hidden="true"><img src={oppaLogo} alt="" /></div>
        <div className="oppa-landing-container oppa-hero-grid">
          <div className="oppa-hero-copy">
            <span className="oppa-fresh-badge"><span /> <CookingPot size={15} /> Freshly Cooked Daily</span>
            <p className="oppa-eyebrow oppa-eyebrow-light">Korean fried chicken, made for sharing</p>
            <h1>Bold flavor.<br /><em>Golden crunch.</em></h1>
            <p className="oppa-hero-subtitle">Korean Fried Chicken</p>
            <p className="oppa-hero-description">Crispy chicken, savory sauces, and satisfying sides—prepared fresh and ready for your next favorite meal.</p>
            <div className="oppa-hero-actions">
              <button type="button" onClick={goToLogin} className="oppa-button oppa-button-yellow">Order Now <ArrowRight size={17} /></button>
              <button type="button" onClick={goToLogin} className="oppa-button oppa-button-outline">View Menu</button>
              <button type="button" onClick={() => navigate('/franchise-opportunities')} className="oppa-button oppa-button-white">Franchise</button>
            </div>
          </div>
          <div className="oppa-hero-art">
            <div className="oppa-hero-photo"><img src={getLandingHeroImage(products)} alt="Crispy Oppa Dru Korean fried chicken" /></div>
            <div className="oppa-mascot-sticker"><img src={oppaLogo} alt="Oppa Dru mascot" /></div>
          </div>
        </div>
        <div className="oppa-landing-container oppa-trust-strip">
          <div><CookingPot size={17} /><span>Cooked fresh daily</span></div>
          <div><Utensils size={17} /><span>Authentic Korean recipes</span></div>
          <div><Clock3 size={17} /><span>Open daily 10:00 AM – 11:00 PM</span></div>
          <div><Truck size={17} /><span>Delivery available</span></div>
        </div>
      </section>

      <main>
        <section id="menu" className="oppa-landing-section oppa-landing-container" data-reveal>
          <SectionHeading eyebrow="Explore the menu" title="Find your kind of delicious." text="From crispy chicken to refreshing drinks, there is something for every craving." />
          <div className="oppa-category-grid">
            {categoryCards.map(({ name, text, fallbackPhoto, icon: Icon }) => (
              <article className="oppa-category-card" key={name}>
                <button type="button" className="oppa-category-image" onClick={goToLogin} aria-label={`View ${name} items`}>
                  <img src={getCategoryPhoto(name, fallbackPhoto)} alt="" /><span className="oppa-category-icon"><Icon size={20} /></span>
                </button>
                <div className="oppa-category-copy"><h3>{name}</h3><p>{text}</p>
                  <button type="button" onClick={goToLogin} className="oppa-text-link">View items <ArrowRight size={15} /></button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="oppa-landing-section oppa-landing-container" data-reveal>
          <SectionHeading eyebrow="Customer favorites" title="Best sellers & featured menu" text="Explore a few customer favorites from our menu." />
          <div className="oppa-product-grid">
            {featuredProducts.map((product) => (
              <article className="oppa-product-card" key={product.name}>
                <div className="oppa-product-photo"><img src={product.photo} alt="" /><span>Featured</span></div>
                <div className="oppa-product-copy"><h3>{product.name}</h3><p>{product.description}</p>
                  <div><strong>{product.price}</strong><button type="button" onClick={goToLogin} className="oppa-order-small">Order <ArrowRight size={14} /></button></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="oppa-landing-container oppa-about-section" data-reveal>
          <div className="oppa-about-card">
            <div className="oppa-about-art"><span className="oppa-about-shape" /><img src={oppaLogo} alt="Oppa Dru mascot" /></div>
            <div className="oppa-about-copy"><p className="oppa-eyebrow">A little about us</p><h2>Meet Oppa Dru Korean Fried Chicken.</h2>
              <p>We serve Korean-style fried chicken with crisp textures, bold sauces, and a menu made for everyday cravings. Find your favorite, share a meal, and enjoy it fresh.</p>
              <div className="oppa-about-highlights">
                <span><strong>Since 2018</strong><small>Serving our community</small></span>
                <span><strong>Cooked fresh</strong><small>Made to order</small></span>
                <span><strong>Korean-inspired</strong><small>Bold recipe flavors</small></span>
              </div>
              <button type="button" onClick={goToLogin} className="oppa-button oppa-button-green">Visit Store <ArrowRight size={16} /></button>
            </div>
          </div>
        </section>

        <section className="oppa-landing-container oppa-franchise-teaser" data-reveal>
          <div><p className="oppa-eyebrow oppa-eyebrow-light">Bring the flavor closer</p><h2>Grow with Oppa Dru.</h2><p>Explore a franchise opportunity and learn what it takes to build a branch with us.</p></div>
          <ul><li><span>01</span> Application reviewed individually</li><li><span>02</span> Proposed location guidance</li><li><span>03</span> Tools and onboarding to discuss</li></ul>
          <button type="button" onClick={() => navigate('/franchise-opportunities')} className="oppa-button oppa-button-yellow">Explore Franchise <ArrowRight size={16} /></button>
        </section>

        <section className="oppa-landing-section oppa-landing-container" data-reveal>
          <SectionHeading eyebrow="Come by or get in touch" title="Visit us" text="Stop by for a freshly cooked meal or contact the team for directions." />
          <div className="oppa-visit-card">
            <div className="oppa-visit-details">
              <div><span><MapPin size={18} /></span><p><strong>Address</strong>37 Malihan St. Barangay Zone 1,<br />Dasmariñas, Cavite, Philippines</p></div>
              <div><span><Clock3 size={18} /></span><p><strong>Business hours</strong>Daily: 10:00 AM – 11:00 PM</p></div>
              <div><span><Phone size={18} /></span><p><strong>Call us</strong><a href="tel:09473065526">0947 306 5526</a></p></div>
              <a href="https://maps.google.com/?q=37+Malihan+St+Barangay+Zone+1+Dasmarinas+Cavite+Philippines" target="_blank" rel="noreferrer" className="oppa-button oppa-button-green">Get Directions <ArrowRight size={16} /></a>
            </div>
            <div className="oppa-map-placeholder" role="img" aria-label="Map placeholder for Oppa Dru at 37 Malihan Street in Dasmariñas, Cavite">
              <div className="oppa-map-grid" /><span className="oppa-map-pin"><MapPin size={24} fill="currentColor" /></span><div className="oppa-map-label"><strong>Oppa Dru Korean Fried Chicken</strong><span>37 Malihan St., Dasmariñas, Cavite</span></div>
            </div>
          </div>
        </section>

        <section className="oppa-landing-container oppa-hungry-cta" data-reveal>
          <div className="oppa-cta-pattern" aria-hidden="true" />
          <p className="oppa-eyebrow oppa-eyebrow-light">The good stuff is calling</p><h2>Hungry already?</h2>
          <p>Order now and enjoy Korean-inspired fried chicken, cooked fresh for you.</p>
          <div><button type="button" onClick={goToLogin} className="oppa-button oppa-button-yellow">Order Online <ArrowRight size={16} /></button><button type="button" onClick={goToLogin} className="oppa-button oppa-button-outline">View Menu</button></div>
        </section>
      </main>
      <BrandFooter />
    </div>
  );
};

const SectionHeading: React.FC<{ eyebrow: string; title: string; text: string }> = ({ eyebrow, title, text }) => (
  <div className="oppa-section-heading"><p className="oppa-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{text}</p></div>
);

export default LandingPage;

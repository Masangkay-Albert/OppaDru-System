import React, { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import oppaLogo from '../../../assets/oppadrulogo.jpg';
import fbLogo from '../../../assets/facebook-logoo.png';
import igLogo from '../../../assets/instagram-logoo.png';
import '../../../styles/BrandChrome.css';

type BrandNavbarProps = {
  variant?: 'customer' | 'franchise';
  onApply?: () => void;
  applyDisabled?: boolean;
};

const navItems = [
  { label: 'Home', href: '/#home', section: 'home' },
  { label: 'Menu', href: '/#menu', section: 'menu' },
  { label: 'Franchise', href: '/franchise-opportunities', section: 'franchise' },
  { label: 'About', href: '/#about', section: 'about' },
];

export const BrandNavbar: React.FC<BrandNavbarProps> = ({
  variant = 'customer',
  onApply,
  applyDisabled = false,
}) => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const isFranchise = variant === 'franchise';

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 12);
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateScroll);
  }, []);

  useEffect(() => {
    if (variant !== 'customer' || window.location.pathname !== '/') return;
    if (!('IntersectionObserver' in window)) return;
    const sections = navItems
      .filter((item) => item.section !== 'franchise')
      .map((item) => document.getElementById(item.section))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.1, 0.5] });
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [variant]);

  const primaryAction = () => {
    setMenuOpen(false);
    if (isFranchise) onApply?.();
    else navigate('/login');
  };

  return (
    <header className={`brand-navbar ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="brand-navbar-inner">
        <Link to="/" className="brand-navbar-logo" aria-label="Oppa Dru Korean Fried Chicken home">
          <span className="brand-logo-mark"><img src={oppaLogo} alt="" /></span>
          <span className="brand-logo-copy"><strong>Oppa Dru</strong><span>Korean Fried Chicken</span></span>
        </Link>

        <nav className={`brand-navbar-links ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">
          {navItems.map((item) => (
            <a
              key={item.section}
              href={item.href}
              className={`brand-navbar-link ${(isFranchise && item.section === 'franchise') || (!isFranchise && item.section === activeSection) ? 'is-active' : ''}`}
              aria-current={isFranchise && item.section === 'franchise' ? 'page' : !isFranchise && item.section === activeSection ? 'location' : undefined}
              onClick={(event) => {
                setMenuOpen(false);
                if (item.href.startsWith('/#') && window.location.pathname === '/') {
                  event.preventDefault();
                  document.getElementById(item.section)?.scrollIntoView({ behavior: 'smooth' });
                } else if (item.href.startsWith('/#')) {
                  navigate(item.href);
                }
              }}
            >
              {item.label}
            </a>
          ))}
          {isFranchise && (
            <Link to="/franchise/applicant-login" className="brand-mobile-login" onClick={() => setMenuOpen(false)}>Login</Link>
          )}
          {isFranchise && (
            <button type="button" className="brand-mobile-apply" onClick={primaryAction} disabled={applyDisabled}>Apply Now <ArrowRight size={15} /></button>
          )}
        </nav>

        {isFranchise ? (
          <div className="brand-navbar-actions">
            <Link to="/franchise/applicant-login" className="brand-login-link">Login</Link>
            <button type="button" className="brand-navbar-cta" onClick={primaryAction} disabled={applyDisabled}>Apply Now <ArrowRight size={15} /></button>
          </div>
        ) : (
          <button type="button" className="brand-navbar-cta brand-customer-login" onClick={primaryAction}>Login</button>
        )}

        <button
          type="button"
          className="brand-mobile-toggle"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
};

type BrandFooterProps = {
  variant?: 'customer' | 'franchise';
};

export const BrandFooter: React.FC<BrandFooterProps> = ({ variant = 'customer' }) => {
  const isFranchise = variant === 'franchise';
  return (
    <footer className="brand-footer">
      <div className="brand-footer-grid">
        <div className="brand-footer-about">
          <Link to="/" className="brand-footer-logo">
            <span className="brand-logo-mark"><img src={oppaLogo} alt="" /></span>
            <span className="brand-logo-copy"><strong>Oppa Dru</strong><span>Korean Fried Chicken</span></span>
          </Link>
          <p>Bold Korean-style flavors, crispy textures, and food prepared fresh for every order.</p>
          {!isFranchise && (
            <div className="mt-4">
              <h2 className="text-sm font-bold">Quality &amp; Replacement Policy</h2>
              <p>We don&apos;t offer returns or exchanges. We make sure our food is good quality. If something is wrong, tell us and we&apos;ll replace it right away, no need to return the food.</p>
            </div>
          )}
        </div>

        <div className="brand-footer-column">
          <h2>{isFranchise ? 'Franchise Links' : 'Quick Links'}</h2>
          {isFranchise ? (
            <>
              <Link to="/franchise/applicant-login">Applicant Sign In</Link>
              <a href="mailto:oppadrukfc@gmail.com?subject=Privacy%20Policy%20Request">Privacy Policy</a>
              <a href="#program-terms">Program Terms</a>
            </>
          ) : (
            <>
              <a href="/#home">Home</a>
              <a href="/#menu">Menu</a>
              <Link to="/franchise-opportunities">Franchise</Link>
              <a href="/#about">About</a>
            </>
          )}
        </div>

        <div className="brand-footer-column">
          <h2>Contact Us</h2>
          <a href="tel:09473065526">0947 306 5526</a>
          <a href="mailto:oppadrukfc@gmail.com">oppadrukfc@gmail.com</a>
          <p>37 Malihan St. Barangay Zone 1, Dasmariñas, Cavite, Philippines</p>
        </div>

        <div className="brand-footer-column brand-footer-social">
          <h2>Follow Us</h2>
          <div className="brand-social-links">
            <a href="https://www.facebook.com/oppadruKFC" target="_blank" rel="noreferrer" aria-label="Oppa Dru on Facebook">
              <img src={fbLogo} alt="" />
            </a>
            <a href="https://www.instagram.com/oppadrukfc/" target="_blank" rel="noreferrer" aria-label="Oppa Dru on Instagram">
              <img src={igLogo} alt="" />
            </a>
          </div>
          <h3>Business Hours</h3>
          <p>Daily: 10:00 AM – 11:00 PM</p>
        </div>
      </div>
      <div className="brand-footer-bottom">
        <span>© 2018 Oppa Dru Korean Fried Chicken. All rights reserved.</span>
        {isFranchise && <span>An application is not an offer, approval, or authorization to operate.</span>}
      </div>
    </footer>
  );
};

export default BrandNavbar;

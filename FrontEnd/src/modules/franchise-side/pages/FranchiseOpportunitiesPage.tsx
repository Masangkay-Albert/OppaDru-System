import React, { useEffect, useState } from 'react';
import {
  ArrowDown, ArrowRight, BadgeCheck, BarChart3, Building2,
  Check, ChefHat, ChevronDown, CircleHelp, ClipboardCheck, Clock3,
  FileCheck2, Handshake, Headset, MapPin, Megaphone, PackageCheck, Phone,
  ShieldCheck, ShoppingBag, Store, Utensils,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFranchiseApplicantAuth } from '../../../contexts/franchiseApplicantAuth';
import { API_URL } from '../../../services/apiConfig';
import { productService, type Product } from '../../../services/productService';
import { getLandingHeroImage } from '../../../data/landingHeroImage';
import oppaLogo from '../../../assets/oppadrulogo.jpg';
import { BrandFooter, BrandNavbar } from '../../shared/components/BrandChrome';
import '../../../styles/FranchiseOpportunitiesPage.css';

interface FranchiseOpportunityInfo {
  requirements: string[];
  available_locations?: string[];
}

const processSteps = [
  {
    icon: FileCheck2,
    title: 'Explore the opportunity',
    description: 'Review the franchise opportunity, requirements, fees, and available locations.',
  },
  {
    icon: ClipboardCheck,
    title: 'Submit your application',
    description: 'Register as an applicant, complete the application form, and submit your business details and proposed location.',
  },
  {
    icon: BadgeCheck,
    title: 'Application review',
    description: 'The original owner reviews your application and updates the status to Approved or Rejected.',
  },
  {
    icon: Handshake,
    title: 'Complete the requirements',
    description: 'Review and sign the franchise agreement, complete payment verification, and fulfill any other requirements before operating.',
  },
  {
    icon: Building2,
    title: 'Branch activation',
    description: 'An authorized administrator creates or activates your franchise branch and assigns a franchise manager and staff.',
  },
  {
    icon: BarChart3,
    title: 'Begin operations',
    description: 'Start operating with your own POS, orders, staff accounts, inventory, and sales records.',
  },
];

const partnerBenefits = [
  { icon: Utensils, title: 'Proven menu', text: 'Explore the Oppa Dru Korean fried chicken menu and product range.' },
  { icon: ShoppingBag, title: 'Operating system', text: 'A point-of-sale and order workflow is part of the franchise platform.' },
  { icon: ChefHat, title: 'Training', text: 'Training requirements and schedules are reviewed before opening.' },
  { icon: Megaphone, title: 'Marketing support', text: 'Discuss brand and promotional materials available to franchise partners.' },
  { icon: PackageCheck, title: 'Supply support', text: 'Review product sourcing and supply arrangements with the franchise team.' },
  { icon: MapPin, title: 'Location guidance', text: 'Proposed sites are reviewed for suitability before a branch is approved.' },
];

const packageItems = [
  'Franchise onboarding and application review',
  'Menu and product orientation',
  'POS and order workflow setup',
  'Branch, manager, and staff account setup',
  'Inventory and sales record tools',
  'Pre-opening requirements guidance',
];

const qualifications = [
  'Business or leadership experience relevant to food service or retail.',
  'Financial readiness for the agreed investment and location-specific costs.',
  'Willingness to complete interviews, due diligence, and site assessment.',
  'Commitment to follow the signed agreement and operating standards.',
];

const supportItems = [
  'Guidance through application and location review.',
  'Orientation on products, systems, and operating workflows.',
  'Branch account configuration after authorization.',
  'Coordination on training and pre-opening requirements.',
];

const franchiseModels = [
  { icon: Store, name: 'Kiosk', bestFor: 'Compact sites and high-footfall locations' },
  { icon: ShoppingBag, name: 'Food Stall', bestFor: 'Food courts, markets, and shared dining spaces' },
  { icon: Utensils, name: 'Full Restaurant', bestFor: 'Dedicated dining and takeaway locations' },
];

const faqs = [
  {
    question: 'How long does the review take?',
    answer: 'Review time depends on the completeness of your application and any required interviews or location assessment. The franchise team will share updates using the contact details in your application.',
  },
  {
    question: 'Do I need a property before applying?',
    answer: 'No. You may submit a proposed province, city or municipality, and barangay even if you have not secured a property. A specific site can be discussed during review.',
  },
  {
    question: 'When can I operate a franchise?',
    answer: 'Operations may begin only after approval, completion of the signed agreement and requirements, payment verification, and branch activation by an authorized administrator.',
  },
  {
    question: 'What permits are required?',
    answer: 'Permit requirements depend on your location and business setup. Confirm the applicable local and national requirements with the relevant authorities and the franchise team.',
  },
  {
    question: 'Is financing available?',
    answer: 'Financing availability has not been published. Please confirm directly with the franchise team and your preferred financial institution.',
  },
];

const FranchiseOpportunitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const { applicant, isLoading: isAuthLoading, logout } = useFranchiseApplicantAuth();
  const [info, setInfo] = useState<FranchiseOpportunityInfo | null>(null);
  const [heroImage, setHeroImage] = useState(() => getLandingHeroImage([]));
  const [error, setError] = useState('');
  const [isStartingApplication, setIsStartingApplication] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/franchise-opportunities`, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to load franchise information.');
        if (!cancelled) setInfo(result.data);
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load franchise information. Please try again later or contact the franchise team.');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let active = true;
    productService.getAvailableProducts().then((products: Product[]) => {
      if (active) setHeroImage(getLandingHeroImage(products));
    }).catch((loadError: unknown) => {
      console.error('Unable to load the landing hero product image for the franchise page.', loadError);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((target) => target.classList.add('is-visible'));
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
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [info]);

  const handleApply = async () => {
    setIsStartingApplication(true);
    try {
      if (applicant) await logout();
      navigate('/franchise/applicant-login?returnTo=%2Ffranchise%2Fapply', { replace: true });
    } catch (signOutError: unknown) {
      const message = signOutError instanceof Error ? signOutError.message : 'Unable to sign out of the existing applicant account.';
      navigate('/franchise/applicant-login?returnTo=%2Ffranchise%2Fapply', { replace: true, state: { signOutError: message } });
    } finally {
      setIsStartingApplication(false);
    }
  };

  const applyLabel = isStartingApplication ? 'Please wait…' : 'Apply for Franchise';

  return (
    <main className="franchise-opportunities-page min-h-screen">
      <BrandNavbar variant="franchise" onApply={handleApply} applyDisabled={isAuthLoading || isStartingApplication} />

      <section className="franchise-hero">
        <div className="franchise-hero-pattern" aria-hidden="true" />
        <div className="franchise-hero-inner">
          <div className="franchise-hero-copy">
            <p className="franchise-eyebrow franchise-eyebrow-light">A Korean fried chicken opportunity</p>
            <h1>Build something <em>delicious.</em><br />Grow with Oppa Dru.</h1>
            <p className="franchise-hero-description">
              Explore a franchise partnership built around Korean fried chicken, practical operating tools, and a thoughtful application process.
            </p>
            <div className="franchise-hero-buttons">
              <button type="button" onClick={handleApply} disabled={isAuthLoading || isStartingApplication} className="franchise-button franchise-button-light">
                {applyLabel} <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>
            <p className="franchise-disclaimer">An application is not an offer, approval, or authorization to operate.</p>
          </div>
          <div className="franchise-hero-visual">
            <div className="franchise-photo-frame">
              <img src={heroImage} alt="Crispy Korean fried chicken from Oppa Dru" />
            </div>
            <span className="franchise-hero-stamp"><img src={oppaLogo} alt="Oppa Dru mascot logo" /></span>
          </div>
        </div>
        <a href="#franchise-overview" className="franchise-scroll-cue"><ArrowDown size={15} /> Explore the opportunity</a>
      </section>

      <div className="franchise-main-wrap" id="franchise-overview">
        <div className="franchise-main-grid">
          <div className="franchise-content-column">
            {error && <div role="alert" className="franchise-data-error"><CircleHelp size={18} /> {error}</div>}

            <section className="franchise-section" data-reveal>
              <SectionHeading eyebrow="The partnership" title="Why partner with us?" description="A closer look at the tools, guidance, and conversations that shape the opportunity." />
              <div className="franchise-benefit-grid">
                {partnerBenefits.map(({ icon: Icon, title, text }) => (
                  <article className="franchise-feature-card" key={title}>
                    <span className="franchise-icon-badge"><Icon size={20} aria-hidden="true" /></span>
                    <h3>{title}</h3><p>{text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="franchise-section" data-reveal>
              <SectionHeading eyebrow="Find the right fit" title="Franchise models" description="Explore the formats available for different types of locations." />
              <div className="franchise-model-grid">
                {franchiseModels.map(({ icon: Icon, name, bestFor }) => (
                  <article className="franchise-model-card" key={name}>
                    <span className="franchise-icon-badge"><Icon size={21} aria-hidden="true" /></span>
                    <h3>{name}</h3>
                    <p><strong>Best for</strong>{bestFor}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="franchise-section" data-reveal>
              <SectionHeading eyebrow="Your path forward" title="Franchise Process" description="From opportunity to a fully operating franchise branch." />
              <ol className="franchise-process">
                {processSteps.map(({ icon: Icon, title, description }, index) => (
                  <li className="franchise-process-step" key={title}>
                    <span className="franchise-process-marker"><Icon size={19} aria-hidden="true" /></span>
                    <span className="franchise-process-number">{String(index + 1).padStart(2, '0')}</span>
                    <div><h3>{title}</h3><p>{description}</p></div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="franchise-section" data-reveal>
              <SectionHeading eyebrow="A connected toolkit" title="What’s included in your package" description="Confirm the final scope and availability of each item in your franchise agreement." />
              <div className="franchise-checklist-grid">
                {packageItems.map((item) => <div className="franchise-check-item" key={item}><Check size={17} aria-hidden="true" />{item}</div>)}
              </div>
            </section>

            <section className="franchise-section" data-reveal>
              <SectionHeading eyebrow="Shared expectations" title="A strong partnership works both ways" description="A clear view of applicant readiness and the support discussed through the process." />
              <div className="franchise-two-card-grid">
                <InfoListCard icon={BadgeCheck} title="Applicant qualifications" items={[...qualifications, ...(info?.requirements || [])]} />
                <InfoListCard icon={Headset} title="Franchisor support" items={supportItems} />
              </div>
            </section>

            <section className="franchise-section" data-reveal>
              <SectionHeading eyebrow="Good to know" title="Frequently asked questions" description="A few common questions before you take the next step." />
              <div className="franchise-faq-list">
                {faqs.map((faq) => (
                  <details className="franchise-faq-item" key={faq.question}>
                    <summary>{faq.question}<ChevronDown size={18} aria-hidden="true" /></summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="franchise-section" data-reveal>
              <div className="franchise-terms-card" id="program-terms">
                <span className="franchise-icon-badge"><ShieldCheck size={21} aria-hidden="true" /></span>
                <div><p className="franchise-eyebrow">Program terms</p><h2>Understand the terms before you commit.</h2>
                  <p>Applications are reviewed individually. Franchise access and operation require approval, a signed agreement, completion of applicable requirements, payment verification, and branch activation by an authorized administrator.</p>
                  <p className="franchise-terms-disclaimer">An application is not an offer, approval, or authorization to operate.</p>
                </div>
              </div>
            </section>

            <section className="franchise-final-cta" data-reveal>
              <div><p className="franchise-eyebrow franchise-eyebrow-light">Your next chapter starts here</p><h2>Ready to grow with Oppa Dru?</h2><p>Tell us about your experience, plans, and proposed location.</p></div>
              <div className="franchise-final-actions">
                <button type="button" onClick={handleApply} disabled={isAuthLoading || isStartingApplication} className="franchise-button franchise-button-light">{isStartingApplication ? 'Please wait…' : 'Start Your Application'} <ArrowRight size={17} /></button>
              </div>
            </section>
          </div>

          <aside className="franchise-sidebar">
            <div className="franchise-quick-card">
              <p className="franchise-eyebrow">At a glance</p><h2>Quick Facts</h2>
              <div className="franchise-quick-row"><span><Clock3 size={17} /> Review time</span><strong>Varies by application</strong></div>
              {error && <p className="franchise-sidebar-error" role="status">Live franchise information is temporarily unavailable.</p>}
              <button type="button" onClick={handleApply} disabled={isAuthLoading || isStartingApplication} className="franchise-button franchise-button-primary">
                {applyLabel} <ArrowRight size={16} />
              </button>
              <p className="franchise-sidebar-caption">Contact the franchise team for current program details.</p>
            </div>

            <section className="franchise-locations-card">
              <span className="franchise-icon-badge"><MapPin size={19} /></span><h2>Available locations</h2>
              {info?.available_locations?.length
                ? <ul>{info.available_locations.map((location) => <li key={location}>{location}</li>)}</ul>
                : <p>Specific locations have not been published here. You may still submit a proposed location for review.</p>}
            </section>

            <section className="franchise-contact-card">
              <p className="franchise-eyebrow">Questions?</p><h2>Talk to our team</h2>
              <a href="mailto:oppadrukfc@gmail.com">oppadrukfc@gmail.com</a>
              <a href="tel:09473065526"><Phone size={15} /> 0947 306 5526</a>
            </section>
          </aside>
        </div>
      </div>

      <BrandFooter variant="franchise" />

      <div className="franchise-mobile-cta" role="region" aria-label="Franchise application actions">
        <button type="button" onClick={handleApply} disabled={isAuthLoading || isStartingApplication} className="franchise-button franchise-button-primary">{applyLabel} <ArrowRight size={16} /></button>
      </div>
    </main>
  );
};

const SectionHeading: React.FC<{ eyebrow: string; title: string; description?: string }> = ({ eyebrow, title, description }) => (
  <div className="franchise-section-heading">
    <p className="franchise-eyebrow">{eyebrow}</p><h2>{title}</h2>{description && <p>{description}</p>}
  </div>
);

const InfoListCard: React.FC<{ icon: typeof BadgeCheck; title: string; items: string[] }> = ({ icon: Icon, title, items }) => (
  <article className="franchise-info-card"><span className="franchise-icon-badge"><Icon size={20} /></span><h3>{title}</h3>
    <ul>{items.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
  </article>
);

export default FranchiseOpportunitiesPage;

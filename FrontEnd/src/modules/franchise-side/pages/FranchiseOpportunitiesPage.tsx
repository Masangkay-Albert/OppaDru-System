import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CircleHelp, ClipboardCheck, Clock3, HandCoins } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';

interface FranchiseOpportunityInfo {
  investment: { minimum: string | null; maximum: string | null } | null;
  franchise_fee?: string | null;
  requirements: string[];
  available_locations?: string[];
  qualifications?: string[];
  business_rules?: string[];
  support?: string[];
  steps: string[];
  faqs: Array<{ question: string; answer: string }>;
}

const FranchiseOpportunitiesPage: React.FC = () => {
  const [info, setInfo] = useState<FranchiseOpportunityInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/franchise-opportunities`, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to load franchise information.');
        if (!cancelled) setInfo(result.data);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to load franchise information.');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)]"><ArrowLeft size={16} /> Back to home</Link>
        <span className="inline-flex items-center gap-2 font-serif text-lg font-bold text-[var(--oppa-green)]"><Building2 size={19} /> Oppa Dru Franchise</span>
      </header>

      <section className="bg-[var(--oppa-green)] px-5 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-white/70">Franchise opportunities</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl">Grow with Oppa Dru Korean Fried Chicken</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/80">Explore a partnership opportunity and tell us about your operating experience, investment plans, and proposed market. Every application is individually reviewed.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/franchise/applicant-access" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[var(--oppa-green)] shadow-sm transition hover:bg-[var(--oppa-cream)]">Apply for Franchise <ArrowRight size={16} /></Link>
            <Link to="/franchise/track-application" className="rounded-xl border border-white/50 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">Track an application</Link>
          </div>
          <p className="mt-3 text-xs text-white/65">An application is not an offer, approval, or authorization to operate.</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 lg:grid-cols-[1.4fr_.8fr]">
        <div className="space-y-8">
          <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green)]/10 p-2.5 text-[var(--oppa-green)]"><BadgeCheck size={21} /></span><div><h2 className="font-serif text-2xl font-bold">What we look for</h2><p className="text-sm text-[var(--oppa-text-muted)]">The review considers the whole operating plan.</p></div></div>
            {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : !info ? <p className="text-sm text-[var(--oppa-text-muted)]">Loading opportunity details…</p> : (
              <ul className="space-y-3">{info.requirements.map((requirement) => <li key={requirement} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--oppa-green)]" />{requirement}</li>)}</ul>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green)]/10 p-2.5 text-[var(--oppa-green)]"><Building2 size={21} /></span><div><h2 className="font-serif text-2xl font-bold">Available franchise locations</h2><p className="text-sm text-[var(--oppa-text-muted)]">Proposed locations are subject to review and approval.</p></div></div>
            {!info ? <p className="text-sm text-[var(--oppa-text-muted)]">Loading available locations…</p> : info.available_locations?.length ? (
              <ul className="space-y-3">{info.available_locations.map((location) => <li key={location} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--oppa-green)]" />{location}</li>)}</ul>
            ) : <p className="text-sm leading-6 text-[var(--oppa-text-muted)]">Specific locations have not been published yet. You may still submit a proposed location for review.</p>}
          </section>

          <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green)]/10 p-2.5 text-[var(--oppa-green)]"><ClipboardCheck size={21} /></span><div><h2 className="font-serif text-2xl font-bold">Proseso ng franchise</h2><p className="text-sm text-[var(--oppa-text-muted)]">Mula opportunity hanggang sa operasyon ng franchise branch.</p></div></div>
            <ol className="space-y-4">
              {(info?.steps || []).map((description, index) => <li key={description} className="flex gap-4"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--oppa-cream)] text-sm font-bold text-[var(--oppa-green)]">{index + 1}</span><p className="pt-1 text-sm leading-6">{description}</p></li>)}
            </ol>
          </section>

          {!!info?.qualifications?.length && (
            <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 font-serif text-2xl font-bold">Applicant qualifications</h2>
              <ul className="space-y-3">{info.qualifications.map((qualification) => <li key={qualification} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--oppa-green)]" />{qualification}</li>)}</ul>
            </section>
          )}

          {!!info?.support?.length && (
            <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 font-serif text-2xl font-bold">Franchisor support</h2>
              <ul className="space-y-3">{info.support.map((item) => <li key={item} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--oppa-green)]" />{item}</li>)}</ul>
            </section>
          )}

          {!!info?.business_rules?.length && (
            <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 font-serif text-2xl font-bold">Program terms</h2>
              <ul className="space-y-3">{info.business_rules.map((rule) => <li key={rule} className="flex gap-3 text-sm leading-6"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--oppa-green)]" />{rule}</li>)}</ul>
            </section>
          )}
        </div>

        <aside className="space-y-8">
          <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green)]/10 p-2.5 text-[var(--oppa-green)]"><HandCoins size={21} /></span><h2 className="font-serif text-xl font-bold">Investment planning</h2></div>
            {!info?.investment && !info?.franchise_fee ? (
              <p className="text-sm leading-6 text-[var(--oppa-text-muted)]">Investment figures have not been published. Share your estimated capacity in the application; our team will discuss applicable costs during review.</p>
            ) : (
              <div className="space-y-2 text-sm">
                {info.investment?.minimum && <p><span className="text-[var(--oppa-text-muted)]">Estimated minimum:</span> <strong>₱{Number(info.investment.minimum).toLocaleString('en-PH')}</strong></p>}
                {info.investment?.maximum && <p><span className="text-[var(--oppa-text-muted)]">Estimated maximum:</span> <strong>₱{Number(info.investment.maximum).toLocaleString('en-PH')}</strong></p>}
                {info.franchise_fee && <p><span className="text-[var(--oppa-text-muted)]">Published franchise fee:</span> <strong>₱{Number(info.franchise_fee).toLocaleString('en-PH')}</strong></p>}
                <p className="pt-2 text-xs leading-5 text-[var(--oppa-text-muted)]">Published estimates are informational and may not include all location-specific costs. Confirm current fees and terms directly with the franchise team.</p>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-[var(--oppa-green)]/10 p-2.5 text-[var(--oppa-green)]"><CircleHelp size={21} /></span><h2 className="font-serif text-xl font-bold">Frequently asked questions</h2></div>
            {!info ? <p className="text-sm text-[var(--oppa-text-muted)]">Loading answers…</p> : <div className="space-y-5">{info.faqs.map((faq) => <div key={faq.question}><h3 className="text-sm font-semibold">{faq.question}</h3><p className="mt-1 text-sm leading-6 text-[var(--oppa-text-muted)]">{faq.answer}</p></div>)}</div>}
          </section>

          <div className="rounded-2xl border border-[var(--oppa-border)] bg-white/70 p-5 text-sm leading-6 text-[var(--oppa-text-muted)]">
            <Clock3 size={18} className="mb-2 text-[var(--oppa-green)]" />
            <p>After submitting, use your reference number and contact email to check your status, interview details, and next steps. Applicants with an account can also use My Applications.</p>
          </div>
        </aside>
      </div>

      <footer className="border-t border-[var(--oppa-border)] px-5 py-8 text-center text-xs text-[var(--oppa-text-muted)]">
        <div className="flex flex-wrap justify-center gap-5">
          <Link to="/franchise/applicant-access" className="font-semibold text-[var(--oppa-green)] hover:underline">Ready to apply? Start your application</Link>
          <Link to="/franchise/track-application" className="font-semibold text-[var(--oppa-green)] hover:underline">Already applied? Track your application</Link>
        </div>
      </footer>
    </main>
  );
};

export default FranchiseOpportunitiesPage;

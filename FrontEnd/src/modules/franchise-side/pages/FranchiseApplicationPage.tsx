import React, { useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, Mail, MapPin, MessageSquareText, Phone, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';

const initialForm = {
  franchise_name: '',
  contact_name: '',
  email: '',
  phone: '',
  location: '',
  notes: '',
};

const FranchiseApplicationPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleChange = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/franchise-applications`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.message || data?.errors ? 'Please review your application details.' : 'Unable to submit application.';
        setError(message);
        setIsSubmitting(false);
        return;
      }

      setIsSubmitted(true);
      setForm(initialForm);
    } catch {
      setError('Unable to send the application right now. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--oppa-cream)] px-6 py-10">
        <div className="max-w-lg rounded-3xl border border-[var(--oppa-border)] bg-white p-8 text-center shadow-lg">
          <div className="mb-4 flex justify-center text-[var(--oppa-green)]">
            <CheckCircle2 size={54} />
          </div>
          <h1 className="mb-2 text-3xl font-semibold text-[var(--oppa-green)]">Application submitted</h1>
          <p className="text-sm text-[var(--oppa-text-muted)]">
            Your franchise inquiry has been sent successfully. Our team will review it and contact you shortly.
          </p>
          <button
            onClick={() => navigate('/franchise/login')}
            className="mt-6 rounded-xl bg-[var(--oppa-green)] px-5 py-3 font-medium text-white transition-colors hover:bg-[var(--oppa-green-dark)]"
          >
            Go to franchise login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[var(--oppa-border)] bg-white p-6 shadow-lg sm:p-8">
        <button
          onClick={() => navigate('/')}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)]"
        >
          <ArrowLeft size={16} /> Back to home
        </button>

        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-[var(--oppa-green)]">
            <Building2 size={20} />
            <span className="text-sm font-semibold uppercase tracking-[0.12em]">Franchise inquiry</span>
          </div>
          <h1 className="text-3xl font-semibold text-[var(--oppa-text)]">Apply to become a franchise partner</h1>
          <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">
            Share your business details and we will review your application.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">Franchise name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={form.franchise_name}
                onChange={(event) => handleChange('franchise_name', event.target.value)}
                required
                className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                placeholder="Oppa Dru Downtown"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">Contact person</label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={form.contact_name}
                onChange={(event) => handleChange('contact_name', event.target.value)}
                required
                className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                placeholder="Juan Dela Cruz"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                required
                className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                placeholder="hello@example.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                placeholder="0917-123-4567"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">Location</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={form.location}
                onChange={(event) => handleChange('location', event.target.value)}
                className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                placeholder="Cebu City"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">Notes</label>
            <div className="relative">
              <MessageSquareText className="absolute left-3 top-3 size-4 text-gray-400" />
              <textarea
                rows={5}
                value={form.notes}
                onChange={(event) => handleChange('notes', event.target.value)}
                className="w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green-bright)]"
                placeholder="Tell us about your desired franchise location, market interests, and investment goals."
              />
            </div>
          </div>

          <div className="md:col-span-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/')} 
              className="rounded-xl border border-[var(--oppa-border)] px-5 py-3 text-sm font-medium text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-[var(--oppa-green)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] disabled:opacity-60"
            >
              {isSubmitting ? 'Submitting...' : 'Submit application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FranchiseApplicationPage;

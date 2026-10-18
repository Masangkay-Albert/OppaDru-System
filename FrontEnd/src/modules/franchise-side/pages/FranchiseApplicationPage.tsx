import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronDown,
  Clock3, Copy, FileText, FileUp, Info, LoaderCircle, Lock, Moon, Pencil, Sun,
  Trash2, X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { franchiseApplicantAuthService } from '../../../services/franchiseApplicantAuthService';
import { useFranchiseApplicantAuth } from '../../../contexts/franchiseApplicantAuth';
import { applyTheme, getSavedTheme, type Theme } from '../../../services/theme';
import '../../../styles/franchise-application-theme.css';
import './FranchiseApplicationPage.css';

type PropertyStatus = '' | 'yes' | 'no' | 'looking';
type ApplicationForm = {
  franchise_name: string;
  contact_name: string;
  email: string;
  phone: string;
  province: string;
  city: string;
  street: string;
  business_experience: string;
  investment_capacity: string;
  location: string;
  location_province: string;
  location_city: string;
  location_barangay: string;
  location_area: string;
  has_proposed_property: PropertyStatus;
  opening_timeline: string;
  business_information: string;
  notes: string;
};
type GeographicOption = {
  code: string;
  name: string;
};
type Draft = { form: ApplicationForm; step: number };
type FormFieldName = keyof ApplicationForm;

const initialForm: ApplicationForm = {
  franchise_name: '', contact_name: '', email: '', phone: '', province: '', city: '', street: '',
  business_experience: '', investment_capacity: '', location: '', location_province: '', location_city: '',
  location_barangay: '', location_area: '', has_proposed_property: '',
  opening_timeline: '', business_information: '', notes: '',
};

const draftKey = 'franchise-application-draft';
const stepLabels = ['Your details', 'Business plan', 'Review'];
const stepDescriptions = ['Contact and address details', 'Location, experience, and capacity', 'Check details and submit'];
const stepHeadings = ['Tell us about yourself', 'Tell us about your plans', 'Review your application'];
const maxSupportingDocuments = 8;
const maxSupportingDocumentSize = 10 * 1024 * 1024;
const acceptedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
const timelineLabels: Record<string, string> = {
  within_6_months: 'Within 6 months',
  '6_to_12_months': '6–12 months',
  '12_to_18_months': '12–18 months',
  more_than_18_months: 'More than 18 months',
  not_sure: 'Not sure yet',
};

const getReferenceNumber = (value: unknown): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const payload = value as Record<string, unknown>;
  if (typeof payload.reference_number === 'string') return payload.reference_number;
  return getReferenceNumber(payload.data) || getReferenceNumber(payload.application) || getReferenceNumber(payload.result);
};

const formatPhone = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('63')) digits = `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) digits = `0${digits}`;
  digits = digits.slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
};

const formatCurrencyInput = (value: string) => {
  const normalized = value.replace(/[^\d.]/g, '');
  const [whole = '', ...fractionParts] = normalized.split('.');
  const fraction = fractionParts.join('').slice(0, 2);
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return normalized.includes('.') ? `${formattedWhole}.${fraction}` : formattedWhole;
};

const currencyValue = (value: string) => value.replace(/,/g, '');
const formatCurrency = (value: string) => {
  const amount = Number(currencyValue(value));
  return value && Number.isFinite(amount) ? `₱${amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}` : 'Not provided';
};
const fileSize = (size: number) => size < 1024 * 1024
  ? `${(size / 1024).toFixed(0)} KB`
  : `${(size / 1024 / 1024).toFixed(2)} MB`;
const addressValue = (form: ApplicationForm) => [form.street, form.city, form.province].filter(Boolean).join(', ');
const proposedLocationValue = (area: string, barangay: string, city: string, province: string) =>
  [area.trim(), barangay.trim(), city.trim(), province.trim()].filter(Boolean).join(', ');

const readDraft = (): { draft: Draft | null; error: string } => {
  const rawDraft = localStorage.getItem(draftKey);
  if (!rawDraft) return { draft: null, error: '' };
  try {
    const parsed = JSON.parse(rawDraft) as Partial<Draft>;
    if (!parsed.form || typeof parsed.form !== 'object') {
      return { draft: null, error: 'We couldn’t read your saved draft. You can start a new application.' };
    }
    const form = { ...initialForm, ...parsed.form };
    if (!parsed.form.location_province && !parsed.form.location_area && form.location) {
      form.location_area = form.location;
    }

    return {
      draft: {
        form,
        step: typeof parsed.step === 'number' ? Math.max(0, Math.min(2, parsed.step)) : 0,
      },
      error: '',
    };
  } catch {
    return { draft: null, error: 'We couldn’t read your saved draft. You can start a new application.' };
  }
};

const normalizeGeoOption = (item: Record<string, unknown>): GeographicOption => ({
  code: String(item.code ?? item.province_code ?? item.city_code ?? item.id ?? '').trim(),
  name: String(item.name ?? item.province_name ?? item.city_name ?? item.municipality_name ?? item.province ?? item.municipality ?? '').trim(),
});

const parseGeoOptions = (payload: unknown): GeographicOption[] => {
  const data = Array.isArray(payload) ? payload : Array.isArray((payload as Record<string, unknown> | undefined)?.data)
    ? (payload as Record<string, unknown>).data as unknown[]
    : [];

  return data
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => normalizeGeoOption(item))
    .filter((item) => item.code && item.name)
    .sort((left, right) => left.name.localeCompare(right.name, 'en', { sensitivity: 'base' }));
};

const FranchiseApplicationPage: React.FC = () => {
  const navigate = useNavigate();
  const { applicant } = useFranchiseApplicantAuth();
  const [draftBootstrap] = useState(readDraft);
  const [form, setForm] = useState<ApplicationForm>(initialForm);
  const [documents, setDocuments] = useState<File[]>([]);
  const [step, setStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FormFieldName, string>>>({});
  const [error, setError] = useState(draftBootstrap.error);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [fileError, setFileError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false);
  const [consentAccurate, setConsentAccurate] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [savedDraft, setSavedDraft] = useState<Draft | null>(draftBootstrap.draft);
  const [draftResolved, setDraftResolved] = useState(!draftBootstrap.draft);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>(draftBootstrap.draft ? 'saved' : 'idle');
  const [provinceCatalog, setProvinceCatalog] = useState<GeographicOption[]>([]);
  const [cityCatalog, setCityCatalog] = useState<GeographicOption[]>([]);
  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [provinceLoading, setProvinceLoading] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);
  const [addressBarangayCatalog, setAddressBarangayCatalog] = useState<GeographicOption[]>([]);
  const [addressBarangayLoading, setAddressBarangayLoading] = useState(false);
  const [proposedProvinceCode, setProposedProvinceCode] = useState('');
  const [proposedCityCatalog, setProposedCityCatalog] = useState<GeographicOption[]>([]);
  const [proposedCityCode, setProposedCityCode] = useState('');
  const [proposedCityLoading, setProposedCityLoading] = useState(false);
  const [proposedBarangayCatalog, setProposedBarangayCatalog] = useState<GeographicOption[]>([]);
  const [proposedBarangayLoading, setProposedBarangayLoading] = useState(false);
  const cityDisabled = !provinceCode || provinceLoading || cityLoading;
  const proposedCityDisabled = !proposedProvinceCode || provinceLoading || proposedCityLoading;
  const addressGeoReady = Boolean(provinceCode && cityCode);
  const [minimumInvestment, setMinimumInvestment] = useState<string | null>(null);
  const [minimumInvestmentError, setMinimumInvestmentError] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [copyMessage, setCopyMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showStepOneNotes, setShowStepOneNotes] = useState(false);
  const [showReviewNotes, setShowReviewNotes] = useState(false);
  const [updateApplicantProfile, setUpdateApplicantProfile] = useState(false);
  const profileInitialized = useRef(false);
  const cityRequestId = useRef(0);
  const addressBarangayRequestId = useRef(0);
  const proposedCityRequestId = useRef(0);
  const proposedBarangayRequestId = useRef(0);
  const provinceOptions = useMemo(() => provinceCatalog.map((option) => option.name), [provinceCatalog]);
  const cityOptions = useMemo(() => cityCatalog.map((option) => option.name), [cityCatalog]);
  const addressBarangayOptions = useMemo(() => addressBarangayCatalog.map((option) => option.name), [addressBarangayCatalog]);
  const proposedCityOptions = useMemo(() => proposedCityCatalog.map((option) => option.name), [proposedCityCatalog]);
  const proposedBarangayOptions = useMemo(() => proposedBarangayCatalog.map((option) => option.name), [proposedBarangayCatalog]);
  const hasFormData = Object.values(form).some((value) => value.trim()) || documents.length > 0;
  const cardRef = useRef<HTMLElement>(null);
  const sidebarHeadingRef = useRef<HTMLHeadingElement>(null);
  const compactHeadingRef = useRef<HTMLHeadingElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFirstStepRender = useRef(true);

  useEffect(() => {
    if (!applicant || profileInitialized.current) return;
    profileInitialized.current = true;
    setForm((current) => ({
      ...current,
      contact_name: applicant.full_name || current.contact_name,
      email: applicant.email,
      phone: formatPhone(applicant.phone || current.phone),
    }));
  }, [applicant]);

  useEffect(() => {
    let cancelled = false;
    const loadProvinceOptions = async () => {
      setProvinceLoading(true);
      try {
        const response = await fetch(`${API_URL}/geo/provinces`, { headers: { Accept: 'application/json' } });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Unable to load provinces.');
        const options = parseGeoOptions(result);
        if (!cancelled) setProvinceCatalog(options);
        if (!options.length && !cancelled) {
          setError('Unable to load the province list right now. Please try again.');
        }
      } catch {
        if (!cancelled) setProvinceCatalog([]);
      } finally {
        if (!cancelled) setProvinceLoading(false);
      }
    };

    void loadProvinceOptions();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/franchise-opportunities`, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to load franchise investment details.');
        const minimum = result?.data?.investment?.minimum;
        if (!cancelled && (typeof minimum === 'string' || typeof minimum === 'number')) {
          setMinimumInvestment(String(minimum));
        }
      })
      .catch(() => {
        if (!cancelled) setMinimumInvestmentError(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (provinceCatalog.length) {
      syncAddressCodes();
    }
  }, [provinceCatalog, cityCatalog]);

  useEffect(() => {
    if (!draftResolved) return;
    if (!hasFormData) {
      localStorage.removeItem(draftKey);
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ form, step } satisfies Draft));
        setDraftStatus('saved');
      } catch {
        setDraftStatus('failed');
        setError('Your browser couldn’t save this draft. Keep this page open to avoid losing your changes.');
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [form, step, draftResolved, hasFormData]);

  useEffect(() => {
    if (isFirstStepRender.current) {
      isFirstStepRender.current = false;
      return;
    }
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const heading = window.matchMedia('(min-width: 1024px)').matches
      ? sidebarHeadingRef.current
      : compactHeadingRef.current;
    heading?.focus({ preventScroll: true });
  }, [step]);

  const stepOneValid = useMemo(() => (
    !!form.contact_name.trim()
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    && /^09\d{9}$/.test(form.phone.replace(/\D/g, ''))
    && !!form.province.trim()
    && !!form.city.trim()
    && addressBarangayCatalog.some((option) => option.name.toLowerCase() === form.street.trim().toLowerCase())
  ), [form, addressBarangayCatalog]);

  const stepTwoValid = useMemo(() => (
    provinceCatalog.some((option) => option.name.toLowerCase() === form.location_province.trim().toLowerCase())
    && proposedCityCatalog.some((option) => option.name.toLowerCase() === form.location_city.trim().toLowerCase())
    && proposedBarangayCatalog.some((option) => option.name.toLowerCase() === form.location_barangay.trim().toLowerCase())
    && !!form.business_experience.trim()
    && !!form.investment_capacity.trim()
    && Number(currencyValue(form.investment_capacity)) >= 0
    && !!form.has_proposed_property
    && !!form.opening_timeline
  ), [form, provinceCatalog, proposedCityCatalog, proposedBarangayCatalog]);

  const syncAddressCodes = (nextProvinceName?: string, nextCityName?: string) => {
    const provinceMatch = provinceCatalog.find((option) => option.name.toLowerCase() === (nextProvinceName ?? form.province).trim().toLowerCase());
    const cityMatch = cityCatalog.find((option) => option.name.toLowerCase() === (nextCityName ?? form.city).trim().toLowerCase());
    setProvinceCode(provinceMatch?.code ?? '');
    setCityCode(cityMatch?.code ?? '');
    return [provinceMatch?.code ?? '', cityMatch?.code ?? ''] as const;
  };

  const updateField = (field: FormFieldName, value: string) => {
    setDraftStatus('saving');
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const updateProposedLocation = (field: 'location_province' | 'location_city' | 'location_barangay' | 'location_area', value: string) => {
    setDraftStatus('saving');
    setForm((current) => {
      const next = { ...current, [field]: value };
      next.location = proposedLocationValue(next.location_area, next.location_barangay, next.location_city, next.location_province);
      return next;
    });
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError('');
  };

  const loadCitiesForProvince = async (nextProvinceCode: string, selectedCity = form.city) => {
    if (!nextProvinceCode) {
      cityRequestId.current += 1;
      setCityCatalog([]);
      setCityCode('');
      setCityLoading(false);
      setForm((current) => ({ ...current, city: '', street: '' }));
      return;
    }

    const requestId = ++cityRequestId.current;
    setCityLoading(true);
    try {
      const response = await fetch(`${API_URL}/geo/cities?province_code=${encodeURIComponent(nextProvinceCode)}`, {
        headers: { Accept: 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to load cities for this province.');

      const options = parseGeoOptions(result);
      if (requestId !== cityRequestId.current) return;

      setCityCatalog(options);
      if (!options.length) {
        setError('No cities or municipalities were returned for this province.');
      }
      const savedCity = selectedCity.trim();
      const validCity = savedCity && options.some((option) => option.name.toLowerCase() === savedCity.toLowerCase());

      setForm((current) => ({
        ...current,
        city: validCity ? savedCity : '',
        street: validCity && current.city.toLowerCase() === savedCity.toLowerCase() ? current.street : '',
      }));
      setCityCode(validCity ? (options.find((option) => option.name.toLowerCase() === savedCity.toLowerCase())?.code ?? '') : '');
    } catch {
      if (requestId !== cityRequestId.current) return;
      setCityCatalog([]);
      setCityCode('');
      setForm((current) => ({ ...current, city: '', street: '' }));
    } finally {
      if (requestId === cityRequestId.current) setCityLoading(false);
    }
  };

  useEffect(() => {
    if (!cityCode) {
      addressBarangayRequestId.current += 1;
      setAddressBarangayCatalog([]);
      setAddressBarangayLoading(false);
      setForm((current) => current.street ? { ...current, street: '' } : current);
      return;
    }

    let cancelled = false;
    const requestId = ++addressBarangayRequestId.current;
    const loadAddressBarangays = async () => {
      setAddressBarangayLoading(true);
      try {
        const response = await fetch(`${API_URL}/geo/barangays?city_code=${encodeURIComponent(cityCode)}`, {
          headers: { Accept: 'application/json' },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Unable to load barangays for this municipality.');
        const options = parseGeoOptions(result);
        if (cancelled || requestId !== addressBarangayRequestId.current) return;
        setAddressBarangayCatalog(options);
        setForm((current) => {
          const validBarangay = options.some((option) =>
            option.name.toLowerCase() === current.street.trim().toLowerCase(),
          );
          return validBarangay || !current.street ? current : { ...current, street: '' };
        });
      } catch {
        if (cancelled || requestId !== addressBarangayRequestId.current) return;
        setAddressBarangayCatalog([]);
        setForm((current) => current.street ? { ...current, street: '' } : current);
        setError('Unable to load barangays for your address. Please try selecting the city or municipality again.');
      } finally {
        if (!cancelled && requestId === addressBarangayRequestId.current) setAddressBarangayLoading(false);
      }
    };
    void loadAddressBarangays();
    return () => { cancelled = true; };
  }, [cityCode]);

  const loadProposedCitiesForProvince = async (nextProvinceCode: string, selectedCity = form.location_city) => {
    if (!nextProvinceCode) {
      proposedCityRequestId.current += 1;
      setProposedCityCatalog([]);
      setProposedCityLoading(false);
      setProposedCityCode('');
      updateProposedLocation('location_city', '');
      return;
    }

    const requestId = ++proposedCityRequestId.current;
    setProposedCityLoading(true);
    try {
      const response = await fetch(`${API_URL}/geo/cities?province_code=${encodeURIComponent(nextProvinceCode)}`, {
        headers: { Accept: 'application/json' },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to load municipalities for this province.');
      const options = parseGeoOptions(result);
      if (requestId !== proposedCityRequestId.current) return;
      setProposedCityCatalog(options);
      const matchingCity = options.find((option) =>
        option.name.toLowerCase() === selectedCity.trim().toLowerCase(),
      );
      setProposedCityCode(matchingCity?.code ?? '');
      setForm((current) => {
        const validCity = options.some((option) => option.name.toLowerCase() === current.location_city.trim().toLowerCase());
        const locationCity = validCity ? current.location_city : '';
        return {
          ...current,
          location_city: locationCity,
          location_barangay: validCity ? current.location_barangay : '',
          location: proposedLocationValue(current.location_area, validCity ? current.location_barangay : '', locationCity, current.location_province),
        };
      });
      if (!options.length) setError('No cities or municipalities were returned for the selected proposed location province.');
    } catch {
      if (requestId !== proposedCityRequestId.current) return;
      setProposedCityCatalog([]);
      setProposedCityCode('');
      setError('Unable to load municipalities for the proposed location. Please try selecting the province again.');
    } finally {
      if (requestId === proposedCityRequestId.current) setProposedCityLoading(false);
    }
  };

  useEffect(() => {
    if (!provinceCatalog.length || proposedProvinceCode || !form.location_province) return;
    const selectedProvince = provinceCatalog.find((option) =>
      option.name.toLowerCase() === form.location_province.trim().toLowerCase(),
    );
    if (!selectedProvince) return;
    setProposedProvinceCode(selectedProvince.code);
    void loadProposedCitiesForProvince(selectedProvince.code, form.location_city);
  }, [provinceCatalog, proposedProvinceCode, form.location_province]);

  useEffect(() => {
    if (!proposedCityCode) {
      proposedBarangayRequestId.current += 1;
      setProposedBarangayCatalog([]);
      setProposedBarangayLoading(false);
      setForm((current) => {
        if (!current.location_barangay) return current;
        const next = { ...current, location_barangay: '' };
        next.location = proposedLocationValue(next.location_area, '', next.location_city, next.location_province);
        return next;
      });
      return;
    }

    let cancelled = false;
    const requestId = ++proposedBarangayRequestId.current;
    const loadBarangays = async () => {
      setProposedBarangayLoading(true);
      try {
        const response = await fetch(`${API_URL}/geo/barangays?city_code=${encodeURIComponent(proposedCityCode)}`, {
          headers: { Accept: 'application/json' },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'Unable to load barangays for this municipality.');
        const options = parseGeoOptions(result);
        if (cancelled || requestId !== proposedBarangayRequestId.current) return;
        setProposedBarangayCatalog(options);
        setForm((current) => {
          const validBarangay = options.some((option) =>
            option.name.toLowerCase() === current.location_barangay.trim().toLowerCase(),
          );
          const locationBarangay = validBarangay ? current.location_barangay : '';
          return {
            ...current,
            location_barangay: locationBarangay,
            location: proposedLocationValue(current.location_area, locationBarangay, current.location_city, current.location_province),
          };
        });
      } catch {
        if (cancelled || requestId !== proposedBarangayRequestId.current) return;
        setProposedBarangayCatalog([]);
        setForm((current) => ({
          ...current,
          location_barangay: '',
          location: proposedLocationValue(current.location_area, '', current.location_city, current.location_province),
        }));
        setError('Unable to load barangays for the proposed location. Please try selecting the municipality again.');
      } finally {
        if (!cancelled && requestId === proposedBarangayRequestId.current) setProposedBarangayLoading(false);
      }
    };
    void loadBarangays();
    return () => { cancelled = true; };
  }, [proposedCityCode]);

  const validateField = (field: FormFieldName, value = form[field]) => {
    let message = '';
    const required = ['contact_name', 'email', 'phone', 'province', 'city', 'street', 'location_province', 'location_city', 'location_barangay',
      'business_experience', 'investment_capacity', 'has_proposed_property', 'opening_timeline'].includes(field);
    if (required && !value.trim()) {
      message = 'This field is required.';
    } else if (field === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
      message = 'Enter a valid email address.';
    } else if (field === 'phone' && !/^09\d{9}$/.test(value.replace(/\D/g, ''))) {
      message = 'Enter an 11-digit Philippine mobile number, such as 0917 123 4567.';
    } else if (field === 'investment_capacity' && value && (!Number.isFinite(Number(currencyValue(value))) || Number(currencyValue(value)) < 0)) {
      message = 'Enter a valid investment amount.';
    } else if (field === 'province' && value.trim()) {
      const matchesProvince = provinceCatalog.some((option) => option.name.toLowerCase() === value.trim().toLowerCase());
      if (!matchesProvince) {
        message = 'Select a valid Philippine province from the list.';
      }
    } else if (field === 'city' && value.trim()) {
      const cityMatches = cityCatalog.some((option) => option.name.toLowerCase() === value.trim().toLowerCase());
      if (!cityMatches) {
        message = 'Select a valid city or municipality for the selected province.';
      }
    } else if (field === 'street' && value.trim()) {
      const barangayMatches = addressBarangayCatalog.some((option) => option.name.toLowerCase() === value.trim().toLowerCase());
      if (!barangayMatches) {
        message = 'Select a barangay within the selected city or municipality.';
      }
    } else if (field === 'location_province' && value.trim()) {
      const matchesProvince = provinceCatalog.some((option) => option.name.toLowerCase() === value.trim().toLowerCase());
      if (!matchesProvince) {
        message = 'Select a valid province for the proposed franchise location.';
      }
    } else if (field === 'location_city' && value.trim()) {
      const cityMatches = proposedCityCatalog.some((option) => option.name.toLowerCase() === value.trim().toLowerCase());
      if (!cityMatches) {
        message = 'Select a city or municipality within the proposed location province.';
      }
    } else if (field === 'location_barangay' && value.trim()) {
      const barangayMatches = proposedBarangayCatalog.some((option) => option.name.toLowerCase() === value.trim().toLowerCase());
      if (!barangayMatches) {
        message = 'Select a barangay within the proposed city or municipality.';
      }
    }
    setFieldErrors((current) => ({ ...current, [field]: message || undefined }));
    return !message;
  };

  const validateStep = () => {
    const requiredFields: FormFieldName[] = step === 0
      ? ['contact_name', 'email', 'phone', 'province', 'city', 'street']
      : ['location_province', 'location_city', 'location_barangay', 'business_experience', 'investment_capacity', 'has_proposed_property', 'opening_timeline'];
    let valid = true;
    for (const field of requiredFields) {
      if (!validateField(field)) valid = false;
    }
    return valid;
  };

  const goToStep = (nextStep: number) => {
    setDraftStatus('saving');
    setStep(Math.max(0, Math.min(2, nextStep)));
    setError('');
  };

  const continueToNextStep = () => {
    if (!validateStep()) {
      const firstInvalid = document.querySelector<HTMLElement>('[aria-invalid="true"]');
      firstInvalid?.focus();
      return;
    }
    goToStep(step + 1);
  };

  const restoreDraft = () => {
    if (!savedDraft) return;
    const restoredForm = {
      ...savedDraft.form,
      contact_name: applicant?.full_name || savedDraft.form.contact_name,
      email: applicant?.email || savedDraft.form.email,
      phone: formatPhone(applicant?.phone || savedDraft.form.phone),
    };
    setForm(restoredForm);
    const addressProvince = provinceCatalog.find((option) =>
      option.name.toLowerCase() === restoredForm.province.trim().toLowerCase(),
    );
    setProvinceCode(addressProvince?.code ?? '');
    if (addressProvince) void loadCitiesForProvince(addressProvince.code, restoredForm.city);
    const proposedProvince = provinceCatalog.find((option) =>
      option.name.toLowerCase() === restoredForm.location_province.trim().toLowerCase(),
    );
    setProposedProvinceCode(proposedProvince?.code ?? '');
    if (proposedProvince) void loadProposedCitiesForProvince(proposedProvince.code, restoredForm.location_city);
    setStep(savedDraft.step);
    setSavedDraft(null);
    setDraftResolved(true);
    setError('');
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    setSavedDraft(null);
    setDraftResolved(true);
    setDraftStatus('idle');
  };

  const validateFiles = (selected: File[]) => {
    setFileError('');
    const validFiles: File[] = [];
    for (const file of selected) {
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      if (!acceptedExtensions.includes(extension)) {
        setFileError(`${file.name} isn’t a supported file. Choose a PDF, JPG, PNG, DOC, or DOCX file.`);
        continue;
      }
      if (file.size > maxSupportingDocumentSize) {
        setFileError(`${file.name} is larger than the 10 MB limit. Choose a smaller file.`);
        continue;
      }
      validFiles.push(file);
    }
    const uniqueFiles = validFiles.filter((file, index) =>
      !documents.some((existing) =>
        existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified,
      )
      && validFiles.findIndex((candidate) =>
        candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified,
      ) === index,
    );
    const availableSlots = maxSupportingDocuments - documents.length;
    if (uniqueFiles.length > availableSlots) {
      setFileError(`You can attach up to ${maxSupportingDocuments} files. ${availableSlots} slot(s) remain.`);
    }
    if (uniqueFiles.length) {
      setDocuments((current) => [...current, ...uniqueFiles.slice(0, availableSlots)]);
    }
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    validateFiles(Array.from(event.target.files || []));
    event.target.value = '';
  };

  const removeDocument = () => {
    if (removeIndex === null) return;
    setDocuments((current) => current.filter((_, index) => index !== removeIndex));
    setRemoveIndex(null);
  };

  const handleSubmit = async () => {
    if (step !== 2 || isSubmitting || !consentAccurate || !consentPrivacy) return;
    setError('');
    setSubmissionFailed(false);
    setIsSubmitting(true);
    const body = new FormData();
    body.append('franchise_name', form.franchise_name);
    body.append('contact_name', form.contact_name);
    body.append('email', applicant?.email || form.email);
    body.append('update_profile', updateApplicantProfile ? '1' : '0');
    body.append('phone', form.phone);
    body.append('applicant_address', addressValue(form));
    body.append('business_experience', form.business_experience);
    body.append('investment_capacity', currencyValue(form.investment_capacity));
    body.append('location', form.location);
    body.append('has_proposed_property', form.has_proposed_property === 'yes' ? '1' : '0');
    body.append('property_status', form.has_proposed_property);
    body.append('opening_timeline', form.opening_timeline);
    body.append('business_information', form.business_information);
    body.append('notes', form.notes);
    documents.forEach((file) => body.append('documents[]', file));

    try {
      const response = await fetch(`${API_URL}/franchise-applications`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(franchiseApplicantAuthService.getToken()
            ? { Authorization: `Bearer ${franchiseApplicantAuthService.getToken()}` }
            : {}),
        },
        body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const validationMessages = result.errors ? Object.values(result.errors).flat().join(' ') : '';
        throw new Error(validationMessages || result.message || 'Unable to submit your application.');
      }
      const reference = getReferenceNumber(result);
      localStorage.removeItem(draftKey);
      setReferenceNumber(reference);
      setSubmissionConfirmed(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your application. Please try again.');
      setSubmissionFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const leaveApplication = () => {
    if (hasFormData) setLeaveDialogOpen(true);
    else navigate('/franchise-opportunities');
  };

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(referenceNumber);
      setCopyMessage('Reference number copied.');
    } catch {
      setCopyMessage('Copy failed. Select and copy the reference number instead.');
    }
  };

  if (submissionConfirmed) {
    return (
      <SuccessScreen
        name={form.contact_name}
        email={form.email}
        referenceNumber={referenceNumber}
        copyMessage={copyMessage}
        onCopy={() => void copyReference()}
      />
    );
  }

  return (
    <main className="franchise-application-page min-h-screen">
      <div className="franchise-application-shell">
        <div className="franchise-top-actions">
          <button type="button" onClick={leaveApplication} className="franchise-back-opportunities inline-flex min-h-11 items-center gap-2 rounded-lg text-sm">
            <ArrowLeft size={16} aria-hidden="true" /> Back to opportunities
          </button>
          <ThemeToggle />
        </div>

        <div className="franchise-application-layout">
          <aside className="franchise-sidebar">
            <div className="franchise-brand-eyebrow mb-4 flex items-center gap-2 text-[var(--oppa-green)]">
              <Building2 size={19} aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-[.14em]">Franchise application</span>
            </div>
            <h1 ref={sidebarHeadingRef} tabIndex={-1} className="franchise-sidebar-heading font-serif text-3xl font-bold leading-tight text-[var(--oppa-text)] focus:outline-none">
              {stepHeadings[step]}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--oppa-text-muted)]">
              Application review is required; submitting does not guarantee approval.
            </p>
            <Stepper currentStep={step} onStepChange={goToStep} orientation="vertical" />
            <DraftStatus status={draftStatus} />
            {minimumInvestment && step === 1 && (
              <p className="franchise-investment-callout mt-5 flex items-center gap-2 rounded-2xl p-4 text-sm font-semibold">
                <Info size={17} /> Minimum investment: ₱{Number(minimumInvestment).toLocaleString('en-PH')}
              </p>
            )}
            {(step === 0 || step === 2) && (
              <ImportantNotesToggle
                expanded={step === 0 ? showStepOneNotes : showReviewNotes}
                onToggle={() => (step === 0 ? setShowStepOneNotes((value) => !value) : setShowReviewNotes((value) => !value))}
                className="franchise-sidebar-notes"
              />
            )}
            <p className="franchise-reassurance mt-auto pt-6 text-xs leading-5 text-[var(--oppa-text-muted)]">
              Your details are handled with care and used only to review your franchise proposal.
            </p>
          </aside>

          <section ref={cardRef} className="franchise-application-card w-full rounded-[24px] border border-[var(--oppa-border)] px-5 py-6 sm:px-8 sm:py-8">
        <header className="franchise-compact-header mb-7">
          <div className="mb-2 flex items-center gap-2 text-[var(--oppa-green)]">
            <Building2 size={19} aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[.14em]">Franchise application</span>
          </div>
          <div className="franchise-heading-row">
            <h1 ref={compactHeadingRef} tabIndex={-1} className="font-serif text-3xl font-bold leading-tight text-[var(--oppa-text)] focus:outline-none sm:text-[2.1rem]">
              {stepHeadings[step]}
            </h1>
            <DraftStatus status={draftStatus} />
          </div>
          <p className="franchise-disclaimer mt-2 max-w-3xl text-sm leading-6 text-[var(--oppa-text-muted)]">
            Application review is required; submitting does not guarantee approval.
          </p>
          <Stepper currentStep={step} onStepChange={goToStep} orientation="horizontal" />
          {minimumInvestment && step === 1 && (
            <p className="franchise-investment-callout mt-4 flex items-center gap-2 rounded-xl p-3 text-sm font-semibold">
              <Info size={17} /> Minimum investment: ₱{Number(minimumInvestment).toLocaleString('en-PH')}
            </p>
          )}
          {(step === 0 || step === 2) && (
            <ImportantNotesToggle
              expanded={step === 0 ? showStepOneNotes : showReviewNotes}
              onToggle={() => (step === 0 ? setShowStepOneNotes((value) => !value) : setShowReviewNotes((value) => !value))}
              className="franchise-compact-notes"
            />
          )}
        </header>

        {savedDraft && (
          <div className="my-5 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)] p-4" role="region" aria-label="Saved application draft">
            <div className="flex items-start gap-3">
              <Clock3 className="mt-0.5 size-5 shrink-0 text-[var(--oppa-green)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--oppa-text)]">Continue where you left off?</p>
                <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">A saved draft is available on this device. Uploaded files are not saved.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={restoreDraft} className="franchise-draft-continue min-h-11 rounded-xl px-4 text-sm font-semibold">Continue draft</button>
                  <button type="button" onClick={discardDraft} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)]">Start fresh</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="franchise-alert my-5 flex items-start gap-2 rounded-xl p-3 text-sm" role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> <span>{error}</span>
          </div>
        )}

        <div key={step} className="franchise-step-panel">
          {step === 0 && (
            <div className="space-y-7">
              <FormSection title="Personal information" className="franchise-form-subsection">
                <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                  <FormField id="contact_name" label="Full legal name" required helper="Enter the name shown on your valid ID." error={fieldErrors.contact_name}>
                    <input id="contact_name" required autoComplete="name" maxLength={255} value={form.contact_name}
                      onChange={(event) => updateField('contact_name', event.target.value)} onBlur={() => validateField('contact_name')}
                      placeholder="Your full legal name" className="franchise-control" aria-invalid={!!fieldErrors.contact_name}
                      aria-describedby={fieldDescription('contact_name', !!fieldErrors.contact_name)} />
                  </FormField>
                  <FormField id="email" label="Contact email" required helper="Linked to your signed-in account and cannot be changed here." error={fieldErrors.email}>
                    <LockedEmailField id="email" value={form.email} onBlur={() => validateField('email')}
                      describedBy={fieldDescription('email', !!fieldErrors.email)} />
                  </FormField>
                  <FormField id="phone" label="Philippine mobile number" required helper="Format: 09XX XXX XXXX." error={fieldErrors.phone}>
                    <PhoneInput id="phone" value={form.phone}
                      onChange={(value) => updateField('phone', value)} onBlur={() => validateField('phone')}
                      describedBy={fieldDescription('phone', !!fieldErrors.phone)} invalid={!!fieldErrors.phone}
                      placeholder="0917 123 4567" />
                  </FormField>
                </div>
              </FormSection>
              <FormSection title="Address" className="franchise-form-subsection">
                <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                  <FormField id="province" label="Province" required helper={provinceLoading ? 'Loading provinces…' : 'Start typing to see matching provinces.'} error={fieldErrors.province}>
                    <SearchableSelect id="province" required value={form.province} onChange={(value) => {
                      updateField('province', value);
                      setCityCode('');
                      setForm((current) => ({ ...current, city: '', street: '' }));
                      const selectedProvince = provinceCatalog.find((option) => option.name.toLowerCase() === value.trim().toLowerCase());
                      setProvinceCode(selectedProvince?.code ?? '');
                      setFieldErrors((current) => ({ ...current, province: undefined, city: undefined }));
                      if (selectedProvince?.code) {
                        void loadCitiesForProvince(selectedProvince.code, '');
                      } else {
                        cityRequestId.current += 1;
                        setCityCatalog([]);
                        setCityLoading(false);
                      }
                    }}
                      onBlur={() => validateField('province')} options={provinceOptions} placeholder="Select or enter a province"
                      invalid={!!fieldErrors.province} describedBy={fieldDescription('province', !!fieldErrors.province)} disabled={provinceLoading} />
                  </FormField>
                  <FormField id="city" label="City / Municipality" required helper={cityLoading ? 'Loading cities…' : addressGeoReady ? 'Enter the city or municipality where you live.' : 'Select a valid province to unlock the city list.'} error={fieldErrors.city}>
                    <SearchableSelect id="city" required value={form.city} onChange={(value) => {
                      updateField('city', value);
                      setForm((current) => ({ ...current, street: '' }));
                      const selectedCity = cityCatalog.find((option) => option.name.toLowerCase() === value.trim().toLowerCase());
                      setCityCode(selectedCity?.code ?? '');
                      setFieldErrors((current) => ({ ...current, city: undefined }));
                    }}
                      onBlur={() => validateField('city')} options={cityOptions} placeholder="Select or enter a city"
                      invalid={!!fieldErrors.city} describedBy={fieldDescription('city', !!fieldErrors.city)} disabled={cityDisabled} />
                  </FormField>
                  <FormField id="street" label="Barangay" required helper={
                    addressBarangayLoading
                      ? 'Loading barangays…'
                      : cityCode
                        ? addressBarangayOptions.length
                          ? 'Choose a barangay within the selected city or municipality.'
                          : 'No barangays are currently available for this municipality.'
                        : 'Select a city or municipality first to see its barangays.'
                  } error={fieldErrors.street} className="sm:col-span-2">
                    <SearchableSelect id="street" required value={form.street} onChange={(value) => {
                      updateField('street', value);
                    }}
                      onBlur={() => validateField('street')} options={addressBarangayOptions} placeholder="Select a barangay"
                      invalid={!!fieldErrors.street} describedBy={fieldDescription('street', !!fieldErrors.street)}
                      disabled={!cityCode || cityLoading || addressBarangayLoading || !addressBarangayOptions.length} />
                  </FormField>
                </div>
              </FormSection>
              <label className="franchise-profile-consent flex min-h-11 items-start gap-3 rounded-xl p-3 text-sm leading-5 text-[var(--oppa-text-muted)]">
                <input type="checkbox" checked={updateApplicantProfile} onChange={(event) => setUpdateApplicantProfile(event.target.checked)} className="mt-0.5 size-4 accent-[var(--oppa-green)]" />
                <span>Also update my applicant account name and mobile number with these details.</span>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-7">
              <FormSection title="Location">
                <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                  <FormField id="location_province" label="Proposed location province" required helper={provinceLoading ? 'Loading provinces…' : 'Choose the province where you plan to open the franchise.'} error={fieldErrors.location_province}>
                    <SearchableSelect id="location_province" required value={form.location_province} onChange={(value) => {
                      updateProposedLocation('location_province', value);
                      updateProposedLocation('location_city', '');
                      const selectedProvince = provinceCatalog.find((option) =>
                        option.name.toLowerCase() === value.trim().toLowerCase(),
                      );
                      setProposedProvinceCode(selectedProvince?.code ?? '');
                      setProposedCityCode('');
                      if (selectedProvince) {
                        void loadProposedCitiesForProvince(selectedProvince.code, '');
                      } else {
                        proposedCityRequestId.current += 1;
                        setProposedCityCatalog([]);
                        setProposedCityLoading(false);
                      }
                    }}
                      onBlur={() => validateField('location_province')} options={provinceOptions} placeholder="Select a province"
                      invalid={!!fieldErrors.location_province} describedBy={fieldDescription('location_province', !!fieldErrors.location_province)} disabled={provinceLoading} />
                  </FormField>
                  <FormField id="location_city" label="Proposed city / municipality" required helper={
                    proposedCityLoading
                      ? 'Loading municipalities…'
                      : proposedProvinceCode
                        ? 'Only cities and municipalities in the selected province are listed.'
                        : 'Select a province first to see its cities and municipalities.'
                  } error={fieldErrors.location_city}>
                    <SearchableSelect id="location_city" required value={form.location_city} onChange={(value) => {
                      updateProposedLocation('location_city', value);
                      updateProposedLocation('location_barangay', '');
                      const selectedCity = proposedCityCatalog.find((option) =>
                        option.name.toLowerCase() === value.trim().toLowerCase(),
                      );
                      setProposedCityCode(selectedCity?.code ?? '');
                    }}
                      onBlur={() => validateField('location_city')} options={proposedCityOptions} placeholder="Select a city or municipality"
                      invalid={!!fieldErrors.location_city} describedBy={fieldDescription('location_city', !!fieldErrors.location_city)} disabled={proposedCityDisabled} />
                  </FormField>
                  <FormField id="location_barangay" label="Proposed location barangay" required helper={
                    proposedBarangayLoading
                      ? 'Loading barangays…'
                      : proposedCityCode
                        ? proposedBarangayOptions.length
                          ? 'Choose a barangay within the selected municipality. This is required for your proposed site.'
                          : 'No barangays are currently available for this municipality.'
                        : 'Select a municipality first to see its barangays.'
                  } error={fieldErrors.location_barangay}>
                    <SearchableSelect id="location_barangay" required value={form.location_barangay} onChange={(value) => {
                      updateProposedLocation('location_barangay', value);
                    }}
                      onBlur={() => validateField('location_barangay')} options={proposedBarangayOptions} placeholder="Select a barangay"
                      invalid={!!fieldErrors.location_barangay} describedBy={fieldDescription('location_barangay', !!fieldErrors.location_barangay)}
                      disabled={!proposedCityCode || proposedBarangayLoading || !proposedBarangayOptions.length} />
                  </FormField>
                  <FormField id="location_area" label="Street, shopping center, or landmark" helper="Optional, but helpful for accurately assessing the proposed site." error={fieldErrors.location_area} className="sm:col-span-2">
                    <input id="location_area" maxLength={500} value={form.location_area}
                      onChange={(event) => updateProposedLocation('location_area', event.target.value)}
                      placeholder="Street, shopping center, or nearby landmark (optional)" className="franchise-control"
                      aria-invalid={!!fieldErrors.location_area} aria-describedby={fieldDescription('location_area', !!fieldErrors.location_area)} />
                  </FormField>
                </div>
              </FormSection>
              <FormSection title="Experience and capacity">
                <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                  <FormField id="business_experience" label="Relevant business or management experience" required helper="Share your experience in business, team leadership, or food service." error={fieldErrors.business_experience} className="sm:col-span-2">
                    <AutoGrowTextarea id="business_experience" required maxLength={5000} rows={4} value={form.business_experience}
                      onChange={(value) => updateField('business_experience', value)} onBlur={() => validateField('business_experience')}
                      placeholder="Describe your experience operating a business, managing teams, or working in food service."
                      invalid={!!fieldErrors.business_experience} describedBy={fieldDescription('business_experience', !!fieldErrors.business_experience)} />
                  </FormField>
                  <FormField id="investment_capacity" label="Estimated investment capacity" required helper={
                    minimumInvestment
                      ? `Minimum required investment: ₱${Number(minimumInvestment).toLocaleString('en-PH')}.`
                      : minimumInvestmentError ? 'The minimum investment is currently unavailable.' : 'Enter your available investment in Philippine pesos.'
                  } error={fieldErrors.investment_capacity}>
                    <CurrencyInput id="investment_capacity" value={form.investment_capacity}
                      onChange={(value) => updateField('investment_capacity', value)}
                      onBlur={() => validateField('investment_capacity')}
                      invalid={!!fieldErrors.investment_capacity}
                      describedBy={fieldDescription('investment_capacity', !!fieldErrors.investment_capacity)} />
                  </FormField>
                  <FormField id="franchise_name" label="Proposed business name" helper="Optional — the team can help you choose a final name.">
                    <input id="franchise_name" maxLength={255} value={form.franchise_name} onChange={(event) => updateField('franchise_name', event.target.value)} placeholder="Name for your proposed location" className="franchise-control" />
                  </FormField>
                </div>
              </FormSection>
              <FormSection title="Property and timeline">
                <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
                  <FormField id="property_status" label="Do you have a proposed property?" required helper="You can update the team if your plans change." error={fieldErrors.has_proposed_property} className="sm:col-span-2">
                    <SegmentedRadio
                      id="property_status"
                      name="property_status"
                      value={form.has_proposed_property}
                      options={[{ value: 'yes', label: 'Yes', description: 'I have a site in mind' }, { value: 'no', label: 'No', description: 'I do not have a site yet' }, { value: 'looking', label: 'Still looking', description: 'I am exploring locations' }]}
                      onChange={(value) => {
                        updateField('has_proposed_property', value as PropertyStatus);
                        setFieldErrors((current) => ({ ...current, has_proposed_property: undefined }));
                      }}
                      onBlur={() => validateField('has_proposed_property')}
                      invalid={!!fieldErrors.has_proposed_property}
                      describedBy={fieldDescription('property_status', !!fieldErrors.has_proposed_property)}
                    />
                  </FormField>
                  <FormField id="opening_timeline" label="Expected opening timeline" required helper="Choose the timeframe that best matches your current plan." error={fieldErrors.opening_timeline}>
                    <StyledSelect id="opening_timeline" required value={form.opening_timeline}
                      onChange={(value) => {
                        updateField('opening_timeline', value);
                        setFieldErrors((current) => ({ ...current, opening_timeline: undefined }));
                      }} onBlur={() => validateField('opening_timeline')}
                      invalid={!!fieldErrors.opening_timeline} describedBy={fieldDescription('opening_timeline', !!fieldErrors.opening_timeline)}
                      options={Object.entries(timelineLabels).map(([value, label]) => ({ value, label }))} placeholder="Choose a timeframe" />
                  </FormField>
                </div>
              </FormSection>
              <FormSection title="Additional information">
                <div className="grid gap-5">
                  <FormField id="business_information" label="Other relevant business information" helper="Partners, operating plans, or other details that support your business plan.">
                    <AutoGrowTextarea id="business_information" maxLength={5000} rows={3} value={form.business_information}
                      onChange={(value) => updateField('business_information', value)}
                      placeholder="Partners, operating plans, or other relevant business information." />
                  </FormField>
                  <FormField id="notes" label="Additional notes" helper="Use this for anything not covered above.">
                    <AutoGrowTextarea id="notes" maxLength={5000} rows={3} value={form.notes}
                      onChange={(value) => updateField('notes', value)} placeholder="Anything else you would like to include." />
                  </FormField>
                  <FileDropzone
                    inputRef={fileInputRef}
                    documents={documents}
                    error={fileError}
                    isDragging={isDragging}
                    onFileChange={onFileInputChange}
                    onDrop={(files) => validateFiles(files)}
                    onDragChange={setIsDragging}
                    onBrowse={() => fileInputRef.current?.click()}
                    onRemove={(index) => setRemoveIndex(index)}
                  />
                </div>
              </FormSection>
            </div>
          )}

          {step === 2 && (
            <div className="franchise-review-grid">
              <p className="franchise-review-intro text-sm leading-6 text-[var(--oppa-text-muted)]">Review the details below before sending your application. You can edit any section or remove a document.</p>
              <ReviewSection title="Your details" onEdit={() => goToStep(0)}>
                <ReviewItem label="Full legal name" value={form.contact_name} />
                <ReviewItem label="Contact email" value={form.email} />
                <ReviewItem label="Mobile number" value={formatPhone(form.phone)} />
                <ReviewItem label="Province" value={form.province} />
                <ReviewItem label="City / Municipality" value={form.city} />
                <ReviewItem label="Barangay" value={form.street} />
                <ReviewItem label="Update applicant account" value={updateApplicantProfile ? 'Yes' : 'No'} />
              </ReviewSection>
              <ReviewSection title="Business plan" onEdit={() => goToStep(1)}>
                <ReviewItem label="Proposed business name" value={form.franchise_name} optional />
                <ReviewItem label="Proposed location province" value={form.location_province} />
                <ReviewItem label="Proposed city / municipality" value={form.location_city} />
                <ReviewItem label="Proposed location barangay" value={form.location_barangay} />
                <ReviewItem label="Street, shopping center, or landmark" value={form.location_area} optional />
                <ReviewItem label="Business experience" value={form.business_experience} />
                <ReviewItem label="Investment capacity" value={formatCurrency(form.investment_capacity)} />
                <ReviewItem label="Proposed property" value={propertyLabel(form.has_proposed_property)} />
                <ReviewItem label="Expected opening" value={timelineLabels[form.opening_timeline]} />
                <ReviewItem label="Other relevant business information" value={form.business_information} optional />
                <ReviewItem label="Additional notes" value={form.notes} optional />
              </ReviewSection>
              <ReviewSection title={`Documents (${documents.length}/${maxSupportingDocuments})`} onEdit={() => goToStep(1)} progress={{ value: documents.length, max: maxSupportingDocuments }}>
                {documents.length ? (
                  <ul className="space-y-3 sm:col-span-2" aria-label="Uploaded documents">
                    {documents.map((file, index) => (
                      <FileCard key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={() => setRemoveIndex(index)} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--oppa-text-muted)] sm:col-span-2">Not provided</p>
                )}
              </ReviewSection>

              <div className="franchise-review-consents space-y-3 rounded-2xl bg-[var(--oppa-cream)] p-4 sm:p-5">
                <ConsentCheckbox id="consent-accurate" checked={consentAccurate} onChange={setConsentAccurate}>
                  I confirm the information in this application is accurate and complete.
                </ConsentCheckbox>
                <ConsentCheckbox id="consent-privacy" checked={consentPrivacy} onChange={setConsentPrivacy}>
                  I agree to the Privacy Policy and consent to the processing of my information under the Data Privacy Act.
                </ConsentCheckbox>
              </div>
            </div>
          )}
        </div>

        <footer className="franchise-form-actions mt-8 flex items-center justify-between gap-3 border-t border-[var(--oppa-border)] pt-5">
          <Button type="button" variant="secondary" onClick={() => goToStep(step - 1)} disabled={step === 0}>
            <ArrowLeft size={15} /> Back
          </Button>
          {step < 2 ? (
            <Button type="button" variant="primary" onClick={continueToNextStep} disabled={step === 0 ? !stepOneValid : !stepTwoValid}>
              {step === 1 ? 'Review application' : 'Continue'} <ArrowRight size={16} />
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={() => void handleSubmit()} disabled={isSubmitting || !consentAccurate || !consentPrivacy}>
              {isSubmitting ? <><LoaderCircle size={16} className="animate-spin" /> Submitting…</> : <>{submissionFailed ? 'Retry submission' : 'Confirm and submit application'} <ArrowRight size={16} /></>}
            </Button>
          )}
        </footer>
      </section>
        </div>
      </div>

      {leaveDialogOpen && (
        <ConfirmationDialog
          title="Leave your application?"
          message="Your changes are saved as a draft on this device. You can continue later."
          confirmLabel="Back to opportunities"
          onCancel={() => setLeaveDialogOpen(false)}
          onConfirm={() => navigate('/franchise-opportunities')}
        />
      )}
      {removeIndex !== null && (
        <ConfirmationDialog
          title="Remove this document?"
          message={`“${documents[removeIndex]?.name || 'This document'}” will be removed from your application.`}
          confirmLabel="Remove document"
          destructive
          onCancel={() => setRemoveIndex(null)}
          onConfirm={removeDocument}
        />
      )}
    </main>
  );
};

const fieldDescription = (id: string, hasError: boolean) => hasError ? `${id}-help ${id}-error` : `${id}-help`;

const FormField: React.FC<{
  id: string;
  label: string;
  required?: boolean;
  helper: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ id, label, required = false, helper, error, className = '', children }) => (
  <div className={`franchise-field min-w-0 ${className}`}>
    <label id={`${id}-label`} htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[var(--label)]">
      {label}{required && <span className="franchise-required-mark ml-1" aria-hidden="true">*</span>}
      {required && <span className="sr-only"> (required)</span>}
    </label>
    {children}
    <p id={`${id}-help`} className="mt-1.5 text-xs leading-5 text-[var(--oppa-text-muted)]">{helper}</p>
    {error && <p id={`${id}-error`} className="franchise-danger-text mt-1 inline-flex items-start gap-1.5 text-xs font-medium" aria-live="polite"><AlertCircle size={14} className="mt-px shrink-0" />{error}</p>}
  </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant: 'primary' | 'secondary' }> = ({ variant, className = '', children, ...props }) => (
  <button {...props} className={`franchise-${variant}-button ${className}`}>{children}</button>
);

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(getSavedTheme);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button type="button" className="franchise-theme-toggle" aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`} onClick={() => { applyTheme(nextTheme); setTheme(nextTheme); }}>
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  );
};

const FormSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <section className={`space-y-4 ${className}`} aria-label={title}>
    <h2 className="border-b border-[var(--oppa-border)] pb-2 text-sm font-bold uppercase tracking-[.08em] text-[var(--oppa-text-muted)]">{title}</h2>
    {children}
  </section>
);

const DraftStatus: React.FC<{ status: 'idle' | 'saving' | 'saved' | 'failed' }> = ({ status }) => (
  <span className={`franchise-draft-status is-${status}`} role="status" aria-live="polite">
    {status === 'saved' && <Check size={14} aria-hidden="true" />}
    {status === 'saving' ? 'Saving draft…' : status === 'failed' ? 'Draft not saved' : status === 'saved' ? 'Draft saved' : 'Draft ready'}
  </span>
);

const ImportantNotesToggle: React.FC<{ expanded: boolean; onToggle: () => void; className?: string }> = ({ expanded, onToggle, className = '' }) => (
  <div className={`franchise-important-notes ${className}`}>
    <button type="button" className="franchise-important-notes-toggle" aria-expanded={expanded} onClick={onToggle}>
      Important notes <ChevronDown size={16} className={expanded ? 'is-open' : ''} aria-hidden="true" />
    </button>
    {expanded && <ImportantNotes />}
  </div>
);

const Stepper: React.FC<{
  currentStep: number;
  onStepChange: (step: number) => void;
  orientation?: 'vertical' | 'horizontal';
}> = ({ currentStep, onStepChange, orientation = 'horizontal' }) => (
  <nav aria-label="Application steps" className={`franchise-stepper-nav is-${orientation}`}>
    <p className="franchise-step-progress" aria-live="polite">
      Step {currentStep + 1} of 3 <span aria-hidden="true">•</span> about {currentStep === 2 ? '1' : '3'} min left
    </p>
    <div className="franchise-progress-track" role="progressbar" aria-label="Application progress" aria-valuemin={1} aria-valuemax={3} aria-valuenow={currentStep + 1}>
      <span style={{ width: `${((currentStep + 1) / 3) * 100}%` }} />
    </div>
    <ol className="franchise-stepper">
      {stepLabels.map((label, index) => {
        const completed = index < currentStep;
        const current = index === currentStep;
        const contents = (
          <>
            <span className="franchise-step-circle">{completed ? <Check size={16} aria-hidden="true" /> : index + 1}</span>
            <span className="franchise-step-copy">
              <span className="franchise-step-label">{label}</span>
              <span className="franchise-step-description">{stepDescriptions[index]}</span>
            </span>
          </>
        );
        return (
          <li key={label} className={`franchise-stepper-item ${index < 2 ? 'has-connector' : ''} ${completed ? 'is-complete' : ''} ${current ? 'is-current' : ''}`}>
            {completed ? (
              <button type="button" onClick={() => onStepChange(index)} className="franchise-step-button" aria-label={`Return to completed step ${index + 1}: ${label}`}>
                {contents}
              </button>
            ) : (
              <span className="franchise-step-button" aria-current={current ? 'step' : undefined}>
                {contents}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

const StyledSelect: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}> = ({ id, value, onChange, onBlur, options, placeholder, required, invalid, describedBy }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => options.findIndex((option) => option.value === value));
  const listId = `${id}-options`;
  const selectedOption = options.find((option) => option.value === value);
  const chooseOption = (option: { value: string; label: string }) => {
    onChange(option.value);
    setActiveIndex(options.findIndex((candidate) => candidate.value === option.value));
    setIsOpen(false);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => {
        if (index < 0) return event.key === 'ArrowDown' ? 0 : options.length - 1;
        return event.key === 'ArrowDown'
          ? (index + 1) % options.length
          : (index <= 0 ? options.length - 1 : index - 1);
      });
    } else if ((event.key === 'Enter' || event.key === ' ') && !isOpen) {
      event.preventDefault();
      setIsOpen(true);
    } else if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      chooseOption(options[activeIndex] || options[0]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="franchise-custom-select">
      <button id={id} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={isOpen}
        aria-controls={listId} aria-activedescendant={isOpen && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-required={required} aria-invalid={invalid} aria-describedby={describedBy}
        onClick={() => setIsOpen((open) => !open)} onKeyDown={handleKeyDown} onBlur={onBlur}
        className={`franchise-control franchise-select-button ${selectedOption ? '' : 'is-placeholder'}`}>
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown size={16} className={isOpen ? 'is-open' : ''} aria-hidden="true" />
      </button>
      {isOpen && (
        <ul id={listId} className="franchise-select-options" role="listbox" aria-labelledby={`${id}-label`}>
          {options.map((option, index) => (
            <li key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value}>
              <button type="button" tabIndex={-1} className={index === activeIndex ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()} onClick={() => chooseOption(option)}>
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const LockedEmailField: React.FC<{ id: string; value: string; onBlur: () => void; describedBy: string }> = ({ id, value, onBlur, describedBy }) => (
  <div className="relative">
    <Lock className="franchise-control-icon" size={16} aria-hidden="true" />
    <input id={id} type="email" autoComplete="email" value={value} readOnly aria-readonly="true" onBlur={onBlur}
      className="franchise-control franchise-control-with-icon franchise-locked-control" aria-describedby={describedBy} />
  </div>
);

const PhoneInput: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
  describedBy: string;
  placeholder: string;
}> = ({ id, value, onChange, onBlur, invalid, describedBy, placeholder }) => (
  <input id={id} required type="tel" inputMode="tel" autoComplete="tel" maxLength={13} value={value}
    onChange={(event) => onChange(formatPhone(event.target.value))} onBlur={onBlur}
    placeholder={placeholder} className="franchise-control" aria-invalid={invalid} aria-describedby={describedBy} />
);

const SearchableSelect: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  options: string[];
  placeholder: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}> = ({ id, value, onChange, onBlur, options, placeholder, required, invalid, describedBy, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const filteredOptions = options.filter((option) => option.toLowerCase().includes(value.trim().toLowerCase()));
  const listId = `${id}-options`;
  const selectOption = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setActiveIndex(-1);
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && filteredOptions.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => (index + 1) % filteredOptions.length);
    } else if (event.key === 'ArrowUp' && filteredOptions.length) {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((index) => index <= 0 ? filteredOptions.length - 1 : index - 1);
    } else if (event.key === 'Enter' && isOpen && filteredOptions.length) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex >= 0 ? activeIndex : 0]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="franchise-searchable-select">
      <input id={id} required={required} role="combobox" aria-autocomplete="list" aria-expanded={isOpen}
        aria-controls={listId} aria-activedescendant={isOpen && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        autoComplete="off" maxLength={150} value={value} disabled={disabled}
        onChange={(event) => { if (disabled) return; onChange(event.target.value); setIsOpen(true); setActiveIndex(-1); }}
        onFocus={() => { if (!disabled) setIsOpen(true); }} onBlur={() => { window.setTimeout(() => setIsOpen(false), 100); onBlur(); }}
        onKeyDown={handleKeyDown} placeholder={placeholder}
        className={`franchise-control franchise-search-input ${options.some((option) => option.toLowerCase() === value.toLowerCase()) ? 'is-selected' : ''}`}
        aria-invalid={invalid} aria-describedby={describedBy} />
      <ChevronDown className="franchise-search-chevron" size={16} aria-hidden="true" />
      {isOpen && !disabled && filteredOptions.length > 0 && (
        <ul id={listId} className="franchise-search-options" role="listbox">
          {filteredOptions.map((option, index) => (
            <li key={option} id={`${listId}-${index}`} role="option" aria-selected={option.toLowerCase() === value.toLowerCase()}>
              <button type="button" tabIndex={-1} className={index === activeIndex ? 'is-active' : ''}
                onMouseDown={(event) => event.preventDefault()} onClick={() => selectOption(option)}>
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CurrencyInput: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
  describedBy: string;
}> = ({ id, value, onChange, onBlur, invalid, describedBy }) => (
  <div className="relative">
    <span className="franchise-currency-prefix" aria-hidden="true">₱</span>
    <input id={id} required inputMode="decimal" maxLength={16} value={value}
      onChange={(event) => onChange(formatCurrencyInput(event.target.value))}
      onBlur={onBlur} placeholder="2,500,000" className="franchise-control franchise-currency-control"
      aria-invalid={invalid} aria-describedby={describedBy} />
  </div>
);

const SegmentedRadio: React.FC<{
  id: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string; description: string }>;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid: boolean;
  describedBy: string;
}> = ({ id, name, value, options, onChange, onBlur, invalid, describedBy }) => (
  <div id={id} role="radiogroup" tabIndex={-1} aria-labelledby={`${id}-label`} aria-describedby={describedBy} aria-invalid={invalid} className="grid gap-2 sm:grid-cols-3">
    {options.map((option) => (
      <label key={option.value} className={`franchise-radio-card ${value === option.value ? 'is-selected' : ''}`}>
        <input type="radio" name={name} value={option.value} checked={value === option.value}
          onChange={() => onChange(option.value)} onBlur={onBlur} />
        <span className="franchise-radio-check" aria-hidden="true">{value === option.value && <Check size={13} />}</span>
        <span><span className="block text-sm font-semibold">{option.label}</span><span className="mt-1 block text-xs text-[var(--oppa-text-muted)]">{option.description}</span></span>
      </label>
    ))}
  </div>
);

const AutoGrowTextarea: React.FC<{
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  maxLength: number;
  rows: number;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}> = ({ id, value, onChange, onBlur, placeholder, maxLength, rows, required, invalid, describedBy }) => (
  <div>
    <textarea id={id} required={required} maxLength={maxLength} rows={rows} value={value} placeholder={placeholder}
      onChange={(event) => {
        onChange(event.target.value);
        event.target.style.height = 'auto';
        event.target.style.height = `${event.target.scrollHeight}px`;
      }}
      onBlur={onBlur} className="franchise-control franchise-textarea" aria-invalid={invalid} aria-describedby={describedBy} />
    <p className="mt-1 text-right text-xs text-[var(--oppa-text-muted)]" aria-live="polite">{value.length} / {maxLength}</p>
  </div>
);

const FileDropzone: React.FC<{
  inputRef: React.RefObject<HTMLInputElement | null>;
  documents: File[];
  error: string;
  isDragging: boolean;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDrop: (files: File[]) => void;
  onDragChange: (dragging: boolean) => void;
  onBrowse: () => void;
  onRemove: (index: number) => void;
}> = ({ inputRef, documents, error, isDragging, onFileChange, onDrop, onDragChange, onBrowse, onRemove }) => (
  <div>
    <div className="mb-2">
      <h3 className="text-sm font-semibold text-[var(--oppa-green)]">Supporting documents <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span></h3>
      <p className="mt-1 text-xs leading-5 text-[var(--oppa-text-muted)]">PDF, JPG, PNG, DOC, or DOCX · Maximum 10 MB per file · Up to 8 files</p>
    </div>
    <div className={`franchise-dropzone ${isDragging ? 'is-dragging' : ''}`}
      onDragOver={(event) => { event.preventDefault(); onDragChange(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onDragChange(false); }}
      onDrop={(event) => { event.preventDefault(); onDragChange(false); onDrop(Array.from(event.dataTransfer.files)); }}>
      <input ref={inputRef} id="supporting-documents" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={onFileChange} className="sr-only" aria-label="Browse for supporting documents" />
      <span className="franchise-upload-icon"><FileUp size={22} aria-hidden="true" /></span>
      <p className="text-sm font-semibold text-[var(--oppa-text)]">Drag files here or <button type="button" onClick={onBrowse} className="font-bold text-[var(--oppa-green)] underline underline-offset-2">browse</button></p>
      <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Files are attached when you submit this application.</p>
    </div>
    {error && <p className="franchise-danger-text mt-2 flex items-start gap-1.5 text-sm font-medium" role="alert"><AlertCircle size={15} className="mt-0.5 shrink-0" />{error}</p>}
    {documents.length > 0 && (
      <ul className="mt-3 space-y-2" aria-label="Selected supporting documents">
        {documents.map((file, index) => <FileCard key={`${file.name}-${file.lastModified}-${index}`} file={file} onRemove={() => onRemove(index)} />)}
      </ul>
    )}
  </div>
);

const FileCard: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  const [previewError, setPreviewError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const isImage = /\.(jpe?g|png)$/i.test(file.name);
  const imageUrl = useMemo(() => isImage ? URL.createObjectURL(file) : '', [file, isImage]);
  useEffect(() => {
    if (imageUrl) return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);
  const preview = () => {
    const url = URL.createObjectURL(file);
    const opened = window.open(url, '_blank');
    if (!opened) setPreviewError('Allow pop-ups to preview this file.');
    else opened.opener = null;
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return (
    <li className="franchise-file-card">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {isImage && imageUrl && !imageFailed ? <img src={imageUrl} alt="" onError={() => setImageFailed(true)} className="size-11 shrink-0 rounded-lg object-cover" /> : <span className="franchise-file-icon"><FileText size={20} aria-hidden="true" /></span>}
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-semibold text-[var(--oppa-text)]">{file.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-xs text-[var(--oppa-text-muted)]">{fileSize(file.size)}</p>
            <span className="franchise-file-ready">Ready to submit</span>
          </div>
          <div className="franchise-upload-progress mt-2" role="progressbar" aria-label={`${file.name} ready`} aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}><span /></div>
          {previewError && <p className="franchise-danger-text mt-1 text-xs" role="status">{previewError}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={preview} className="franchise-file-action">Preview</button>
        <button type="button" onClick={onRemove} className="franchise-remove-button" aria-label={`Remove ${file.name}`}><Trash2 size={17} /></button>
      </div>
    </li>
  );
};

const ReviewSection: React.FC<{
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
  progress?: { value: number; max: number };
}> = ({ title, onEdit, children, progress }) => (
  <section className="rounded-2xl border border-[var(--oppa-border)] p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-serif text-lg font-semibold text-[var(--oppa-text)]">{title}</h2>
      <button type="button" onClick={onEdit} className="franchise-review-edit"><Pencil size={14} aria-hidden="true" /> Edit</button>
    </div>
    {progress && <div className="franchise-document-count" aria-label={`${progress.value} of ${progress.max} documents attached`}>
      <span>{progress.value}/{progress.max} documents</span>
      <span className="franchise-document-meter"><span style={{ width: `${(progress.value / progress.max) * 100}%` }} /></span>
    </div>}
    <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">{children}</div>
  </section>
);

const ReviewItem: React.FC<{ label: string; value?: string; optional?: boolean }> = ({ label, value, optional = false }) => (
  <div className="min-w-0">
    <p className="text-xs font-semibold text-[var(--oppa-text-muted)]">{label}</p>
    <p className={`mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 ${optional && !value ? 'text-[var(--oppa-text-muted)]' : 'text-[var(--oppa-text)]'}`}>{value?.trim() || 'Not provided'}</p>
  </div>
);

const ConsentCheckbox: React.FC<{ id: string; checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }> = ({ id, checked, onChange, children }) => (
  <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg p-2 text-sm leading-6 text-[var(--oppa-text)]">
    <input id={id} type="checkbox" required checked={checked} onChange={(event) => onChange(event.target.checked)} className="franchise-checkbox mt-1 size-5 shrink-0" />
    <span>{children}<span className="franchise-required-mark ml-1" aria-hidden="true">*</span><span className="sr-only"> (required)</span></span>
  </label>
);

const ImportantNotes = () => (
  <div className="mt-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)] p-4 text-sm leading-6 text-[var(--oppa-text-muted)]">
    <p>Your application is reviewed by our team. Submission does not guarantee approval or authorize franchise operations. Please ensure the information and documents you provide are accurate. Your application information will be used to review your franchise proposal and communicate with you about its progress.</p>
  </div>
);

const propertyLabel = (value: PropertyStatus) => ({
  '': '',
  yes: 'Yes — I have a site in mind',
  no: 'No — I do not have a site yet',
  looking: 'Still looking',
}[value] ?? '');

const ConfirmationDialog: React.FC<{
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ title, message, confirmLabel, destructive = false, onCancel, onConfirm }) => {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => { cancelRef.current = onCancel; });

  useEffect(() => {
    const dialog = dialogRef.current;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])') || [];
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(focusable());
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1].focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      returnFocus?.focus();
    };
  }, []);

  return (
    <div className="franchise-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section ref={dialogRef} className="franchise-dialog" role="alertdialog" aria-modal="true" aria-labelledby="franchise-dialog-title" aria-describedby="franchise-dialog-message">
        <button type="button" onClick={onCancel} aria-label="Close dialog" className="franchise-dialog-close"><X size={19} /></button>
        <div className="franchise-dialog-symbol"><Info size={22} /></div>
        <h2 id="franchise-dialog-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">{title}</h2>
        <p id="franchise-dialog-message" className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">{message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} className="franchise-secondary-button min-h-11">Keep editing</button>
          <button type="button" onClick={onConfirm} className={`franchise-dialog-confirm min-h-11 rounded-xl px-4 text-sm font-semibold ${destructive ? 'is-destructive' : ''}`}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
};

const SuccessScreen: React.FC<{
  name: string;
  email: string;
  referenceNumber: string;
  copyMessage: string;
  onCopy: () => void;
}> = ({ name, email, referenceNumber, copyMessage, onCopy }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
  <main className="franchise-application-page flex min-h-screen items-center justify-center bg-[var(--oppa-cream)] px-4 py-8 text-[var(--oppa-text)]">
    <section className="franchise-application-card franchise-card-surface w-full max-w-2xl rounded-[28px] border border-[var(--oppa-border)] p-6 sm:p-10">
      <div className="mb-4 flex justify-end"><ThemeToggle /></div>
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-[var(--oppa-green)] franchise-success-check"><CheckCircle2 size={36} aria-hidden="true" /></div>
      <p className="mt-5 text-center text-xs font-bold uppercase tracking-[.16em] text-[var(--oppa-green)]">Application submitted</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-center font-serif text-3xl font-bold text-[var(--oppa-text)] focus:outline-none">Thank you, {name}</h1>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-6 text-[var(--oppa-text-muted)]">Your application has been received. Keep your reference number to track its progress.</p>
      {referenceNumber ? (
        <div className="mt-6 rounded-2xl bg-[var(--oppa-cream)] p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">Application reference</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <p className="font-mono text-xl font-bold tracking-wide text-[var(--oppa-green)]">{referenceNumber}</p>
            <button type="button" onClick={onCopy} className="franchise-copy-button inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--oppa-border)] px-3 text-sm font-semibold" aria-label="Copy reference number"><Copy size={15} /> Copy</button>
          </div>
          {copyMessage && <p className="mt-2 text-xs text-[var(--oppa-text-muted)]" role="status">{copyMessage}</p>}
        </div>
      ) : (
        <p role="status" className="franchise-warning mt-6 rounded-xl p-4 text-sm">Your application was received. The reference number was not included in the response; please check your email for updates and avoid submitting again.</p>
      )}
      <section className="mt-8">
        <h2 className="mb-4 font-serif text-xl font-semibold">What happens next</h2>
        <ol className="franchise-success-timeline">
          {['Received', 'Under review', 'Interview', 'Decision'].map((label, index) => (
            <li key={label} className={index <= 1 ? 'is-active' : ''}><span className="franchise-timeline-dot">{index <= 1 && <Check size={12} />}</span><span>{label}</span></li>
          ))}
        </ol>
      </section>
      <p className="mt-6 text-center text-sm text-[var(--oppa-text-muted)]">A confirmation and future updates will be sent to <span className="font-semibold text-[var(--oppa-text)]">{email}</span>.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/franchise/track-application" state={{ referenceNumber, email }} className="franchise-success-track inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold">Track my application <ArrowRight size={16} /></Link>
        <Link to="/franchise-opportunities" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--oppa-border)] px-5 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">Back to opportunities</Link>
      </div>
    </section>
  </main>
  );
};

export default FranchiseApplicationPage;

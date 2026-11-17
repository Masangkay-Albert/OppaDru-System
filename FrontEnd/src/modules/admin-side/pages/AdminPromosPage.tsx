import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import AdminLayout from '../components/AdminLayout';
import { promoService, PromoRequestError, type Promo } from '../../../services/promoService';
import { fetchWithAdminAuth } from '../../../services/adminAuthService';
import { formatCurrency } from '../../../utils/formatters';
import { categories } from '../../../data/mockData';
import { PageContainer, PageHeader } from '../../../components/ui/AdminPage';
import CategoryPills from '../../../components/ui/CategoryPills';
import Select from '../../../components/ui/Select';
import SearchInput from '../../../components/ui/SearchInput';
import {
  DiscountBadge,
  FieldLabel,
  IconButton,
  PromoModal,
  SegmentedControl,
  Toggle,
} from '../../../components/ui/AdminPromoControls';
import {
  getPromoDateTimeMin,
  getPromoDateTimeTimestamp,
  stripEmoji,
  toPromoApiDateTime,
  toPromoDateTimeInput,
} from '../../../utils/promoUi';
import { useToast } from '../../customer-side/components/ToastProvider';
import { INPUT_LIMITS } from '../../../constants/inputLimits';
import { LimitedInput, LimitedTextarea } from '../../../components/ui/LimitedInput';
import {
  LuCalendar,
  LuCheck,
  LuClipboard,
  LuClipboardCheck,
  LuFilter,
  LuLoaderCircle,
  LuBanknote,
  LuPencil,
  LuPercent,
  LuPlus,
  LuRefreshCw,
  LuSparkles,
  LuTag,
  LuTrash2,
  LuX,
} from 'react-icons/lu';
import { ValidatedForm } from '../../../components/ui/FormValidation';

type PromoStatusFilter = 'all' | 'active' | 'inactive' | 'expired';

const formatPromoDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
};

const errorMessage = (error: unknown, fallback: string): string => (
  error instanceof Error ? error.message : fallback
);

const localDateTimeTimestamp = getPromoDateTimeTimestamp;
const getPromoCurrentYear = (): number => Number(new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
}).format(new Date()));
const getDateTimeLocalMax = (): string => `${getPromoCurrentYear()}-12-31T23:59`;

const statusLabel = (promo: Promo): string => (
  promo.is_expired ? 'expired' : promo.is_active ? 'active' : 'inactive'
);

const daysUntil = (value: string): number => Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);

interface PromoDetailsProps {
  promo: Promo;
}

function PromoDetails({ promo }: PromoDetailsProps) {
  const title = stripEmoji(promo.title);
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    if (!promo.code) return;
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      showToast('Promo code copied.', 'success');
    } catch (error: unknown) {
      console.error('Unable to copy promo code.', error);
      showToast('Could not copy promo code.', 'error');
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-3">
      <PromoImage src={promo.image_url} className="size-11 rounded-xl border border-[var(--oppa-border)]" />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate font-display text-sm font-semibold text-[var(--oppa-text)]">{title}</h3>
          {promo.code && (
            <button type="button" onClick={() => void copyCode()} title="Copy promo code" aria-label={`Copy promo code ${promo.code}`} className="group/code inline-flex items-center gap-1 rounded-md border border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-2 py-0.5 font-mono text-xs font-medium text-[var(--oppa-text-muted)] transition-colors hover:border-[var(--oppa-green)] hover:text-[var(--oppa-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/40">
              {promo.code}
              {copied ? <LuClipboardCheck size={12} aria-hidden="true" /> : <LuClipboard size={12} aria-hidden="true" className="opacity-0 transition-opacity group-hover/code:opacity-100 group-focus-visible/code:opacity-100" />}
            </button>
          )}
        </div>
        {promo.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--oppa-text-muted)]">{promo.description}</p>
        )}
        {promo.times_used !== undefined && promo.times_used > 0 && (
          <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Used {promo.times_used} times</p>
        )}
      </div>
    </div>
  );
}

function PromoImage({ src, className = '' }: { src?: string | null; className?: string }) {
  const [failedSrc, setFailedSrc] = useState('');
  const [authenticatedImage, setAuthenticatedImage] = useState<{ source: string; url: string } | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    if (!src?.includes('/api/admin/promos/')) return undefined;
    void fetchWithAdminAuth(src)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Promo image request failed (${response.status}).`);
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setAuthenticatedImage({ source: src, url: objectUrl });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((error: unknown) => {
        console.error('Unable to load promo image.', error);
        if (active) setFailedSrc(src);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  const isAdminImage = Boolean(src?.includes('/api/admin/promos/'));
  const displaySrc = isAdminImage
    ? (authenticatedImage?.source === src ? authenticatedImage.url : '')
    : (src || '');

  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-[var(--oppa-green-soft)]/60 text-[var(--oppa-green)] ${className}`}>
      {displaySrc && failedSrc !== src ? (
        <img src={displaySrc} alt="" onError={() => setFailedSrc(src || '')} className="size-full object-cover" />
      ) : (
        <LuSparkles size={20} aria-hidden="true" />
      )}
    </span>
  );
}

function ApplicableCategories({ promo }: { promo: Promo }) {
  return <CategoryPills categories={promo.applicable_categories || []} max={2} />;
}

function PromoValidity({ promo }: { promo: Promo }) {
  if (!promo.end_date) {
    return <span className="inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)]"><span className="size-2 rounded-full bg-[var(--oppa-text-muted)]/50" aria-hidden="true" />No expiration</span>;
  }
  if (promo.is_expired) {
    return <span className="inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)]"><span className="size-2 rounded-full bg-[var(--promo-danger-text)]" aria-hidden="true" />Expired {formatPromoDate(promo.end_date)}</span>;
  }

  const remainingDays = daysUntil(promo.end_date);
  const endingSoon = remainingDays <= 3;
  const dotClass = endingSoon ? 'bg-[var(--promo-warning-text)]' : 'bg-[var(--oppa-green)]';
  const relative = remainingDays <= 0
    ? 'Ends today'
    : `Ends in ${remainingDays} day${remainingDays === 1 ? '' : 's'}`;

  return (
    <div className="text-sm">
      <p className="inline-flex items-center gap-2 font-medium text-[var(--oppa-text)]">
        <span className={`size-2 rounded-full ${dotClass}`} aria-hidden="true" />
        {relative}
      </p>
      <p className="mt-0.5 pl-4 text-xs text-[var(--oppa-text-muted)]">Until {formatPromoDate(promo.end_date)}</p>
    </div>
  );
}

interface PromoRowProps {
  promo: Promo;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  toggling?: boolean;
}

function PromoRow({ promo, onEdit, onDelete, onToggle, toggling = false }: PromoRowProps) {
  return (
      <tr className="promo-table-row h-[76px] transition-colors duration-150">
        <td className="min-w-0 px-5 py-3 align-middle"><PromoDetails promo={promo} /></td>
        <td className="px-4 py-3 text-center align-middle">
          <div className="flex justify-center">
            <DiscountBadge type={promo.discount_type} value={Number(promo.discount_value)} />
          </div>
          {Number(promo.min_order_amount) > 0 && (
            <p className="mt-1.5 text-xs text-[var(--oppa-text-muted)]">
              Min. order: {formatCurrency(Number(promo.min_order_amount))}
            </p>
          )}
        </td>
        <td className="px-4 py-3 align-middle">
          <ApplicableCategories promo={promo} />
        </td>
        <td className="px-4 py-3 text-sm align-middle">
          <PromoValidity promo={promo} />
        </td>
        <td className="px-4 py-3 align-middle">
          <Toggle checked={promo.is_active} onChange={onToggle} label={`${promo.is_active ? 'Deactivate' : 'Activate'} ${stripEmoji(promo.title)}`} disabled={toggling} />
        </td>
        <td className="px-4 py-3 align-middle">
          <div className="flex items-center justify-end gap-1">
            <IconButton icon={LuPencil} label={`Edit ${stripEmoji(promo.title)}`} onClick={onEdit} />
            <IconButton icon={LuTrash2} label={`Delete ${stripEmoji(promo.title)}`} onClick={onDelete} tone="danger" />
          </div>
        </td>
      </tr>
  );
}

function PromoCard({ promo, onEdit, onDelete, onToggle, toggling = false }: PromoRowProps) {
  return (
    <article className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <PromoDetails promo={promo} />
        <div className="flex shrink-0 items-center gap-1">
          <IconButton icon={LuPencil} label={`Edit ${stripEmoji(promo.title)}`} onClick={onEdit} />
          <IconButton icon={LuTrash2} label={`Delete ${stripEmoji(promo.title)}`} onClick={onDelete} tone="danger" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--oppa-border)] pt-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Discount</p>
          <DiscountBadge type={promo.discount_type} value={Number(promo.discount_value)} />
          {Number(promo.min_order_amount) > 0 && (
            <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Min. order: {formatCurrency(Number(promo.min_order_amount))}</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Status</p>
          <Toggle checked={promo.is_active} onChange={onToggle} label={`${promo.is_active ? 'Deactivate' : 'Activate'} ${stripEmoji(promo.title)}`} disabled={toggling} />
        </div>
        <div className="col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Applicable to</p>
          <ApplicableCategories promo={promo} />
        </div>
        <div className="col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Validity</p>
          <PromoValidity promo={promo} />
          {promo.start_date && <p className="text-xs text-[var(--oppa-text-muted)]">From {formatPromoDate(promo.start_date)}</p>}
        </div>
      </div>
    </article>
  );
}

interface FormFieldProps {
  children: ReactNode;
  error?: string;
}

function FormField({ children, error }: FormFieldProps) {
  return (
    <div>
      {children}
      {error && <p className="mt-1.5 text-xs font-medium text-[var(--promo-danger-text)]" role="alert">{error}</p>}
    </div>
  );
}

const inputClass = (invalid = false) => (
  `h-11 w-full rounded-xl border bg-[var(--oppa-surface)] px-3.5 text-sm text-[var(--oppa-text)] transition-colors duration-150 focus-visible:border-[var(--oppa-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/30 ${
    invalid ? 'border-red-500' : 'border-[var(--oppa-border)]'
  }`
);

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promoCounts, setPromoCounts] = useState<Record<PromoStatusFilter, number>>({
    all: 0,
    active: 0,
    inactive: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PromoStatusFilter>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'online' | 'onsite'>('all');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<'all' | 'online' | 'onsite'>('all');
  const [togglingPromoIds, setTogglingPromoIds] = useState<Set<string>>(() => new Set());
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<string>('10');
  const [minOrderAmount, setMinOrderAmount] = useState<string>('0');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<string>('');
  const [usageLimit, setUsageLimit] = useState<string>('');
  const [perCustomerLimit, setPerCustomerLimit] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [dateTimeMin, setDateTimeMin] = useState(getPromoDateTimeMin);
  const [deleteTarget, setDeleteTarget] = useState<Promo | null>(null);
  const [initialStartDate, setInitialStartDate] = useState('');
  const [initialEndDate, setInitialEndDate] = useState('');
  const searchRef = useRef(search);
  const loadRequestSequence = useRef(0);
  const promoCodeInputRef = useRef<HTMLInputElement>(null);

  const loadPromos = useCallback(async () => {
    const requestSequence = loadRequestSequence.current + 1;
    loadRequestSequence.current = requestSequence;
    setLoading(true);
    try {
      const data = await promoService.getAllPromos({
        status: statusFilter,
        search: searchRef.current,
        channel: channelFilter,
      });
      if (requestSequence !== loadRequestSequence.current) return;
      setPromos(data);
      setPromoCounts((previous) => {
        if (statusFilter !== 'all') return { ...previous, [statusFilter]: data.length };
        return {
          all: data.length,
          active: data.filter((promo) => statusLabel(promo) === 'active').length,
          inactive: data.filter((promo) => statusLabel(promo) === 'inactive').length,
          expired: data.filter((promo) => statusLabel(promo) === 'expired').length,
        };
      });
    } catch (error: unknown) {
      if (requestSequence === loadRequestSequence.current) console.error(error);
    } finally {
      if (requestSequence === loadRequestSequence.current) setLoading(false);
    }
  }, [channelFilter, statusFilter]);
  const loadPromosRef = useRef(loadPromos);
  useEffect(() => {
    loadPromosRef.current = loadPromos;
  }, [loadPromos]);

  useEffect(() => {
    void Promise.resolve().then(loadPromos);
  }, [loadPromos]);

  const resetDateErrors = () => {
    setStartDateError('');
    setEndDateError('');
  };

  const openCreateModal = () => {
    setEditingPromo(null);
    setTitle('');
    setCode('');
    setDescription('');
    setChannel('all');
    setDiscountType('percent');
    setDiscountValue('10');
    setMinOrderAmount('0');
    setMaxDiscountAmount('');
    setUsageLimit('1');
    setPerCustomerLimit('1');
    setStartDate('');
    setEndDate('');
    setInitialStartDate('');
    setInitialEndDate('');
    setDateTimeMin(getPromoDateTimeMin());
    setIsActive(true);
    setSelectedCategories([]);
    setSelectedProducts([]);
    setFormError(null);
    setCodeError('');
    resetDateErrors();
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promo) => {
    const savedStartDate = toPromoDateTimeInput(promo.start_date);
    const savedEndDate = toPromoDateTimeInput(promo.end_date);
    setEditingPromo(promo);
    setTitle(promo.title);
    setCode(promo.code || '');
    setDescription(promo.description || '');
    setChannel(promo.channel || 'all');
    setDiscountType(promo.discount_type);
    setDiscountValue(String(promo.discount_value));
    setMinOrderAmount(String(promo.min_order_amount ?? 0));
    setMaxDiscountAmount(promo.max_discount_amount == null ? '' : String(promo.max_discount_amount));
    setUsageLimit(promo.usage_limit == null ? '' : String(promo.usage_limit));
    setPerCustomerLimit(promo.per_customer_limit == null ? '' : String(promo.per_customer_limit));
    setStartDate(savedStartDate);
    setEndDate(savedEndDate);
    setInitialStartDate(savedStartDate);
    setInitialEndDate(savedEndDate);
    setDateTimeMin(getPromoDateTimeMin());
    setIsActive(promo.is_active);
    setSelectedCategories(promo.applicable_categories || []);
    setSelectedProducts(promo.applicable_products || []);
    setFormError(null);
    setCodeError('');
    resetDateErrors();
    setIsModalOpen(true);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((previous) => (
      previous.includes(categoryId)
        ? previous.filter((category) => category !== categoryId)
        : [...previous, categoryId]
    ));
  };

  const validateDates = (): boolean => {
    resetDateErrors();
    const nowWithTolerance = Date.now() - 60_000;
    const currentYear = getPromoCurrentYear();
    let valid = true;
    const startWasEdited = startDate !== initialStartDate;
    const endWasEdited = endDate !== initialEndDate;

    if (startDate && Number(startDate.slice(0, 4)) > currentYear) {
      setStartDateError(`Promo dates cannot be later than ${currentYear}.`);
      valid = false;
    }

    if (endDate && Number(endDate.slice(0, 4)) > currentYear) {
      setEndDateError(`Promo dates cannot be later than ${currentYear}.`);
      valid = false;
    }

    if (startDate && startWasEdited && localDateTimeTimestamp(startDate) < nowWithTolerance) {
      setStartDateError('Start date cannot be in the past.');
      valid = false;
    }

    if (endDate && endWasEdited && localDateTimeTimestamp(endDate) < Date.now()) {
      setEndDateError('End date cannot be in the past.');
      valid = false;
    }

    if (startDate && endDate && localDateTimeTimestamp(endDate) <= localDateTimeTimestamp(startDate)) {
      setEndDateError('End date must be after the start date.');
      valid = false;
    }
    return valid;
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setStartDateError(value && Number(value.slice(0, 4)) > getPromoCurrentYear()
      ? `Promo dates cannot be later than ${getPromoCurrentYear()}.`
      : value && value !== initialStartDate && localDateTimeTimestamp(value) < Date.now() - 60_000
        ? 'Start date cannot be in the past.'
        : '');
    setEndDateError('');
    if (value && endDate && localDateTimeTimestamp(endDate) <= localDateTimeTimestamp(value)) {
      setEndDate('');
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    if (value && Number(value.slice(0, 4)) > getPromoCurrentYear()) {
      setEndDateError(`Promo dates cannot be later than ${getPromoCurrentYear()}.`);
    } else if (value && value !== initialEndDate && localDateTimeTimestamp(value) < Date.now()) {
      setEndDateError('End date cannot be in the past.');
    } else if (value && startDate && localDateTimeTimestamp(value) <= localDateTimeTimestamp(startDate)) {
      setEndDateError('End date must be after the start date.');
    } else {
      setEndDateError('');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setCodeError('');
    if (!title.trim()) {
      setFormError('Please enter a promo title.');
      return;
    }
    if (discountValue === '' || Number(discountValue) <= 0) {
      setFormError('Discount value must be greater than zero.');
      return;
    }
    const discountMaximum = discountType === 'percent' ? INPUT_LIMITS.percentage.max : INPUT_LIMITS.amount.max;
    if (!/^\d+(?:\.\d{1,2})?$/.test(discountValue) || Number(discountValue) > discountMaximum) {
      setFormError(`Discount value cannot exceed ${discountType === 'percent' ? '100%' : `₱${discountMaximum.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`}.`);
      return;
    }
    const optionalAmounts = [minOrderAmount, maxDiscountAmount].filter((value) => value !== '');
    if (optionalAmounts.some((value) => !/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) > INPUT_LIMITS.amount.max)) {
      setFormError(`Order amounts cannot exceed ₱${INPUT_LIMITS.amount.max.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.`);
      return;
    }
    const optionalLimits = [usageLimit, perCustomerLimit].filter((value) => value !== '');
    const requiredNewLimitMissing = !editingPromo && optionalLimits.length !== 2;
    const savedLimitCleared = Boolean(editingPromo && (
      (editingPromo.usage_limit != null && usageLimit === '')
      || (editingPromo.per_customer_limit != null && perCustomerLimit === '')
    ));
    if (requiredNewLimitMissing || savedLimitCleared || optionalLimits.some((value) => !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 999999)) {
      setFormError('Usage limits must be whole numbers from 1 to 999,999.');
      return;
    }
    if (!validateDates()) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      const codeValue = code.trim().toUpperCase();
      if (codeValue && (!editingPromo || codeValue !== editingPromo.code?.trim().toUpperCase())) {
        formData.append('code', codeValue);
      }
      formData.append('description', description.trim());
      formData.append('channel', channel);
      formData.append('discount_type', discountType);
      formData.append('discount_value', String(discountValue));
      formData.append('min_order_amount', String(minOrderAmount || 0));
      if (maxDiscountAmount !== '') formData.append('max_discount_amount', String(maxDiscountAmount));
      if (usageLimit !== '') formData.append('usage_limit', String(usageLimit));
      if (perCustomerLimit !== '') formData.append('per_customer_limit', String(perCustomerLimit));
      if (startDate) formData.append('start_date', toPromoApiDateTime(startDate));
      if (endDate) formData.append('end_date', toPromoApiDateTime(endDate));
      formData.append('is_active', isActive ? '1' : '0');
      formData.append('applicable_categories', JSON.stringify(selectedCategories));
      formData.append('applicable_products', JSON.stringify(selectedProducts));
      if (editingPromo) {
        await promoService.updatePromo(editingPromo.id, formData);
      } else {
        await promoService.createPromo(formData);
      }

      setIsModalOpen(false);
      await loadPromos();
    } catch (error: unknown) {
      if (error instanceof PromoRequestError && error.fieldErrors.code?.length) {
        const message = error.fieldErrors.code.join(' ');
        setCodeError(message);
        setFormError('Please fix the highlighted field before saving.');
        window.setTimeout(() => {
          promoCodeInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          promoCodeInputRef.current?.focus({ preventScroll: true });
        }, 0);
      } else {
        setFormError(errorMessage(error, 'Failed to save promo.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await promoService.deletePromo(deleteTarget.id);
      setDeleteTarget(null);
      await loadPromos();
    } catch (error: unknown) {
      showToast(errorMessage(error, 'Failed to delete promo.'), 'error');
    }
  };

  const handleToggleActive = async (promo: Promo) => {
    if (togglingPromoIds.has(promo.id)) return;
    const nextActive = !promo.is_active;
    setTogglingPromoIds((previous) => new Set(previous).add(promo.id));
    setPromos((previous) => previous.map((item) => (
      item.id === promo.id ? { ...item, is_active: nextActive } : item
    )));
    try {
      const updated = await promoService.toggleActive(promo.id);
      setPromos((previous) => previous.map((item) => (
        item.id === promo.id ? { ...item, is_active: updated.is_active } : item
      )));
      showToast(`Promo ${updated.is_active ? 'activated' : 'deactivated'}.`, 'success');
      await loadPromosRef.current();
    } catch (error: unknown) {
      setPromos((previous) => previous.map((item) => (
        item.id === promo.id ? { ...item, is_active: promo.is_active } : item
      )));
      showToast(errorMessage(error, 'Failed to toggle promo.'), 'error');
    } finally {
      setTogglingPromoIds((previous) => {
        const next = new Set(previous);
        next.delete(promo.id);
        return next;
      });
    }
  };

  const filteredPromos = useMemo(() => promos.filter((promo) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query
      || promo.title.toLowerCase().includes(query)
      || Boolean(promo.code?.toLowerCase().includes(query))
      || Boolean(promo.description?.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'all' || statusLabel(promo) === statusFilter);
  }), [promos, search, statusFilter]);

  const visiblePromos = filteredPromos;
  const endDateMin = startDate && startDate > dateTimeMin ? startDate : dateTimeMin;
  const startDateMin = editingPromo
    && startDate === initialStartDate
    && startDate
    && startDate < dateTimeMin
    ? undefined
    : dateTimeMin;
  const endDateInputMin = editingPromo
    && endDate === initialEndDate
    && endDate
    && endDate < endDateMin
    ? undefined
    : endDateMin;
  const dateTimeMax = getDateTimeLocalMax();
  const modalFooter = (
    <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
      <button
        type="button"
        onClick={() => setIsModalOpen(false)}
        className="h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] transition-colors duration-150 hover:bg-[var(--oppa-cream)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="promo-form"
        disabled={isSubmitting}
        className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[var(--oppa-green)] px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting && <LuLoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
        {editingPromo ? 'Save Changes' : 'Create Promo'}
      </button>
    </div>
  );

  return (
    <AdminLayout>
      <PageContainer compact>
        <PageHeader
          icon={LuTag}
          title="Promos & Discounts"
          subtitle="Create, schedule, and manage database-driven promotions across Customer and Cashier POS."
          iconClassName="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[var(--oppa-green-soft)] to-[var(--oppa-surface)] text-[var(--oppa-green)] ring-1 ring-[var(--oppa-green)]/15 shadow-sm"
          action={(
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-[var(--oppa-green-dark)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50 focus-visible:ring-offset-2"
            >
              <LuPlus size={18} aria-hidden="true" />
              Add New Promo
            </button>
          )}
        />

        <section className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 shadow-card sm:p-4" aria-label="Promotion filters">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="-mx-1 overflow-x-auto px-1 pb-1 xl:pb-0">
              <SegmentedControl<PromoStatusFilter>
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All', count: promoCounts.all },
                  { value: 'active', label: 'Active', count: promoCounts.active },
                  { value: 'inactive', label: 'Inactive', count: promoCounts.inactive },
                  { value: 'expired', label: 'Expired', count: promoCounts.expired },
                ]}
              />
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row xl:max-w-2xl xl:flex-1">
              <SearchInput
                aria-label="Search title, code, or description"
                placeholder="Search title, code, or description..."
                value={search}
                onChange={setSearch}
                onValueChange={(value) => { searchRef.current = value; }}
                wrapperClassName="min-w-0 flex-1"
              />
              <Select
                aria-label="Filter promotions by channel"
                value={channelFilter}
                onChange={(value) => setChannelFilter(value as typeof channelFilter)}
                icon={<LuFilter size={16} aria-hidden="true" />}
                options={[
                  { value: 'all', label: 'All channels' },
                  { value: 'online', label: 'Customer' },
                  { value: 'onsite', label: 'Cashier POS' },
                ]}
                className="w-full shrink-0 sm:w-44"
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-card" aria-label="Promotions">
          {loading ? (
            <div role="status" aria-label="Loading promotions" aria-busy="true" className="space-y-3 p-4">
              <div className="hidden md:block">
                <div className="grid grid-cols-6 gap-4 rounded-xl bg-[var(--oppa-green-soft)]/60 px-5 py-3.5">
                  {Array.from({ length: 6 }, (_, index) => <span key={index} className="h-3 animate-pulse rounded bg-[var(--oppa-text-muted)]/15" />)}
                </div>
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="grid min-h-24 grid-cols-6 items-center gap-4 px-5 py-5">
                    <span className="col-span-1 h-10 animate-pulse rounded-lg bg-[var(--oppa-green-soft)]" />
                    {Array.from({ length: 5 }, (_, cell) => <span key={cell} className="h-7 animate-pulse rounded-lg bg-[var(--oppa-cream)]" />)}
                  </div>
                ))}
              </div>
              <div className="space-y-3 md:hidden">
                {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-[var(--oppa-cream)]" />)}
              </div>
            </div>
          ) : visiblePromos.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]">
                <LuTag size={24} aria-hidden="true" />
              </span>
              <h2 className="font-display text-xl font-semibold text-[var(--oppa-text)]">No promos found</h2>
              <p className="mt-1 max-w-md text-sm text-[var(--oppa-text-muted)]">
                {search ? `No promotions match "${search}".` : 'Get started by creating your first promotional offer.'}
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50"
                >
                  <LuPlus size={18} aria-hidden="true" />
                  Add New Promo
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1100px] table-fixed text-left">
                  <colgroup>
                    <col />
                    <col className="w-40" />
                    <col className="w-[270px]" />
                    <col className="w-48" />
                    <col className="w-28" />
                    <col className="w-24" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 bg-[var(--oppa-green-soft)]/80 text-[11px] uppercase tracking-[0.06em] text-[var(--oppa-text-muted)]">
                    <tr>
                      <th scope="col" className="px-5 py-3.5 font-semibold">Promo details</th>
                      <th scope="col" className="px-4 py-3.5 text-center font-semibold">Discount</th>
                      <th scope="col" className="px-4 py-3.5 font-semibold">Applicable to</th>
                      <th scope="col" className="px-4 py-3.5 font-semibold">Validity</th>
                      <th scope="col" className="px-4 py-3.5 font-semibold">Active</th>
                      <th scope="col" className="px-4 py-3.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePromos.map((promo) => (
                      <PromoRow
                        key={promo.id}
                        promo={promo}
                        toggling={togglingPromoIds.has(promo.id)}
                        onEdit={() => openEditModal(promo)}
                        onDelete={() => setDeleteTarget(promo)}
                        onToggle={() => void handleToggleActive(promo)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-3 md:hidden">
                {visiblePromos.map((promo) => (
                  <PromoCard
                    key={promo.id}
                    promo={promo}
                    toggling={togglingPromoIds.has(promo.id)}
                    onEdit={() => openEditModal(promo)}
                    onDelete={() => setDeleteTarget(promo)}
                    onToggle={() => void handleToggleActive(promo)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <PromoModal
          open={isModalOpen}
          title={editingPromo ? 'Edit Promotion' : 'Create New Promotion'}
          icon={LuTag}
          onClose={() => setIsModalOpen(false)}
          labelledBy="promo-modal-title"
          footer={modalFooter}
        >
          <ValidatedForm id="promo-form" onSubmit={handleSubmit} className="promo-modal-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {formError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--promo-danger-border)] bg-[var(--promo-danger-bg)] p-3 text-sm text-[var(--promo-danger-text)]">
                <LuX size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-7">
                <FieldLabel htmlFor="promo-title">Promo title <span className="text-[var(--promo-danger-text)]">*</span></FieldLabel>
                <LimitedInput id="promo-title" type="text" data-required="true" data-min-length={INPUT_LIMITS.announcementTitle.min} maxLength={INPUT_LIMITS.announcementTitle.max} showCounter placeholder="e.g. 10% Welcome Treat" value={stripEmoji(title)} onChange={(event) => setTitle(event.target.value)} className={inputClass()} />
              </div>
              <div className="sm:col-span-5">
                <FieldLabel htmlFor="promo-code">Promo code (voucher)</FieldLabel>
                <LimitedInput
                  ref={promoCodeInputRef}
                  id="promo-code"
                  type="text"
                  maxLength={INPUT_LIMITS.promoCode.max}
                  inputFilter="promoCode"
                  showCounter
                  placeholder="Custom code or generate one"
                  value={code}
                  aria-invalid={Boolean(codeError)}
                  aria-describedby={codeError ? 'promo-code-error' : undefined}
                  onChange={(event) => {
                    setCode(event.target.value.toUpperCase());
                    if (codeError) {
                      setCodeError('');
                      setFormError(null);
                    }
                  }}
                  className={`${inputClass(Boolean(codeError))} font-mono uppercase`}
                />
                <button
                  type="button"
                  onClick={() => {
                    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    const bytes = new Uint8Array(10);
                    window.crypto.getRandomValues(bytes);
                    setCode(Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join(''));
                    setCodeError('');
                    setFormError(null);
                  }}
                  className="mt-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-[var(--oppa-green)] transition hover:bg-[var(--oppa-green-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/40"
                >
                  <LuRefreshCw size={13} aria-hidden="true" /> Generate random code
                </button>
                {codeError && <p id="promo-code-error" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-[var(--promo-danger-text)]"><LuX size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{codeError}</p>}
              </div>
              <div className="sm:col-span-4">
                <Select
                  label="Available channel"
                  value={channel}
                  onChange={(value) => setChannel(value as typeof channel)}
                  options={[
                    { value: 'all', label: 'All channels' },
                    { value: 'online', label: 'Customer' },
                    { value: 'onsite', label: 'Cashier POS' },
                  ]}
                />
              </div>
              <div className="sm:col-span-12">
                <FieldLabel htmlFor="promo-description">Description</FieldLabel>
                <LimitedTextarea
                  id="promo-description"
                  rows={3}
                  maxLength={INPUT_LIMITS.longText.max}
                  showCounter
                  placeholder="Brief description displayed on the banner and promotional sections..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3.5 py-3 text-sm text-[var(--oppa-text)] transition-colors duration-150 focus-visible:border-[var(--oppa-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/30"
                />
              </div>
            </div>

            <div className="promo-discount-fields">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Discount type <span className="text-[var(--promo-danger-text)]">*</span></p>
                <div className="grid h-11 grid-cols-2 gap-1 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)] p-1" role="group" aria-label="Discount type">
                  <button
                    type="button"
                    aria-pressed={discountType === 'percent'}
                    onClick={() => setDiscountType('percent')}
                    className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50 ${discountType === 'percent' ? 'bg-[var(--oppa-green)] text-white shadow-sm' : 'text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-surface)]'}`}
                  >
                    <LuPercent size={16} aria-hidden="true" /> Percent
                  </button>
                  <button
                    type="button"
                    aria-pressed={discountType === 'fixed'}
                    onClick={() => setDiscountType('fixed')}
                    className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50 ${discountType === 'fixed' ? 'bg-[var(--oppa-green)] text-white shadow-sm' : 'text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-surface)]'}`}
                  >
                    <LuBanknote size={16} aria-hidden="true" /> Fixed (P)
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="promo-value">Value ({discountType === 'percent' ? '%' : 'P'}) <span className="text-[var(--promo-danger-text)]">*</span></FieldLabel>
                <div className="relative">
                  <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--oppa-text-muted)] ${discountType === 'fixed' ? 'left-3.5' : 'right-3.5'}`}>
                    {discountType === 'fixed' ? '₱' : '%'}
                  </span>
                  <LimitedInput id="promo-value" type="text" inputMode="decimal" inputFilter="amount" maxLength={discountType === 'percent' ? 6 : 9} data-required="true" placeholder={discountType === 'percent' ? '15' : '50'} value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} className={`${inputClass()} font-semibold ${discountType === 'fixed' ? 'pl-8' : 'pr-9'}`} />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="promo-min-order">Min. order spend (P)</FieldLabel>
                <LimitedInput id="promo-min-order" type="text" inputMode="decimal" inputFilter="amount" maxLength={9} placeholder="0" value={minOrderAmount} onChange={(event) => setMinOrderAmount(event.target.value)} className={inputClass()} />
              </div>
              <div>
                <FieldLabel htmlFor="promo-usage-limit">Total usage limit</FieldLabel>
                <LimitedInput id="promo-usage-limit" type="number" min={1} max={999999} step={1} inputMode="numeric" inputFilter="digits" placeholder="1 or more" value={usageLimit} onChange={(event) => setUsageLimit(event.target.value)} className={inputClass()} />
              </div>
              <div>
                <FieldLabel htmlFor="promo-per-customer-limit">Uses per customer</FieldLabel>
                <LimitedInput id="promo-per-customer-limit" type="number" min={1} max={999999} step={1} inputMode="numeric" inputFilter="digits" placeholder="1 or more" value={perCustomerLimit} onChange={(event) => setPerCustomerLimit(event.target.value)} className={inputClass()} />
              </div>
            </div>

            <div className="promo-datetime-fields">
              <FormField error={startDateError}>
                <FieldLabel htmlFor="promo-start-date">Start date & time (optional)</FieldLabel>
                <div className="relative">
                  <LuCalendar size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" aria-hidden="true" />
                  <input
                    id="promo-start-date"
                    type="datetime-local"
                    step={60}
                    data-min={startDateMin}
                    data-max={dateTimeMax}
                    value={startDate}
                    onChange={(event) => handleStartDateChange(event.target.value)}
                    className={`${inputClass(Boolean(startDateError))} cursor-pointer pl-10 [font-family:inherit]`}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Choose now or a future start time this year (Philippine time).</p>
              </FormField>
              <FormField error={endDateError}>
                <FieldLabel htmlFor="promo-end-date">End date & time (optional)</FieldLabel>
                <div className="relative">
                  <LuCalendar size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" aria-hidden="true" />
                  <input
                    id="promo-end-date"
                    type="datetime-local"
                    step={60}
                    data-min={endDateInputMin}
                    data-max={dateTimeMax}
                    value={endDate}
                    onChange={(event) => handleEndDateChange(event.target.value)}
                    className={`${inputClass(Boolean(endDateError))} cursor-pointer pl-10 [font-family:inherit]`}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Philippine time; after the start time and within this year.</p>
              </FormField>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Applicable categories</p>
              <div id="promo-category-chip" className="flex flex-wrap gap-2">
                {categories.filter((category) => category.id !== 'all').map((category) => {
                  const selected = selectedCategories.includes(category.id);
                  const Icon = selected ? LuCheck : LuPlus;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleCategory(category.id)}
                      className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50 ${
                        selected
                          ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]'
                          : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]'
                      }`}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {category.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-[var(--oppa-text-muted)]">Leave empty to apply to all.</p>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/60 p-3.5">
              <div>
                <p className="text-sm font-semibold text-[var(--oppa-text)]">Activate Promo Immediately</p>
                <p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">When enabled, this promo will immediately show in the banner and be usable.</p>
              </div>
              <Toggle checked={isActive} onChange={setIsActive} label="Activate Promo Immediately" />
            </div>
          </ValidatedForm>
        </PromoModal>

        {deleteTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDeleteTarget(null);
          }}>
            <section role="alertdialog" aria-modal="true" aria-labelledby="delete-promo-title" className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-6 shadow-2xl">
              <span className="mb-4 grid size-12 place-items-center rounded-xl bg-[var(--promo-danger-bg)] text-[var(--promo-danger-text)]"><LuTrash2 size={22} aria-hidden="true" /></span>
              <h2 id="delete-promo-title" className="font-display text-xl font-bold text-[var(--oppa-text)]">Delete “{stripEmoji(deleteTarget.title)}”?</h2>
              <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">Are you sure you want to delete this promotion? This action cannot be undone. Customers will no longer be able to use this promo code.</p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setDeleteTarget(null)} className="h-10 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] transition-colors hover:bg-[var(--oppa-cream)]">Cancel</button>
                <button type="button" onClick={() => void handleDelete()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-800">
                  <LuTrash2 size={16} aria-hidden="true" /> Delete promo
                </button>
              </div>
            </section>
          </div>
        )}
      </PageContainer>
    </AdminLayout>
  );
}

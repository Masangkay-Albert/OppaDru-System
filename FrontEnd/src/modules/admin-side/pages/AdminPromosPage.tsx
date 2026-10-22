import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import AdminLayout from '../components/AdminLayout';
import { promoService, type Promo } from '../../../services/promoService';
import { formatCurrency } from '../../../utils/formatters';
import { categories } from '../../../data/mockData';
import { PageContainer, PageHeader } from '../../../components/ui/AdminPage';
import {
  CategoryBadge,
  DiscountBadge,
  FieldLabel,
  IconButton,
  PromoModal,
  SegmentedControl,
  StatusBadge,
  Toggle,
} from '../../../components/ui/AdminPromoControls';
import { getLocalDateTimeMin, stripEmoji } from '../../../utils/promoUi';
import {
  LuCalendar,
  LuCheck,
  LuImage,
  LuLoaderCircle,
  LuBanknote,
  LuPencil,
  LuPercent,
  LuPlus,
  LuSearch,
  LuSparkles,
  LuTag,
  LuTrash2,
  LuX,
} from 'react-icons/lu';

const PROMO_TIME_ZONE = 'Asia/Manila';
type PromoStatusFilter = 'all' | 'active' | 'inactive' | 'expired';

const toDateTimeLocal = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PROMO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
};

const toPromoApiDateTime = (value: string): string => (
  value ? `${value.length === 16 ? `${value}:00` : value}+08:00` : ''
);

const formatPromoDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: PROMO_TIME_ZONE,
  });
};

const errorMessage = (error: unknown, fallback: string): string => (
  error instanceof Error ? error.message : fallback
);

const localDateTimeTimestamp = (value: string): number => new Date(value).getTime();

const statusLabel = (promo: Promo): string => (
  promo.is_expired ? 'expired' : promo.is_active ? 'active' : 'inactive'
);

interface PromoDetailsProps {
  promo: Promo;
}

function PromoDetails({ promo }: PromoDetailsProps) {
  const title = stripEmoji(promo.title);
  return (
    <div className="flex min-w-0 items-center gap-3">
      {promo.image_url ? (
        <img
          src={promo.image_url}
          alt=""
          className="size-11 shrink-0 rounded-xl border border-[var(--oppa-border)] object-cover"
        />
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--oppa-green-soft)] bg-[var(--oppa-green-soft)]/60 text-[var(--oppa-green)]">
          <LuSparkles size={20} aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--oppa-text)]">{title}</h3>
          {promo.code && (
            <span className="rounded-md border border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-2 py-0.5 font-mono text-xs font-medium text-[var(--oppa-text-muted)]">
              {promo.code}
            </span>
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

interface PromoRowProps {
  promo: Promo;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function PromoRow({ promo, onEdit, onDelete, onToggle }: PromoRowProps) {
  const isExpired = Boolean(promo.is_expired);
  return (
    <>
      <tr className="min-h-[76px] transition-colors duration-150 hover:bg-green-50/40">
        <td className="min-w-[320px] px-5 py-4"><PromoDetails promo={promo} /></td>
        <td className="w-40 px-4 py-4">
          <DiscountBadge type={promo.discount_type} value={Number(promo.discount_value)} />
          {Number(promo.min_order_amount) > 0 && (
            <p className="mt-1.5 text-xs text-[var(--oppa-text-muted)]">
              Min. order: {formatCurrency(Number(promo.min_order_amount))}
            </p>
          )}
        </td>
        <td className="w-44 px-4 py-4">
          {promo.applicable_categories?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {promo.applicable_categories.map((category) => (
                <CategoryBadge key={category}>{category.replaceAll('-', ' ')}</CategoryBadge>
              ))}
            </div>
          ) : <CategoryBadge neutral>All Categories</CategoryBadge>}
        </td>
        <td className="w-44 px-4 py-4 text-sm">
          {isExpired ? (
            <StatusBadge active={false} expired />
          ) : promo.end_date ? (
            <div>
              <p className="font-medium text-[var(--oppa-text)]">Until {formatPromoDate(promo.end_date)}</p>
              <p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">
                {promo.start_date ? `From ${formatPromoDate(promo.start_date)}` : 'Ongoing'}
              </p>
            </div>
          ) : <span className="text-sm text-[var(--oppa-text-muted)]">No expiration</span>}
        </td>
        <td className="w-32 px-4 py-4">
          <button type="button" onClick={onToggle} aria-label={`${promo.is_active ? 'Deactivate' : 'Activate'} ${stripEmoji(promo.title)}`}>
            <StatusBadge active={promo.is_active} expired={isExpired} />
          </button>
        </td>
        <td className="w-24 px-4 py-4">
          <div className="flex items-center justify-end gap-1">
            <IconButton icon={LuPencil} label={`Edit ${stripEmoji(promo.title)}`} onClick={onEdit} />
            <IconButton icon={LuTrash2} label={`Delete ${stripEmoji(promo.title)}`} onClick={onDelete} tone="danger" />
          </div>
        </td>
      </tr>
    </>
  );
}

function PromoCard({ promo, onEdit, onDelete, onToggle }: PromoRowProps) {
  const isExpired = Boolean(promo.is_expired);
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
          <button type="button" onClick={onToggle} aria-label={`${promo.is_active ? 'Deactivate' : 'Activate'} ${stripEmoji(promo.title)}`}>
            <StatusBadge active={promo.is_active} expired={isExpired} />
          </button>
        </div>
        <div className="col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Applicable to</p>
          <div className="flex flex-wrap gap-1.5">
            {promo.applicable_categories?.length
              ? promo.applicable_categories.map((category) => <CategoryBadge key={category}>{category.replaceAll('-', ' ')}</CategoryBadge>)
              : <CategoryBadge neutral>All Categories</CategoryBadge>}
          </div>
        </div>
        <div className="col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Validity</p>
          <p className="text-sm font-medium text-[var(--oppa-text)]">
            {promo.end_date ? `Until ${formatPromoDate(promo.end_date)}` : 'No expiration'}
          </p>
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
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState<number | ''>(10);
  const [minOrderAmount, setMinOrderAmount] = useState<number | ''>(0);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [dateTimeMin, setDateTimeMin] = useState(getLocalDateTimeMin);
  const [deleteTarget, setDeleteTarget] = useState<Promo | null>(null);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [initialStartDate, setInitialStartDate] = useState('');
  const [initialEndDate, setInitialEndDate] = useState('');
  const searchRef = useRef(search);

  const loadPromos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await promoService.getAllPromos({ status: statusFilter, search: searchRef.current });
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
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void Promise.resolve().then(loadPromos);
  }, [loadPromos]);

  useEffect(() => () => {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const resetDateErrors = () => {
    setStartDateError('');
    setEndDateError('');
  };

  const openCreateModal = () => {
    setEditingPromo(null);
    setTitle('');
    setCode('');
    setDescription('');
    setDiscountType('percent');
    setDiscountValue(10);
    setMinOrderAmount(0);
    setMaxDiscountAmount('');
    setStartDate('');
    setEndDate('');
    setInitialStartDate('');
    setInitialEndDate('');
    setDateTimeMin(getLocalDateTimeMin());
    setIsActive(true);
    setSelectedCategories([]);
    setSelectedProducts([]);
    setImageFile(null);
    setImagePreview(null);
    setImageInputKey((key) => key + 1);
    setFormError(null);
    resetDateErrors();
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promo) => {
    const savedStartDate = toDateTimeLocal(promo.start_date);
    const savedEndDate = toDateTimeLocal(promo.end_date);
    setEditingPromo(promo);
    setTitle(promo.title);
    setCode(promo.code || '');
    setDescription(promo.description || '');
    setDiscountType(promo.discount_type);
    setDiscountValue(promo.discount_value);
    setMinOrderAmount(promo.min_order_amount ?? 0);
    setMaxDiscountAmount(promo.max_discount_amount ?? '');
    setStartDate(savedStartDate);
    setEndDate(savedEndDate);
    setInitialStartDate(savedStartDate);
    setInitialEndDate(savedEndDate);
    setDateTimeMin(getLocalDateTimeMin());
    setIsActive(promo.is_active);
    setSelectedCategories(promo.applicable_categories || []);
    setSelectedProducts(promo.applicable_products || []);
    setImageFile(null);
    setImagePreview(promo.image_url || null);
    setImageInputKey((key) => key + 1);
    setFormError(null);
    resetDateErrors();
    setIsModalOpen(true);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageInputKey((key) => key + 1);
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
    let valid = true;
    const startWasEdited = startDate !== initialStartDate;
    const endWasEdited = endDate !== initialEndDate;

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
    setStartDateError(value
      && value !== initialStartDate
      && localDateTimeTimestamp(value) < Date.now() - 60_000
      ? 'Start date cannot be in the past.'
      : '');
    setEndDateError('');
    if (value && endDate && localDateTimeTimestamp(endDate) <= localDateTimeTimestamp(value)) {
      setEndDate('');
    }
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    if (value && value !== initialEndDate && localDateTimeTimestamp(value) < Date.now()) {
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
    if (!title.trim()) {
      setFormError('Please enter a promo title.');
      return;
    }
    if (discountValue === '' || Number(discountValue) <= 0) {
      setFormError('Discount value must be greater than zero.');
      return;
    }
    if (!validateDates()) return;

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (code.trim()) formData.append('code', code.trim().toUpperCase());
      formData.append('description', description.trim());
      formData.append('discount_type', discountType);
      formData.append('discount_value', String(discountValue));
      formData.append('min_order_amount', String(minOrderAmount || 0));
      if (maxDiscountAmount !== '') formData.append('max_discount_amount', String(maxDiscountAmount));
      if (startDate) formData.append('start_date', toPromoApiDateTime(startDate));
      if (endDate) formData.append('end_date', toPromoApiDateTime(endDate));
      formData.append('is_active', isActive ? '1' : '0');
      formData.append('applicable_categories', JSON.stringify(selectedCategories));
      formData.append('applicable_products', JSON.stringify(selectedProducts));
      if (imageFile) formData.append('image', imageFile);

      if (editingPromo) {
        await promoService.updatePromo(editingPromo.id, formData);
      } else {
        await promoService.createPromo(formData);
      }

      setIsModalOpen(false);
      await loadPromos();
    } catch (error: unknown) {
      setFormError(errorMessage(error, 'Failed to save promo.'));
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
      window.alert(errorMessage(error, 'Failed to delete promo.'));
    }
  };

  const handleToggleActive = async (promo: Promo) => {
    try {
      const updated = await promoService.toggleActive(promo.id);
      setPromos((previous) => previous.map((item) => (
        item.id === promo.id ? { ...item, is_active: updated.is_active } : item
      )));
    } catch (error: unknown) {
      window.alert(errorMessage(error, 'Failed to toggle promo.'));
    }
  };

  const filteredPromos = useMemo(() => promos.filter((promo) => {
    const query = search.trim().toLowerCase();
    return !query
      || promo.title.toLowerCase().includes(query)
      || Boolean(promo.code?.toLowerCase().includes(query))
      || Boolean(promo.description?.toLowerCase().includes(query));
  }), [promos, search]);

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
      <PageContainer>
        <PageHeader
          icon={LuTag}
          title="Promos & Discounts"
          subtitle="Create, schedule, and manage database-driven promotions across Customer and Cashier POS."
          action={(
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/50 focus-visible:ring-offset-2"
            >
              <LuPlus size={18} aria-hidden="true" />
              Add New Promo
            </button>
          )}
        />

        <section className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 shadow-card sm:p-4" aria-label="Promotion filters">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 overflow-x-auto px-1 pb-1 lg:pb-0">
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
            <label className="relative block w-full min-w-[260px] lg:max-w-md lg:flex-1">
              <span className="sr-only">Search title, code, or description</span>
              <LuSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search title, code, or description..."
                value={search}
                onChange={(event) => {
                  searchRef.current = event.target.value;
                  setSearch(event.target.value);
                }}
                className="h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] pl-10 pr-4 text-sm text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)] focus-visible:border-[var(--oppa-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/30"
              />
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-card" aria-label="Promotions">
          {loading && promos.length === 0 ? (
            <div role="status" aria-label="Loading promotions" aria-busy="true" className="min-h-64" />
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
                <table className="w-full min-w-[1080px] table-fixed text-left">
                  <colgroup>
                    <col />
                    <col className="w-40" />
                    <col className="w-44" />
                    <col className="w-44" />
                    <col className="w-32" />
                    <col className="w-24" />
                  </colgroup>
                  <thead className="bg-[var(--oppa-green-soft)]/60 text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">
                    <tr>
                      <th scope="col" className="px-5 py-3.5 font-semibold">Promo details</th>
                      <th scope="col" className="px-4 py-3.5 font-semibold">Discount</th>
                      <th scope="col" className="px-4 py-3.5 font-semibold">Applicable to</th>
                      <th scope="col" className="px-4 py-3.5 font-semibold">Validity</th>
                      <th scope="col" className="px-4 py-3.5 font-semibold">Active</th>
                      <th scope="col" className="px-4 py-3.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--oppa-border)]">
                    {visiblePromos.map((promo) => (
                      <PromoRow
                        key={promo.id}
                        promo={promo}
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
          <form id="promo-form" onSubmit={handleSubmit} className="promo-modal-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            {formError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--promo-danger-border)] bg-[var(--promo-danger-bg)] p-3 text-sm text-[var(--promo-danger-text)]">
                <LuX size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-7">
                <FieldLabel htmlFor="promo-title">Promo title <span className="text-[var(--promo-danger-text)]">*</span></FieldLabel>
                <input id="promo-title" type="text" required placeholder="e.g. 10% Welcome Treat" value={stripEmoji(title)} onChange={(event) => setTitle(event.target.value)} className={inputClass()} />
              </div>
              <div className="sm:col-span-5">
                <FieldLabel htmlFor="promo-code">Promo code (voucher)</FieldLabel>
                <input id="promo-code" type="text" placeholder="e.g. OPPA10, WEEKEND50" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className={`${inputClass()} font-mono uppercase`} />
              </div>
              <div className="sm:col-span-12">
                <FieldLabel htmlFor="promo-description">Description</FieldLabel>
                <textarea
                  id="promo-description"
                  rows={3}
                  placeholder="Brief description displayed on the banner and promotional sections..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-24 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3.5 py-3 text-sm text-[var(--oppa-text)] transition-colors duration-150 focus-visible:border-[var(--oppa-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  <input id="promo-value" type="number" step="any" min="0.01" required placeholder={discountType === 'percent' ? '15' : '50'} value={discountValue} onChange={(event) => setDiscountValue(event.target.value === '' ? '' : Number(event.target.value))} className={`${inputClass()} font-semibold ${discountType === 'fixed' ? 'pl-8' : 'pr-9'}`} />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="promo-min-order">Min. order spend (P)</FieldLabel>
                <input id="promo-min-order" type="number" step="any" min="0" placeholder="0" value={minOrderAmount} onChange={(event) => setMinOrderAmount(event.target.value === '' ? '' : Number(event.target.value))} className={inputClass()} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField error={startDateError}>
                <FieldLabel htmlFor="promo-start-date">Start date & time (optional)</FieldLabel>
                <div className="relative">
                  <LuCalendar size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" aria-hidden="true" />
                  <input
                    id="promo-start-date"
                    type="datetime-local"
                    step={60}
                    min={startDateMin}
                    value={startDate}
                    onChange={(event) => handleStartDateChange(event.target.value)}
                    className={`${inputClass(Boolean(startDateError))} cursor-pointer pl-10 [font-family:inherit]`}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Choose now or a future start time.</p>
              </FormField>
              <FormField error={endDateError}>
                <FieldLabel htmlFor="promo-end-date">End date & time (optional)</FieldLabel>
                <div className="relative">
                  <LuCalendar size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" aria-hidden="true" />
                  <input
                    id="promo-end-date"
                    type="datetime-local"
                    step={60}
                    min={endDateInputMin}
                    value={endDate}
                    onChange={(event) => handleEndDateChange(event.target.value)}
                    className={`${inputClass(Boolean(endDateError))} cursor-pointer pl-10 [font-family:inherit]`}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Must be after the start time.</p>
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

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Optional promo banner image</p>
              <div className="flex flex-col gap-3 rounded-xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-cream)]/50 p-3 sm:flex-row sm:items-center">
                {imagePreview ? (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-[var(--oppa-border)]">
                    <img src={imagePreview} alt="Promo banner preview" className="size-full object-cover" />
                    <button
                      type="button"
                      aria-label="Remove banner image"
                      title="Remove image"
                      onClick={removeImage}
                      className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      <LuX size={14} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]">
                    <LuImage size={22} aria-hidden="true" />
                  </span>
                )}
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <input key={imageInputKey} id="promo-image" type="file" accept="image/*" onChange={handleImageChange} className="sr-only" />
                  <label
                    htmlFor="promo-image"
                    className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3.5 text-sm font-semibold text-[var(--oppa-text)] transition-colors hover:bg-[var(--oppa-cream)] focus-within:ring-2 focus-within:ring-[var(--oppa-green)]/50"
                  >
                    <LuImage size={16} aria-hidden="true" />
                    Choose file
                  </label>
                  <span className="min-w-0 truncate text-xs text-[var(--oppa-text-muted)]">
                    {imageFile?.name || (imagePreview ? 'Current banner image' : 'No file chosen')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/60 p-3.5">
              <div>
                <p className="text-sm font-semibold text-[var(--oppa-text)]">Activate Promo Immediately</p>
                <p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">When enabled, this promo will immediately show in the banner and be usable.</p>
              </div>
              <Toggle checked={isActive} onChange={setIsActive} label="Activate Promo Immediately" />
            </div>
          </form>
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

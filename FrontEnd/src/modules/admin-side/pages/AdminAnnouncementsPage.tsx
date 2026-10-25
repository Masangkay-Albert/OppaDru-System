import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  LoaderCircle,
  Megaphone,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Share2,
  Sparkles,
  ThumbsUp,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  FiArrowRight,
  FiCheckCircle,
  FiHeart,
  FiMapPin,
  FiShoppingBag,
  FiThumbsUp,
} from 'react-icons/fi';
import { FaFacebookF } from 'react-icons/fa';
import AdminLayout from '../components/AdminLayout';
import {
  ConfirmDialog,
  FilterBar,
  PageHeader,
  Toast,
} from '../components/AdminUI';
import { announcementService } from '../../../services/announcementService';
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementFilters,
  AnnouncementFormData,
  AnnouncementPriority,
  AnnouncementStats,
  FacebookStatus,
} from '../../../types/announcement.types';

const LEGACY_AUDIENCE_META = {
  label: 'Legacy audience',
  shortLabel: 'Legacy',
  description: 'Previously targeted announcement',
  icon: Megaphone,
  color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
};

const PRIORITY_BADGES: Record<AnnouncementPriority, { label: string; style: string }> = {
  normal: { label: 'General', style: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  promo: { label: 'Special Promo', style: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800' },
  high: { label: 'High Priority', style: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-800' },
  urgent: { label: 'Urgent Alert', style: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800' },
};

const formatDateForInput = (isoDate?: string | null): string => {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const getMinimumScheduleDateTime = (): string =>
  formatDateForInput(new Date(Date.now() + 60_000).toISOString());

const formatDisplayDate = (isoDate?: string | null): string => {
  if (!isoDate) return 'Immediate';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return 'Immediate';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const AdminAnnouncementsPage: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [stats, setStats] = useState<AnnouncementStats>({
    total: 0,
    published: 0,
    scheduled: 0,
    draft: 0,
    audiences: { all: 0, customers: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'success' | 'error'>('success');

  // Filter States
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [previewItem, setPreviewItem] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: '',
    content: '',
    target_audience: 'customers',
    priority: 'normal',
    status: 'published',
    date_sent: '',
    scheduled_at: '',
    image_url: '',
    imageFile: null,
    remove_image: false,
    publish_to_facebook: true,
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<'immediate' | 'schedule'>('immediate');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Facebook Integration States
  const [fbStatus, setFbStatus] = useState<FacebookStatus | null>(null);
  const [isFbSettingsOpen, setIsFbSettingsOpen] = useState(false);
  const [isPublishingToFb, setIsPublishingToFb] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'app' | 'facebook'>('app');

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastTone(tone);
  };

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const filters: AnnouncementFilters = {
        status: statusFilter,
        search: search.trim(),
        direction: sortDirection,
      };
      const result = await announcementService.getAnnouncements(filters);
      setAnnouncements(result.announcements);
      setStats(result.stats);
    } catch {
      showToast('Failed to load announcements.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    announcementService.getFacebookStatus().then((status) => {
      setFbStatus(status);
    });
  }, [statusFilter, sortDirection]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadAnnouncements();
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Lock background scroll and handle Escape key when popups are active
  useEffect(() => {
    if (isFormOpen || previewItem || isFbSettingsOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (isFormOpen && !isSubmitting) setIsFormOpen(false);
          if (previewItem) setPreviewItem(null);
          if (isFbSettingsOpen) setIsFbSettingsOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isFormOpen, previewItem, isFbSettingsOpen, isSubmitting]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      content: '',
      target_audience: 'customers',
      priority: 'normal',
      status: 'published',
      date_sent: new Date().toISOString(),
      scheduled_at: '',
      image_url: '',
      imageFile: null,
      remove_image: false,
      publish_to_facebook: true,
    });
    setSendMode('immediate');
    setImagePreview(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: Announcement) => {
    setEditingItem(item);
    const isScheduled = item.status === 'scheduled';
    setSendMode(isScheduled ? 'schedule' : 'immediate');
    setFormData({
      title: item.title,
      content: item.content,
      target_audience: 'customers',
      priority: item.priority,
      status: item.status,
      date_sent: item.date_sent || '',
      scheduled_at: item.scheduled_at || '',
      image_url: item.image_url || '',
      imageFile: null,
      remove_image: false,
      publish_to_facebook: item.status === 'draft' && !item.metadata?.facebook_published_at,
    });
    setImagePreview(item.image_url || null);
    setIsFormOpen(true);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showToast('Image file must be under 10MB.', 'error');
        return;
      }
      setFormData((prev) => ({
        ...prev,
        imageFile: file,
        remove_image: false,
      }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      imageFile: null,
      image_url: '',
      remove_image: true,
    }));
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitForm = async (e: React.SyntheticEvent, statusOverride?: 'draft') => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast('Announcement headline is required.', 'error');
      return;
    }
    if (!formData.content.trim()) {
      showToast('Announcement content is required.', 'error');
      return;
    }

    const submittedStatus = statusOverride ?? (
      sendMode === 'schedule'
        ? 'scheduled'
        : editingItem || formData.status === 'published'
        ? 'published'
        : formData.status
    );
    if (submittedStatus === 'scheduled') {
      const scheduledTime = Date.parse(formData.scheduled_at || '');
      if (!Number.isFinite(scheduledTime) || scheduledTime <= Date.now()) {
        showToast('Choose a schedule date and time in the future.', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const submissionData: AnnouncementFormData = {
        ...formData,
        target_audience: 'customers',
        status: submittedStatus,
        date_sent: submittedStatus === 'draft'
          ? formData.date_sent
          : sendMode === 'immediate'
          ? (editingItem?.status === 'published'
            ? formData.date_sent || new Date().toISOString()
            : new Date().toISOString())
          : (formData.scheduled_at || formData.date_sent || new Date().toISOString()),
        scheduled_at: submittedStatus === 'scheduled' ? formData.scheduled_at : undefined,
      };

      if (editingItem) {
        const updated = await announcementService.updateAnnouncement(editingItem.id, submissionData);
        if (submissionData.status === 'published' && submissionData.publish_to_facebook) {
          try {
            const facebookResult = await announcementService.publishToFacebook(updated.id);
            if (facebookResult.success) {
              showToast('Announcement updated and published successfully!');
            } else {
              showToast(
                `Announcement published to customers, but Facebook publishing failed: ${facebookResult.message || 'Check the Facebook connection.'}`,
                'error'
              );
              if (facebookResult.need_config || (facebookResult.message || '').includes('OAuth error 190')) {
                setFbStatus(await announcementService.getFacebookStatus());
                setIsFbSettingsOpen(true);
              }
            }
          } catch {
            showToast('Announcement published to customers, but Facebook publishing failed.', 'error');
          }
        } else if (submissionData.status === 'scheduled') {
          showToast('Announcement scheduled successfully!');
        } else if (submissionData.status === 'draft') {
          showToast('Announcement saved as a draft.');
        } else {
          showToast('Announcement updated and published successfully!');
        }
      } else {
        const result = await announcementService.createAnnouncement(submissionData);
        if (result.facebookPublish && !result.facebookPublish.success) {
          showToast(
            `Announcement saved, but Facebook publishing failed: ${result.facebookPublish.message || 'Check the Facebook connection.'}`,
            'error'
          );
          if ((result.facebookPublish.message || '').includes('OAuth error 190')) {
            setFbStatus(await announcementService.getFacebookStatus());
            setIsFbSettingsOpen(true);
          }
        } else if (submissionData.status === 'scheduled') {
          showToast('Announcement scheduled successfully!');
        } else if (submissionData.status === 'draft') {
          showToast('Announcement saved as a draft.');
        } else {
          showToast('Announcement posted successfully!');
        }
      }

      setIsFormOpen(false);
      loadAnnouncements();
    } catch {
      showToast('Failed to save announcement. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: Announcement) => {
    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      await announcementService.toggleStatus(item.id, nextStatus);
      showToast(`Announcement moved to ${nextStatus === 'published' ? 'Published' : 'Draft'}.`);
      loadAnnouncements();
    } catch {
      showToast('Failed to toggle announcement status.', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await announcementService.deleteAnnouncement(deleteTarget.id);
      showToast('Announcement deleted.');
      setDeleteTarget(null);
      loadAnnouncements();
    } catch {
      showToast('Failed to delete announcement.', 'error');
    }
  };

  const generateFbCaption = (item: Announcement) => {
    const websiteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://oppadru.vercel.app';
    return `${item.title}

${item.content}

Order directly on our website:
${websiteUrl}/menu

Oppa Dru Korean Fried Chicken
#OppaDru #KoreanFriedChicken #FoodTrip #CrispyChicken`;
  };

  const handleCopyFbCaption = (item: Announcement) => {
    const caption = generateFbCaption(item);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(caption);
      showToast('Facebook post caption copied to clipboard!');
    }
  };

  const handleOpenFbPage = () => {
    window.open('https://www.facebook.com/oppadruKFC', '_blank', 'noopener,noreferrer');
  };

  const handleOpenMetaBusinessSuite = (item?: Announcement) => {
    if (item) {
      handleCopyFbCaption(item);
      showToast('Caption copied! Opening Meta Business Suite...', 'success');
    }
    setTimeout(() => {
      window.open('https://business.facebook.com/latest/composer', '_blank', 'noopener,noreferrer');
    }, 400);
  };

  const handleDirectPublishFacebook = async (item: Announcement) => {
    setIsPublishingToFb(item.id);
    try {
      const res = await announcementService.publishToFacebook(item.id);
      if (res.need_config) {
        showToast('Please connect your Facebook Page credentials first.', 'error');
        setIsFbSettingsOpen(true);
        return;
      }
      if (res.success) {
        showToast('Successfully published to Facebook Page!', 'success');
        loadAnnouncements();
        if (previewItem && previewItem.id === item.id) {
          setPreviewItem(
            res.announcement || {
              ...previewItem,
              metadata: { ...(previewItem.metadata || {}), facebook_post_url: res.post_url },
            }
          );
        }
      } else {
        showToast(res.message || 'Failed to post to Facebook.', 'error');
        if ((res.message || '').includes('OAuth error 190')) {
          setFbStatus(await announcementService.getFacebookStatus());
          setIsFbSettingsOpen(true);
        }
      }
    } catch {
      showToast('Error connecting to Facebook API.', 'error');
    } finally {
      setIsPublishingToFb(null);
    }
  };

  const handleRefreshFacebookStatus = async () => {
    try {
      setFbStatus(await announcementService.getFacebookStatus());
    } catch {
      showToast('Unable to check the Facebook connection.', 'error');
    }
  };

  const getAudienceMeta = (audience: AnnouncementAudience) => {
    return audience === 'customers'
      ? {
          label: 'Customers Only',
          shortLabel: 'Customers',
          description: 'Food ordering menu & customer notifications',
          icon: FiShoppingBag,
          color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        }
      : LEGACY_AUDIENCE_META;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          title="Announcements"
          subtitle="Publish news, promotional deals, and important alerts for customers."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFbSettingsOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3.5 py-2 text-sm font-medium text-[var(--oppa-text)] transition-colors hover:border-[#1877F2]/40 hover:bg-[#1877F2]/5"
                title={fbStatus?.connected ? `Connected to ${fbStatus.page_name || 'Facebook Page'}` : 'Not connected to Facebook. Open settings to configure the Page.'}
                aria-label={fbStatus?.connected ? `Facebook connected to ${fbStatus.page_name || 'Page'}. Open settings.` : 'Facebook not connected. Open Facebook settings.'}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-[#1877F2] text-white"><FaFacebookF size={9} aria-hidden="true" /></span>
                <span>
                  {fbStatus?.connected ? fbStatus.page_name || 'Facebook Connected' : 'Connect Facebook'}
                </span>
                <span className={`size-2 rounded-full ${fbStatus?.connected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
              </button>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--oppa-green-dark)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[var(--oppa-green)]/20 transition-all duration-200 hover:-translate-y-px hover:bg-[var(--oppa-green)] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
              >
                <Plus size={17} />
                <span>New Announcement</span>
              </button>
            </div>
          }
        />

        {/* Stats Row */}
        <div className="grid grid-cols-1 gap-3.5 min-[420px]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <div className="admin-card flex items-center gap-3.5 rounded-2xl border border-[var(--oppa-border)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
            <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] dark:bg-[var(--oppa-green)]/20 dark:text-emerald-300">
              <Megaphone size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">Total Broadcasts</p>
              <h3 className="font-serif text-[28px] font-bold leading-tight text-[#1A2B20] dark:text-[var(--oppa-text)]">{stats.total}</h3>
            </div>
          </div>

          <div className="admin-card flex items-center gap-3.5 rounded-2xl border border-[var(--oppa-border)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
            <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
              <CheckCircle2 size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">Active / Sent</p>
              <h3 className="font-serif text-[28px] font-bold leading-tight text-[#1A2B20] dark:text-[var(--oppa-text)]">{stats.published}</h3>
            </div>
          </div>

          <div className="admin-card flex items-center gap-3.5 rounded-2xl border border-[var(--oppa-border)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
            <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300">
              <Calendar size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">Scheduled</p>
              <h3 className="font-serif text-[28px] font-bold leading-tight text-[#1A2B20] dark:text-[var(--oppa-text)]">{stats.scheduled}</h3>
            </div>
          </div>

          <div className="admin-card flex items-center gap-3.5 rounded-2xl border border-[var(--oppa-border)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
            <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300">
              <FileText size={22} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">Drafts</p>
              <h3 className="font-serif text-[28px] font-bold leading-tight text-[#1A2B20] dark:text-[var(--oppa-text)]">{stats.draft}</h3>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <FilterBar className="space-y-3.5 rounded-2xl p-3.5 sm:p-4">
          <div className="grid grid-cols-2 gap-2.5 lg:flex lg:items-center">
            {/* Search Input */}
            <div className="relative col-span-2 min-w-0 lg:flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]"
              />
              <input
                type="text"
                placeholder="Search headline or message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="admin-input h-[42px] w-full rounded-xl pl-9 text-sm"
              />
            </div>

            {/* Status Filter */}
            <div className="relative min-w-0 lg:w-[170px] lg:shrink-0">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="admin-select h-[42px] w-full appearance-none rounded-xl pr-9 text-sm"
                aria-label="Filter by announcement status"
              >
                <option value="all">All Statuses</option>
                <option value="published">Published / Sent</option>
                <option value="scheduled">Scheduled</option>
                <option value="draft">Drafts</option>
              </select>
              <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
            </div>

            {/* Sort Order */}
            <div className="relative min-w-0 lg:w-[170px] lg:shrink-0">
              <select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
                className="admin-select h-[42px] w-full appearance-none rounded-xl pr-9 text-sm"
                aria-label="Sort order"
              >
                <option value="desc">Newest Sent</option>
                <option value="asc">Oldest Sent</option>
              </select>
              <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
            </div>
          </div>

        </FilterBar>

        {/* Content Section: Cards Grid */}
        {loading ? (
          <div role="status" aria-label="Loading announcements" aria-busy="true" className="min-h-64" />
        ) : announcements.length === 0 ? (
          <div className="admin-card flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-6 py-10 text-center shadow-sm">
            <div className="mb-2 flex size-16 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] ring-8 ring-[var(--oppa-green-soft)]/30 dark:bg-[var(--oppa-green)]/20 dark:text-emerald-300 dark:ring-[var(--oppa-green)]/10">
              <Megaphone size={27} aria-hidden="true" />
            </div>
            <h2 className="mt-2 font-serif text-xl font-bold text-[var(--oppa-text)]">No announcements found</h2>
            <p className="mt-1 max-w-md text-sm text-[var(--oppa-text-muted)]">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search criteria or status filter.'
                : 'Create your first announcement to keep customers informed.'}
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--oppa-green)] bg-[var(--oppa-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--oppa-green-dark)] transition-colors hover:bg-[var(--oppa-green)] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
            >
              <Plus size={16} aria-hidden="true" />
              <span>Create Announcement</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {announcements.map((item) => {
              const audienceMeta = getAudienceMeta(item.target_audience);
              const AudienceIcon = audienceMeta.icon;
              const priorityBadge = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.normal;
              const displayDate = item.status === 'scheduled' ? item.scheduled_at : item.date_sent;

              return (
                <article
                  key={item.id}
                  className="admin-card group flex flex-col overflow-hidden border border-[var(--oppa-border)] transition-all hover:border-[var(--oppa-green)]/40 hover:shadow-lg"
                >
                  {/* Card Media Header */}
                  <div className="relative h-44 w-full overflow-hidden bg-gradient-to-tr from-[var(--oppa-green-dark)]/15 via-[var(--oppa-green-soft)]/25 to-[var(--oppa-cream)]">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-[var(--oppa-green)]/15 text-[var(--oppa-green-dark)] dark:text-emerald-300">
                          <AudienceIcon size={24} />
                        </div>
                        <span className="mt-2 text-xs font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                          {audienceMeta.label}
                        </span>
                      </div>
                    )}

                    {/* Status & Priority Floating Badges */}
                    <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-sm backdrop-blur-md ${priorityBadge.style}`}>
                        {item.priority === 'promo' && <Sparkles size={11} />}
                        {item.priority === 'urgent' && <AlertCircle size={11} />}
                        {priorityBadge.label}
                      </span>
                    </div>

                    <div className="absolute right-3 top-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur-md ${
                          item.status === 'published'
                            ? 'bg-emerald-600/90 text-white'
                            : item.status === 'scheduled'
                            ? 'bg-sky-600/90 text-white'
                            : 'bg-slate-700/85 text-white'
                        }`}
                      >
                        <span className="size-1.5 rounded-full bg-white animate-pulse" />
                        <span className="capitalize">{item.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    {/* Audience Chip & Date Info */}
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${audienceMeta.color}`}
                      >
                        <AudienceIcon size={12} />
                        <span>{audienceMeta.label}</span>
                      </span>

                      <div className="flex items-center gap-1 text-[11px] text-[var(--oppa-text-muted)]" title="Date Sent / Scheduled">
                        <Clock size={12} />
                        <span>{formatDisplayDate(displayDate)}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="mb-1.5 font-serif text-base sm:text-lg font-bold leading-snug text-[var(--oppa-text)] line-clamp-2">
                      {item.title}
                    </h3>

                    {/* Content Preview */}
                    <p className="mb-4 flex-1 text-xs sm:text-sm leading-relaxed text-[var(--oppa-text-muted)] line-clamp-3">
                      {item.content}
                    </p>

                    {/* Footer / Meta & Actions */}
                    <div className="mt-auto border-t border-[var(--oppa-border)] pt-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] text-[var(--oppa-text-muted)]">
                            By <strong className="text-[var(--oppa-text)] font-medium">{item.author_name || 'Admin'}</strong>
                          </span>
                          {item.metadata?.facebook_post_url ? (
                            <a
                              href={item.metadata.facebook_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                              title="View post on Facebook Page"
                            >
                              <span className="flex size-3.5 items-center justify-center rounded-full bg-[#1877F2] text-white"><FaFacebookF size={8} aria-hidden="true" /></span>
                              <span>Posted on FB</span>
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (fbStatus?.connected) {
                                  handleDirectPublishFacebook(item);
                                } else {
                                  handleOpenMetaBusinessSuite(item);
                                }
                              }}
                              disabled={isPublishingToFb === item.id}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                              title="Post text & image to Meta Business Suite / Facebook"
                            >
                              <span className="flex size-3.5 items-center justify-center rounded-full bg-[#1877F2] text-white"><FaFacebookF size={8} aria-hidden="true" /></span>
                              <span>{isPublishingToFb === item.id ? 'Posting…' : fbStatus?.connected ? 'Publish to FB' : 'Post on Meta Suite'}</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (fbStatus?.connected) {
                                handleDirectPublishFacebook(item);
                              } else {
                                handleOpenMetaBusinessSuite(item);
                              }
                            }}
                            disabled={isPublishingToFb === item.id}
                            className="flex size-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors disabled:opacity-50"
                            title={fbStatus?.connected ? "Directly publish to Facebook Page" : "Copy caption & open Meta Business Suite"}
                          >
                            {isPublishingToFb === item.id ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Share2 size={15} />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewItem(item);
                              setPreviewMode('app');
                            }}
                            className="flex size-8 items-center justify-center rounded-lg text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-green)] transition-colors"
                            title="Live Preview"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(item)}
                            className="flex size-8 items-center justify-center rounded-lg text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-green)] transition-colors"
                            title={item.status === 'published' ? 'Unpublish to Draft' : 'Publish Immediately'}
                          >
                            <Send size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item)}
                            className="flex size-8 items-center justify-center rounded-lg text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-text)] transition-colors"
                            title="Edit Announcement"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="flex size-8 items-center justify-center rounded-lg text-[var(--oppa-text-muted)] hover:bg-red-500/10 hover:text-red-600 transition-colors"
                            title="Delete Announcement"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Modal: Create & Edit Announcement (Portaled directly to document.body for unobstructed viewport positioning) */}
        {isFormOpen && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#10241a]/65 p-3 backdrop-blur-sm sm:p-5"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSubmitting) setIsFormOpen(false);
            }}
          >
            <div
              className="admin-card relative flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-full max-w-none min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-2xl animate-in fade-in zoom-in-95 duration-200 sm:h-[calc(100dvh-2.5rem)] sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-[720px]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="announcement-modal-title"
              onKeyDown={(event) => {
                if (event.key !== 'Tab') return;
                const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
                  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) {
                  event.preventDefault();
                  return;
                }

                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }}
            >
              {/* Sticky Top Header */}
              <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-[var(--oppa-border)] bg-[var(--oppa-surface-raised)] px-5 py-4 sm:px-6">
                <div>
                  <h2 id="announcement-modal-title" className="font-serif text-lg sm:text-xl font-bold text-[var(--oppa-text)]">
                    {editingItem ? 'Edit Announcement' : 'Create New Announcement'}
                  </h2>
                  <p className="text-xs text-[var(--oppa-text-muted)] mt-0.5">
                    Share updates, promotional deals, and important notices with customers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-xl p-2 text-[var(--oppa-text-muted)] transition-colors hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"
                  aria-label="Close modal"
                >
                  <X size={19} />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form
                onSubmit={handleSubmitForm}
                className="flex min-h-0 flex-col"
                style={{ flex: '1 1 0%' }}
              >
                <div
                  className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
                  style={{ flex: '1 1 0%' }}
                >
                  {/* 1. Target Audience */}
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                      Recipients
                    </label>
                    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--oppa-green)] bg-[#EAF5EE] p-3 dark:bg-[var(--oppa-green)]/15">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--oppa-green)] text-white">
                        <FiShoppingBag size={16} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-[var(--oppa-green-dark)] dark:text-emerald-200">
                          Customers Only
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[var(--oppa-text-muted)]">
                          Announcements are sent to customer accounts.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Headline & Priority */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label htmlFor="announcement-title" className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                        Headline / Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="announcement-title"
                        type="text"
                        required
                        placeholder="e.g. Weekend Special: 20% Off Korean Chicken!"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="admin-input h-11 w-full rounded-xl px-3 text-base sm:text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="announcement-priority" className="mb-1 block text-xs font-bold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                        Priority Tag
                      </label>
                      <div className="relative">
                        <select
                          id="announcement-priority"
                          value={formData.priority}
                          onChange={(e) =>
                            setFormData({ ...formData, priority: e.target.value as AnnouncementPriority })
                          }
                          className="admin-select h-11 w-full appearance-none rounded-xl px-3 pr-9 text-base sm:text-sm"
                        >
                          <option value="normal">Standard / General</option>
                          <option value="promo">Special Promo</option>
                          <option value="high">High Priority</option>
                          <option value="urgent">Urgent Alert</option>
                        </select>
                        <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
                      </div>
                    </div>
                  </div>

                  {/* 3. Text Message Body */}
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label htmlFor="announcement-content" className="block text-xs font-bold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                        Message Content <span className="text-red-500">*</span>
                      </label>
                      <span className={`text-[11px] ${formData.content.length >= 1800 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--oppa-text-muted)]'}`}>{formData.content.length} characters</span>
                    </div>
                    <textarea
                      id="announcement-content"
                      required
                      rows={6}
                      placeholder="Write detailed announcements, promotional details, schedule reminders, or operational instructions..."
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      className="admin-textarea min-h-40 w-full resize-y rounded-xl px-3.5 py-3 text-base leading-relaxed sm:text-sm"
                    />
                  </div>

                  {/* 4. Banner Image */}
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--oppa-text-muted)]" id="announcement-image-label">
                      Banner Image (Optional)
                    </label>

                    {imagePreview ? (
                      <div className="relative overflow-hidden rounded-[14px] border border-[var(--oppa-border)]">
                        <img src={imagePreview} alt="Announcement banner preview" className="h-40 w-full object-cover" />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          aria-label="Remove announcement image"
                          className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-lg bg-black/75 px-2.5 py-1 text-xs font-semibold text-white shadow backdrop-blur hover:bg-black transition-colors"
                        >
                          <X size={13} /> Remove
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[var(--oppa-border)] bg-[var(--oppa-surface-raised)] px-4 py-5 text-center transition-colors duration-150 hover:border-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]/30"
                        aria-labelledby="announcement-image-label"
                      >
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] ring-4 ring-[var(--oppa-green-soft)]/40">
                          <UploadCloud size={21} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--oppa-text)]">
                            Click to upload an announcement image
                          </p>
                          <p className="text-[11px] text-[var(--oppa-text-muted)]">
                            PNG, JPG, WebP up to 10MB
                          </p>
                        </div>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />

                    {/* Image URL fallback */}
                    <div className="mt-3">
                      <label htmlFor="announcement-image-url" className="mb-1.5 block text-xs font-medium text-[var(--oppa-text-muted)]">Or paste image URL</label>
                      <input
                        id="announcement-image-url"
                        type="url"
                        placeholder="https://..."
                        value={formData.image_url || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({ ...formData, image_url: val, imageFile: null });
                          setImagePreview(val || null);
                        }}
                        className="admin-input h-11 w-full rounded-xl px-3 text-base sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* 5. Date Sent & Scheduling */}
                  <div className="space-y-3 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface-raised)] p-3.5 sm:p-4">
                    <div className="grid grid-cols-2 rounded-xl bg-[var(--oppa-cream)] p-1 dark:bg-black/15">
                      <label className={`flex cursor-pointer items-center justify-center rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition-colors ${sendMode === 'immediate' ? 'bg-[var(--oppa-green)] text-white shadow-sm' : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'}`}>
                        <input
                          type="radio"
                          name="sendMode"
                          checked={sendMode === 'immediate'}
                          onChange={() => setSendMode('immediate')}
                          className="sr-only"
                        />
                        <span>Send Immediately</span>
                      </label>

                      <label className={`flex cursor-pointer items-center justify-center rounded-lg px-2 py-2.5 text-center text-xs font-semibold transition-colors ${sendMode === 'schedule' ? 'bg-[var(--oppa-green)] text-white shadow-sm' : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'}`}>
                        <input
                          type="radio"
                          name="sendMode"
                          checked={sendMode === 'schedule'}
                          onChange={() => setSendMode('schedule')}
                          className="sr-only"
                        />
                        <span>Schedule Date & Time</span>
                      </label>
                    </div>

                    <div className="min-w-0">
                      <label
                        htmlFor={sendMode === 'schedule' ? 'announcement-scheduled-at' : 'announcement-date-sent'}
                        className="mb-1.5 block text-xs font-medium text-[var(--oppa-text-muted)]"
                      >
                        {sendMode === 'schedule' ? 'Scheduled Broadcast Time' : 'Date Sent Stamp'}
                      </label>
                      <input
                        id={sendMode === 'schedule' ? 'announcement-scheduled-at' : 'announcement-date-sent'}
                        type="datetime-local"
                        required={sendMode === 'schedule'}
                        disabled={sendMode === 'immediate'}
                        min={sendMode === 'schedule' ? getMinimumScheduleDateTime() : undefined}
                        value={formatDateForInput(
                          sendMode === 'schedule'
                            ? formData.scheduled_at
                            : formData.date_sent || new Date().toISOString()
                        )}
                        onChange={(e) => {
                          const selectedTime = e.target.value
                            ? new Date(e.target.value).toISOString()
                            : '';
                          setFormData((prev) => sendMode === 'schedule'
                            ? { ...prev, scheduled_at: selectedTime, date_sent: selectedTime }
                            : { ...prev, date_sent: selectedTime || new Date().toISOString() });
                        }}
                        className="admin-input box-border block h-11 w-full min-w-0 max-w-full rounded-xl px-3 text-base disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
                      />
                      {sendMode === 'immediate' ? (
                        <p className="mt-1.5 text-[11px] text-[var(--oppa-text-muted)]">
                          Current time is auto-assigned upon publish.
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-[var(--oppa-text-muted)]">
                          Choose a future date and time for this announcement.
                        </p>
                      )}
                    </div>
                  </div>

                  {(!editingItem || (
                    editingItem.status === 'draft' &&
                    !editingItem.metadata?.facebook_published_at
                  )) && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--oppa-green)]/20 bg-[var(--oppa-green-soft)]/45 p-3.5 text-xs transition-colors hover:bg-[var(--oppa-green-soft)]/70 dark:bg-[var(--oppa-green)]/10 dark:hover:bg-[var(--oppa-green)]/15">
                      <input
                        type="checkbox"
                        checked={!!formData.publish_to_facebook}
                        onChange={(e) => setFormData({ ...formData, publish_to_facebook: e.target.checked })}
                        className="mt-0.5 size-4 shrink-0 rounded accent-[var(--oppa-green)] focus:ring-[var(--oppa-green)]"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-[var(--oppa-text)] flex items-center gap-1.5">
                          <span className="flex size-4 items-center justify-center rounded-full bg-[#1877F2] text-white"><FaFacebookF size={9} aria-hidden="true" /></span>
                          Also publish to Oppa Dru Facebook Page
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-[var(--oppa-text-muted)]">
                          Checked by default. Publishes the headline, message, and optional image. Drafts and scheduled announcements are not posted early.
                        </span>
                      </div>
                    </label>
                  )}
                </div>

                {/* Sticky Bottom Actions Footer */}
                <div className="z-10 mt-auto flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--oppa-border)] bg-[var(--oppa-surface-raised)] px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5 sm:px-6">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    disabled={isSubmitting}
                    className="w-full rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--oppa-text-muted)] transition-colors hover:bg-[var(--oppa-cream)] hover:text-[var(--oppa-text)] sm:w-auto"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleSubmitForm(e, 'draft')}
                    disabled={isSubmitting}
                    className="w-full rounded-xl border border-[var(--oppa-green)]/50 bg-[var(--oppa-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--oppa-green-dark)] transition-colors hover:bg-[var(--oppa-green-soft)]/40 disabled:opacity-60 sm:w-auto"
                  >
                    Save Draft
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green-dark)] px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-[var(--oppa-green)]/20 transition-all duration-200 hover:-translate-y-px hover:bg-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    {isSubmitting ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
                    <span>
                      {isSubmitting
                        ? 'Saving…'
                        : sendMode === 'schedule'
                        ? 'Schedule Announcement'
                        : editingItem
                        ? 'Update & Publish'
                        : 'Send Announcement'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Modal: Live Recipient Preview (Portaled directly to document.body) */}
        {previewItem && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/70 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPreviewItem(null);
            }}
          >
            <div
              className="admin-card relative my-auto mt-4 sm:mt-auto flex flex-col w-full max-w-lg max-h-[85vh] rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
            >
              {/* Sticky Top Header with View Switcher */}
              <div className="flex items-center justify-between border-b border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-4 py-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="flex size-2.5 rounded-full bg-red-400" />
                  <span className="flex size-2.5 rounded-full bg-amber-400" />
                  <span className="flex size-2.5 rounded-full bg-emerald-400" />
                  
                  {/* View Mode Switcher */}
                  <div className="ml-2 flex items-center rounded-lg bg-[var(--oppa-border)]/40 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('app')}
                      className={`rounded-md px-2.5 py-1 transition-all ${
                        previewMode === 'app'
                          ? 'bg-white shadow-xs text-[var(--oppa-text)] font-bold dark:bg-slate-800'
                          : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'
                      }`}
                    >
                      App View
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('facebook')}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-all ${
                        previewMode === 'facebook'
                          ? 'bg-[#1877F2] text-white font-bold shadow-xs'
                          : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'
                      }`}
                    >
                      <FaFacebookF size={11} aria-hidden="true" /> Facebook Post View
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="rounded-lg p-1 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-border)]/40 transition-colors"
                >
                  <X size={17} />
                </button>
              </div>

              {/* Scrollable Announcement Preview Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {previewMode === 'facebook' ? (
                  /* Realistic Facebook Feed Post Mockup */
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#242526] text-slate-900 dark:text-slate-100 font-sans">
                    {/* Post Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--oppa-green)] text-white font-bold text-sm shadow-xs overflow-hidden">
                          {fbStatus?.page_picture ? (
                            <img src={fbStatus.page_picture} alt="Avatar" className="size-full object-cover" />
                          ) : (
                            <FiShoppingBag size={18} aria-hidden="true" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 leading-tight">
                            <span className="font-bold text-sm hover:underline cursor-pointer">
                              {fbStatus?.page_name || 'Oppa Dru Korean Fried Chicken'}
                            </span>
                            <span className="flex size-3.5 items-center justify-center rounded-full bg-blue-500 text-white"><FiCheckCircle size={11} aria-hidden="true" /></span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <span>{previewItem.date_sent ? formatDisplayDate(previewItem.date_sent) : 'Just now'}</span>
                            <span>·</span>
                            <span title="Public" className="inline-flex items-center"><Globe size={11} /></span>
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400 font-bold text-base cursor-pointer">···</span>
                    </div>

                    {/* Post Content */}
                    <div className="mb-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      <p className="font-bold text-base mb-1.5">{previewItem.title}</p>
                      <p>{previewItem.content}</p>
                      <p className="mt-2 text-blue-600 dark:text-blue-400">
                        <span className="inline-flex items-center gap-1"><FiShoppingBag aria-hidden="true" /> Order directly on our website:</span><br />
                        <FiArrowRight className="mr-1 inline-block" aria-hidden="true" />{typeof window !== 'undefined' ? window.location.origin : 'https://oppadru.vercel.app'}/menu
                      </p>
                      <p className="mt-1 text-slate-500 text-xs">
                        <FiMapPin className="mr-1 inline-block" aria-hidden="true" />Oppa Dru Korean Fried Chicken <br />
                        #OppaDru #KoreanFriedChicken #FoodTrip #CrispyChicken
                      </p>
                    </div>

                    {/* Attached Banner Image (full width) */}
                    {previewItem.image_url && (
                      <div className="-mx-4 mb-3 border-y border-slate-200 dark:border-slate-700 bg-black flex items-center justify-center overflow-hidden max-h-80">
                        <img
                          src={previewItem.image_url}
                          alt={previewItem.title}
                          className="w-full object-cover"
                        />
                      </div>
                    )}

                    {/* Engagement Counter Row */}
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-2 mb-2 px-1">
                      <div className="flex items-center gap-1">
                        <span className="flex size-4 items-center justify-center rounded-full bg-[#1877F2] text-white"><FiThumbsUp size={10} aria-hidden="true" /></span>
                        <span className="flex size-4 items-center justify-center rounded-full bg-red-500 text-white"><FiHeart size={10} aria-hidden="true" /></span>
                        <span className="ml-1">86</span>
                      </div>
                      <div className="flex gap-2">
                        <span>14 comments</span>
                        <span>·</span>
                        <span>9 shares</span>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="grid grid-cols-3 gap-1 pt-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <button type="button" className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <ThumbsUp size={14} /> Like
                      </button>
                      <button type="button" className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <MessageCircle size={14} /> Comment
                      </button>
                      <button type="button" className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <Share2 size={14} /> Share
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Standard App View */
                  <>
                    {previewItem.image_url && (
                      <img
                        src={previewItem.image_url}
                        alt={previewItem.title}
                        className="max-h-52 w-full rounded-xl object-cover shadow-sm border border-[var(--oppa-border)]"
                      />
                    )}

                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PRIORITY_BADGES[previewItem.priority]?.style || ''}`}>
                        {PRIORITY_BADGES[previewItem.priority]?.label || 'General'}
                      </span>
                      <span className="text-xs text-[var(--oppa-text-muted)]">
                        {previewItem.date_sent ? formatDisplayDate(previewItem.date_sent) : 'Immediate'}
                      </span>
                      <span className="ml-auto text-xs font-semibold text-[var(--oppa-text-muted)]">
                        {previewItem.target_audience === 'all'
                          ? <><Megaphone className="mr-1 inline-block" size={12} aria-hidden="true" />Legacy audience</>
                          : <><FiShoppingBag className="mr-1 inline-block" aria-hidden="true" />Customers Only</>}
                      </span>
                    </div>

                    <h3 className="font-serif text-lg sm:text-xl font-bold leading-snug text-[var(--oppa-text)]">
                      {previewItem.title}
                    </h3>

                    <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-[var(--oppa-text-muted)]">
                      {previewItem.content}
                    </p>
                  </>
                )}

                {/* Facebook Action Card */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/30">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-[#1877F2] text-white">
                        <FaFacebookF size={10} aria-hidden="true" />
                      </span>
                      <span className="text-xs font-bold text-[var(--oppa-text)]">
                        Post to Facebook Business Page
                      </span>
                    </div>
                    {previewItem.metadata?.facebook_post_url ? (
                      <a
                        href={previewItem.metadata.facebook_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        ✓ View on FB Page
                      </a>
                    ) : (
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        @oppadruKFC
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--oppa-text-muted)] mb-3">
                    Upload this announcement (headline, content, and image) directly to your official Facebook Business Page feed.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenMetaBusinessSuite(previewItem)}
                      className="flex items-center gap-1.5 rounded-lg bg-[#1877F2] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#166fe5] shadow-xs transition-colors"
                      title="Copies caption and opens Meta Business Suite Post Composer"
                    >
                      <ExternalLink size={13} />
                      <span>Create on Meta Business Suite</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyFbCaption(previewItem)}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--oppa-border)] bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] shadow-xs transition-colors dark:bg-slate-800"
                    >
                      <Copy size={13} />
                      <span>Copy Caption</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenFbPage()}
                      className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-100/60 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-200 shadow-xs transition-colors dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      <ExternalLink size={13} />
                      <span>View FB Page</span>
                    </button>
                    {fbStatus?.connected && (
                      <button
                        type="button"
                        onClick={() => handleDirectPublishFacebook(previewItem)}
                        disabled={isPublishingToFb === previewItem.id}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition-colors disabled:opacity-50"
                        title="Auto-upload via Facebook Graph API"
                      >
                        {isPublishingToFb === previewItem.id ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        <span>Direct API Post</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sticky Bottom Footer */}
              <div className="flex items-center justify-between border-t border-[var(--oppa-border)] bg-[var(--oppa-surface-raised)] px-5 py-3 text-xs text-[var(--oppa-text-muted)] shrink-0">
                <span>Broadcasted via Oppa Dru</span>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="admin-button-primary px-3.5 py-1.5 text-xs font-bold"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Facebook Settings Modal (Portaled to document.body) */}
        {isFbSettingsOpen && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/75 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFbSettingsOpen(false);
            }}
          >
            <div
              className="admin-card relative my-auto flex flex-col w-full max-w-lg rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-5 py-4 bg-[var(--oppa-surface-raised)]">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-xl bg-[#1877F2] text-white shadow-sm">
                    <FaFacebookF size={15} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-serif text-base font-bold text-[var(--oppa-text)]">
                      Facebook Page Integration
                    </h3>
                    <p className="text-[11px] text-[var(--oppa-text-muted)]">
                      Connect your Facebook Business Page for automated text & image posting
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFbSettingsOpen(false)}
                  className="rounded-lg p-1.5 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] transition-colors"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {fbStatus?.connected ? (
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white font-bold">
                      <Check size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-emerald-900 dark:text-emerald-200">
                        Connected to: {fbStatus.page_name}
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Page ID: {fbStatus.page_id} · Direct posting is active.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
                    <p className="font-bold text-amber-900 dark:text-amber-200">
                      {fbStatus?.configured ? 'Facebook is not connected' : 'Facebook setup is required'}
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                      {fbStatus?.error || fbStatus?.message || 'Set the Page Access Token in the backend environment to enable posting.'}
                    </p>
                    {(fbStatus?.error || '').includes('OAuth error 190') && (
                      <p className="mt-2 text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                        This cannot be fixed by rechecking. Re-authorize the Page, replace the backend Page token, and redeploy the backend.
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface-raised)] p-3 text-xs text-[var(--oppa-text-muted)]">
                  <p>Page ID: {fbStatus?.page_id || '1356325764233154'}</p>
                  <p className="mt-2">
                    Configure <code>FACEBOOK_PAGE_ACCESS_TOKEN</code> in the backend environment. Use a Page Access Token for this Page—not a temporary Graph API user token—with <code>pages_show_list</code>, <code>pages_manage_posts</code>, and <code>pages_read_engagement</code>. Replace it after the Facebook user session is revoked, then redeploy and recheck.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--oppa-border)]">
                  <button
                    type="button"
                    onClick={() => setIsFbSettingsOpen(false)}
                    className="admin-button-secondary px-3.5 py-1.5 text-xs font-medium"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshFacebookStatus}
                    className="admin-button-primary flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold shadow"
                  >
                    <RefreshCw size={13} />
                    <span>Recheck connection</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Delete Confirmation Dialog */}
        {deleteTarget && (
          <ConfirmDialog
            title="Delete Announcement?"
            description={`Are you sure you want to permanently delete "${deleteTarget.title}"? This cannot be undone.`}
            confirmLabel="Delete Announcement"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
          />
        )}

        {/* Toast Alert */}
        {toastMessage && (
          <Toast message={toastMessage} tone={toastTone} onDismiss={() => setToastMessage(null)} />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAnnouncementsPage;

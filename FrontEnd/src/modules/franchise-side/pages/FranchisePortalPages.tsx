import React, { useEffect, useState } from 'react';
import { Building2, Check, CircleHelp, FileText, Loader2, Megaphone, ReceiptText, RefreshCw, Search, WalletCards } from 'lucide-react';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { EmptyState, PageHeader } from '../../admin-side/components/AdminUI';
import ProductsPage, { type ProductsPageConfig } from '../../shared/components/ProductsPage';
import { franchiseProductAdapter } from '../../../services/franchiseProductService';
import { canManageBranchProduct } from '../../../services/franchiseProductPermissions';
import { announcementService } from '../../../services/announcementService';
import type { Announcement } from '../../../types/announcement.types';
import { ValidatedForm } from '../../../components/ui/FormValidation';

const Shell: React.FC<{ eyebrow: string; title: string; description: string; icon?: React.ElementType; children: React.ReactNode }> = ({ eyebrow, title, description, icon: Icon, children }) => <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7"><div className="mx-auto max-w-[1500px]"><div className="mb-4 flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--oppa-green)]">{eyebrow}</p><PageHeader title={title} subtitle={description} /></div>{Icon && <span className="mt-2 rounded-xl bg-[var(--oppa-green-soft)] p-2.5 text-[var(--oppa-green-dark)]"><Icon size={20} aria-hidden="true" /></span>}</div>{children}</div></main>;
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="admin-card p-6"><h2 className="font-semibold text-[var(--oppa-text)]">{title}</h2><div className="mt-4">{children}</div></section>;
const AsyncEmpty: React.FC<{ message: string }> = ({ message }) => <EmptyState title={message} />;
const getAnnouncementSentAt = (announcement: Announcement): string | undefined =>
  announcement.status === 'scheduled'
    ? announcement.scheduled_at || undefined
    : announcement.date_sent || announcement.created_at;

type BranchAnnouncement = Announcement & { is_read: boolean };

const getRelativeDate = (value?: string): { relative: string; full: string } | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const elapsedSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1],
  ];
  const [unit, secondsPerUnit] = units.find(([, seconds]) => Math.abs(elapsedSeconds) >= seconds) || units[units.length - 1];
  return {
    relative: new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(elapsedSeconds / secondsPerUnit), unit),
    full: date.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
  };
};

const AnnouncementCard: React.FC<{
  announcement: BranchAnnouncement;
  onRead: (announcement: BranchAnnouncement) => void;
  isMarkingRead: boolean;
}> = ({ announcement, onRead, isMarkingRead }) => {
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const sentAt = getRelativeDate(getAnnouncementSentAt(announcement));
  const isLong = announcement.content.length > 220;
  const contentId = `branch-announcement-content-${announcement.id.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const priorityClass = announcement.priority === 'urgent'
    ? 'bg-red-100 text-red-800'
    : announcement.priority === 'high'
      ? 'bg-orange-100 text-orange-800'
      : announcement.priority === 'promo'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]';
  const priorityLabel = announcement.priority === 'urgent'
    ? 'Urgent'
    : announcement.priority === 'high'
      ? 'High priority'
      : announcement.priority === 'promo'
        ? 'Special promo'
        : 'General';

  const toggleExpanded = () => {
    const shouldExpand = !expanded;
    setExpanded(shouldExpand);
    if (shouldExpand && !announcement.is_read) onRead(announcement);
  };

  return (
    <article className={`overflow-hidden rounded-2xl border shadow-sm transition-[box-shadow,opacity] hover:shadow-md ${announcement.is_read ? 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] opacity-80' : 'border-l-4 border-y-[var(--oppa-border)] border-r-[var(--oppa-border)] border-l-[var(--oppa-green)] bg-[var(--oppa-surface)]'}`}>
      <div className="relative aspect-video overflow-hidden bg-[var(--oppa-surface-raised)]">
        {announcement.image_url && !imageFailed ? <>
          {!imageLoaded && <div aria-hidden="true" className="absolute inset-0 bg-[var(--oppa-surface-raised)]" />}
          <img
            src={announcement.image_url}
            alt={announcement.title}
            className={`h-full w-full object-cover object-[center_top] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageFailed(true)}
          />
        </> : <div role="img" aria-label={`Announcement banner for ${announcement.title}`} className="flex h-full items-center justify-center bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]">
          <Megaphone size={34} aria-hidden="true" />
        </div>}
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityClass}`}>{priorityLabel}</span>
            {!announcement.is_read
              ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">New</span>
              : <span className="inline-flex items-center gap-1 rounded-full bg-[var(--oppa-cream)] px-2.5 py-1 text-[11px] font-medium text-[var(--oppa-text-muted)]"><Check size={12} aria-hidden="true" />Read</span>}
          </div>
          {sentAt && <time className="text-xs text-[var(--oppa-text-muted)]" dateTime={getAnnouncementSentAt(announcement)} title={sentAt.full}>{sentAt.relative}</time>}
        </div>
        <h3 className={`mt-3 font-serif text-lg font-bold leading-snug text-[var(--oppa-text)] ${expanded ? '' : 'line-clamp-2'}`}>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={toggleExpanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} announcement: ${announcement.title}`}
            className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
          >{announcement.title}</button>
        </h3>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={toggleExpanded}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} message for ${announcement.title}`}
          className="mt-2 block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
        >
          <span id={contentId} className={`block whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--oppa-text)] ${expanded ? '' : 'line-clamp-3'}`}>
            {announcement.content}
          </span>
          {isLong && <span className="mt-2 inline-block text-xs font-semibold text-[var(--oppa-green-dark)]">{expanded ? 'Show less' : 'Read full message'}</span>}
        </button>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-[var(--oppa-text-muted)]"><Building2 size={14} aria-hidden="true" />From Main Branch</p>
          {!announcement.is_read && <button
            type="button"
            onClick={() => onRead(announcement)}
            disabled={isMarkingRead}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] disabled:cursor-wait disabled:opacity-70"
          >{isMarkingRead && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}{isMarkingRead ? 'Marking…' : 'Mark as read'}</button>}
        </div>
      </div>
    </article>
  );
};

const AnnouncementCardSkeleton: React.FC = () => (
  <article aria-hidden="true" className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)]">
    <div className="aspect-video bg-[var(--oppa-surface-raised)]" />
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex justify-between gap-3">
        <div className="h-6 w-28 rounded-full bg-[var(--oppa-cream)]" />
        <div className="h-4 w-16 rounded bg-[var(--oppa-cream)]" />
      </div>
      <div className="h-5 w-4/5 rounded bg-[var(--oppa-cream)]" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-[var(--oppa-cream)]" />
        <div className="h-3 w-5/6 rounded bg-[var(--oppa-cream)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--oppa-cream)]" />
      </div>
      <div className="flex justify-between gap-3">
        <div className="h-4 w-28 rounded bg-[var(--oppa-cream)]" />
        <div className="h-8 w-24 rounded-lg bg-[var(--oppa-cream)]" />
      </div>
    </div>
  </article>
);

export const MenuAvailabilityPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const branchId = String(franchiseUser?.franchise_id || '');
  const canManage = Boolean(branchId) && ['owner', 'manager'].includes(franchiseUser?.role?.toLowerCase() || '');
  const config: ProductsPageConfig = {
    subtitle: 'Manage this branch’s products and availability.',
    adapter: franchiseProductAdapter,
    permissions: {
      add: canManage,
      bulkAvailability: canManage,
      bulkCategory: canManage,
      bulkDelete: canManage,
      forProduct: (product, permission) => canManageBranchProduct(product, permission, branchId, canManage),
    },
  };

  return <div className="px-4 pb-6 pt-6 sm:px-6 lg:px-8">
    <div className="mx-auto w-full max-w-[1600px]">
      <ProductsPage config={config} />
    </div>
  </div>;
};

export const DiscountRequestsPage: React.FC = () => <Shell eyebrow="Business · Branch only" title="Discount Requests" description="Submit a request for main-branch review. Approval decisions are never made in the franchise portal." icon={FileText}><Card title="Request a discount"><ValidatedForm className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}><label className="text-sm sm:col-span-2">Reason<input data-required="true" placeholder="Describe the customer or order context" className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5" /></label><label className="text-sm">Order reference<input placeholder="Optional order number" className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5" /></label><label className="text-sm">Requested amount<input placeholder="Enter amount" inputMode="decimal" className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5" /></label><button className="rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2">Submit request</button></ValidatedForm></Card><div className="mt-4"><Card title="Request history"><AsyncEmpty message="No discount requests have been submitted for this branch." /></Card></div></Shell>;
export const FeesPaymentsPage: React.FC = () => <Shell eyebrow="Business · Owner access" title="Fees & Payments" description="Review agreement-defined fees and branch payment history. Amounts appear when the agreement data is available." icon={WalletCards}><Card title="Agreement fees"><AsyncEmpty message="Fee details are not configured for this branch yet. Contact the franchise team for an editable agreement summary." /></Card></Shell>;
export const AnnouncementsPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const [announcements, setAnnouncements] = useState<BranchAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [reloadKey, setReloadKey] = useState(0);
  const [readingId, setReadingId] = useState<string | null>(null);
  const branchId = String(franchiseUser?.franchise_id || '');

  useEffect(() => {
    let active = true;
    const loadAnnouncements = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);
      setError('');
      try {
        const result = await announcementService.getFranchiseAnnouncements();
        if (active) setAnnouncements(result.announcements);
      } catch (loadError: unknown) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Announcements could not be loaded.');
      } finally {
        if (active && showLoading) setLoading(false);
      }
    };
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') void loadAnnouncements(false);
    };

    void loadAnnouncements(true);
    window.addEventListener('focus', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenActive);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenActive);
    };
  }, [branchId, reloadKey]);

  const markAsRead = async (announcement: BranchAnnouncement) => {
    if (announcement.is_read || readingId === announcement.id) return;
    setReadingId(announcement.id);
    try {
      await announcementService.markFranchiseAnnouncementRead(announcement.id);
      setAnnouncements((current) => current.map((item) => item.id === announcement.id ? { ...item, is_read: true } : item));
      setReadError('');
      window.dispatchEvent(new Event('franchise-announcements-updated'));
    } catch (readError) {
      setReadError(readError instanceof Error ? readError.message : 'The announcement could not be marked as read.');
    } finally {
      setReadingId(null);
    }
  };

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredAnnouncements = announcements.filter((announcement) => (
    (filter === 'all' || !announcement.is_read)
    && (!normalizedSearch || `${announcement.title} ${announcement.content}`.toLocaleLowerCase().includes(normalizedSearch))
  ));
  const sortedAnnouncements = [...filteredAnnouncements].sort((first, second) => (
    new Date(getAnnouncementSentAt(second) || second.created_at || 0).getTime()
    - new Date(getAnnouncementSentAt(first) || first.created_at || 0).getTime()
  ));

  return <Shell eyebrow="Communication · Read only" title="Announcements" description="Updates published by the main branch for franchise teams.">
    <Card title="Branch updates">
      <div className="w-full">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search announcements by title or message</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or message…"
              className="h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] pl-9 pr-3 text-sm text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)] focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20"
            />
          </label>
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <div role="group" aria-label="Filter announcements" className="inline-flex h-11 w-auto shrink-0 items-center rounded-xl bg-[var(--oppa-cream)] p-1">
              {([['all', 'All'], ['unread', 'Unread']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${label} announcements`}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`h-9 rounded-lg px-4 text-sm font-semibold transition-colors ${filter === value ? 'bg-[var(--oppa-surface)] text-[var(--oppa-green-dark)] shadow-sm' : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'} focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]`}
                >{label}</button>
              ))}
            </div>
            <p aria-live="polite" aria-label={`${filteredAnnouncements.length} announcement${filteredAnnouncements.length === 1 ? '' : 's'} matching the current filter`} className="shrink-0 text-right text-sm text-[var(--oppa-text-muted)]">
              {filteredAnnouncements.length} announcement{filteredAnnouncements.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        {readError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{readError}</p>}
        {loading ? <div role="status" aria-label="Loading announcements" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <span className="sr-only">Loading announcements…</span>
            <AnnouncementCardSkeleton />
            <AnnouncementCardSkeleton />
            <AnnouncementCardSkeleton />
          </div>
          : error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center text-sm text-red-800">
            <p>{error}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-300 bg-white px-4 font-semibold text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
              <RefreshCw size={15} aria-hidden="true" />Try again
            </button>
          </div>
          : announcements.length === 0 ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-5 py-9 text-center">
            <span className="mb-3 rounded-full bg-[var(--oppa-green-soft)] p-3 text-[var(--oppa-green-dark)]"><Megaphone size={22} aria-hidden="true" /></span>
            <p className="text-sm font-medium text-[var(--oppa-text-muted)]">No announcements are available right now.</p>
          </div>
          : filteredAnnouncements.length === 0
            ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-5 py-9 text-center">
              <span className="mb-3 rounded-full bg-[var(--oppa-green-soft)] p-3 text-[var(--oppa-green-dark)]"><Search size={20} aria-hidden="true" /></span>
              <p className="text-sm font-medium text-[var(--oppa-text-muted)]">No announcements match your search or filter.</p>
              <button type="button" onClick={() => { setSearch(''); setFilter('all'); }} className="mt-3 min-h-10 rounded-lg px-3 text-sm font-semibold text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">Clear filters</button>
            </div>
            : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedAnnouncements.map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  onRead={(item) => void markAsRead(item)}
                  isMarkingRead={readingId === announcement.id}
                />
              ))}
            </div>}
      </div>
    </Card>
  </Shell>;
};
export const SupportResourcesPage: React.FC = () => <Shell eyebrow="Communication" title="Support & Resources" description="Find your franchise team contact, training materials, operating manuals, and frequently asked questions." icon={CircleHelp}><div className="grid gap-4 md:grid-cols-3"><Card title="Franchise team"><AsyncEmpty message="Contact details will appear when your support profile is configured." /></Card><Card title="Training materials"><AsyncEmpty message="No training materials have been published yet." /></Card><Card title="FAQ & manuals"><AsyncEmpty message="Resources will appear here when available." /></Card></div></Shell>;
export const FranchiseDeliveryPage: React.FC = () => <Shell eyebrow="Operations · Branch only" title="Delivery" description="Manage delivery activity for this branch when delivery is enabled in the branch agreement." icon={ReceiptText}><Card title="Delivery activity"><AsyncEmpty message="Delivery is not enabled or there is no delivery activity for this branch yet." /></Card></Shell>;

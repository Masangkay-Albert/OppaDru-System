import React, { useEffect, useState } from 'react';
import { CircleHelp, FileText, Megaphone, ReceiptText, Search, WalletCards } from 'lucide-react';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { EmptyState, PageHeader } from '../../admin-side/components/AdminUI';
import ProductsPage, { type ProductsPageConfig } from '../../shared/components/ProductsPage';
import { franchiseProductAdapter } from '../../../services/franchiseProductService';
import { canManageBranchProduct } from '../../../services/franchiseProductPermissions';
import { announcementService } from '../../../services/announcementService';
import type { Announcement } from '../../../types/announcement.types';
import { ValidatedForm } from '../../../components/ui/FormValidation';

const Shell: React.FC<{ eyebrow: string; title: string; description: string; icon: React.ElementType; children: React.ReactNode }> = ({ eyebrow, title, description, icon: Icon, children }) => <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7"><div className="mx-auto max-w-[1500px]"><div className="mb-4 flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--oppa-green)]">{eyebrow}</p><PageHeader title={title} subtitle={description} /></div><span className="mt-2 rounded-xl bg-[var(--oppa-green-soft)] p-2.5 text-[var(--oppa-green-dark)]"><Icon size={20} aria-hidden="true" /></span></div>{children}</div></main>;
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
}> = ({ announcement, onRead }) => {
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
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
    <article className={`overflow-hidden rounded-2xl border shadow-sm ${announcement.is_read ? 'border-[var(--oppa-border)] bg-[var(--oppa-surface)]' : 'border-[var(--oppa-green)]/40 bg-[var(--oppa-green-soft)]/20'}`}>
      {announcement.image_url && (imageFailed
        ? <div role="img" aria-label="Banner image unavailable" className="flex aspect-[16/5] items-center justify-center gap-2 bg-[var(--oppa-cream)] text-sm text-[var(--oppa-text-muted)]">
            <Megaphone size={18} aria-hidden="true" />
            <span>Banner image unavailable</span>
          </div>
        : <img
            src={announcement.image_url}
            alt=""
            className="aspect-[16/5] w-full bg-[var(--oppa-cream)] object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />)}
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${priorityClass}`}>{priorityLabel}</span>
            {!announcement.is_read && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">New</span>}
          </div>
          {sentAt && <time className="text-xs text-[var(--oppa-text-muted)]" dateTime={getAnnouncementSentAt(announcement)} title={sentAt.full}>{sentAt.relative}</time>}
        </div>
        <h3 className="mt-3 font-serif text-lg font-bold text-[var(--oppa-text)]">{announcement.title}</h3>
        <p id={contentId} className={`mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--oppa-text)] ${isLong && !expanded ? 'line-clamp-3' : ''}`}>
          {announcement.content}
        </p>
        {isLong && <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={toggleExpanded}
          className="mt-2 rounded-md text-sm font-semibold text-[var(--oppa-green-dark)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
        >{expanded ? 'Read less' : 'Read more'}</button>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--oppa-text-muted)]">From Main Branch</p>
          {!announcement.is_read && <button
            type="button"
            onClick={() => onRead(announcement)}
            className="rounded-md text-xs font-semibold text-[var(--oppa-green-dark)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
          >Mark as read</button>}
        </div>
      </div>
    </article>
  );
};

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
  }, [branchId]);

  const markAsRead = async (announcement: BranchAnnouncement) => {
    if (announcement.is_read) return;
    try {
      await announcementService.markFranchiseAnnouncementRead(announcement.id);
      setAnnouncements((current) => current.map((item) => item.id === announcement.id ? { ...item, is_read: true } : item));
      setReadError('');
      window.dispatchEvent(new Event('franchise-announcements-updated'));
    } catch (readError) {
      setReadError(readError instanceof Error ? readError.message : 'The announcement could not be marked as read.');
    }
  };

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredAnnouncements = announcements.filter((announcement) => (
    (filter === 'all' || !announcement.is_read)
    && (!normalizedSearch || `${announcement.title} ${announcement.content}`.toLocaleLowerCase().includes(normalizedSearch))
  ));

  return <Shell eyebrow="Communication · Read only" title="Announcements" description="Updates published by the main branch for franchise teams." icon={Megaphone}>
    <Card title="Branch updates">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
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
          <div role="group" aria-label="Filter announcements" className="inline-flex w-full rounded-xl bg-[var(--oppa-cream)] p-1 sm:w-auto">
            {([['all', 'All'], ['unread', 'Unread']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-9 flex-1 rounded-lg px-4 text-sm font-semibold transition-colors sm:flex-none ${filter === value ? 'bg-[var(--oppa-surface)] text-[var(--oppa-green-dark)] shadow-sm' : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]`}
              >{label}</button>
            ))}
          </div>
          <p aria-live="polite" className="text-sm text-[var(--oppa-text-muted)] sm:ml-auto sm:whitespace-nowrap">
            {filteredAnnouncements.length} announcement{filteredAnnouncements.length === 1 ? '' : 's'}
          </p>
        </div>
        {readError && <p role="alert" className="mb-4 text-sm text-red-700">{readError}</p>}
        {loading ? <p role="status" className="py-8 text-center text-sm text-[var(--oppa-text-muted)]">Loading announcements…</p>
          : error ? <p role="alert" className="py-8 text-center text-sm text-red-700">{error}</p>
          : announcements.length === 0 ? <AsyncEmpty message="No announcements are available right now." />
          : filteredAnnouncements.length === 0
            ? <AsyncEmpty message={filter === 'unread' && !normalizedSearch ? 'No unread announcements.' : 'No announcements match your search.'} />
            : <div className="space-y-4">
              {filteredAnnouncements.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} onRead={(item) => void markAsRead(item)} />
              ))}
            </div>}
      </div>
    </Card>
  </Shell>;
};
export const SupportResourcesPage: React.FC = () => <Shell eyebrow="Communication" title="Support & Resources" description="Find your franchise team contact, training materials, operating manuals, and frequently asked questions." icon={CircleHelp}><div className="grid gap-4 md:grid-cols-3"><Card title="Franchise team"><AsyncEmpty message="Contact details will appear when your support profile is configured." /></Card><Card title="Training materials"><AsyncEmpty message="No training materials have been published yet." /></Card><Card title="FAQ & manuals"><AsyncEmpty message="Resources will appear here when available." /></Card></div></Shell>;
export const FranchiseDeliveryPage: React.FC = () => <Shell eyebrow="Operations · Branch only" title="Delivery" description="Manage delivery activity for this branch when delivery is enabled in the branch agreement." icon={ReceiptText}><Card title="Delivery activity"><AsyncEmpty message="Delivery is not enabled or there is no delivery activity for this branch yet." /></Card></Shell>;

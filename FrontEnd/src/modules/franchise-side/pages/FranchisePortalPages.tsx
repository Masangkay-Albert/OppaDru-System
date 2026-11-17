import React, { useEffect, useState } from 'react';
import { CircleHelp, FileText, Megaphone, ReceiptText, WalletCards } from 'lucide-react';
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
  const [announcements, setAnnouncements] = useState<Array<Announcement & { is_read: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readError, setReadError] = useState('');
  const branchId = String(franchiseUser?.franchise_id || '');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    announcementService.getFranchiseAnnouncements()
      .then((result) => {
        if (active) setAnnouncements(result.announcements);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Announcements could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branchId]);

  const markAsRead = async (announcement: Announcement & { is_read: boolean }) => {
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

  return <Shell eyebrow="Communication · Read only" title="Announcements" description="Updates published by the main branch for franchise teams." icon={Megaphone}>
    <Card title="Branch updates">
      {loading ? <p role="status" className="py-8 text-center text-sm text-[var(--oppa-text-muted)]">Loading announcements…</p>
        : error ? <p role="alert" className="py-8 text-center text-sm text-red-700">{error}</p>
        : announcements.length === 0 ? <AsyncEmpty message="No announcements are available right now." />
        : <div className="space-y-4">
          {readError && <p role="alert" className="text-sm text-red-700">{readError}</p>}
          {announcements.map((announcement) => {
            const sentAt = getAnnouncementSentAt(announcement);
            return (
            <article key={announcement.id} className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-sm">
              {announcement.image_url && <img src={announcement.image_url} alt="" className="max-h-64 w-full object-cover" loading="lazy" />}
              <div className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${announcement.priority === 'urgent' ? 'bg-red-100 text-red-800' : announcement.priority === 'high' ? 'bg-orange-100 text-orange-800' : announcement.priority === 'promo' ? 'bg-amber-100 text-amber-800' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]'}`}>
                    {announcement.priority === 'urgent' ? 'Urgent' : announcement.priority === 'high' ? 'High priority' : announcement.priority === 'promo' ? 'Special promo' : 'General'}
                  </span>
                  <div className="flex items-center gap-2">
                    {!announcement.is_read && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">New</span>}
                    <time className="text-xs text-[var(--oppa-text-muted)]" dateTime={sentAt}>
                      {sentAt ? new Date(sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
                    </time>
                  </div>
                </div>
                <h3 className="mt-3 font-serif text-lg font-bold text-[var(--oppa-text)]">{announcement.title}</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--oppa-text)]">{announcement.content}</p>
                {!announcement.is_read && <button type="button" onClick={() => void markAsRead(announcement)} className="mt-4 rounded-lg border border-[var(--oppa-border)] px-3 py-1.5 text-xs font-semibold text-[var(--oppa-green-dark)] transition hover:border-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">Mark as read</button>}
              </div>
            </article>
          );})}
        </div>}
    </Card>
  </Shell>;
};
export const SupportResourcesPage: React.FC = () => <Shell eyebrow="Communication" title="Support & Resources" description="Find your franchise team contact, training materials, operating manuals, and frequently asked questions." icon={CircleHelp}><div className="grid gap-4 md:grid-cols-3"><Card title="Franchise team"><AsyncEmpty message="Contact details will appear when your support profile is configured." /></Card><Card title="Training materials"><AsyncEmpty message="No training materials have been published yet." /></Card><Card title="FAQ & manuals"><AsyncEmpty message="Resources will appear here when available." /></Card></div></Shell>;
export const FranchiseDeliveryPage: React.FC = () => <Shell eyebrow="Operations · Branch only" title="Delivery" description="Manage delivery activity for this branch when delivery is enabled in the branch agreement." icon={ReceiptText}><Card title="Delivery activity"><AsyncEmpty message="Delivery is not enabled or there is no delivery activity for this branch yet." /></Card></Shell>;

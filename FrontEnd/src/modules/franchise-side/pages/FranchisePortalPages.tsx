import React from 'react';
import { CircleHelp, FileText, Megaphone, ReceiptText, WalletCards } from 'lucide-react';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { EmptyState, PageHeader } from '../../admin-side/components/AdminUI';
import ProductsPage, { type ProductsPageConfig } from '../../shared/components/ProductsPage';
import { franchiseProductAdapter } from '../../../services/franchiseProductService';
import { canManageBranchProduct } from '../../../services/franchiseProductPermissions';

const Shell: React.FC<{ eyebrow: string; title: string; description: string; icon: React.ElementType; children: React.ReactNode }> = ({ eyebrow, title, description, icon: Icon, children }) => <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7"><div className="mx-auto max-w-[1500px]"><div className="mb-4 flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--oppa-green)]">{eyebrow}</p><PageHeader title={title} subtitle={description} /></div><span className="mt-2 rounded-xl bg-[var(--oppa-green-soft)] p-2.5 text-[var(--oppa-green-dark)]"><Icon size={20} aria-hidden="true" /></span></div>{children}</div></main>;
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="admin-card p-6"><h2 className="font-semibold text-[var(--oppa-text)]">{title}</h2><div className="mt-4">{children}</div></section>;
const AsyncEmpty: React.FC<{ message: string }> = ({ message }) => <EmptyState title={message} />;

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

export const DiscountRequestsPage: React.FC = () => <Shell eyebrow="Business · Branch only" title="Discount Requests" description="Submit a request for main-branch review. Approval decisions are never made in the franchise portal." icon={FileText}><Card title="Request a discount"><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}><label className="text-sm sm:col-span-2">Reason<input required placeholder="Describe the customer or order context" className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5" /></label><label className="text-sm">Order reference<input placeholder="Optional order number" className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5" /></label><label className="text-sm">Requested amount<input placeholder="Enter amount" inputMode="decimal" className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5" /></label><button className="rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2">Submit request</button></form></Card><div className="mt-4"><Card title="Request history"><AsyncEmpty message="No discount requests have been submitted for this branch." /></Card></div></Shell>;
export const FeesPaymentsPage: React.FC = () => <Shell eyebrow="Business · Owner access" title="Fees & Payments" description="Review agreement-defined fees and branch payment history. Amounts appear when the agreement data is available." icon={WalletCards}><Card title="Agreement fees"><AsyncEmpty message="Fee details are not configured for this branch yet. Contact the franchise team for an editable agreement summary." /></Card></Shell>;
export const AnnouncementsPage: React.FC = () => <Shell eyebrow="Communication · Read only" title="Announcements" description="Updates published by the main branch for franchise teams." icon={Megaphone}><Card title="Branch updates"><AsyncEmpty message="No announcements are available right now." /></Card></Shell>;
export const SupportResourcesPage: React.FC = () => <Shell eyebrow="Communication" title="Support & Resources" description="Find your franchise team contact, training materials, operating manuals, and frequently asked questions." icon={CircleHelp}><div className="grid gap-4 md:grid-cols-3"><Card title="Franchise team"><AsyncEmpty message="Contact details will appear when your support profile is configured." /></Card><Card title="Training materials"><AsyncEmpty message="No training materials have been published yet." /></Card><Card title="FAQ & manuals"><AsyncEmpty message="Resources will appear here when available." /></Card></div></Shell>;
export const FranchiseDeliveryPage: React.FC = () => <Shell eyebrow="Operations · Branch only" title="Delivery" description="Manage delivery activity for this branch when delivery is enabled in the branch agreement." icon={ReceiptText}><Card title="Delivery activity"><AsyncEmpty message="Delivery is not enabled or there is no delivery activity for this branch yet." /></Card></Shell>;

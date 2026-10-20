import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleHelp, FileText, LoaderCircle, Megaphone, ReceiptText, Search, WalletCards } from 'lucide-react';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { categories } from '../../../data/mockData';
import { formatCurrency } from '../../../utils/formatters';
import { AvailabilitySwitch, EmptyState, PageHeader, ProductThumbnail, Toast } from '../../admin-side/components/AdminUI';

const Shell: React.FC<{ eyebrow: string; title: string; description: string; icon: React.ElementType; children: React.ReactNode }> = ({ eyebrow, title, description, icon: Icon, children }) => <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7"><div className="mx-auto max-w-[1500px]"><div className="mb-4 flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--oppa-green)]">{eyebrow}</p><PageHeader title={title} subtitle={description} /></div><span className="mt-2 rounded-xl bg-[var(--oppa-green-soft)] p-2.5 text-[var(--oppa-green-dark)]"><Icon size={20} aria-hidden="true" /></span></div>{children}</div></main>;
const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => <section className="admin-card p-6"><h2 className="font-semibold text-[var(--oppa-text)]">{title}</h2><div className="mt-4">{children}</div></section>;
const Empty: React.FC<{ message: string }> = ({ message }) => <EmptyState title={message} />;
const Loading = () => <div className="flex items-center justify-center rounded-[20px] border border-[var(--oppa-border)] bg-white p-12 text-sm text-[var(--oppa-text-muted)]"><LoaderCircle className="mr-2 animate-spin" size={17} />Loading branch data...</div>;
const AsyncEmpty: React.FC<{ message: string }> = ({ message }) => <Empty message={message} />;

interface BranchMenuItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number | string;
  image?: string;
  branch_available?: boolean;
}

export const MenuAvailabilityPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const [items, setItems] = useState<BranchMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const loadMenu = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/inventory`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Could not load branch products.');
      setItems(Array.isArray(payload.data?.items) ? payload.data.items : []);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load branch products.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void loadMenu(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadMenu]);

  const getCategoryLabel = (value: string) =>
    categories.find((entry) => entry.id === value)?.name || value.replaceAll('-', ' ');

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = category === 'all' || item.category === category;
      const matchesSearch = !query
        || item.name.toLowerCase().includes(query)
        || (item.description || '').toLowerCase().includes(query)
        || getCategoryLabel(item.category).toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    }).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [items, search, category]);

  const toggleAvailability = async (item: BranchMenuItem) => {
    if (pendingIds.includes(item.id)) return;
    const nextAvailable = !item.branch_available;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, branch_available: nextAvailable } : entry));
    setPendingIds((current) => [...current, item.id]);
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/inventory/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_available: nextAvailable }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not update this item’s branch availability.');
      setNotice(`${item.name} marked ${nextAvailable ? 'available' : 'unavailable'}.`);
      await loadMenu(false);
    } catch (updateError) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, branch_available: !nextAvailable } : entry));
      setError(updateError instanceof Error ? updateError.message : 'Could not update this item’s branch availability.');
    } finally {
      setPendingIds((current) => current.filter((id) => id !== item.id));
    }
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      {notice && <Toast message={notice} onDismiss={() => setNotice('')} />}
      <div className="mx-auto max-w-[1500px]">
        <PageHeader title="Products" subtitle="Manage which products this branch can sell. Product details and pricing are managed by the main branch." />

        {error && <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={() => void loadMenu()} className="font-semibold underline">Retry</button></div>}

        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex h-11 w-full shrink-0 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-[var(--oppa-text-muted)] lg:max-w-xs lg:flex-1">
            <Search size={16} aria-hidden="true" />
            <input aria-label="Search products" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products..." className="min-w-0 w-full bg-transparent text-sm text-[var(--oppa-text)] outline-none placeholder:text-[var(--oppa-text-muted)]" />
          </label>
          <div role="tablist" aria-label="Filter products by category" className="admin-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1">
            {[{ id: 'all', name: 'All' }, ...categories.filter((entry) => entry.id !== 'all')].map((entry) => {
              const count = entry.id === 'all' ? items.length : items.filter((item) => item.category === entry.id).length;
              const selected = category === entry.id;
              return <button key={entry.id} type="button" role="tab" aria-selected={selected} onClick={() => setCategory(entry.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${selected ? 'border-green-700 bg-green-700 text-white shadow-sm' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] hover:border-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]'}`}>
                {entry.name}<span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${selected ? 'bg-white/20 text-white' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)]'}`}>{count}</span>
              </button>;
            })}
          </div>
        </div>

        {loading ? <Loading /> : filteredItems.length === 0 ? <section className="admin-card p-10 text-center text-sm text-[var(--oppa-text-muted)]">{items.length ? 'No products match your search or category.' : 'No products are available for this branch yet.'}</section> : (
          <div className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="admin-table products-table w-full min-w-[780px] table-fixed text-sm">
                <thead><tr>
                  <th className="w-[48%] px-4 py-3 text-left font-semibold">Item</th>
                  <th className="w-[24%] px-4 py-3 text-left font-semibold">Category</th>
                  <th className="w-[12%] px-4 py-3 text-right font-semibold">Price</th>
                  <th className="w-[16%] px-4 py-3 text-left font-semibold">Availability</th>
                </tr></thead>
                <tbody>
                  {filteredItems.map((item) => <tr key={item.id} className="border-b border-[var(--oppa-border)]/60 last:border-0 transition hover:bg-[var(--oppa-cream)]/50">
                    <td className="px-4 py-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumbnail src={item.image} name={item.name} className="size-10" />
                        <div className="min-w-0"><p className="truncate font-medium text-[var(--oppa-text)]">{item.name}</p><p className="truncate text-xs text-[var(--oppa-text-muted)]">{item.description || 'Catalog details are read-only'}</p></div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="inline-block max-w-full truncate rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 text-xs font-medium text-[var(--oppa-text)]">{getCategoryLabel(item.category)}</span></td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--oppa-text)]">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-3"><div className="inline-flex items-center gap-2 whitespace-nowrap text-xs text-[var(--oppa-text-muted)]"><AvailabilitySwitch checked={Boolean(item.branch_available)} label={`Change branch availability for ${item.name}`} activeText="Available" inactiveText="Unavailable" disabled={pendingIds.includes(item.id)} onChange={() => void toggleAvailability(item)} /><span>{item.branch_available ? 'Available' : 'Unavailable'}</span></div></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--oppa-border)] px-4 py-3 text-xs text-[var(--oppa-text-muted)]">Showing {filteredItems.length} of {items.length} products · Changes apply to {franchiseUser?.branch?.name || franchiseUser?.franchise?.name || 'this branch'} only.</div>
          </div>
        )}
      </div>
    </main>
  );
};

export const DiscountRequestsPage: React.FC = () => <Shell eyebrow="Business · Branch only" title="Discount Requests" description="Submit a request for main-branch review. Approval decisions are never made in the franchise portal." icon={FileText}><Card title="Request a discount"><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}><label className="text-sm sm:col-span-2">Reason<input required placeholder="Describe the customer or order context" className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5" /></label><label className="text-sm">Order reference<input placeholder="Optional order number" className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5" /></label><label className="text-sm">Requested amount<input placeholder="Enter amount" inputMode="decimal" className="mt-1 w-full rounded-xl border border-[var(--oppa-border)] px-3 py-2.5" /></label><button className="rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2">Submit request</button></form></Card><div className="mt-4"><Card title="Request history"><AsyncEmpty message="No discount requests have been submitted for this branch." /></Card></div></Shell>;
export const FeesPaymentsPage: React.FC = () => <Shell eyebrow="Business · Owner access" title="Fees & Payments" description="Review agreement-defined fees and branch payment history. Amounts appear when the agreement data is available." icon={WalletCards}><Card title="Agreement fees"><AsyncEmpty message="Fee details are not configured for this branch yet. Contact the franchise team for an editable agreement summary." /></Card></Shell>;
export const AnnouncementsPage: React.FC = () => <Shell eyebrow="Communication · Read only" title="Announcements" description="Updates published by the main branch for franchise teams." icon={Megaphone}><Card title="Branch updates"><AsyncEmpty message="No announcements are available right now." /></Card></Shell>;
export const SupportResourcesPage: React.FC = () => <Shell eyebrow="Communication" title="Support & Resources" description="Find your franchise team contact, training materials, operating manuals, and frequently asked questions." icon={CircleHelp}><div className="grid gap-4 md:grid-cols-3"><Card title="Franchise team"><AsyncEmpty message="Contact details will appear when your support profile is configured." /></Card><Card title="Training materials"><AsyncEmpty message="No training materials have been published yet." /></Card><Card title="FAQ & manuals"><AsyncEmpty message="Resources will appear here when available." /></Card></div></Shell>;
export const FranchiseDeliveryPage: React.FC = () => <Shell eyebrow="Operations · Branch only" title="Delivery" description="Manage delivery activity for this branch when delivery is enabled in the branch agreement." icon={ReceiptText}><Card title="Delivery activity"><AsyncEmpty message="Delivery is not enabled or there is no delivery activity for this branch yet." /></Card></Shell>;

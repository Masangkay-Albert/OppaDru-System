import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, PackageCheck, PackageX, Search, TriangleAlert } from 'lucide-react';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { formatCurrency } from '../../../utils/formatters';
import StatCard from '../../admin-side/components/StatCard';
import { PageHeader } from '../../admin-side/components/AdminUI';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  price: number | string;
  image?: string;
  franchise_id?: string | null;
  branch_stock: number | null;
  branch_stock_tracked: boolean;
  branch_enabled: boolean;
  branch_available: boolean;
  low_stock: boolean;
}

type InventoryFilter = 'all' | 'available' | 'low' | 'out' | 'unavailable';

const FranchiseInventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const [stockEdits, setStockEdits] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadInventory = useCallback(async () => {
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/inventory`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch inventory.');
      setItems(Array.isArray(payload.data?.items) ? payload.data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.name === 'TimeoutError'
        ? 'Inventory is taking too long to load. Please retry.'
        : loadError instanceof Error ? loadError.message : 'Could not load branch inventory.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadInventory);
  }, [loadInventory]);

  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.name} ${item.category}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || item.category === category;
    const matchesFilter = filter === 'all'
      || (filter === 'available' && item.branch_available)
      || (filter === 'low' && item.low_stock)
      || (filter === 'out' && item.branch_stock_tracked && item.branch_stock === 0)
      || (filter === 'unavailable' && !item.branch_enabled);
    return matchesSearch && matchesCategory && matchesFilter;
  }), [items, search, category, filter]);

  const saveInventory = async (item: InventoryItem, values: { stock_quantity?: number | null; is_available?: boolean }) => {
    setBusyId(item.id);
    setError('');
    setMessage('');
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/inventory/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not update this branch inventory item.');
      setMessage(`${item.name} inventory updated.`);
      await loadInventory();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update inventory.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader title="Inventory" subtitle="Manage branch stock and availability without changing the shared catalog." />

        {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button onClick={() => { setError(''); setIsLoading(true); void loadInventory(); }} className="font-semibold underline">Retry</button></div>}
        {message && <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        {!isLoading && items.length > 0 && <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Boxes} label="Products tracked" value={items.length} />
          <StatCard icon={PackageCheck} label="Available" value={items.filter((item) => item.branch_available).length} />
          <StatCard icon={TriangleAlert} label="Low stock" value={items.filter((item) => item.low_stock).length} accent="amber" />
          <StatCard icon={PackageX} label="Out of stock" value={items.filter((item) => item.branch_stock_tracked && item.branch_stock === 0).length} accent="red" />
        </section>}
        {isLoading ? <p className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)]">Loading branch inventory...</p> : items.length === 0 ? (
          <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-10 text-center text-sm text-[var(--oppa-text-muted)]">No inventory data available yet.</section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
            <div className="border-b border-[var(--oppa-border)] px-4 py-4 sm:px-5"><h2 className="font-semibold text-[var(--oppa-text)]">Stock and availability</h2><p className="mt-1 text-xs text-gray-500">Set a quantity to start branch-level stock tracking.</p></div>
            <div className="grid gap-3 border-b border-[var(--oppa-border)] p-4 md:grid-cols-[1fr_220px_200px]">
              <label className="franchise-search-field relative flex h-11 items-center rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)]"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inventory" className="admin-embedded-input w-full py-2.5 pl-10 pr-3 text-sm" /></label>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="all">All categories</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}</select>
              <select value={filter} onChange={(event) => setFilter(event.target.value as InventoryFilter)} className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm"><option value="all">All availability</option><option value="available">Available</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="unavailable">Unavailable</option></select>
            </div>
            {filteredItems.length === 0 ? <p className="p-8 text-center text-sm text-[var(--oppa-text-muted)]">No products match these filters.</p> : (
              <div className="overflow-x-auto">
                <table className="admin-table w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-[#edf5ef] text-xs uppercase text-[var(--oppa-text-muted)]"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Branch stock</th><th className="px-4 py-3">Availability</th><th className="px-4 py-3">Price</th><th className="px-4 py-3">Update</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[var(--oppa-cream)]">{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <Boxes size={17} className="text-[var(--oppa-green)]" />}</div><span><span className="block font-semibold">{item.name}</span><span className="block text-xs text-gray-500">{item.franchise_id ? 'Branch product' : 'Shared product'}</span></span></div></td>
                        <td className="px-4 py-3">{item.category}</td>
                        <td className="px-4 py-3">
                          <input type="number" min="0" value={stockEdits[item.id] ?? (item.branch_stock_tracked ? String(item.branch_stock ?? 0) : '')} onChange={(event) => setStockEdits((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Not tracked" className="w-28 rounded-lg border border-gray-200 px-2 py-1.5" aria-label={`Stock quantity for ${item.name}`} />
                          {item.low_stock && <span className="ml-2 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">Low</span>}
                          {item.branch_stock_tracked && item.branch_stock === 0 && <span className="ml-2 rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">Out</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button disabled={busyId === item.id} onClick={() => void saveInventory(item, { is_available: !item.branch_enabled })} className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${item.branch_available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                            {item.branch_enabled ? 'Available' : 'Unavailable'}
                          </button>
                        </td>
                        <td className="px-4 py-3">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3">
                          <button disabled={busyId === item.id || !/^\d+$/.test(stockEdits[item.id] ?? (item.branch_stock_tracked ? String(item.branch_stock ?? '') : ''))} onClick={() => void saveInventory(item, { stock_quantity: Number(stockEdits[item.id] ?? item.branch_stock) })} className="rounded-lg bg-[var(--oppa-green)] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Save stock</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
};

export default FranchiseInventoryPage;

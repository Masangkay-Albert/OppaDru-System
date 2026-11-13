import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, PackageCheck, PackageX, TriangleAlert } from 'lucide-react';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import {
  adjustBranchIngredient,
  getBranchIngredientInventory,
  receiveBranchTransfer,
  submitRestockRequest,
} from '../../../services/franchiseIngredientInventoryService';
import type {
  BranchIngredientInventory,
  BranchIngredient,
} from '../../../services/franchiseIngredientInventoryService';
import { formatCurrency } from '../../../utils/formatters';
import { formatInventoryQuantity } from '../../../utils/inventoryFormatters';
import StatCard from '../../admin-side/components/StatCard';
import { PageHeader } from '../../admin-side/components/AdminUI';
import Select from '../../../components/ui/Select';
import SearchInput from '../../../components/ui/SearchInput';
import { ValidatedForm } from '../../../components/ui/FormValidation';

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
type InventoryTab = 'products' | 'ingredients';

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
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>('products');
  const [ingredientInventory, setIngredientInventory] = useState<BranchIngredientInventory | null>(null);
  const [ingredientEdit, setIngredientEdit] = useState<Record<number, { type: 'stock_in' | 'stock_out' | 'waste' | 'adjustment'; quantity: string; reason: string }>>({});
  const [restockIngredient, setRestockIngredient] = useState('');
  const [restockQuantity, setRestockQuantity] = useState('');
  const [restockNotes, setRestockNotes] = useState('');

  const loadInventory = useCallback(async () => {
    try {
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/inventory`, {
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not load branch inventory.');
      setItems(Array.isArray(payload.data?.items) ? payload.data.items : []);
      const ingredients = await getBranchIngredientInventory();
      setIngredientInventory(ingredients);
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

  const saveIngredientMovement = async (ingredient: BranchIngredient) => {
    const values = ingredientEdit[ingredient.id] || { type: 'stock_in' as const, quantity: '', reason: '' };
    setBusyId(`ingredient-${ingredient.id}`);
    setError('');
    setMessage('');
    try {
      await adjustBranchIngredient(ingredient.id, {
        type: values.type,
        quantity: Number(values.quantity),
        reason: values.reason.trim(),
      });
      setMessage(`${ingredient.name} stock updated and recorded.`);
      await loadInventory();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update ingredient stock.');
    } finally {
      setBusyId(null);
    }
  };

  const requestRestock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      await submitRestockRequest({
        items: [{ ingredient_id: Number(restockIngredient), quantity: Number(restockQuantity) }],
        notes: restockNotes.trim(),
      });
      setRestockQuantity('');
      setRestockNotes('');
      setMessage('Restock request sent to the main branch.');
      await loadInventory();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not submit restock request.');
    }
  };

  const confirmTransfer = async (transferId: number) => {
    setError('');
    try {
      await receiveBranchTransfer(transferId);
      setMessage('Stock transfer marked as received.');
      await loadInventory();
    } catch (receiveError) {
      setError(receiveError instanceof Error ? receiveError.message : 'Could not confirm stock transfer.');
    }
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <PageHeader title="Inventory" subtitle="Manage branch stock and availability without changing the shared catalog." />

        <div role="tablist" aria-label="Inventory type" className="flex gap-2">
          <button type="button" role="tab" aria-selected={inventoryTab === 'products'} onClick={() => setInventoryTab('products')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${inventoryTab === 'products' ? 'bg-[var(--oppa-green)] text-white' : 'border border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)]'}`}>Product stock</button>
          <button type="button" role="tab" aria-selected={inventoryTab === 'ingredients'} onClick={() => setInventoryTab('ingredients')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${inventoryTab === 'ingredients' ? 'bg-[var(--oppa-green)] text-white' : 'border border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)]'}`}>Ingredient stock</button>
        </div>

        {error && <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button onClick={() => { setError(''); setIsLoading(true); void loadInventory(); }} className="font-semibold underline">Retry</button></div>}
        {message && <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</p>}
        {inventoryTab === 'products' && !isLoading && items.length > 0 && <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Boxes} label="Products tracked" value={items.length} />
          <StatCard icon={PackageCheck} label="Available" value={items.filter((item) => item.branch_available).length} />
          <StatCard icon={TriangleAlert} label="Low stock" value={items.filter((item) => item.low_stock).length} accent="amber" />
          <StatCard icon={PackageX} label="Out of stock" value={items.filter((item) => item.branch_stock_tracked && item.branch_stock === 0).length} accent="red" />
        </section>}
        {inventoryTab === 'ingredients' ? (
          <div className="space-y-4">
            {ingredientInventory?.expiring_soon.length ? <section role="alert" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950"><strong>{ingredientInventory.expiring_soon.length} ingredient batch{ingredientInventory.expiring_soon.length === 1 ? '' : 'es'} expiring soon:</strong> {ingredientInventory.expiring_soon.slice(0, 4).map((batch) => `${batch.ingredient.name} by ${batch.expires_at}`).join(', ')}</section> : null}
            <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-sm">
              <div className="border-b border-[var(--oppa-border)] px-4 py-4"><h2 className="font-semibold text-[var(--oppa-text)]">Branch ingredient stock</h2><p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Ingredient stock is separate from product-level franchise inventory.</p></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-[var(--oppa-green-soft)]/70 text-xs uppercase text-[var(--oppa-text-muted)]"><tr>{['Ingredient', 'On hand', 'Reorder', 'Status', 'Movement', 'Quantity', 'Reason', ''].map((title) => <th key={title} className="px-3 py-3">{title}</th>)}</tr></thead><tbody className="divide-y divide-[var(--oppa-border)]">
                {(ingredientInventory?.ingredients || []).map((ingredient) => {
                  const edit = ingredientEdit[ingredient.id] || { type: 'stock_in' as const, quantity: '', reason: '' };
                  return <tr key={ingredient.id}>
                    <td className="px-3 py-3"><strong>{ingredient.name}</strong><span className="block text-xs text-[var(--oppa-text-muted)]">{ingredient.category}</span></td>
                    <td className="px-3 py-3">{formatInventoryQuantity(ingredient.quantity, ingredient.unit)}</td>
                    <td className="px-3 py-3">{formatInventoryQuantity(ingredient.reorder_level, ingredient.unit)}</td>
                    <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${ingredient.status === 'out_of_stock' ? 'bg-red-100 text-red-800' : ingredient.status === 'low_stock' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>{ingredient.status.replaceAll('_', ' ')}</span></td>
                    <td className="px-3 py-3"><select aria-label={`Movement for ${ingredient.name}`} value={edit.type} onChange={(event) => setIngredientEdit((current) => ({ ...current, [ingredient.id]: { ...edit, type: event.target.value as typeof edit.type } }))} className="h-9 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2"><option value="stock_in">Stock in</option><option value="stock_out">Stock out</option><option value="adjustment">Adjust total</option><option value="waste">Waste</option></select></td>
                    <td className="px-3 py-3"><input type="number" data-min="0" step="0.001" value={edit.quantity} onChange={(event) => setIngredientEdit((current) => ({ ...current, [ingredient.id]: { ...edit, quantity: event.target.value } }))} className="h-9 w-28 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2" aria-label={`Quantity for ${ingredient.name}`} /></td>
                    <td className="px-3 py-3"><input value={edit.reason} onChange={(event) => setIngredientEdit((current) => ({ ...current, [ingredient.id]: { ...edit, reason: event.target.value } }))} className="h-9 w-40 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2" aria-label={`Reason for ${ingredient.name}`} /></td>
                    <td className="px-3 py-3"><button type="button" disabled={busyId === `ingredient-${ingredient.id}` || !edit.quantity} onClick={() => void saveIngredientMovement(ingredient)} className="rounded-lg bg-[var(--oppa-green)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busyId === `ingredient-${ingredient.id}` ? 'Saving…' : 'Save'}</button></td>
                  </tr>;
                })}
                </tbody></table></div>
            </section>
            <div className="grid gap-4 lg:grid-cols-2">
              <ValidatedForm onSubmit={(event) => { void requestRestock(event); }} className="space-y-3 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4">
                <h3 className="font-semibold text-[var(--oppa-text)]">Request stock from main branch</h3>
                <select data-required="true" value={restockIngredient} onChange={(event) => setRestockIngredient(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm"><option value="">Select ingredient</option>{ingredientInventory?.ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}</select>
                <input data-required="true" type="number" data-min="0.001" step="0.001" value={restockQuantity} onChange={(event) => setRestockQuantity(event.target.value)} placeholder="Requested quantity" className="h-10 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm" />
                <textarea value={restockNotes} onChange={(event) => setRestockNotes(event.target.value)} maxLength={2000} placeholder="Notes (optional)" className="w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 text-sm" />
                <button type="submit" className="rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white">Submit request</button>
              </ValidatedForm>
              <section className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4">
                <h3 className="font-semibold text-[var(--oppa-text)]">Restock requests and transfers</h3>
                <ul className="mt-3 space-y-3 text-sm">{ingredientInventory?.restock_requests.map((request) => <li key={`request-${request.id}`} className="border-b border-[var(--oppa-border)] pb-2"><strong>Request #{request.id}</strong> · {request.status}<p className="text-xs text-[var(--oppa-text-muted)]">{request.items.map((item) => `${item.ingredient.name} × ${formatInventoryQuantity(item.requested_quantity, item.ingredient.unit)}`).join(', ')}</p></li>)}
                  {ingredientInventory?.transfers.map((transfer) => <li key={`transfer-${transfer.id}`} className="flex items-center justify-between gap-2 border-b border-[var(--oppa-border)] pb-2"><span><strong>{transfer.reference}</strong> · {transfer.status}<span className="block text-xs text-[var(--oppa-text-muted)]">{transfer.items.map((item) => `${item.ingredient.name} × ${formatInventoryQuantity(item.quantity, item.ingredient.unit)}`).join(', ')}</span></span>{transfer.status === 'dispatched' && <button type="button" onClick={() => void confirmTransfer(transfer.id)} className="rounded-lg border border-[var(--oppa-border)] px-3 py-1.5 text-xs font-semibold">Confirm receipt</button>}</li>)}</ul>
              </section>
            </div>
          </div>
        ) : isLoading ? <p className="rounded-2xl border border-[var(--oppa-border)] bg-white p-8 text-center text-sm text-[var(--oppa-text-muted)]">Loading branch inventory...</p> : items.length === 0 ? (
          <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-10 text-center text-sm text-[var(--oppa-text-muted)]">No inventory data available yet.</section>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm">
            <div className="border-b border-[var(--oppa-border)] px-4 py-4 sm:px-5"><h2 className="font-semibold text-[var(--oppa-text)]">Stock and availability</h2><p className="mt-1 text-xs text-gray-500">Set a quantity to start branch-level stock tracking.</p></div>
            <div className="grid gap-3 border-b border-[var(--oppa-border)] p-4 md:grid-cols-[1fr_220px_200px]">
              <SearchInput aria-label="Search inventory" value={search} onChange={setSearch} placeholder="Search inventory" />
              <Select<string> aria-label="Filter inventory by category" value={category} onChange={setCategory} options={[{ value: 'all', label: 'All categories' }, ...categories.map((value) => ({ value, label: value }))]} />
              <Select aria-label="Filter inventory by availability" value={filter} onChange={(value) => setFilter(value as InventoryFilter)} options={[{ value: 'all', label: 'All availability' }, { value: 'available', label: 'Available' }, { value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }, { value: 'unavailable', label: 'Unavailable' }]} />
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
                          <input type="number" data-min="0" value={stockEdits[item.id] ?? (item.branch_stock_tracked ? String(item.branch_stock ?? 0) : '')} onChange={(event) => setStockEdits((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Not tracked" className="w-28 rounded-lg border border-gray-200 px-2 py-1.5" aria-label={`Stock quantity for ${item.name}`} />
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

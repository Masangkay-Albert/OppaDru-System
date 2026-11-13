import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, History } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { AdminDate, EmptyState } from '../components/AdminUI';
import Select from '../../../components/ui/Select';
import { getMainBranchInventory, getStockMovements } from '../../../services/mainBranchInventoryService';
import type { MainBranchStockMovement } from '../../../services/mainBranchInventoryService';

const TYPES = [
  { value: 'all', label: 'All movement types' },
  { value: 'stock_in', label: 'Stock in' },
  { value: 'stock_out', label: 'Stock out' },
  { value: 'order_usage', label: 'Order usage' },
  { value: 'waste', label: 'Waste / spoilage' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'count_adjustment', label: 'Stock count variance' },
  { value: 'opening_stock', label: 'Opening stock' },
];

const movementLabel = (type: MainBranchStockMovement['type']) => TYPES.find((item) => item.value === type)?.label || type;

const amountLabel = (amount: number | string, unit: string) => {
  const parsed = Number(amount);
  return `${parsed > 0 ? '+' : ''}${parsed.toLocaleString('en-PH', { maximumFractionDigits: 3 })} ${unit}`;
};

const quantityLabel = (amount: number | string, unit: string) =>
  `${Number(amount).toLocaleString('en-PH', { maximumFractionDigits: 3 })} ${unit}`;

const AdminInventoryHistoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [ingredients, setIngredients] = useState<Array<{ id: number; name: string }>>([]);
  const [movements, setMovements] = useState<MainBranchStockMovement[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ingredientId = searchParams.get('ingredient_id') || '';
  const type = searchParams.get('type') || 'all';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  useEffect(() => {
    let active = true;
    void getMainBranchInventory()
      .then((result) => {
        if (active) setIngredients(result.all_ingredients || result.ingredients);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load ingredient names.');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadMovements = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await getStockMovements({
          ingredient_id: ingredientId,
          type: type === 'all' ? '' : type,
          from,
          to,
          page,
        });
        if (!active) return;
        setMovements(result.data);
        setPageCount(result.last_page);
        setTotal(result.total);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load stock movement history.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadMovements();
    return () => { active = false; };
  }, [ingredientId, type, from, to, page]);

  const ingredientOptions = useMemo(() => [
    { value: '', label: 'All ingredients' },
    ...ingredients.map((item) => ({ value: String(item.id), label: item.name })),
  ], [ingredients]);
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setPage(1);
    setSearchParams(next, { replace: true });
  };
  const clearFilters = () => {
    setPage(1);
    setSearchParams({}, { replace: true });
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <Link to="/admin/inventory" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--oppa-green)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"><ArrowLeft size={16} /> Back to Inventory</Link>
        <header>
          <h1 className="font-serif text-3xl font-bold leading-tight text-[var(--oppa-text)] sm:text-4xl">Stock movement history</h1>
          <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Review every recorded change to main branch stock.</p>
        </header>

        <section aria-label="Filter stock movement history" className="admin-card grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="sr-only" htmlFor="history-ingredient">Filter by ingredient</label>
          <Select<string> id="history-ingredient" aria-label="Filter by ingredient" value={ingredientId} onChange={(value) => setFilter('ingredient_id', value)} options={ingredientOptions} />
          <label className="sr-only" htmlFor="history-type">Filter by movement type</label>
          <Select<string> id="history-type" aria-label="Filter by movement type" value={type} onChange={(value) => setFilter('type', value)} options={[{ value: 'all', label: 'All movement types' }, ...TYPES.filter((item) => item.value !== 'all')]} />
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--oppa-text-muted)]">From<input aria-label="From date" type="date" value={from} max={to || undefined} onChange={(event) => setFilter('from', event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2 text-sm text-[var(--oppa-text)] focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20" /></label>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--oppa-text-muted)]">To<input aria-label="To date" type="date" value={to} min={from || undefined} onChange={(event) => setFilter('to', event.target.value)} className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2 text-sm text-[var(--oppa-text)] focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20" /></label>
          {(ingredientId || type !== 'all' || from || to) && <button type="button" onClick={clearFilters} className="text-left text-sm font-semibold text-[var(--oppa-green)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)] xl:col-span-4">Clear filters</button>}
        </section>

        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <section className="admin-card overflow-hidden">
          {loading ? <div role="status" aria-busy="true" className="p-8 text-center text-sm text-[var(--oppa-text-muted)]">Loading stock activity…</div>
            : movements.length === 0 ? <EmptyState title="No stock activity found" description="Stock movements that match your filters will appear here." icon={<History size={22} />} />
              : <div className="overflow-x-auto"><table className="admin-table w-full min-w-[900px] text-left text-sm"><caption className="sr-only">Stock movement history</caption><thead className="bg-[var(--oppa-green-soft)]/70 text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]"><tr>{['Ingredient', 'Movement', 'Change', 'Before', 'After', 'Reason', 'Performed by', 'Date'].map((heading) => <th key={heading} scope="col" className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-[var(--oppa-border)]">{movements.map((movement) => <tr key={movement.id} className="hover:bg-[var(--oppa-cream)]/60"><td className="px-4 py-3 font-semibold">{movement.ingredient?.name || movement.ingredient_name}</td><td className="px-4 py-3">{movementLabel(movement.type)}</td><td className={`px-4 py-3 font-semibold ${Number(movement.quantity_change) < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{amountLabel(movement.quantity_change, movement.unit)}</td><td className="px-4 py-3">{quantityLabel(movement.quantity_before, movement.unit)}</td><td className="px-4 py-3">{quantityLabel(movement.quantity_after, movement.unit)}</td><td className="max-w-52 truncate px-4 py-3" title={movement.reason || undefined}>{movement.reason || '—'}</td><td className="px-4 py-3">{movement.performed_by}</td><td className="px-4 py-3"><AdminDate value={movement.occurred_at || movement.created_at} /></td></tr>)}</tbody></table></div>}
          {!loading && total > 0 && <div className="flex flex-col gap-3 border-t border-[var(--oppa-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-[var(--oppa-text-muted)]">{total} stock movement{total === 1 ? '' : 's'}</p><nav aria-label="Stock history pages" className="flex items-center gap-2"><button type="button" aria-label="Previous history page" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[var(--oppa-border)] p-2 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"><ArrowLeft size={15} /></button><span aria-live="polite" className="text-xs tabular-nums text-[var(--oppa-text-muted)]">Page {page} of {pageCount}</span><button type="button" aria-label="Next history page" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[var(--oppa-border)] p-2 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"><ArrowRight size={15} /></button></nav></div>}
        </section>
      </div>
    </AdminLayout>
  );
};

export default AdminInventoryHistoryPage;

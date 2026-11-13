import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getBranchIngredientHistory, getBranchIngredientInventory } from '../../../services/franchiseIngredientInventoryService';
import type { BranchIngredientInventory, BranchIngredientMovement } from '../../../services/franchiseIngredientInventoryService';
import { PageHeader } from '../../admin-side/components/AdminUI';
import { formatInventoryQuantity } from '../../../utils/inventoryFormatters';
import { formatPeso, formatUnitPrice } from '../../../utils/formatters';

const movementLabels: Record<BranchIngredientMovement['type'], string> = {
  stock_in: 'Added',
  stock_out: 'Used',
  order_usage: 'Used for an order',
  waste: 'Wasted',
  adjustment: 'Stock corrected',
  count_adjustment: 'Stock counted',
  opening_stock: 'Starting stock',
};

const FranchiseIngredientInventoryHistoryPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [inventory, setInventory] = useState<BranchIngredientInventory | null>(null);
  const [movements, setMovements] = useState<BranchIngredientMovement[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [ingredientId, setIngredientId] = useState(searchParams.get('ingredient_id') || '');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void getBranchIngredientInventory().then(setInventory).catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Could not load ingredient list.');
    });
  }, []);

  useEffect(() => {
    let active = true;
    void getBranchIngredientHistory({
      page,
      ingredient_id: ingredientId ? Number(ingredientId) : undefined,
      type: type ? type as BranchIngredientMovement['type'] : undefined,
    }).then((result) => {
      if (!active) return;
      setMovements(result.data);
      setLastPage(result.last_page);
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load stock history.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [page, ingredientId, type]);

  const selectIngredient = (value: string) => {
    setLoading(true);
    setError('');
    setIngredientId(value);
    setPage(1);
    setSearchParams(value ? { ingredient_id: value } : {});
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1200px] space-y-4">
        <PageHeader title="Stock history" subtitle="Every ingredient stock change for this branch." actions={<Link to="/franchise/inventory/ingredients" className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 py-3 text-sm font-semibold text-[var(--oppa-text)]">Back to ingredients</Link>} />
        <section className="admin-card grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[var(--oppa-text)]">Ingredient
            <select value={ingredientId} onChange={(event) => selectIngredient(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm">
              <option value="">All ingredients</option>
              {(inventory?.ingredients || []).map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-[var(--oppa-text)]">Change
            <select value={type} onChange={(event) => { setLoading(true); setError(''); setType(event.target.value); setPage(1); }} className="mt-1 h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm">
              <option value="">All changes</option>
              {Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </section>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <section className="admin-card overflow-hidden">
          {loading ? <p role="status" className="p-8 text-center text-sm text-[var(--oppa-text-muted)]">Loading stock history…</p> : movements.length === 0 ? <p className="p-8 text-center text-sm text-[var(--oppa-text-muted)]">No stock changes found.</p> : <ul className="divide-y divide-[var(--oppa-border)]">
            {movements.map((movement) => {
              const quantity = Number(movement.quantity_change);
              const date = movement.occurred_at || movement.created_at;
              return <li key={movement.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-sm text-[var(--oppa-text)]"><strong>{movementLabels[movement.type]} {movement.ingredient_name}</strong><span className={`ml-2 font-semibold tabular-nums ${quantity < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{movement.purchase_quantity !== null && movement.purchase_quantity !== undefined ? formatInventoryQuantity(movement.purchase_quantity, movement.purchase_unit || movement.unit) : `${quantity > 0 ? '+' : ''}${formatInventoryQuantity(quantity, movement.unit)}`}</span></p>
                {['stock_in', 'opening_stock'].includes(movement.type) && quantity > 0 && <p className="text-sm font-semibold text-[var(--oppa-text)]">
                  {/transfer/i.test(movement.reason || '') ? 'Transfer value' : 'Total price paid'}{' '}
                  {movement.total_cost !== null && movement.total_cost !== undefined
                    ? formatPeso(movement.total_cost)
                    : movement.unit_cost !== null && movement.unit_cost !== undefined
                      ? formatPeso(Number(movement.quantity) * Number(movement.unit_cost))
                      : 'Price not recorded'} total paid
                  <span className="ml-2 text-xs font-normal text-[var(--oppa-text-muted)]">
                    {movement.unit_cost === null || movement.unit_cost === undefined ? 'Unit price not recorded' : `${formatUnitPrice(movement.unit_cost)} each`}
                    {' · '}{/transfer/i.test(movement.reason || '') ? 'Stock transfer' : movement.supplier?.name || 'No supplier'} · Invoice {movement.invoice_reference || '—'}
                  </span>
                </p>}
                <p className="flex flex-wrap gap-x-3 text-xs text-[var(--oppa-text-muted)]"><span>{movement.performed_by}</span><time dateTime={date}>{new Date(date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</time></p>
              </li>;
            })}
          </ul>}
          {lastPage > 1 && <footer className="flex items-center justify-between border-t border-[var(--oppa-border)] p-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="min-h-10 rounded-lg border border-[var(--oppa-border)] px-3 text-sm disabled:opacity-40">Previous</button>
            <span aria-live="polite" className="text-sm text-[var(--oppa-text-muted)]">Page {page} of {lastPage}</span>
            <button type="button" disabled={page >= lastPage} onClick={() => setPage((current) => current + 1)} className="min-h-10 rounded-lg border border-[var(--oppa-border)] px-3 text-sm disabled:opacity-40">Next</button>
          </footer>}
        </section>
      </div>
    </main>
  );
};

export default FranchiseIngredientInventoryHistoryPage;

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Boxes, ChevronDown, ChevronUp, History, MoreHorizontal, Plus, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchInput from '../../../components/ui/SearchInput';
import { AdminDate, EmptyState, RowActionsMenu } from '../../admin-side/components/AdminUI';
import { formatPeso, formatUnitPrice } from '../../../utils/formatters';
import { formatInventoryQuantity } from '../../../utils/inventoryFormatters';
import type { StockMovementType } from '../../../services/mainBranchInventoryService';

export type InventoryStatusFilter = 'all' | 'low_stock' | 'out_of_stock' | 'attention';

export interface InventoryIngredient {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: number | string;
  usable_quantity?: number | string;
  reorder_level: number | string;
  unit_cost: number | string | null;
  average_unit_cost?: number | string | null;
  stock_value?: number | string | null;
  inventory_value?: number | string | null;
  purchase_history?: InventoryPurchase[];
  supplier?: string | null;
  supplier_id?: number | null;
  purchase_unit?: string | null;
  conversion_factor?: number | string;
  supplier_relation?: { name: string } | null;
  notes?: string | null;
  updated_at?: string | null;
  status?: 'in_stock' | 'low_stock' | 'out_of_stock';
}

interface InventoryMovement {
  id: number;
  type: StockMovementType;
  ingredient_name: string;
  ingredient?: { name: string } | null;
  unit: string;
  quantity_change: number | string;
  performed_by: string;
  occurred_at: string | null;
  created_at: string;
  quantity?: number | string;
  purchase_quantity?: number | string | null;
  purchase_unit?: string | null;
  total_cost?: number | string | null;
  unit_cost?: number | string | null;
  supplier?: { id: number; name: string } | null;
  invoice_reference?: string | null;
}

interface InventoryPurchase {
  id: number;
  type: StockMovementType;
  quantity: number | string;
  purchase_quantity?: number | string | null;
  purchase_unit?: string | null;
  unit: string;
  total_cost?: number | string | null;
  unit_cost?: number | string | null;
  occurred_at: string | null;
  created_at: string;
  supplier?: { name: string } | null;
  invoice_reference?: string | null;
  performed_by: string;
}

interface InventorySummaryData {
  total: number;
  low_stock: number;
  out_of_stock: number;
  needs_restocking: number;
  stock_value: number | string;
}

const statusFor = (ingredient: InventoryIngredient): 'out_of_stock' | 'low_stock' | 'in_stock' => {
  const quantity = Number(ingredient.usable_quantity ?? ingredient.quantity);
  if (quantity <= 0) return 'out_of_stock';
  return quantity <= Number(ingredient.reorder_level) ? 'low_stock' : 'in_stock';
};

const movementCopy: Record<StockMovementType, string> = {
  stock_in: 'Added',
  stock_out: 'Used',
  order_usage: 'Used',
  waste: 'Wasted',
  adjustment: 'Stock corrected',
  count_adjustment: 'Stock corrected',
  opening_stock: 'Starting stock',
};

const friendlyDate = (value: string | null) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const time = date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  });
  const dateKey = (source: Date) => source.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const today = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (dateKey(date) === dateKey(today)) return `Today, ${time}`;
  if (dateKey(date) === dateKey(yesterday)) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}, ${time}`;
};

const eachPrice = (value: number | string | null | undefined, showPrecision = false) => {
  if (value === null || value === undefined) return null;
  if (!showPrecision) return `₱${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
  return formatUnitPrice(value);
};

const IngredientStatus: React.FC<{ ingredient: InventoryIngredient }> = ({ ingredient }) => {
  const status = statusFor(ingredient);
  const label = status === 'out_of_stock' ? 'Out' : status === 'low_stock' ? 'Low' : 'OK';
  const color = status === 'out_of_stock'
    ? 'bg-red-600'
    : status === 'low_stock'
      ? 'bg-amber-500'
      : 'bg-emerald-600';
  const text = status === 'out_of_stock'
    ? 'text-red-700 dark:text-red-300'
    : status === 'low_stock'
      ? 'text-amber-800 dark:text-amber-200'
      : 'text-emerald-800 dark:text-emerald-200';

  return <span className={`inline-flex items-center gap-2 font-semibold ${text}`}><span aria-hidden="true" className={`size-2 rounded-full ${color}`} />{label}</span>;
};

export interface InventoryMenuAction {
  label: string;
  onSelect: () => void;
}

interface InventoryMoreMenuProps {
  actions: InventoryMenuAction[];
}

export const InventoryMoreMenu: React.FC<InventoryMoreMenuProps> = ({ actions }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') || []);
    items()[0]?.focus();
    const dismiss = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [open]);

  const select = (action: () => void) => {
    setOpen(false);
    action();
  };
  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      const focusable = Array.from(document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !menuRef.current?.contains(element)
        && element.getClientRects().length > 0);
      const triggerIndex = triggerRef.current ? focusable.indexOf(triggerRef.current) : -1;
      const next = focusable[triggerIndex + (event.shiftKey ? -1 : 1)];
      setOpen(false);
      (next || triggerRef.current)?.focus();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex < 0
        ? direction > 0 ? 0 : items.length - 1
        : (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
      >
        More <MoreHorizontal size={17} aria-hidden="true" />
      </button>
      {open && <div ref={menuRef} role="menu" aria-label="More inventory actions" onKeyDown={handleMenuKeyDown} className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-1.5 shadow-xl">
        {actions.map((action) => <button key={action.label} role="menuitem" type="button" onClick={() => select(action.onSelect)} className="block min-h-10 w-full rounded-lg px-3 text-left text-sm text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">{action.label}</button>)}
      </div>}
    </div>
  );
};

export const InventorySummaryCards: React.FC<{
  summary: InventorySummaryData;
  loading: boolean;
  needsRestockingSelected: boolean;
  onNeedsRestocking: () => void;
}> = ({ summary, loading, needsRestockingSelected, onNeedsRestocking }) => (
  <section aria-label="Inventory summary" className="grid gap-3 sm:grid-cols-2">
    <article className="admin-card flex min-h-28 items-center justify-between p-4 sm:p-5">
      <div>
        <p className="text-2xl font-bold tabular-nums text-[var(--oppa-text)]">{loading ? '—' : summary.total}</p>
        <h2 className="mt-1 text-sm text-[var(--oppa-text-muted)]">Total ingredients</h2>
      </div>
      <span className="rounded-xl bg-emerald-100 p-2.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><Boxes size={21} aria-hidden="true" /></span>
    </article>
    <button
      type="button"
      aria-pressed={needsRestockingSelected}
      onClick={onNeedsRestocking}
      className={`admin-card flex min-h-28 items-center justify-between p-4 text-left transition hover:border-amber-300 hover:bg-amber-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 dark:hover:bg-amber-950/20 sm:p-5 ${needsRestockingSelected ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
      title="Show ingredients that are low or out of stock"
    >
      <div>
        <p className="text-2xl font-bold tabular-nums text-[var(--oppa-text)]">{loading ? '—' : summary.needs_restocking}</p>
        <h2 className="mt-1 text-sm text-[var(--oppa-text-muted)]">Need restocking</h2>
        {!loading && summary.out_of_stock > 0 && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{summary.out_of_stock} out of stock</p>}
      </div>
      <span className="rounded-xl bg-amber-100 p-2.5 text-amber-900 dark:bg-amber-950 dark:text-amber-200"><AlertTriangle size={21} aria-hidden="true" /></span>
    </button>
  </section>
);

export const InventoryToolbar: React.FC<{
  query: string;
  onQueryChange: (value: string) => void;
  status: InventoryStatusFilter;
  onStatusChange: (value: InventoryStatusFilter) => void;
  category: string;
  categories: string[];
  onCategoryChange: (value: string) => void;
}> = ({ query, onQueryChange, status, onStatusChange, category, categories, onCategoryChange }) => (
  <section aria-label="Ingredient filters" className="admin-card flex flex-col gap-3 p-4 sm:p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <SearchInput aria-label="Search ingredients by name" value={query} onChange={onQueryChange} placeholder="Search ingredients" debounceMs={180} wrapperClassName="min-w-0 flex-1" />
      <details className="relative shrink-0">
        <summary title="Filter by category" className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)] [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal size={15} aria-hidden="true" />Filter{category !== 'all' ? ` · ${category}` : ''}
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 shadow-xl">
          <label htmlFor="inventory-category-filter" className="text-xs font-semibold text-[var(--oppa-text-muted)]">Category</label>
          <select id="inventory-category-filter" value={category} onChange={(event) => onCategoryChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]">
            <option value="all">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </details>
    </div>
    <div role="group" aria-label="Filter ingredients by stock status" className="inline-flex w-full self-start rounded-xl bg-[var(--oppa-cream)] p-1 sm:w-auto">
      {([
        ['all', 'All'],
        ['low_stock', 'Low'],
        ['out_of_stock', 'Out of stock'],
      ] as const).map(([value, label]) => {
        const selected = status === value || (status === 'attention' && value !== 'all');
        return <button
          key={value}
          type="button"
          aria-pressed={selected}
          onClick={() => onStatusChange(value)}
          className={`min-h-9 flex-1 rounded-lg px-3 text-sm font-semibold transition sm:flex-none ${selected ? 'bg-[var(--oppa-surface)] text-[var(--oppa-green-dark)] shadow-sm' : 'text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]'}`}
        >{label}</button>;
      })}
      {status === 'attention' && <span className="sr-only" aria-live="polite">Showing low and out-of-stock ingredients</span>}
    </div>
  </section>
);

interface IngredientListProps {
  ingredients: InventoryIngredient[];
  loading: boolean;
  error: string;
  filteredCount: number;
  page: number;
  pageCount: number;
  expandedDetails: number | null;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
  onAddFirstIngredient: () => void;
  onRetry: () => void;
  onToggleDetails: (ingredient: InventoryIngredient) => void;
  onAddStock: (ingredient: InventoryIngredient) => void;
  onUseStock: (ingredient: InventoryIngredient) => void;
  onAdjustStock?: (ingredient: InventoryIngredient) => void;
  onCountStock?: (ingredient: InventoryIngredient) => void;
  onEditIngredient: (ingredient: InventoryIngredient) => void;
  onArchiveIngredient: (ingredient: InventoryIngredient) => void;
  onViewHistory: (ingredient: InventoryIngredient) => void;
  canManage?: boolean;
  showAdjustmentActions?: boolean;
}

interface GenericIngredientListProps<TIngredient extends InventoryIngredient> extends Omit<IngredientListProps, 'ingredients'
  | 'onToggleDetails' | 'onAddStock' | 'onUseStock' | 'onAdjustStock'
  | 'onCountStock' | 'onEditIngredient' | 'onArchiveIngredient' | 'onViewHistory'> {
  ingredients: TIngredient[];
  onToggleDetails: (ingredient: TIngredient) => void;
  onAddStock: (ingredient: TIngredient) => void;
  onUseStock: (ingredient: TIngredient) => void;
  onAdjustStock?: (ingredient: TIngredient) => void;
  onCountStock?: (ingredient: TIngredient) => void;
  onEditIngredient: (ingredient: TIngredient) => void;
  onArchiveIngredient: (ingredient: TIngredient) => void;
  onViewHistory: (ingredient: TIngredient) => void;
}

export const IngredientList = <TIngredient extends InventoryIngredient,>({
  ingredients,
  loading,
  error,
  filteredCount,
  page,
  pageCount,
  expandedDetails,
  onPageChange,
  onClearFilters,
  onAddFirstIngredient,
  onRetry,
  onToggleDetails,
  onAddStock,
  onUseStock,
  onAdjustStock,
  onCountStock,
  onEditIngredient,
  onArchiveIngredient,
  onViewHistory,
  canManage = true,
  showAdjustmentActions = true,
}: GenericIngredientListProps<TIngredient>) => {
  const details = (ingredient: TIngredient) => (
    <dl className="grid gap-x-6 gap-y-3 rounded-xl bg-[var(--oppa-cream)] p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="text-xs text-[var(--oppa-text-muted)]" title="Low-stock warning starts at this amount">Reorder level</dt><dd className="mt-1 font-semibold text-[var(--oppa-text)]">{formatInventoryQuantity(ingredient.reorder_level, ingredient.unit)}</dd></div>
      <div><dt className="text-xs text-[var(--oppa-text-muted)]">Average price</dt><dd className="mt-1 font-semibold text-[var(--oppa-text)]">{eachPrice(ingredient.average_unit_cost ?? ingredient.unit_cost, true) ? `${eachPrice(ingredient.average_unit_cost ?? ingredient.unit_cost, true)} each` : 'Not set'}</dd></div>
      <div><dt className="text-xs text-[var(--oppa-text-muted)]">Supplier</dt><dd className="mt-1 font-semibold text-[var(--oppa-text)]">{ingredient.supplier_relation?.name || ingredient.supplier || 'Not set'}</dd></div>
      <div><dt className="text-xs text-[var(--oppa-text-muted)]">Last updated</dt><dd className="mt-1 font-semibold text-[var(--oppa-text)]"><AdminDate value={ingredient.updated_at} /></dd></div>
      {ingredient.notes && <div className="sm:col-span-2 lg:col-span-4"><dt className="text-xs text-[var(--oppa-text-muted)]">Notes</dt><dd className="mt-1 text-[var(--oppa-text)]">{ingredient.notes}</dd></div>}
      {ingredient.purchase_history && ingredient.purchase_history.length > 0 && <div className="sm:col-span-2 lg:col-span-4">
        <dt className="text-xs text-[var(--oppa-text-muted)]">Purchase history</dt>
        <dd className="mt-2 space-y-2">
          {ingredient.purchase_history.map((purchase) => {
            const purchaseQuantity = purchase.purchase_quantity ?? purchase.quantity;
            const purchaseUnit = purchase.purchase_unit || purchase.unit;
            const totalPaid = purchase.total_cost !== null && purchase.total_cost !== undefined
              ? formatPeso(purchase.total_cost)
              : purchase.unit_cost !== null && purchase.unit_cost !== undefined
                ? formatPeso(Number(purchase.quantity) * Number(purchase.unit_cost))
                : 'Price not recorded';
            return <div key={purchase.id} className="rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 py-2">
              <p className="font-semibold text-[var(--oppa-text)]">{friendlyDate(purchase.occurred_at || purchase.created_at)} · {formatInventoryQuantity(purchaseQuantity, purchaseUnit)} · {totalPaid} total paid</p>
              <p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">{eachPrice(purchase.unit_cost, true) ? `${eachPrice(purchase.unit_cost, true)} each` : 'Unit price not recorded'} · {purchase.supplier?.name || 'No supplier'} · Invoice {purchase.invoice_reference || '—'} · {purchase.performed_by}</p>
            </div>;
          })}
        </dd>
      </div>}
    </dl>
  );
  const actions = (ingredient: TIngredient) => !canManage ? null : <div className="flex items-center gap-2">
    <button type="button" aria-label={`Add stock to ${ingredient.name}`} onClick={() => onAddStock(ingredient)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--oppa-green)] px-3 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] sm:flex-none"><Plus size={15} aria-hidden="true" />Add</button>
    <button type="button" aria-label={`Use stock from ${ingredient.name}`} onClick={() => onUseStock(ingredient)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] sm:flex-none"><span aria-hidden="true">−</span>Use</button>
    <RowActionsMenu label={ingredient.name} items={[
      { label: 'Edit details', onSelect: () => onEditIngredient(ingredient) },
      ...(showAdjustmentActions ? [
        ...(onAdjustStock ? [{ label: 'Adjust stock', onSelect: () => onAdjustStock(ingredient) }] : []),
        ...(onCountStock ? [{ label: 'Record stock count', onSelect: () => onCountStock(ingredient) }] : []),
      ] : []),
      { label: 'View stock history', onSelect: () => onViewHistory(ingredient) },
      { label: 'Archive', onSelect: () => onArchiveIngredient(ingredient), destructive: true },
    ]} />
  </div>;
  const detailToggle = (ingredient: TIngredient) => {
    const expanded = expandedDetails === ingredient.id;
    return <button
      type="button"
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Hide' : 'Show'} details for ${ingredient.name}`}
      onClick={() => onToggleDetails(ingredient)}
      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--oppa-green)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"
    >{expanded ? 'Hide details' : 'Details'}{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>;
  };

  return (
    <section aria-labelledby="ingredient-table-title" className="admin-card overflow-hidden">
      <header className="border-b border-[var(--oppa-border)] px-4 py-4 sm:px-5">
        <h2 id="ingredient-table-title" className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Ingredients</h2>
        <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Your current stock at a glance.</p>
      </header>
      {loading ? (
        <div role="status" aria-busy="true" className="p-10 text-center text-sm text-[var(--oppa-text-muted)]">Loading ingredients…</div>
      ) : error && ingredients.length === 0 ? (
        <div className="p-8 text-center">
          <p role="alert" className="text-sm text-red-700">{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-[var(--oppa-border)] px-4 py-2 text-sm font-semibold text-[var(--oppa-text)]">Try again</button>
        </div>
      ) : filteredCount === 0 && ingredients.length === 0 ? (
        <EmptyState
          title={canManage ? 'No ingredients yet. Add your first one.' : 'No ingredients tracked yet.'}
          description={canManage ? 'Add an ingredient to start tracking kitchen stock.' : 'Ask a branch manager to add an ingredient.'}
          icon={<Boxes size={23} aria-hidden="true" />}
          action={canManage && <button type="button" onClick={onAddFirstIngredient} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"><Plus size={15} aria-hidden="true" />Add ingredient</button>}
        />
      ) : filteredCount === 0 ? (
        <EmptyState
          title="No ingredients match."
          description="Try another search or filter."
          action={<button type="button" onClick={onClearFilters} className="mt-2 rounded-xl border border-[var(--oppa-border)] px-4 py-2 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)]">Clear filters</button>}
        />
      ) : <>
        <div className="hidden overflow-x-auto md:block">
          <table className="admin-table w-full min-w-[700px] text-left text-sm">
            <caption className="sr-only">Ingredients, current stock, status, and actions</caption>
            <thead className="bg-[var(--oppa-green-soft)]/70 text-xs uppercase tracking-wider text-[var(--oppa-text-muted)]">
              <tr><th scope="col" className="px-4 py-3">Ingredient</th><th scope="col" className="px-4 py-3">Stock</th><th scope="col" className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--oppa-border)]">
              {ingredients.map((ingredient) => {
                const expanded = expandedDetails === ingredient.id;
                return <React.Fragment key={ingredient.id}>
                  <tr className="hover:bg-[var(--oppa-cream)]/50">
                    <td className="px-4 py-3"><p className="font-semibold text-[var(--oppa-text)]">{ingredient.name}</p><div className="mt-0.5 flex items-center gap-2"><p className="text-xs text-[var(--oppa-text-muted)]">{ingredient.category}</p>{detailToggle(ingredient)}</div></td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-[var(--oppa-text)]">
                      {formatInventoryQuantity(ingredient.quantity, ingredient.unit)}
                      <span className="mt-0.5 block text-xs font-normal text-[var(--oppa-text-muted)]">
                        {ingredient.unit_cost === null
                          ? 'Add price'
                          : `${formatPeso(Number(ingredient.stock_value ?? ingredient.inventory_value ?? Number(ingredient.quantity) * Number(ingredient.unit_cost)))} total · ${eachPrice(ingredient.average_unit_cost ?? ingredient.unit_cost)} each`}
                      </span>
                    </td>
                    <td className="px-4 py-3"><div className="flex items-center justify-between gap-3"><IngredientStatus ingredient={ingredient} /><div className="shrink-0">{actions(ingredient)}</div></div></td>
                  </tr>
                  {expanded && <tr><td colSpan={3} className="px-4 pb-4">{details(ingredient)}</td></tr>}
                </React.Fragment>;
              })}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-[var(--oppa-border)] md:hidden">
          {ingredients.map((ingredient) => {
            const expanded = expandedDetails === ingredient.id;
            return <article key={ingredient.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><h3 className="truncate font-semibold text-[var(--oppa-text)]">{ingredient.name}</h3><p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">{ingredient.category}</p></div>
                <IngredientStatus ingredient={ingredient} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs text-[var(--oppa-text-muted)]">Stock</p><p className="font-semibold tabular-nums text-[var(--oppa-text)]">{formatInventoryQuantity(ingredient.quantity, ingredient.unit)}</p><p className="text-xs text-[var(--oppa-text-muted)]">{ingredient.unit_cost === null ? 'Add price' : `${formatPeso(Number(ingredient.stock_value ?? ingredient.inventory_value ?? Number(ingredient.quantity) * Number(ingredient.unit_cost)))} total · ${eachPrice(ingredient.average_unit_cost ?? ingredient.unit_cost)} each`}</p></div>
                {detailToggle(ingredient)}
              </div>
              {expanded && details(ingredient)}
              {actions(ingredient)}
            </article>;
          })}
        </div>
        <footer className="flex flex-col gap-3 border-t border-[var(--oppa-border)] px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--oppa-text-muted)]">Showing {(page - 1) * 12 + 1}–{Math.min(page * 12, filteredCount)} of {filteredCount}</p>
          {pageCount > 1 && <nav aria-label="Ingredient pages" className="flex items-center gap-2">
            <button type="button" aria-label="Previous ingredient page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="min-h-9 rounded-lg border border-[var(--oppa-border)] px-3 text-sm disabled:opacity-40">Previous</button>
            <span aria-live="polite" className="text-xs text-[var(--oppa-text-muted)]">Page {page} of {pageCount}</span>
            <button type="button" aria-label="Next ingredient page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)} className="min-h-9 rounded-lg border border-[var(--oppa-border)] px-3 text-sm disabled:opacity-40">Next</button>
          </nav>}
        </footer>
      </>}
    </section>
  );
};

interface GenericRecentActivityProps<TMovement extends InventoryMovement> {
  movements: TMovement[];
  excludeTypes?: string[];
  viewAllTo?: string;
}

export const RecentActivity = <TMovement extends InventoryMovement,>({
  movements,
  excludeTypes = [],
  viewAllTo = '/admin/inventory/history',
}: GenericRecentActivityProps<TMovement>) => {
  const [expanded, setExpanded] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches);
  const visibleMovements = movements.filter((movement) => !excludeTypes.includes(movement.type));
  return (
    <section className="admin-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <button type="button" aria-expanded={expanded} aria-controls="inventory-recent-activity" onClick={() => setExpanded((current) => !current)} className="flex min-h-10 items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">
          <History size={17} className="text-[var(--oppa-green)]" aria-hidden="true" />
          <span><span className="block font-serif text-lg font-semibold text-[var(--oppa-text)]">Recent activity</span><span className="block text-xs text-[var(--oppa-text-muted)]">Latest 5 stock changes</span></span>
          {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
        <Link to={viewAllTo} className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--oppa-green)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">View all <span aria-hidden="true">→</span></Link>
      </header>
      {expanded && <div id="inventory-recent-activity" className="border-t border-[var(--oppa-border)]">
        {visibleMovements.length === 0 ? <p className="p-5 text-sm text-[var(--oppa-text-muted)]">No stock changes yet.</p> : <ul className="divide-y divide-[var(--oppa-border)]">
          {visibleMovements.slice(0, 5).map((movement) => {
            const amount = Number(movement.quantity_change);
            const ingredientName = movement.ingredient?.name || movement.ingredient_name;
            const action = movementCopy[movement.type];
            return <li key={movement.id} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="min-w-0 text-sm text-[var(--oppa-text)]"><span className="font-medium">{action} {ingredientName}</span><span className={`ml-2 whitespace-nowrap font-semibold tabular-nums ${amount < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{amount > 0 ? '+' : ''}{formatInventoryQuantity(amount, movement.unit)}</span></p>
              <p className="flex shrink-0 flex-wrap gap-x-3 text-xs text-[var(--oppa-text-muted)]"><span>{movement.performed_by}</span><time dateTime={movement.occurred_at || movement.created_at}>{friendlyDate(movement.occurred_at || movement.created_at)}</time></p>
            </li>;
          })}
        </ul>}
      </div>}
    </section>
  );
};

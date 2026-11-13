import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { PackageCheck, PackagePlus, Plus, X } from 'lucide-react';
import Select from '../../../components/ui/Select';
import { COUNTABLE_INVENTORY_UNITS } from '../../../constants/inventoryUnits';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import {
  addBranchIngredient,
  archiveBranchIngredient,
  getBranchIngredientInventory,
  submitRestockRequest,
  updateBranchIngredient,
  adjustBranchIngredient,
} from '../../../services/franchiseIngredientInventoryService';
import type { BranchIngredient, BranchIngredientInventory } from '../../../services/franchiseIngredientInventoryService';
import {
  IngredientList,
  InventorySummaryCards,
  InventoryToolbar,
  RecentActivity,
} from '../../shared/components/InventoryDashboardComponents';
import type { InventoryStatusFilter } from '../../shared/components/InventoryDashboardComponents';
import { ConfirmDialog, PageHeader } from '../../admin-side/components/AdminUI';

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; ingredient: BranchIngredient }
  | { kind: 'stock'; ingredient: BranchIngredient; movement: 'stock_in' | 'stock_out' | 'adjustment' | 'waste' | 'count_adjustment' }
  | { kind: 'restock' };

const fieldClass = 'mt-1 h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]';
const labelClass = 'block text-sm font-medium text-[var(--oppa-text)]';

const InventoryModal: React.FC<{ title: string; description?: string; onClose: () => void; children: React.ReactNode }> = ({ title, description, onClose, children }) => createPortal(
  <div className="fixed inset-0 z-[120] flex items-end justify-center bg-[#173826]/20 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="branch-inventory-modal-title" className="max-h-[95dvh] w-full overflow-y-auto rounded-t-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl sm:p-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 id="branch-inventory-modal-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">{title}</h2>
          {description && <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">{description}</p>}
        </div>
        <button type="button" aria-label="Close dialog" onClick={onClose} className="rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)]"><X size={18} /></button>
      </header>
      {children}
    </section>
  </div>,
  document.body,
);

const FranchiseIngredientInventoryPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const canManage = ['owner', 'manager'].includes(String(franchiseUser?.role || '').toLowerCase());
  const [inventory, setInventory] = useState<BranchIngredientInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState<InventoryStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [expandedDetails, setExpandedDetails] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [useExistingIngredient, setUseExistingIngredient] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<BranchIngredient | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>('pcs');

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setInventory(await getBranchIngredientInventory());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load ingredient inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadInventory(); }, [loadInventory]);

  const ingredients = inventory?.ingredients || [];
  const allCatalog = useMemo(() => {
    const catalog = new Map<number, BranchIngredient>();
    for (const ingredient of [...ingredients, ...(inventory?.available_ingredients || [])]) {
      catalog.set(ingredient.id, { ...ingredient, quantity: '0', status: 'out_of_stock' });
    }
    return [...catalog.values()].sort((first, second) => first.name.localeCompare(second.name));
  }, [ingredients, inventory?.available_ingredients]);
  const categories = useMemo(() => [...new Set(ingredients.map((ingredient) => ingredient.category).filter(Boolean))].sort(), [ingredients]);
  const availableCategories = [...new Set([
    'Meat', 'Vegetables', 'Dairy', 'Dry goods', 'Beverages', 'Packaging', 'Other',
    ...categories,
  ])];
  const categoryOptions = availableCategories.map((item) => ({ value: item, label: item }));
  const unitOptions = COUNTABLE_INVENTORY_UNITS.map((unit) => ({ value: unit, label: unit }));
  const supplierOptions = (inventory?.suppliers || []).map((supplier) => ({ value: supplier.id, label: supplier.name }));
  const existingIngredientOptions = allCatalog
    .filter((item) => !ingredients.some((tracked) => tracked.id === item.id))
    .map((ingredient) => ({ value: ingredient.id, label: `${ingredient.name} · ${ingredient.unit}` }));
  const filteredIngredients = useMemo(() => ingredients.filter((ingredient) => {
    const matchesText = `${ingredient.name} ${ingredient.category}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = category === 'all' || ingredient.category === category;
    const matchesStatus = filter === 'all'
      || (filter === 'attention' && ingredient.status !== 'in_stock')
      || (filter === 'low_stock' && ingredient.status === 'low_stock')
      || (filter === 'out_of_stock' && ingredient.status === 'out_of_stock');
    return matchesText && matchesCategory && matchesStatus;
  }).sort((first, second) => {
    const rank = { out_of_stock: 0, low_stock: 1, in_stock: 2 };
    return rank[first.status] - rank[second.status] || first.name.localeCompare(second.name);
  }), [ingredients, query, category, filter]);
  const pageCount = Math.max(1, Math.ceil(filteredIngredients.length / 12));
  const visibleIngredients = filteredIngredients.slice((page - 1) * 12, page * 12);

  useEffect(() => { setPage(1); }, [query, category, filter]);

  const mutate = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      setModal(null);
      await loadInventory();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'The inventory change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const saveAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reorderLevel = Number(form.get('reorder_level'));
    const unitCost = form.get('unit_cost') ? Number(form.get('unit_cost')) : null;
    const notes = String(form.get('notes') || '').trim();
    if (useExistingIngredient) {
      const ingredientId = Number(form.get('ingredient_id'));
      const ingredient = allCatalog.find((item) => item.id === ingredientId);
      if (!ingredient) {
        setError('Choose an ingredient from the shared catalog.');
        return;
      }
      void mutate(() => addBranchIngredient({
        ingredient_id: ingredientId,
        initial_quantity: Number(form.get('initial_quantity') || 0),
        reorder_level: reorderLevel,
        unit_cost: unitCost,
        notes,
      }), `${ingredient.name} added to branch ingredients.`);
      return;
    }

    const name = String(form.get('name') || '').trim();
    void mutate(() => addBranchIngredient({
      name,
      category: String(form.get('category') || ''),
      unit: String(form.get('unit') || ''),
      purchase_unit: String(form.get('purchase_unit') || ''),
      conversion_factor: Number(form.get('conversion_factor') || 1),
      supplier_id: form.get('supplier_id') ? Number(form.get('supplier_id')) : null,
      initial_quantity: Number(form.get('initial_quantity') || 0),
      reorder_level: reorderLevel,
      unit_cost: unitCost,
      notes,
    }), `${name} added to branch ingredients.`);
  };

  const saveEdit = (event: React.FormEvent<HTMLFormElement>, ingredient: BranchIngredient) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutate(() => updateBranchIngredient(ingredient.id, {
      reorder_level: Number(form.get('reorder_level')),
      unit_cost: form.get('unit_cost') ? Number(form.get('unit_cost')) : null,
      notes: String(form.get('notes') || '').trim(),
    }), `${ingredient.name} details saved.`);
  };

  const saveMovement = (event: React.FormEvent<HTMLFormElement>, ingredient: BranchIngredient, movement: Exclude<ModalState, { kind: 'add' | 'edit' | 'restock' }>['movement']) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get('quantity'));
    const reason = String(form.get('reason') || '').trim();
    void mutate(() => adjustBranchIngredient(ingredient.id, { type: movement, quantity, reason }), `${ingredient.name} stock updated.`);
  };

  const saveRestock = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const items = allCatalog.flatMap((ingredient) => {
      const quantity = Number(form.get(`quantity_${ingredient.id}`) || 0);
      return quantity > 0 ? [{ ingredient_id: ingredient.id, quantity }] : [];
    });
    if (items.length === 0) {
      setError('Enter a quantity for at least one ingredient.');
      return;
    }
    void mutate(() => submitRestockRequest({ items, notes: String(form.get('notes') || '').trim() }), 'Restock request sent to the main branch.');
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px] space-y-4 lg:-mx-10">
        <PageHeader
          title="Inventory"
          subtitle="Track ingredient stock for your branch."
          actions={<div className="flex flex-wrap gap-2 sm:justify-end">
            <Link to="/franchise/inventory" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] sm:flex-none">
              <PackageCheck size={16} aria-hidden="true" /> Product stock
            </Link>
            {canManage && <button type="button" onClick={() => setModal({ kind: 'restock' })} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] sm:flex-none"><PackagePlus size={16} aria-hidden="true" />Request stock</button>}
            {canManage && <button type="button" onClick={() => { setUseExistingIngredient(false); setSelectedUnit('pcs'); setModal({ kind: 'add' }); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] sm:flex-none"><Plus size={16} aria-hidden="true" />Add ingredient</button>}
          </div>}
        />
        {!canManage && <p className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 py-3 text-sm text-[var(--oppa-text-muted)]">You can view stock. A branch owner or manager can make changes.</p>}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        {inventory && <InventorySummaryCards
          summary={inventory.summary}
          loading={loading}
          needsRestockingSelected={filter === 'attention'}
          onNeedsRestocking={() => setFilter((current) => current === 'attention' ? 'all' : 'attention')}
        />}

        {inventory?.expiring_soon.length ? <section role="status" className="rounded-xl border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
          <strong>{inventory.expiring_soon.length} ingredient batch{inventory.expiring_soon.length === 1 ? '' : 'es'} expiring soon:</strong>{' '}
          {inventory.expiring_soon.slice(0, 4).map((batch) => `${batch.ingredient.name} by ${batch.expires_at}`).join(', ')}
        </section> : null}

        <InventoryToolbar
          query={query}
          onQueryChange={setQuery}
          status={filter}
          onStatusChange={setFilter}
          category={category}
          categories={categories}
          onCategoryChange={setCategory}
        />

        <IngredientList
          ingredients={visibleIngredients}
          loading={loading}
          error={error}
          filteredCount={filteredIngredients.length}
          page={page}
          pageCount={pageCount}
          expandedDetails={expandedDetails}
          onPageChange={setPage}
          onClearFilters={() => { setQuery(''); setCategory('all'); setFilter('all'); }}
          onAddFirstIngredient={() => { setUseExistingIngredient(false); setSelectedUnit('pcs'); setModal({ kind: 'add' }); }}
          onRetry={() => { void loadInventory(); }}
          onToggleDetails={(ingredient) => setExpandedDetails((current) => current === ingredient.id ? null : ingredient.id)}
          onAddStock={(ingredient) => setModal({ kind: 'stock', ingredient: ingredient as BranchIngredient, movement: 'stock_in' })}
          onUseStock={(ingredient) => setModal({ kind: 'stock', ingredient: ingredient as BranchIngredient, movement: 'stock_out' })}
          onAdjustStock={(ingredient) => setModal({ kind: 'stock', ingredient: ingredient as BranchIngredient, movement: 'adjustment' })}
          onLogWaste={(ingredient) => setModal({ kind: 'stock', ingredient: ingredient as BranchIngredient, movement: 'waste' })}
          onCountStock={(ingredient) => setModal({ kind: 'stock', ingredient: ingredient as BranchIngredient, movement: 'count_adjustment' })}
          onEditIngredient={(ingredient) => setModal({ kind: 'edit', ingredient: ingredient as BranchIngredient })}
          onArchiveIngredient={(ingredient) => setArchiveTarget(ingredient as BranchIngredient)}
          onViewHistory={(ingredient) => { window.location.assign(`/franchise/inventory/ingredients/history?ingredient_id=${ingredient.id}`); }}
          canManage={canManage}
        />

        <RecentActivity
          movements={inventory?.recent_movements || []}
          viewAllTo="/franchise/inventory/ingredients/history"
        />

      </div>

      {modal?.kind === 'add' && <InventoryModal
        title="Add ingredient"
        description="Add an ingredient or supply used by your branch."
        onClose={() => setModal(null)}
      >
        <form key={useExistingIngredient ? 'existing-ingredient' : 'new-ingredient'} onSubmit={saveAdd} className="space-y-4">
          {useExistingIngredient ? (
            <>
              <label className={labelClass}>Ingredient <span className="text-red-600" aria-hidden="true">*</span>
                <Select
                  name="ingredient_id"
                  options={existingIngredientOptions}
                  placeholder="Choose an ingredient"
                  required
                  triggerClassName={fieldClass}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>Starting quantity
                  <input name="initial_quantity" type="number" min="0" max="999999999.999" step="0.001" defaultValue="0" className={fieldClass} />
                </label>
                <label className={labelClass}>Reorder level <span className="text-red-600" aria-hidden="true">*</span>
                  <input name="reorder_level" required type="number" min="0" max="999999999.999" step="0.001" defaultValue="5" className={fieldClass} />
                </label>
                <label className={labelClass}>Unit cost (₱)
                  <input name="unit_cost" type="number" min="0" max="999999999.99" step="0.01" className={fieldClass} />
                </label>
                <label className={labelClass}>Notes
                  <input name="notes" maxLength={255} className={fieldClass} />
                </label>
              </div>
            </>
          ) : (
            <>
              <label className={labelClass}>Name <span className="text-red-600" aria-hidden="true">*</span>
                <input name="name" required maxLength={160} className={fieldClass} autoComplete="off" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>Category <span className="text-red-600" aria-hidden="true">*</span>
                  <Select
                    name="category"
                    options={categoryOptions}
                    placeholder="Select an ingredient category"
                    required
                    triggerClassName={fieldClass}
                  />
                </label>
                <label className={labelClass}>Usage unit <span className="text-red-600" aria-hidden="true">*</span>
                  <Select
                    name="unit"
                    options={unitOptions}
                    value={selectedUnit}
                    onChange={(unit) => setSelectedUnit(String(unit))}
                    required
                    triggerClassName={fieldClass}
                  />
                </label>
              </div>
              <p className="-mt-2 text-xs text-[var(--oppa-text-muted)]">Ingredient categories describe supplies, not menu product types. Usage and purchase units are independent.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>Starting quantity
                  <input name="initial_quantity" required type="number" min="0" max="999999999" step={COUNTABLE_INVENTORY_UNITS.includes(selectedUnit as typeof COUNTABLE_INVENTORY_UNITS[number]) ? 1 : 0.001} defaultValue="0" className={fieldClass} />
                </label>
                <label className={labelClass}>Reorder level <span className="text-red-600" aria-hidden="true">*</span>
                  <input name="reorder_level" required type="number" min="0" max="999999999" step={COUNTABLE_INVENTORY_UNITS.includes(selectedUnit as typeof COUNTABLE_INVENTORY_UNITS[number]) ? 1 : 0.001} defaultValue="5" className={fieldClass} />
                </label>
                <label className={labelClass}>Purchase unit
                  <Select
                    name="purchase_unit"
                    options={unitOptions}
                    defaultValue={selectedUnit}
                    triggerClassName={fieldClass}
                  />
                </label>
                <label className={labelClass}>Purchase-to-usage conversion
                  <input name="conversion_factor" required type="number" min="1" max="999999" step="1" inputMode="numeric" defaultValue="1" className={fieldClass} />
                </label>
                <label className={labelClass}>Unit cost <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
                  <span className="mt-1 flex">
                    <span className="inline-flex items-center rounded-l-xl border border-r-0 border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 text-sm text-[var(--oppa-text-muted)]">₱</span>
                    <input name="unit_cost" type="number" min="0" max="999999999" step="0.01" className={`${fieldClass} mt-0 rounded-l-none`} aria-label="Unit cost in Philippine pesos" />
                  </span>
                </label>
              </div>
              <label className={labelClass}>Supplier <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
                <Select<string | number>
                  name="supplier_id"
                  options={[{ value: '', label: 'No supplier' }, ...supplierOptions]}
                  defaultValue=""
                  placeholder="No supplier"
                  triggerClassName={fieldClass}
                />
              </label>
              <label className={labelClass}>Notes <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
                <textarea name="notes" maxLength={255} rows={3} className={`${fieldClass} h-auto py-2`} />
              </label>
            </>
          )}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {existingIngredientOptions.length > 0 && (
            <button type="button" onClick={() => { setError(''); setUseExistingIngredient((current) => !current); }} className="text-sm font-semibold text-[var(--oppa-green)] underline underline-offset-2">
              {useExistingIngredient ? 'Create a new ingredient instead' : 'Choose an existing shared ingredient instead'}
            </button>
          )}
          <ModalActions busy={busy} onCancel={() => setModal(null)} submitLabel="Add ingredient" />
        </form>
      </InventoryModal>}

      {modal?.kind === 'edit' && <InventoryModal title={`Edit ${modal.ingredient.name}`} onClose={() => setModal(null)}>
        <form key={modal.ingredient.id} onSubmit={(event) => saveEdit(event, modal.ingredient)} className="space-y-4">
          <label className="block text-sm font-medium text-[var(--oppa-text)]">Reorder level
            <input name="reorder_level" required type="number" min="0" max="999999999.999" step="0.001" defaultValue={modal.ingredient.reorder_level} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-[var(--oppa-text)]">Unit cost (₱)
            <input name="unit_cost" type="number" min="0" max="999999999.99" step="0.01" defaultValue={modal.ingredient.unit_cost ?? ''} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-[var(--oppa-text)]">Notes
            <input name="notes" maxLength={255} defaultValue={modal.ingredient.notes || ''} className={fieldClass} />
          </label>
          <ModalActions busy={busy} onCancel={() => setModal(null)} submitLabel="Save details" />
        </form>
      </InventoryModal>}

      {modal?.kind === 'stock' && <InventoryModal
        title={`${modal.movement === 'stock_in' ? 'Add stock' : modal.movement === 'stock_out' ? 'Use stock' : modal.movement === 'waste' ? 'Log waste' : modal.movement === 'count_adjustment' ? 'Record stock count' : 'Adjust stock'} · ${modal.ingredient.name}`}
        onClose={() => setModal(null)}
      >
        <form key={`${modal.ingredient.id}-${modal.movement}`} onSubmit={(event) => saveMovement(event, modal.ingredient, modal.movement)} className="space-y-4">
          <label className="block text-sm font-medium text-[var(--oppa-text)]">{modal.movement === 'count_adjustment' || modal.movement === 'adjustment' ? 'Counted quantity' : 'Quantity'}
            <input name="quantity" required type="number" min="0" max="999999999.999" step="0.001" className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-[var(--oppa-text)]">Note {['adjustment', 'count_adjustment', 'waste'].includes(modal.movement) ? <span className="text-red-600">*</span> : <span className="text-[var(--oppa-text-muted)]">(optional)</span>}
            <input name="reason" required={['adjustment', 'count_adjustment', 'waste'].includes(modal.movement)} maxLength={2000} className={fieldClass} />
          </label>
          <ModalActions busy={busy} onCancel={() => setModal(null)} submitLabel="Save stock" />
        </form>
      </InventoryModal>}

      {modal?.kind === 'restock' && <InventoryModal title="Request a restock" onClose={() => setModal(null)}>
        <form onSubmit={saveRestock} className="space-y-4">
          <p className="text-sm text-[var(--oppa-text-muted)]">Enter the amount you need for each item.</p>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {allCatalog.map((ingredient) => <label key={ingredient.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 text-sm">
              <span className="truncate text-[var(--oppa-text)]">{ingredient.name} <span className="text-xs text-[var(--oppa-text-muted)]">({ingredient.unit})</span></span>
              <input name={`quantity_${ingredient.id}`} type="number" min="0" max="999999999.999" step="0.001" placeholder="0" className="h-10 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2 text-right" aria-label={`Requested quantity for ${ingredient.name}`} />
            </label>)}
          </div>
          <label className="block text-sm font-medium text-[var(--oppa-text)]">Note (optional)
            <textarea name="notes" maxLength={2000} rows={2} className={`${fieldClass} h-auto py-2`} />
          </label>
          <ModalActions busy={busy} onCancel={() => setModal(null)} submitLabel="Send request" />
        </form>
      </InventoryModal>}

      {archiveTarget && <ConfirmDialog
        title="Archive this ingredient?"
        description={`${archiveTarget.name} will be hidden from active branch stock. Its history and quantity will be kept.`}
        confirmLabel="Archive"
        busy={busy}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => { void mutate(() => archiveBranchIngredient(archiveTarget.id), `${archiveTarget.name} archived.`).then(() => setArchiveTarget(null)); }}
      />}
    </main>
  );
};

const ModalActions: React.FC<{ busy: boolean; onCancel: () => void; submitLabel: string }> = ({ busy, onCancel, submitLabel }) => (
  <div className="flex justify-end gap-2 border-t border-[var(--oppa-border)] pt-4">
    <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)]">Cancel</button>
    <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : submitLabel}</button>
  </div>
);

export default FranchiseIngredientInventoryPage;

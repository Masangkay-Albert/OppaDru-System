import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { PackagePlus, Plus, X } from 'lucide-react';
import { LimitedInput, LimitedTextarea } from '../../../components/ui/LimitedInput';
import Select from '../../../components/ui/Select';
import { COUNTABLE_INVENTORY_UNITS, isValidTotalPriceInput } from '../../../constants/inventoryUnits';
import { INPUT_LIMITS, INPUT_PATTERNS } from '../../../constants/inputLimits';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import {
  addBranchIngredient,
  archiveBranchIngredient,
  getBranchIngredientInventory,
  submitRestockRequest,
  updateBranchIngredient,
  adjustBranchIngredient,
  receiveBranchIngredientStock,
} from '../../../services/franchiseIngredientInventoryService';
import type { BranchIngredient, BranchIngredientInventory } from '../../../services/franchiseIngredientInventoryService';
import {
  IngredientList,
  InventorySummaryCards,
  InventoryToolbar,
  RecentActivity,
} from '../../shared/components/InventoryDashboardComponents';
import type { InventoryStatusFilter } from '../../shared/components/InventoryDashboardComponents';
import { TotalPriceInput } from '../../shared/components/TotalPriceInput';
import { ConfirmDialog, PageHeader } from '../../admin-side/components/AdminUI';

type ModalState =
  | { kind: 'add' }
  | { kind: 'edit'; ingredient: BranchIngredient }
  | { kind: 'stock'; ingredient: BranchIngredient; movement: 'stock_in' | 'stock_out' | 'adjustment' | 'count_adjustment' }
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
  const [ingredientNameError, setIngredientNameError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState<InventoryStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [expandedDetails, setExpandedDetails] = useState<number | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<BranchIngredient | null>(null);
  const [archiveError, setArchiveError] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('pcs');
  const [startingQuantity, setStartingQuantity] = useState('0');
  const [receiveQuantity, setReceiveQuantity] = useState('');

  const loadInventory = useCallback(async () => {
    try {
      const result = await getBranchIngredientInventory();
      setInventory(result);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load ingredient inventory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getBranchIngredientInventory()
      .then((result) => {
        if (!active) return;
        setInventory(result);
        setError('');
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load ingredient inventory.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const ingredients = useMemo(() => inventory?.ingredients || [], [inventory?.ingredients]);
  const allCatalog = useMemo(() => {
    const catalog = new Map<number, BranchIngredient>();
    for (const ingredient of [...ingredients, ...(inventory?.available_ingredients || [])]) {
      catalog.set(ingredient.id, {
        ...ingredient,
        unit_cost: null,
        quantity: '0',
        status: 'out_of_stock',
      });
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

  const mutate = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      setModal(null);
      setLoading(true);
      await loadInventory();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'The inventory change could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const confirmArchive = async () => {
    if (!archiveTarget) return;
    const target = archiveTarget;
    setBusy(true);
    setArchiveError('');
    setError('');
    setNotice('');
    try {
      await archiveBranchIngredient(target.id);
      setNotice(`${target.name} archived.`);
      setArchiveTarget(null);
      setLoading(true);
      await loadInventory();
    } catch (archiveFailure) {
      setArchiveError(archiveFailure instanceof Error ? archiveFailure.message : 'Could not archive this ingredient.');
    } finally {
      setBusy(false);
    }
  };

  const saveAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIngredientNameError('');
    const form = new FormData(event.currentTarget);
    const reorderLevel = Number(form.get('reorder_level'));
    const totalPricePaid = String(form.get('total_price_paid') || '');
    const quantity = Number(form.get('initial_quantity') || 0);
    const notes = String(form.get('notes') || '').trim();
    if (totalPricePaid && !isValidTotalPriceInput(totalPricePaid)) {
      setError('Enter a total price from ₱0 to ₱9,999,999.99 with up to 2 decimal places.');
      return;
    }
    if (totalPricePaid && quantity <= 0) {
      setError('Enter a quantity before adding a total price.');
      return;
    }
    const name = String(form.get('name') || '').trim();
    if (name.length < INPUT_LIMITS.ingredientName.min
      || name.length > INPUT_LIMITS.ingredientName.max
      || !INPUT_PATTERNS.ingredientName.test(name)) {
      setIngredientNameError('Use 2–50 letters, numbers, spaces, or - \' & . , ( ) /.');
      return;
    }
    void mutate(() => addBranchIngredient({
      name,
      category: String(form.get('category') || ''),
      unit: String(form.get('unit') || ''),
      purchase_unit: String(form.get('purchase_unit') || ''),
      conversion_factor: Number(form.get('conversion_factor') || 1),
      supplier_id: form.get('supplier_id') ? Number(form.get('supplier_id')) : null,
      initial_quantity: Number(form.get('initial_quantity') || 0),
      reorder_level: reorderLevel,
      unit_cost: null,
      total_price_paid: totalPricePaid || undefined,
      notes,
    }), `${name} added to branch ingredients.`);
  };

  const saveEdit = (event: React.FormEvent<HTMLFormElement>, ingredient: BranchIngredient) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const totalPricePaid = String(form.get('total_price_paid') || '');
    if (totalPricePaid && !isValidTotalPriceInput(totalPricePaid)) {
      setError('Enter a total price from ₱0 to ₱9,999,999.99 with up to 2 decimal places.');
      return;
    }
    void mutate(() => updateBranchIngredient(ingredient.id, {
      reorder_level: Number(form.get('reorder_level')),
      total_price_paid: totalPricePaid || undefined,
      notes: String(form.get('notes') || '').trim(),
    }), `${ingredient.name} details and price saved.`);
  };

  const saveReceive = (event: React.FormEvent<HTMLFormElement>, ingredient: BranchIngredient) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get('quantity'));
    const totalPricePaid = String(form.get('total_price_paid') || '');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a quantity greater than zero.');
      return;
    }
    if (totalPricePaid && !isValidTotalPriceInput(totalPricePaid)) {
      setError('Enter a total price from ₱0 to ₱9,999,999.99 with up to 2 decimal places.');
      return;
    }
    void mutate(() => receiveBranchIngredientStock(ingredient.id, {
      quantity,
      total_price_paid: totalPricePaid || undefined,
    }), totalPricePaid ? `${ingredient.name} stock received and average price updated.` : `${ingredient.name} stock received. Existing average price kept.`);
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
            {canManage && <button type="button" onClick={() => setModal({ kind: 'restock' })} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] sm:flex-none"><PackagePlus size={16} aria-hidden="true" />Request stock</button>}
            {canManage && <button type="button" onClick={() => { setError(''); setIngredientNameError(''); setSelectedUnit('pcs'); setStartingQuantity('0'); setModal({ kind: 'add' }); }} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] sm:flex-none"><Plus size={16} aria-hidden="true" />Add ingredient</button>}
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
          onQueryChange={(value) => { setQuery(value); setPage(1); }}
          status={filter}
          onStatusChange={(value) => { setFilter(value); setPage(1); }}
          category={category}
          categories={categories}
          onCategoryChange={(value) => { setCategory(value); setPage(1); }}
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
          onAddFirstIngredient={() => { setError(''); setIngredientNameError(''); setSelectedUnit('pcs'); setStartingQuantity('0'); setModal({ kind: 'add' }); }}
          onRetry={() => { setLoading(true); void loadInventory(); }}
          onToggleDetails={(ingredient) => setExpandedDetails((current) => current === ingredient.id ? null : ingredient.id)}
          onAddStock={(ingredient) => { setReceiveQuantity(''); setModal({ kind: 'stock', ingredient: ingredient as BranchIngredient, movement: 'stock_in' }); }}
          onUseStock={(ingredient) => setModal({ kind: 'stock', ingredient: ingredient as BranchIngredient, movement: 'stock_out' })}
          onAdjustStock={(ingredient) => setModal({ kind: 'stock', ingredient: ingredient as BranchIngredient, movement: 'adjustment' })}
          onCountStock={(ingredient) => setModal({ kind: 'stock', ingredient: ingredient as BranchIngredient, movement: 'count_adjustment' })}
          onEditIngredient={(ingredient) => setModal({ kind: 'edit', ingredient: ingredient as BranchIngredient })}
          onArchiveIngredient={(ingredient) => { setArchiveError(''); setArchiveTarget(ingredient as BranchIngredient); }}
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
        <form onSubmit={saveAdd} className="space-y-4">
          <label className={labelClass}>Name <span className="text-red-600" aria-hidden="true">*</span>
            <LimitedInput
              name="name"
              required
              minLength={INPUT_LIMITS.ingredientName.min}
              maxLength={INPUT_LIMITS.ingredientName.max}
              inputFilter="ingredientName"
              showCounter
              error={ingredientNameError}
              onChange={() => setIngredientNameError('')}
              className={fieldClass}
              autoComplete="off"
            />
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
              <LimitedInput name="initial_quantity" required type="number" min="0" max={INPUT_LIMITS.inventoryQuantity.max} step={COUNTABLE_INVENTORY_UNITS.includes(selectedUnit as typeof COUNTABLE_INVENTORY_UNITS[number]) ? 1 : 0.001} inputMode={COUNTABLE_INVENTORY_UNITS.includes(selectedUnit as typeof COUNTABLE_INVENTORY_UNITS[number]) ? 'numeric' : 'decimal'} inputFilter="inventoryQuantity" value={startingQuantity} onChange={(event) => setStartingQuantity(event.target.value)} className={fieldClass} />
            </label>
            <label className={labelClass}>Reorder level <span className="text-red-600" aria-hidden="true">*</span>
              <LimitedInput name="reorder_level" required type="number" min="0" max={INPUT_LIMITS.inventoryQuantity.max} step={COUNTABLE_INVENTORY_UNITS.includes(selectedUnit as typeof COUNTABLE_INVENTORY_UNITS[number]) ? 1 : 0.001} inputMode={COUNTABLE_INVENTORY_UNITS.includes(selectedUnit as typeof COUNTABLE_INVENTORY_UNITS[number]) ? 'numeric' : 'decimal'} inputFilter="inventoryQuantity" defaultValue="5" className={fieldClass} />
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
              <LimitedInput name="conversion_factor" required type="number" min="1" max={INPUT_LIMITS.inventoryConversion.max} step="1" inputMode="numeric" inputFilter="digits" defaultValue="1" className={fieldClass} />
            </label>
            <TotalPriceInput quantity={startingQuantity} usageUnit={selectedUnit} />
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
            <LimitedTextarea name="notes" maxLength={INPUT_LIMITS.longText.max} showCounter rows={3} className={`${fieldClass} h-auto py-2`} />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <ModalActions busy={busy} onCancel={() => setModal(null)} submitLabel="Add ingredient" />
        </form>
      </InventoryModal>}

      {modal?.kind === 'edit' && <InventoryModal title={`Edit ${modal.ingredient.name}`} onClose={() => setModal(null)}>
        <form key={modal.ingredient.id} onSubmit={(event) => saveEdit(event, modal.ingredient)} className="space-y-4">
          <label className="block text-sm font-medium text-[var(--oppa-text)]">Reorder level
            <LimitedInput name="reorder_level" required type="number" min="0" max={INPUT_LIMITS.inventoryQuantity.max} step="0.001" inputMode="decimal" inputFilter="inventoryQuantity" defaultValue={modal.ingredient.reorder_level} className={fieldClass} />
          </label>
          <div className="rounded-xl bg-[var(--oppa-cream)] px-3 py-2 text-sm text-[var(--oppa-text-muted)]">
            <p>Average price: {modal.ingredient.average_unit_cost ?? modal.ingredient.unit_cost ? `₱${Number(modal.ingredient.average_unit_cost ?? modal.ingredient.unit_cost).toLocaleString('en-PH', { maximumFractionDigits: 4 })} each` : 'Not set'}</p>
          </div>
          <TotalPriceInput
            quantity={String(modal.ingredient.quantity)}
            usageUnit={modal.ingredient.unit}
            label="Update price — total price paid for the stock you have now"
            disabled={Number(modal.ingredient.quantity) <= 0}
          />
          {Number(modal.ingredient.quantity) <= 0 && <p className="-mt-3 text-xs text-[var(--oppa-text-muted)]">Add stock with a price instead.</p>}
          <label className="block text-sm font-medium text-[var(--oppa-text)]">Notes
            <LimitedInput name="notes" maxLength={INPUT_LIMITS.longText.max} showCounter defaultValue={modal.ingredient.notes || ''} className={fieldClass} />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <ModalActions busy={busy} onCancel={() => setModal(null)} submitLabel="Update price / details" />
        </form>
      </InventoryModal>}

      {modal?.kind === 'stock' && <InventoryModal
        title={`${modal.movement === 'stock_in' ? 'Add stock' : modal.movement === 'stock_out' ? 'Use stock' : modal.movement === 'count_adjustment' ? 'Record stock count' : 'Adjust stock'} · ${modal.ingredient.name}`}
        onClose={() => setModal(null)}
      >
        {modal.movement === 'stock_in' ? (
          <form key={`${modal.ingredient.id}-receipt`} onSubmit={(event) => saveReceive(event, modal.ingredient)} className="space-y-4">
            <label className="block text-sm font-medium text-[var(--oppa-text)]">Quantity received ({modal.ingredient.purchase_unit || modal.ingredient.unit})
              <LimitedInput name="quantity" required type="number" min="0.001" max={INPUT_LIMITS.inventoryQuantity.max} step="0.001" inputMode="decimal" inputFilter="inventoryQuantity" value={receiveQuantity} onChange={(event) => setReceiveQuantity(event.target.value)} className={fieldClass} />
            </label>
            <TotalPriceInput
              quantity={receiveQuantity}
              usageUnit={modal.ingredient.unit}
              purchaseUnit={modal.ingredient.purchase_unit || modal.ingredient.unit}
              conversionFactor={Number(modal.ingredient.conversion_factor || 1)}
              alwaysShowPreview
            />
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <ModalActions busy={busy} onCancel={() => setModal(null)} submitLabel="Receive stock" />
          </form>
        ) : (
          <form key={`${modal.ingredient.id}-${modal.movement}`} onSubmit={(event) => saveMovement(event, modal.ingredient, modal.movement)} className="space-y-4">
            <label className="block text-sm font-medium text-[var(--oppa-text)]">{modal.movement === 'count_adjustment' || modal.movement === 'adjustment' ? 'Counted quantity' : 'Quantity'}
              <LimitedInput name="quantity" required type="number" min="0" max={INPUT_LIMITS.inventoryQuantity.max} step="0.001" inputMode="decimal" inputFilter="inventoryQuantity" className={fieldClass} />
            </label>
            <label className="block text-sm font-medium text-[var(--oppa-text)]">Note <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
              <LimitedInput name="reason" minLength={INPUT_LIMITS.reason.min} maxLength={INPUT_LIMITS.reason.max} className={fieldClass} />
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <ModalActions busy={busy} onCancel={() => setModal(null)} submitLabel="Save stock" />
          </form>
        )}
      </InventoryModal>}

      {modal?.kind === 'restock' && <InventoryModal title="Request a restock" onClose={() => setModal(null)}>
        <form onSubmit={saveRestock} className="space-y-4">
          <p className="text-sm text-[var(--oppa-text-muted)]">Enter the amount you need for each item.</p>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {allCatalog.map((ingredient) => <label key={ingredient.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3 text-sm">
              <span className="truncate text-[var(--oppa-text)]">{ingredient.name} <span className="text-xs text-[var(--oppa-text-muted)]">({ingredient.unit})</span></span>
              <LimitedInput name={`quantity_${ingredient.id}`} type="number" min="0" max={INPUT_LIMITS.inventoryQuantity.max} step="0.001" inputMode="decimal" inputFilter="inventoryQuantity" placeholder="0" className="h-10 rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2 text-right" aria-label={`Requested quantity for ${ingredient.name}`} />
            </label>)}
          </div>
          <label className="block text-sm font-medium text-[var(--oppa-text)]">Note (optional)
            <LimitedTextarea name="notes" maxLength={INPUT_LIMITS.longText.max} showCounter rows={2} className={`${fieldClass} h-auto py-2`} />
          </label>
          <ModalActions busy={busy} onCancel={() => setModal(null)} submitLabel="Send request" />
        </form>
      </InventoryModal>}

      {archiveTarget && <ConfirmDialog
        title="Archive this ingredient?"
        description={`${archiveTarget.name} will be hidden from active branch stock. Its history and quantity will be kept.`}
        confirmLabel="Archive"
        busy={busy}
        errorMessage={archiveError}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() => { void confirmArchive(); }}
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

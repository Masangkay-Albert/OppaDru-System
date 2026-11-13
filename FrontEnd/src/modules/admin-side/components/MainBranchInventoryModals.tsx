import React, { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import Select from '../../../components/ui/Select';
import { formatInventoryUnitOption, getInventoryUnitOptions, isWholeQuantityUnit } from '../../../constants/inventoryUnits';
import { INPUT_LIMITS, INPUT_PATTERNS } from '../../../constants/inputLimits';
import type { InventorySupplier, MainBranchIngredient, StockMovementType } from '../../../services/mainBranchInventoryService';
import { formatInventoryQuantity } from '../../../utils/inventoryFormatters';
import { TotalPriceInput } from '../../shared/components/TotalPriceInput';
import { isValidTotalPriceInput } from '../../../constants/inventoryUnits';
import { LimitedInput, LimitedTextarea } from '../../../components/ui/LimitedInput';
import { ValidatedForm } from '../../../components/ui/FormValidation';

const fieldClass = 'mt-1 h-11 w-full rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)] focus:ring-2 focus:ring-[var(--oppa-green)]/20';
const labelClass = 'block text-sm font-medium text-[var(--oppa-text)]';

const InventoryModal: React.FC<{
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, description, onClose, children }) => {
  const modalRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    modal?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== 'Tab' || !modal) return;
      const focusable = Array.from(modal.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-[#173826]/20 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}
    >
      <section
        ref={(element) => { modalRef.current = element; }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-modal-title"
        aria-describedby={description ? 'inventory-modal-description' : undefined}
        className="max-h-[95dvh] w-full overflow-y-auto rounded-t-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-2xl sm:max-w-xl sm:rounded-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="inventory-modal-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">{title}</h2>
            {description && <p id="inventory-modal-description" className="mt-1 text-sm text-[var(--oppa-text-muted)]">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-lg p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
};

export interface IngredientFormValues {
  name: string;
  category: string;
  unit: string;
  purchase_unit: string;
  conversion_factor: number;
  quantity?: number;
  reorder_level: number;
  unit_cost: number | null;
  total_price_paid?: string;
  supplier_id: number | null;
  notes: string;
}

export const IngredientFormModal: React.FC<{
  ingredient?: MainBranchIngredient;
  categories: string[];
  suppliers: InventorySupplier[];
  busy: boolean;
  onClose: () => void;
  onSave: (values: IngredientFormValues) => Promise<void>;
}> = ({ ingredient, categories, suppliers, busy, onClose, onSave }) => {
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>(ingredient?.unit || 'pcs');
  const [quantityValue, setQuantityValue] = useState(String(ingredient?.quantity ?? '0'));
  const editing = Boolean(ingredient);
  const availableCategories = [...new Set([
    'Meat', 'Vegetables', 'Dairy', 'Dry goods', 'Beverages', 'Packaging', 'Other',
    ...categories,
    ...(ingredient ? [ingredient.category] : []),
  ])];
  const unitOptions = getInventoryUnitOptions(ingredient?.unit);
  const categoryOptions = availableCategories.map((item) => ({ value: item, label: item }));
  const unitSelectOptions = unitOptions.map((unit) => ({ value: unit, label: formatInventoryUnitOption(unit) }));
  const supplierOptions = suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }));
  const quantityMode = isWholeQuantityUnit(selectedUnit) ? 'numeric' : 'decimal';
  const quantityStep = isWholeQuantityUnit(selectedUnit) ? 1 : 0.001;

  const preventDecimalEntry = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (['e', 'E', '+', '-'].includes(event.key) || (isWholeQuantityUnit(selectedUnit) && event.key === '.')) {
      event.preventDefault();
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNameError('');
    const form = new FormData(event.currentTarget);
    const rawName = String(form.get('name') || '');
    const name = editing && rawName === ingredient?.name ? rawName : rawName.trim();
    const rawNotes = String(form.get('notes') || '');
    const notes = editing && rawNotes === ingredient?.notes ? rawNotes : rawNotes.trim();
    const selectedCategory = String(form.get('category') || '');
    const quantity = editing ? undefined : Number(form.get('quantity'));
    const reorderLevel = Number(form.get('reorder_level'));
    const rawTotalPrice = String(form.get('total_price_paid') || '');
    if (!selectedCategory) {
      setError('Choose an ingredient category.');
      return;
    }
    if (!name) {
      setNameError('Enter an ingredient name.');
      return;
    }
    if ((!editing || name !== ingredient?.name)
      && (name.length < INPUT_LIMITS.ingredientName.min
        || name.length > INPUT_LIMITS.ingredientName.max
        || !INPUT_PATTERNS.ingredientName.test(name))) {
      setNameError('Use 2–50 letters, numbers, spaces, or - \' & . , ( ) /.');
      return;
    }
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0 || (quantity !== undefined && (!Number.isFinite(quantity) || quantity < 0))) {
      setError('Enter valid non-negative quantities.');
      return;
    }
    if (rawTotalPrice && !isValidTotalPriceInput(rawTotalPrice)) {
      setError('Enter a total price from ₱0 to ₱9,999,999.99 with up to 2 decimal places.');
      return;
    }
    if (!editing && rawTotalPrice && quantity === 0) {
      setError('Enter a quantity before adding a total price.');
      return;
    }
    try {
      await onSave({
        name,
        category: selectedCategory,
        unit: String(form.get('unit') || ''),
        purchase_unit: String(form.get('purchase_unit') || ''),
        conversion_factor: Number(form.get('conversion_factor') || 1),
        quantity,
        reorder_level: reorderLevel,
        unit_cost: editing ? (ingredient?.unit_cost === null ? null : Number(ingredient?.unit_cost)) : null,
        total_price_paid: rawTotalPrice || undefined,
        supplier_id: form.get('supplier_id') ? Number(form.get('supplier_id')) : null,
        notes,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save ingredient.');
    }
  };

  return (
    <InventoryModal
      title={editing ? 'Edit ingredient' : 'Add ingredient'}
      description={editing ? 'Update ingredient details. Adjust stock separately to keep a movement history.' : 'Add an ingredient or supply used by the main branch.'}
      onClose={onClose}
    >
      <ValidatedForm onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <label className={labelClass}>Name <span className="text-red-600" aria-hidden="true">*</span>
          <LimitedInput
            name="name"
            data-required="true"
            data-min-length={INPUT_LIMITS.ingredientName.min}
            maxLength={INPUT_LIMITS.ingredientName.max}
            inputFilter="ingredientName"
            showCounter
            error={nameError}
            onChange={() => setNameError('')}
            defaultValue={ingredient?.name || ''}
            className={fieldClass}
            autoComplete="off"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Category <span className="text-red-600" aria-hidden="true">*</span>
            <Select
              name="category"
              options={categoryOptions}
              defaultValue={ingredient?.category || ''}
              placeholder="Select an ingredient category"
              data-required="true"
              className="mt-1"
              triggerClassName={fieldClass}
            />
          </label>
          <label className={labelClass}>Usage unit <span className="text-red-600" aria-hidden="true">*</span>
            <Select
              name="unit"
              options={unitSelectOptions}
              value={selectedUnit}
              onChange={(nextUnit) => setSelectedUnit(String(nextUnit))}
              placeholder="Select usage unit"
              data-required="true"
              className="mt-1"
              triggerClassName={fieldClass}
            />
          </label>
        </div>
        <p className="-mt-2 text-xs text-[var(--oppa-text-muted)]">Ingredient categories describe supplies, not menu product types. Usage and purchase units are independent.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {!editing && <label className={labelClass}>Current quantity
            <LimitedInput
              name="quantity"
              data-required="true"
              type="number"
              data-min="0"
              data-max={INPUT_LIMITS.inventoryQuantity.max}
              step={quantityStep}
              inputMode={quantityMode}
              inputFilter="inventoryQuantity"
              onKeyDown={preventDecimalEntry}
              defaultValue="0"
              onChange={(event) => setQuantityValue(event.target.value)}
              className={fieldClass}
            />
          </label>}
          <label className={labelClass}>Reorder level <span className="text-red-600" aria-hidden="true">*</span>
            <LimitedInput
              name="reorder_level"
              data-required="true"
              type="number"
              data-min="0"
              data-max={INPUT_LIMITS.inventoryQuantity.max}
              step={quantityStep}
              inputMode={quantityMode}
              inputFilter="inventoryQuantity"
              onKeyDown={preventDecimalEntry}
              defaultValue={ingredient?.reorder_level ?? '5'}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>Purchase unit
            <Select
              name="purchase_unit"
              options={unitSelectOptions}
              defaultValue={ingredient?.purchase_unit || ingredient?.unit || 'pcs'}
              placeholder="Select purchase unit"
              className="mt-1"
              triggerClassName={fieldClass}
            />
          </label>
          <label className={labelClass}>Purchase-to-usage conversion
            <LimitedInput
              name="conversion_factor"
              data-required="true"
              type="number"
              data-min="1"
              data-max={INPUT_LIMITS.inventoryConversion.max}
              step="1"
              inputMode="numeric"
              inputFilter="digits"
              onKeyDown={preventDecimalEntry}
              defaultValue={ingredient?.conversion_factor ?? '1'}
              className={fieldClass}
            />
          </label>
          <TotalPriceInput
            quantity={quantityValue}
            usageUnit={selectedUnit}
            label={editing ? 'Total price paid for the stock you have now' : 'Total price paid (optional)'}
            disabled={Boolean(editing && Number(ingredient?.quantity || 0) <= 0)}
          />
        </div>
        {editing && <div className="-mt-2 rounded-xl bg-[var(--oppa-cream)] px-3 py-2 text-sm text-[var(--oppa-text-muted)]">
          <p>Average price: {ingredient?.average_unit_cost ?? ingredient?.unit_cost ? `₱${Number(ingredient.average_unit_cost ?? ingredient.unit_cost).toLocaleString('en-PH', { maximumFractionDigits: 4 })} each` : 'Not set'}</p>
          {Number(ingredient?.quantity || 0) === 0 && <p className="mt-1 text-xs">Add stock with a price instead.</p>}
        </div>}
        <label className={labelClass}>Supplier <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
          <Select
            name="supplier_id"
            options={[{ value: '', label: 'No supplier' }, ...supplierOptions]}
            defaultValue={ingredient?.supplier_id ?? ''}
            placeholder="No supplier"
            className="mt-1"
            triggerClassName={fieldClass}
          />
        </label>
        <label className={labelClass}>Notes <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
          <LimitedTextarea
            name="notes"
            maxLength={INPUT_LIMITS.longText.max}
            showCounter
            rows={3}
            defaultValue={ingredient?.notes || ''}
            className={`${fieldClass} h-auto py-2`}
          />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--oppa-border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:opacity-60">{busy ? 'Saving…' : editing ? 'Update price / details' : 'Add ingredient'}</button>
        </div>
      </ValidatedForm>
    </InventoryModal>
  );
};

export const AdjustStockModal: React.FC<{
  ingredient: MainBranchIngredient;
  initialType: 'stock_out' | 'adjustment';
  busy: boolean;
  onClose: () => void;
  onSave: (values: { type: StockMovementType; quantity: number; reason: string }) => Promise<void>;
}> = ({ ingredient, initialType, busy, onClose, onSave }) => {
  const [type, setType] = useState<'stock_out' | 'adjustment'>(initialType);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const current = Number(ingredient.quantity);
  const amount = Number(quantity || 0);
  const next = type === 'adjustment' ? amount : current - amount;
  const hasNegativeResult = type !== 'adjustment' && next < 0;
  const preview = (value: number) => `${Number(value.toFixed(3))} ${ingredient.unit}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!Number.isFinite(amount) || amount < 0 || (type !== 'adjustment' && amount <= 0)) {
      setError(type === 'adjustment' ? 'Enter a quantity of zero or more.' : 'Enter a quantity greater than zero.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const reason = String(form.get('reason') || '').trim();
    if (hasNegativeResult) {
      setError('This change cannot reduce stock below zero.');
      return;
    }
    await onSave({ type, quantity: amount, reason });
  };

  return (
    <InventoryModal title={type === 'stock_out' ? 'Stock out' : 'Adjust stock'} description={`${ingredient.name} · Current stock: ${preview(current)}`} onClose={onClose}>
      <ValidatedForm onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <label className={labelClass}>Adjustment type
          <select value={type} onChange={(event) => setType(event.target.value as 'stock_out' | 'adjustment')} className={fieldClass}>
            <option value="stock_out">Stock out (used)</option>
            <option value="adjustment">Adjust (set exact quantity)</option>
          </select>
        </label>
        <label className={labelClass}>{type === 'adjustment' ? 'Set quantity to' : 'Quantity'}
          <span className="mt-1 flex">
            <LimitedInput
              autoFocus
              aria-label={`Quantity in ${ingredient.unit}`}
              data-required="true"
              type="number"
              data-min="0"
              data-max={INPUT_LIMITS.inventoryQuantity.max}
              step="0.001"
              inputMode="decimal"
              inputFilter="inventoryQuantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={`${fieldClass} mt-0 rounded-r-none`}
            />
            <span className="inline-flex min-w-14 items-center justify-center rounded-r-xl border border-l-0 border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 text-sm text-[var(--oppa-text-muted)]">{ingredient.unit}</span>
          </span>
        </label>
        <div aria-live="polite" className={`rounded-xl border px-4 py-3 text-sm ${hasNegativeResult ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
          Current <strong>{preview(current)}</strong> → New <strong>{preview(next)}</strong>
          {hasNegativeResult && <p className="mt-1 text-xs">This change would make the stock negative.</p>}
        </div>
        <label className={labelClass}>Reason / notes <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
          <LimitedTextarea name="reason" maxLength={INPUT_LIMITS.reason.max} showCounter rows={3} className={`${fieldClass} h-auto py-2`} placeholder="Add an optional note" />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--oppa-border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">Cancel</button>
          <button type="submit" disabled={busy || hasNegativeResult} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:opacity-60">{busy ? 'Saving…' : 'Save adjustment'}</button>
        </div>
      </ValidatedForm>
    </InventoryModal>
  );
};

export const QuickStockActionModal: React.FC<{
  ingredient: MainBranchIngredient;
  type: 'stock_in' | 'stock_out';
  busy: boolean;
  onClose: () => void;
  onSave: (values: { type: StockMovementType; quantity: number; reason: string }) => Promise<void>;
}> = ({ ingredient, type, busy, onClose, onSave }) => {
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const actionLabel = type === 'stock_in' ? 'Add stock' : 'Use stock';
  const amount = Number(quantity);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999) {
      setError('Enter a quantity greater than zero.');
      return;
    }
    if (type === 'stock_out' && amount > Number(ingredient.quantity)) {
      setError('You cannot use more than the current stock.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const reason = String(form.get('reason') || '').trim();
    try {
      await onSave({ type, quantity: amount, reason });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update stock.');
    }
  };

  return (
    <InventoryModal title={actionLabel} description={`${ingredient.name} · Current stock: ${formatInventoryQuantity(ingredient.quantity, ingredient.unit)}`} onClose={onClose}>
      <ValidatedForm onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <label className={labelClass}>Quantity
          <span className="mt-1 flex">
            <LimitedInput
              autoFocus
              aria-label={`Quantity in ${ingredient.unit}`}
              data-required="true"
              type="number"
              data-min="0.001"
              data-max={INPUT_LIMITS.inventoryQuantity.max}
              step="0.001"
              inputMode="decimal"
              inputFilter="inventoryQuantity"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={`${fieldClass} mt-0 rounded-r-none`}
            />
            <span className="inline-flex min-w-14 items-center justify-center rounded-r-xl border border-l-0 border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 text-sm text-[var(--oppa-text-muted)]">{ingredient.unit}</span>
          </span>
        </label>
        <label className={labelClass}>Note <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
          <LimitedTextarea name="reason" maxLength={INPUT_LIMITS.reason.max} showCounter rows={2} className={`${fieldClass} h-auto py-2`} placeholder="Add a short note" />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--oppa-border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:opacity-60">{busy ? 'Saving…' : actionLabel}</button>
        </div>
      </ValidatedForm>
    </InventoryModal>
  );
};

export const ReceiveStockModal: React.FC<{
  ingredient: MainBranchIngredient;
  busy: boolean;
  onClose: () => void;
  onSave: (values: { quantity: number; total_price_paid?: string }) => Promise<void>;
}> = ({ ingredient, busy, onClose, onSave }) => {
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState('');
  const factor = Number(ingredient.conversion_factor || 1);
  const purchaseUnit = ingredient.purchase_unit || ingredient.unit;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    try {
      await onSave({
        quantity,
        total_price_paid: totalPricePaid || undefined,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not receive stock.');
    }
  };
  return (
    <InventoryModal title="Receive stock" description={`${ingredient.name} · Purchase unit: ${ingredient.purchase_unit || ingredient.unit}`} onClose={onClose}>
      <ValidatedForm onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <label className={labelClass}>Quantity received ({purchaseUnit}) <span className="text-red-600" aria-hidden="true">*</span>
          <LimitedInput name="quantity" type="number" data-min="0.001" data-max={INPUT_LIMITS.inventoryQuantity.max} step="0.001" inputMode="decimal" inputFilter="inventoryQuantity" data-required="true" value={quantity} onChange={(event) => setQuantity(event.target.value)} className={fieldClass} />
        </label>
        <TotalPriceInput
          quantity={quantity}
          usageUnit={ingredient.unit}
          purchaseUnit={purchaseUnit}
          conversionFactor={factor}
          alwaysShowPreview
        />
        <p className="text-xs text-[var(--oppa-text-muted)]">Stock converts to {ingredient.unit} using the saved purchase conversion. The average price updates only when a price is entered.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-[var(--oppa-border)] pt-4">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Receiving…' : 'Receive stock'}</button>
        </div>
      </ValidatedForm>
    </InventoryModal>
  );
};

export const CountStockModal: React.FC<{
  ingredient: MainBranchIngredient;
  busy: boolean;
  onClose: () => void;
  onSave: (values: { quantity: number; reason: string }) => Promise<void>;
}> = ({ ingredient, busy, onClose, onSave }) => {
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const counted = Number(quantity);
  const current = Number(ingredient.quantity);
  const variance = counted - current;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const reason = String(form.get('reason') || '').trim();
    if (!Number.isFinite(counted) || counted < 0) {
      setError('Enter a valid counted quantity.');
      return;
    }
    try {
      await onSave({ quantity: counted, reason });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not apply the stock count.');
    }
  };

  return (
    <InventoryModal title="Physical stock count" description={ingredient.name} onClose={onClose}>
      <ValidatedForm onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <p className="rounded-xl bg-[var(--oppa-cream)] px-4 py-3 text-sm">System quantity: <strong>{formatInventoryQuantity(current, ingredient.unit)}</strong></p>
        <label className={labelClass}>Counted quantity <span className="text-red-600" aria-hidden="true">*</span>
          <LimitedInput type="number" data-min="0" data-max={INPUT_LIMITS.inventoryQuantity.max} step="0.001" inputMode="decimal" inputFilter="inventoryQuantity" value={quantity} onChange={(event) => setQuantity(event.target.value)} data-required="true" className={fieldClass} />
        </label>
        {quantity !== '' && Number.isFinite(counted) && <p className={`text-sm font-semibold ${variance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>Variance: {variance > 0 ? '+' : ''}{formatInventoryQuantity(variance, ingredient.unit)}</p>}
        <label className={labelClass}>Reason <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
          <LimitedTextarea name="reason" maxLength={INPUT_LIMITS.reason.max} showCounter rows={3} className={`${fieldClass} h-auto py-2`} placeholder="Add an optional note" />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-[var(--oppa-border)] pt-4">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={busy || quantity === ''} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Apply count'}</button>
        </div>
      </ValidatedForm>
    </InventoryModal>
  );
};

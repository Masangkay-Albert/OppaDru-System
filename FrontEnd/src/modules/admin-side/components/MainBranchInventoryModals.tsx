import React, { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import type { InventorySupplier, MainBranchIngredient, StockMovementType } from '../../../services/mainBranchInventoryService';

const INVENTORY_UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'piece', 'pack', 'box', 'tray'];

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

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) closeRef.current(); }}
    >
      <section
        ref={(element) => { modalRef.current = element; }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inventory-modal-title"
        aria-describedby={description ? 'inventory-modal-description' : undefined}
        className="h-[100dvh] max-h-[100dvh] w-full overflow-y-auto rounded-none border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-2xl sm:p-6"
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
    </div>
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
  supplier_id: number | null;
  notes: string;
}

export const IngredientFormModal: React.FC<{
  ingredient?: MainBranchIngredient;
  categories: string[];
  suppliers: InventorySupplier[];
  busy: boolean;
  onClose: () => void;
  onSave: (values: IngredientFormValues, addAnother: boolean) => Promise<void>;
}> = ({ ingredient, categories, suppliers, busy, onClose, onSave }) => {
  const [error, setError] = useState('');
  const editing = Boolean(ingredient);
  const availableCategories = [...new Set([
    'Meat', 'Vegetables', 'Dairy', 'Dry goods', 'Beverages', 'Packaging', 'Other',
    ...categories,
    ...(ingredient ? [ingredient.category] : []),
  ])];

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get('name') || '').trim();
    const selectedCategory = String(form.get('category') || '');
    const quantity = editing ? undefined : Number(form.get('quantity'));
    const reorderLevel = Number(form.get('reorder_level'));
    const rawCost = String(form.get('unit_cost') || '');
    if (!selectedCategory) {
      setError('Choose an ingredient category.');
      return;
    }
    if (!name) {
      setError('Enter an ingredient name.');
      return;
    }
    if (!Number.isFinite(reorderLevel) || reorderLevel < 0 || (quantity !== undefined && (!Number.isFinite(quantity) || quantity < 0)) || (rawCost && (!Number.isFinite(Number(rawCost)) || Number(rawCost) < 0))) {
      setError('Enter valid non-negative quantities and costs.');
      return;
    }
    if (!editing && name.length > 160) {
      setError('Name cannot exceed 160 characters.');
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
        unit_cost: rawCost ? Number(rawCost) : null,
        supplier_id: form.get('supplier_id') ? Number(form.get('supplier_id')) : null,
        notes: String(form.get('notes') || '').trim(),
      }, !editing && form.get('add_another') === 'on');
      if (!editing && form.get('add_another') === 'on') formElement.reset();
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
      <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <label className={labelClass}>Name <span className="text-red-600" aria-hidden="true">*</span>
          <input name="name" required maxLength={160} defaultValue={ingredient?.name || ''} className={fieldClass} autoComplete="off" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Category <span className="text-red-600" aria-hidden="true">*</span>
            <select
              name="category"
              defaultValue={ingredient?.category || ''}
              required
              className={fieldClass}
            >
              <option value="" disabled>Select an ingredient category</option>
              {availableCategories.map((item) => {
                return <option key={item} value={item}>{item}</option>;
              })}
            </select>
          </label>
          <label className={labelClass}>Usage unit <span className="text-red-600" aria-hidden="true">*</span>
            <select name="unit" required defaultValue={ingredient?.unit || ''} className={fieldClass}>
              <option value="" disabled>Select a unit</option>
              {INVENTORY_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </label>
        </div>
        <p className="-mt-2 text-xs text-[var(--oppa-text-muted)]">Ingredient categories describe supplies, not menu product types. Usage and purchase units are independent.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {!editing && <label className={labelClass}>Current quantity
            <input name="quantity" required type="number" min="0" max="999999999" step="0.001" defaultValue="0" className={fieldClass} />
          </label>}
          <label className={labelClass}>Reorder level <span className="text-red-600" aria-hidden="true">*</span>
            <input name="reorder_level" required type="number" min="0" max="999999999" step="0.001" defaultValue={ingredient?.reorder_level ?? '5'} className={fieldClass} />
          </label>
          <label className={labelClass}>Purchase unit
            <select name="purchase_unit" defaultValue={ingredient?.purchase_unit || ingredient?.unit || ''} className={fieldClass}>
              {INVENTORY_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </label>
          <label className={labelClass}>Purchase-to-usage conversion
            <input name="conversion_factor" required type="number" min="0.000001" max="999999.999999" step="0.000001" defaultValue={ingredient?.conversion_factor ?? '1'} className={fieldClass} />
          </label>
          <label className={labelClass}>Unit cost <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
            <span className="mt-1 flex">
              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 text-sm text-[var(--oppa-text-muted)]">₱</span>
              <input name="unit_cost" type="number" min="0" max="999999999" step="0.01" defaultValue={ingredient?.unit_cost ?? ''} className={`${fieldClass} mt-0 rounded-l-none`} aria-label="Unit cost in Philippine pesos" />
            </span>
          </label>
        </div>
        {editing && <p className="-mt-2 text-xs text-[var(--oppa-text-muted)]">Change current stock using Adjust stock so every change is recorded.</p>}
        <label className={labelClass}>Supplier <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
          <select name="supplier_id" defaultValue={ingredient?.supplier_id || ''} className={fieldClass}>
            <option value="">No supplier</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label className={labelClass}>Notes <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
          <textarea name="notes" maxLength={5000} rows={3} defaultValue={ingredient?.notes || ''} className={`${fieldClass} h-auto py-2`} />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--oppa-border)] pt-4 sm:flex-row sm:justify-end">
          {!editing && <label className="mr-auto inline-flex items-center gap-2 text-sm text-[var(--oppa-text-muted)]"><input type="checkbox" name="add_another" className="accent-[var(--oppa-green)]" /> Add another</label>}
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:opacity-60">{busy ? 'Saving…' : editing ? 'Save changes' : 'Add ingredient'}</button>
        </div>
      </form>
    </InventoryModal>
  );
};

export const AdjustStockModal: React.FC<{
  ingredient: MainBranchIngredient;
  initialType: 'stock_out' | 'adjustment' | 'waste';
  busy: boolean;
  onClose: () => void;
  onSave: (values: { type: StockMovementType; quantity: number; reason: string }) => Promise<void>;
}> = ({ ingredient, initialType, busy, onClose, onSave }) => {
  const [type, setType] = useState<'stock_out' | 'adjustment' | 'waste'>(initialType);
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
    if ((type === 'adjustment' || type === 'waste') && !reason) {
      setError('A reason is required for adjustments and waste.');
      return;
    }
    if (hasNegativeResult) {
      setError('Stock out or waste cannot reduce stock below zero.');
      return;
    }
    await onSave({ type, quantity: amount, reason });
  };

  return (
    <InventoryModal title={type === 'waste' ? 'Log waste / spoilage' : type === 'stock_out' ? 'Stock out' : 'Adjust stock'} description={`${ingredient.name} · Current stock: ${preview(current)}`} onClose={onClose}>
      <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <label className={labelClass}>Adjustment type
          <select value={type} onChange={(event) => setType(event.target.value as 'stock_out' | 'adjustment' | 'waste')} className={fieldClass}>
            <option value="stock_out">Stock out (used)</option>
            <option value="waste">Waste / spoilage</option>
            <option value="adjustment">Adjust (set exact quantity)</option>
          </select>
        </label>
        <label className={labelClass}>{type === 'adjustment' ? 'Set quantity to' : 'Quantity'}
          <span className="mt-1 flex">
            <input
              autoFocus
              aria-label={`Quantity in ${ingredient.unit}`}
              required
              type="number"
              min="0"
              max="999999999"
              step="0.001"
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
        <label className={labelClass}>Reason / notes {(type === 'waste' || type === 'adjustment') && <span className="text-red-600" aria-hidden="true">*</span>}
          <textarea name="reason" maxLength={2000} rows={3} required={type === 'waste' || type === 'adjustment'} className={`${fieldClass} h-auto py-2`} placeholder={type === 'waste' || type === 'adjustment' ? 'Please explain this adjustment' : 'Add a note about this stock change'} />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--oppa-border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">Cancel</button>
          <button type="submit" disabled={busy || hasNegativeResult} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:opacity-60">{busy ? 'Saving…' : 'Save adjustment'}</button>
        </div>
      </form>
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
    <InventoryModal title={actionLabel} description={`${ingredient.name} · Current stock: ${Number(ingredient.quantity).toLocaleString('en-PH', { maximumFractionDigits: 3 })} ${ingredient.unit}`} onClose={onClose}>
      <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <label className={labelClass}>Quantity
          <span className="mt-1 flex">
            <input
              autoFocus
              aria-label={`Quantity in ${ingredient.unit}`}
              required
              type="number"
              min="0.001"
              max="999999999"
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className={`${fieldClass} mt-0 rounded-r-none`}
            />
            <span className="inline-flex min-w-14 items-center justify-center rounded-r-xl border border-l-0 border-[var(--oppa-border)] bg-[var(--oppa-cream)] px-3 text-sm text-[var(--oppa-text-muted)]">{ingredient.unit}</span>
          </span>
        </label>
        <label className={labelClass}>Note <span className="font-normal text-[var(--oppa-text-muted)]">(optional)</span>
          <textarea name="reason" maxLength={2000} rows={2} className={`${fieldClass} h-auto py-2`} placeholder="Add a short note" />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--oppa-border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)] hover:bg-[var(--oppa-cream)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:opacity-60">{busy ? 'Saving…' : actionLabel}</button>
        </div>
      </form>
    </InventoryModal>
  );
};

export const ReceiveStockModal: React.FC<{
  ingredient: MainBranchIngredient;
  suppliers: InventorySupplier[];
  busy: boolean;
  onClose: () => void;
  onSave: (values: { quantity: number; unit_cost: number; supplier_id: number | null; occurred_at: string; invoice_reference: string; expires_at?: string }) => Promise<void>;
}> = ({ ingredient, suppliers, busy, onClose, onSave }) => {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Number(form.get('quantity'));
    const unitCost = Number(form.get('unit_cost'));
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
      setError('Enter a positive quantity and a valid non-negative unit cost.');
      return;
    }
    try {
      await onSave({
        quantity,
        unit_cost: unitCost,
        supplier_id: form.get('supplier_id') ? Number(form.get('supplier_id')) : null,
        occurred_at: String(form.get('occurred_at') || ''),
        invoice_reference: String(form.get('invoice_reference') || '').trim(),
        expires_at: String(form.get('expires_at') || '') || undefined,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not receive stock.');
    }
  };
  return (
    <InventoryModal title="Receive stock" description={`${ingredient.name} · Purchase unit: ${ingredient.purchase_unit || ingredient.unit}`} onClose={onClose}>
      <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Quantity received <span className="text-red-600" aria-hidden="true">*</span>
            <input name="quantity" type="number" min="0.001" step="0.001" required className={fieldClass} />
          </label>
          <label className={labelClass}>Cost per {ingredient.purchase_unit || ingredient.unit} (₱) <span className="text-red-600" aria-hidden="true">*</span>
            <input name="unit_cost" type="number" min="0" step="0.01" required className={fieldClass} />
          </label>
        </div>
        <label className={labelClass}>Supplier
          <select name="supplier_id" defaultValue={ingredient.supplier_id || ''} className={fieldClass}>
            <option value="">No supplier recorded</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Received date
            <input name="occurred_at" type="datetime-local" className={fieldClass} />
          </label>
          <label className={labelClass}>Expiry date (optional)
            <input name="expires_at" type="date" className={fieldClass} />
          </label>
        </div>
        <label className={labelClass}>Invoice / reference
          <input name="invoice_reference" maxLength={160} className={fieldClass} />
        </label>
        <p className="text-xs text-[var(--oppa-text-muted)]">Stock is converted to {ingredient.unit} using the ingredient's purchase conversion factor. Unit cost is updated using weighted average.</p>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-[var(--oppa-border)] pt-4">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Receiving…' : 'Receive stock'}</button>
        </div>
      </form>
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
    if (!Number.isFinite(counted) || counted < 0 || !reason) {
      setError('Enter a valid counted quantity and a reason.');
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
      <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <p className="rounded-xl bg-[var(--oppa-cream)] px-4 py-3 text-sm">System quantity: <strong>{current.toLocaleString('en-PH', { maximumFractionDigits: 3 })} {ingredient.unit}</strong></p>
        <label className={labelClass}>Counted quantity <span className="text-red-600" aria-hidden="true">*</span>
          <input type="number" min="0" max="999999999" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required className={fieldClass} />
        </label>
        {quantity !== '' && Number.isFinite(counted) && <p className={`text-sm font-semibold ${variance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>Variance: {variance > 0 ? '+' : ''}{variance.toLocaleString('en-PH', { maximumFractionDigits: 3 })} {ingredient.unit}</p>}
        <label className={labelClass}>Reason <span className="text-red-600" aria-hidden="true">*</span>
          <textarea name="reason" required maxLength={2000} rows={3} className={`${fieldClass} h-auto py-2`} placeholder="Describe the stock count or discrepancy" />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-[var(--oppa-border)] pt-4">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border border-[var(--oppa-border)] px-4 text-sm font-semibold">Cancel</button>
          <button type="submit" disabled={busy || quantity === ''} className="min-h-11 rounded-xl bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Apply count'}</button>
        </div>
      </form>
    </InventoryModal>
  );
};

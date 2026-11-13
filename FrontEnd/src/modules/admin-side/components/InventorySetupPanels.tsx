import React, { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { LimitedInput } from '../../../components/ui/LimitedInput';
import { INPUT_LIMITS, normalizePhilippinePhone } from '../../../constants/inputLimits';
import {
  createSupplier,
  deleteSupplier,
  getInventoryRecipes,
  saveProductRecipes,
  updateSupplier,
} from '../../../services/mainBranchInventoryService';
import type {
  InventorySupplier,
  IngredientRecipe,
  ProductRecipeSet,
} from '../../../services/mainBranchInventoryService';

const fieldClass = 'mt-1 h-10 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-3 text-sm text-[var(--oppa-text)]';

export const SupplierManager: React.FC<{
  suppliers: InventorySupplier[];
  onClose: () => void;
  onChanged: () => void;
}> = ({ suppliers, onClose, onChanged }) => {
  const [editing, setEditing] = useState<InventorySupplier | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawName = String(form.get('name') || '');
    const rawContactPerson = String(form.get('contact_person') || '');
    const rawPhone = String(form.get('phone') || '');
    const rawEmail = String(form.get('email') || '');
    const rawNotes = String(form.get('notes') || '');
    const values: Omit<InventorySupplier, 'id' | 'ingredients_count'> = {
      name: editing && rawName.trim() === editing.name.trim() ? editing.name : rawName.trim(),
      contact_person: editing && rawContactPerson.trim() === (editing.contact_person || '').trim()
        ? editing.contact_person
        : rawContactPerson.trim() || null,
      phone: editing && rawPhone.trim() === (editing.phone || '').trim()
        ? editing.phone
        : normalizePhilippinePhone(rawPhone) || null,
      email: editing && rawEmail.trim() === (editing.email || '').trim()
        ? editing.email
        : rawEmail.trim().toLowerCase() || null,
      lead_time_days: form.get('lead_time_days') ? Number(form.get('lead_time_days')) : null,
      notes: editing && rawNotes.trim() === (editing.notes || '').trim()
        ? editing.notes
        : rawNotes.trim() || null,
    };
    setBusy(true);
    setError('');
    try {
      if (editing) await updateSupplier(editing.id, values);
      else await createSupplier(values);
      setEditing(null);
      formElement.reset();
      onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save supplier.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (supplier: InventorySupplier) => {
    if (!window.confirm(`Delete supplier "${supplier.name}"?`)) return;
    setError('');
    try {
      await deleteSupplier(supplier.id);
      onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete supplier.');
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="supplier-manager-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="supplier-manager-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">Supplier directory</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Manage suppliers used for purchasing and receiving.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-[var(--oppa-text-muted)]" aria-label="Close supplier manager">×</button>
        </div>
        <form onSubmit={(event) => { void save(event); }} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-[var(--oppa-text)]">Name *
            <LimitedInput name="name" required minLength={INPUT_LIMITS.categoryOrSupplierName.min} maxLength={INPUT_LIMITS.categoryOrSupplierName.max} inputFilter="businessName" showCounter defaultValue={editing?.name || ''} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-[var(--oppa-text)]">Contact person
            <LimitedInput name="contact_person" minLength={INPUT_LIMITS.personName.min} maxLength={INPUT_LIMITS.personName.max} inputFilter="personName" showCounter defaultValue={editing?.contact_person || ''} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-[var(--oppa-text)]">Phone
            <LimitedInput name="phone" type="tel" inputMode="tel" maxLength={13} inputFilter="phone" defaultValue={editing?.phone || ''} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-[var(--oppa-text)]">Email
            <LimitedInput name="email" type="email" maxLength={INPUT_LIMITS.email.max} defaultValue={editing?.email || ''} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-[var(--oppa-text)]">Lead time (days)
            <LimitedInput name="lead_time_days" type="number" inputMode="numeric" min="0" max="3650" step="1" inputFilter="digits" defaultValue={editing?.lead_time_days ?? ''} className={fieldClass} />
          </label>
          <label className="text-sm font-medium text-[var(--oppa-text)]">Notes
            <LimitedInput name="notes" maxLength={INPUT_LIMITS.longText.max} showCounter defaultValue={editing?.notes || ''} className={fieldClass} />
          </label>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Saving…' : editing ? 'Save supplier' : 'Add supplier'}</button>
            {editing && <button type="button" onClick={() => setEditing(null)} className="min-h-10 rounded-lg border border-[var(--oppa-border)] px-4 text-sm font-semibold text-[var(--oppa-text)]">Cancel edit</button>}
          </div>
        </form>
        <ul className="mt-5 divide-y divide-[var(--oppa-border)] border-t border-[var(--oppa-border)]">
          {suppliers.map((supplier) => <li key={supplier.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div><p className="font-semibold text-[var(--oppa-text)]">{supplier.name}</p><p className="text-xs text-[var(--oppa-text-muted)]">{supplier.contact_person || 'No contact'} · {supplier.phone || supplier.email || 'No contact details'}</p></div>
            <div className="flex gap-2"><button type="button" onClick={() => setEditing(supplier)} className="rounded-lg border border-[var(--oppa-border)] px-3 py-1.5 text-xs font-semibold">Edit</button><button type="button" disabled={(supplier.ingredients_count || 0) > 0} title={(supplier.ingredients_count || 0) > 0 ? 'Linked suppliers cannot be deleted' : 'Delete supplier'} onClick={() => void remove(supplier)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40">Delete</button></div>
          </li>)}
          {suppliers.length === 0 && <li className="py-5 text-sm text-[var(--oppa-text-muted)]">No suppliers yet.</li>}
        </ul>
      </section>
    </div>
  );
};

interface RecipeRow {
  ingredient_id: string;
  quantity: string;
  unit: string;
}

const mapRecipes = (recipes: IngredientRecipe[]): RecipeRow[] => recipes.map((recipe) => ({
  ingredient_id: String(recipe.ingredient_id),
  quantity: String(recipe.quantity),
  unit: recipe.unit,
}));

export const RecipeManager: React.FC<{
  onClose: () => void;
  onChanged: () => void;
}> = ({ onClose, onChanged }) => {
  const [products, setProducts] = useState<ProductRecipeSet[]>([]);
  const [ingredients, setIngredients] = useState<Array<{ id: number; name: string; unit: string }>>([]);
  const [productId, setProductId] = useState('');
  const [rows, setRows] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getInventoryRecipes().then((result) => {
      if (!active) return;
      setProducts(result.products);
      setIngredients(result.ingredients);
      setProductId(result.products[0]?.product.id || '');
      setRows(mapRecipes(result.products[0]?.recipes || []));
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load product recipes.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedProduct = useMemo(() => products.find((entry) => entry.product.id === productId), [products, productId]);
  const selectProduct = (id: string) => {
    setProductId(id);
    setRows(mapRecipes(products.find((entry) => entry.product.id === id)?.recipes || []));
    setError('');
  };
  const updateRow = (index: number, patch: Partial<RecipeRow>) =>
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const addRow = () => setRows((current) => [...current, { ingredient_id: '', quantity: '', unit: '' }]);
  const save = async () => {
    if (!productId) return;
    setSaving(true);
    setError('');
    try {
      await saveProductRecipes(productId, rows.map((row) => ({
        ingredient_id: Number(row.ingredient_id),
        quantity: Number(row.quantity),
        unit: row.unit,
      })));
      onChanged();
      const result = await getInventoryRecipes();
      setProducts(result.products);
      setIngredients(result.ingredients);
      setRows(mapRecipes(result.products.find((entry) => entry.product.id === productId)?.recipes || []));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save product recipe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="recipe-manager-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><h2 id="recipe-manager-title" className="font-serif text-xl font-bold text-[var(--oppa-text)]">Product recipes</h2><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Set usage quantities per portion in each ingredient's usage unit.</p></div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1 text-[var(--oppa-text-muted)]" aria-label="Close recipe manager">×</button>
        </div>
        {loading ? <p role="status" className="py-8 text-sm text-[var(--oppa-text-muted)]">Loading recipes…</p> : <>
          <label className="mt-4 block text-sm font-medium text-[var(--oppa-text)]">Product
            <select value={productId} onChange={(event) => selectProduct(event.target.value)} className={fieldClass}>
              {products.map((entry) => <option key={entry.product.id} value={entry.product.id}>{entry.product.name}</option>)}
            </select>
          </label>
          {selectedProduct?.can_make !== null && selectedProduct?.can_make !== undefined && <p className="mt-3 rounded-lg bg-[var(--oppa-green-soft)] p-3 text-sm font-semibold text-[var(--oppa-green-dark)]">Can make {selectedProduct.can_make.toLocaleString()} portion{selectedProduct.can_make === 1 ? '' : 's'} with current stock.</p>}
          <div className="mt-4 space-y-3">
            {rows.map((row, index) => {
              const selectedIngredient = ingredients.find((ingredient) => String(ingredient.id) === row.ingredient_id);
              return <div key={`${index}-${row.ingredient_id}`} className="grid gap-2 rounded-xl border border-[var(--oppa-border)] p-3 sm:grid-cols-[minmax(0,1fr)_140px_90px_auto]">
                <select aria-label={`Ingredient for recipe row ${index + 1}`} value={row.ingredient_id} onChange={(event) => {
                  const ingredient = ingredients.find((item) => String(item.id) === event.target.value);
                  updateRow(index, { ingredient_id: event.target.value, unit: ingredient?.unit || '' });
                }} className={fieldClass}>
                  <option value="">Select ingredient</option>{ingredients.map((ingredient) => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>)}
                </select>
                <input aria-label={`Quantity for recipe row ${index + 1}`} type="number" min="0.001" step="0.001" value={row.quantity} onChange={(event) => updateRow(index, { quantity: event.target.value })} className={fieldClass} placeholder="Quantity" />
                <span className="flex h-10 items-center text-sm text-[var(--oppa-text-muted)]">{selectedIngredient?.unit || row.unit || 'Unit'}</span>
                <button type="button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="h-10 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700">Remove</button>
              </div>;
            })}
          </div>
          <button type="button" onClick={addRow} className="mt-3 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm font-semibold text-[var(--oppa-text)]">Add ingredient</button>
          {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex justify-end gap-2 border-t border-[var(--oppa-border)] pt-4">
            <button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-[var(--oppa-border)] px-4 text-sm font-semibold">Close</button>
            <button type="button" onClick={() => void save()} disabled={saving || !productId} className="min-h-10 rounded-lg bg-[var(--oppa-green)] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save recipe'}</button>
          </div>
        </>}
      </section>
    </div>
  );
};

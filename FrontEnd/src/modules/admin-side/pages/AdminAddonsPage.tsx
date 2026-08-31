import React, { useEffect, useState } from 'react';
import { ImagePlus, Plus, Save, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { productService } from '../../../services/productService';
import type { AddonGroup } from '../../../types/product.types';
import { categories } from '../../../data/mockData';
import { getAddonImage } from '../../../data/productImages';

const DEFAULT_ADDON_IMAGE = getAddonImage();

type AddonDraft = {
  name: string;
  price: string;
  image?: string;
  preview?: string;
  imageFile?: File | null;
};

const createEmptyAddonDraft = (): AddonDraft => ({
  name: '',
  price: '',
  image: '',
  preview: '',
  imageFile: undefined,
});

const sanitizePositivePriceInput = (value: string): string => {
  if (!value) return '';

  const digitsOnly = value.replace(/[^\d.]/g, '');
  const [whole, ...decimalParts] = digitsOnly.split('.');
  const safeValue = decimalParts.length > 0
    ? `${whole || '0'}.${decimalParts.join('')}`
    : whole || '';

  if (!safeValue || safeValue === '0' || safeValue === '0.') return '';

  const parsedValue = Number.parseFloat(safeValue);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) return '';

  return String(parsedValue);
};

const editableCategories = categories.filter((category) => category.id !== 'all');

const AdminAddonsPage: React.FC = () => {
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [newGroup, setNewGroup] = useState({ name: '', categories: [] as string[] });
  const [newAddon, setNewAddon] = useState<Record<number, AddonDraft>>({});
  const [editingAddon, setEditingAddon] = useState<Record<number, AddonDraft>>({});
  const [editingGroups, setEditingGroups] = useState<Record<number, { name: string; categories: string[]; selection_type: 'single' | 'multiple'; supports_quantity: boolean }>>({});
  const [message, setMessage] = useState('');

  const refresh = async () => setGroups(await productService.getAdminAddonGroups());
  useEffect(() => { refresh().catch(() => setMessage('Unable to load add-on configuration.')); }, []);

  const toggleCategory = (category: string) => setNewGroup((current) => ({
    ...current,
    categories: current.categories.includes(category)
      ? current.categories.filter((item) => item !== category)
      : [...current.categories, category],
  }));

  const addGroup = async () => {
    if (!newGroup.name || newGroup.categories.length === 0) return;
    await productService.createAddonGroup({ name: newGroup.name, applicable_categories: newGroup.categories, selection_type: 'multiple', supports_quantity: false });
    setNewGroup({ name: '', categories: [] });
    await refresh();
  };

  const addAddon = async (groupId: number) => {
    const draft = newAddon[groupId] ?? createEmptyAddonDraft();
    const normalizedName = draft.name?.trim() ?? '';
    const parsedPrice = draft.price === '' ? Number.NaN : Number.parseFloat(String(draft.price));

    if (!normalizedName) {
      setMessage('Enter an add-on name first.');
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setMessage('Enter a valid positive add-on price.');
      return;
    }

    try {
      let imageUrl = draft.image || '';
      if (draft.imageFile) imageUrl = await productService.uploadImage(draft.imageFile, 'addons');

      await productService.createAddon(groupId, {
        name: normalizedName,
        price: parsedPrice,
        image: imageUrl || undefined,
      });

      setNewAddon((current) => ({ ...current, [groupId]: createEmptyAddonDraft() }));
      setMessage('Add-on added successfully.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add this add-on.');
    }
  };

  const saveAddon = async (addonId: number) => {
    const draft = editingAddon[addonId];
    if (!draft) return;

    let imageUrl = draft.image || '';
    if (draft.imageFile) {
      imageUrl = await productService.uploadImage(draft.imageFile, 'addons');
    }

    await productService.updateAddon(addonId, {
      name: draft.name,
      price: Number(draft.price) || 0,
      image: imageUrl || undefined,
    });

    setEditingAddon((current) => { const next = { ...current }; delete next[addonId]; return next; });
    await refresh();
  };

  const toggleAddonAvailability = async (addonId: number, isActive: boolean) => {
    await productService.updateAddon(addonId, { is_active: !isActive });
    await refresh();
  };

  const deleteAddon = async (addonId: number, addonName: string) => {
    if (!window.confirm(`Delete "${addonName}"? Past orders will keep their saved add-on details.`)) return;
    await productService.deleteAddon(addonId);
    await refresh();
  };

  const beginGroupEdit = (group: AddonGroup) => setEditingGroups((current) => ({
    ...current,
    [group.id]: {
      name: group.name,
      categories: group.applicable_categories || [],
      selection_type: group.selection_type,
      supports_quantity: group.supports_quantity,
    },
  }));

  const saveGroup = async (groupId: number) => {
    const draft = editingGroups[groupId];
    if (!draft || !draft.name || draft.categories.length === 0) return;
    await productService.updateAddonGroup(groupId, { ...draft, applicable_categories: draft.categories });
    setEditingGroups((current) => { const next = { ...current }; delete next[groupId]; return next; });
    await refresh();
  };

  const toggleGroupCategory = (groupId: number, category: string) => {
    const draft = editingGroups[groupId];
    if (!draft) return;
    setEditingGroups({
      ...editingGroups,
      [groupId]: { ...draft, categories: draft.categories.includes(category) ? draft.categories.filter((item) => item !== category) : [...draft.categories, category] },
    });
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h1 className="font-serif text-3xl font-bold text-[var(--oppa-text)]">Add-ons</h1><p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Configure which options appear for each menu category.</p></div>
      </div>
      {message && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</p>}
      <section className="mb-6 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-[var(--oppa-text)]">Create add-on group</h2>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input value={newGroup.name} onChange={(event) => setNewGroup({ ...newGroup, name: event.target.value })} placeholder="Group name" className="flex-1 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" />
          <button onClick={addGroup} className="flex items-center justify-center gap-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-medium text-white"><Plus size={16} /> Add group</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{editableCategories.map((category) => <button key={category.id} onClick={() => toggleCategory(category.id)} className={`rounded-full px-3 py-1.5 text-xs ${newGroup.categories.includes(category.id) ? 'bg-[var(--oppa-green)] text-white' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)]'}`}>{category.name}</button>)}</div>
      </section>
      <div className="space-y-4">{groups.map((group) => <section key={group.id} className="rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-[var(--oppa-text)]">{group.name}</h2><p className="text-xs text-[var(--oppa-text-muted)]">{group.selection_type === 'single' ? 'Single selection' : 'Multiple selection'}{group.supports_quantity ? ' • Quantity enabled' : ''}</p></div><div className="flex items-center gap-3"><button onClick={() => beginGroupEdit(group)} className="text-xs text-[var(--oppa-green)]">Edit group</button><button onClick={() => productService.updateAddonGroup(group.id, { is_active: !(group.is_active ?? true) }).then(refresh).catch(() => setMessage('Unable to update group availability.'))} className="text-xs text-[var(--oppa-green)]">{group.is_active === false ? <><ToggleLeft size={16} className="inline" /> Inactive</> : <><ToggleRight size={16} className="inline" /> Active</>}</button></div></div>
        {editingGroups[group.id] && <div className="mt-3 rounded-lg border border-[var(--oppa-border)] p-3"><div className="flex flex-col gap-2 sm:flex-row"><input value={editingGroups[group.id].name} onChange={(event) => setEditingGroups({ ...editingGroups, [group.id]: { ...editingGroups[group.id], name: event.target.value } })} className="flex-1 rounded border px-2 py-1 text-sm" /><button onClick={() => saveGroup(group.id)} className="rounded bg-[var(--oppa-green)] px-3 py-1 text-sm text-white">Save</button></div><div className="mt-2 flex flex-wrap gap-2">{editableCategories.map((category) => <button key={category.id} onClick={() => toggleGroupCategory(group.id, category.id)} className={`rounded-full px-2 py-1 text-xs ${editingGroups[group.id].categories.includes(category.id) ? 'bg-[var(--oppa-green)] text-white' : 'bg-[var(--oppa-green-soft)] text-[var(--oppa-text)]'}`}>{category.name}</button>)}</div></div>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{group.addons.map((addon) => { const draft = editingAddon[Number(addon.id)]; const isActive = addon.is_active !== false; return <div key={addon.id} className={`flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-[var(--oppa-cream)]' : 'bg-gray-100 text-gray-400'}`}>{draft ? <>
          <img src={getAddonImage(draft.preview || draft.image || addon.image)} alt={draft.name || addon.name} onError={(event) => { event.currentTarget.src = DEFAULT_ADDON_IMAGE; }} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
          <input value={draft.name} onChange={(event) => setEditingAddon({ ...editingAddon, [Number(addon.id)]: { ...draft, name: event.target.value } })} className="min-w-0 flex-1 rounded border px-2 py-1" />
          <input type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.price} onChange={(event) => {
            const sanitized = sanitizePositivePriceInput(event.target.value);
            setEditingAddon({ ...editingAddon, [Number(addon.id)]: { ...draft, price: sanitized || '' } });
          }} className="w-20 rounded border px-2 py-1" />
          <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded border border-dashed border-[var(--oppa-border)] bg-white text-[var(--oppa-green)]" title="Upload add-on image">
            <ImagePlus size={15} />
            <input type="file" accept="image/*" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                setEditingAddon((current) => ({
                  ...current,
                  [Number(addon.id)]: { ...draft, imageFile: file, preview: typeof reader.result === 'string' ? reader.result : draft.preview || draft.image || addon.image || DEFAULT_ADDON_IMAGE },
                }));
              };
              reader.readAsDataURL(file);
            }} />
          </label>
          <button onClick={() => saveAddon(Number(addon.id))} className="text-xs font-medium text-[var(--oppa-green)]">Save</button>
        </> : <><img src={getAddonImage(addon.image)} alt={addon.name} onError={(event) => { event.currentTarget.src = DEFAULT_ADDON_IMAGE; }} className="h-10 w-10 shrink-0 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate">{addon.name}</span><span className="shrink-0 font-medium">₱{Number(addon.price).toFixed(2)}</span><button onClick={() => setEditingAddon({ ...editingAddon, [Number(addon.id)]: { name: addon.name, price: String(addon.price), image: addon.image || '', preview: addon.image || '' } })} className="shrink-0 text-xs text-[var(--oppa-green)]">Edit</button><button onClick={() => toggleAddonAvailability(Number(addon.id), isActive)} className="shrink-0 text-xs text-[var(--oppa-green)]">{isActive ? 'Available' : 'Not available'}</button><button onClick={() => deleteAddon(Number(addon.id), addon.name)} aria-label={`Delete ${addon.name}`} title="Delete add-on" className="shrink-0 text-red-600"><Trash2 size={15} /></button></>}</div>; })}</div>
        <div className="mt-4 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/40 p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(110px,0.7fr)_auto_auto]">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--oppa-border)] bg-white px-2 py-2">
              <img src={getAddonImage(newAddon[group.id]?.preview || newAddon[group.id]?.image)} alt="Add-on preview" onError={(event) => { event.currentTarget.src = DEFAULT_ADDON_IMAGE; }} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              <input
                value={newAddon[group.id]?.name || ''}
                onChange={(event) => setNewAddon((current) => ({
                  ...current,
                  [group.id]: { ...(current[group.id] || createEmptyAddonDraft()), name: event.target.value },
                }))}
                placeholder="New add-on"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)] focus:outline-none"
              />
            </div>

            <input
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={newAddon[group.id]?.price ?? ''}
              onChange={(event) => {
                const sanitized = sanitizePositivePriceInput(event.target.value);
                setNewAddon((current) => ({
                  ...current,
                  [group.id]: { ...(current[group.id] || createEmptyAddonDraft()), price: sanitized || '' },
                }));
              }}
              placeholder="Price"
              className="w-full rounded-lg border border-[var(--oppa-border)] bg-white px-3 py-2 text-sm text-[var(--oppa-text)] placeholder:text-[var(--oppa-text-muted)] focus:border-[var(--oppa-green)] focus:outline-none"
            />

            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--oppa-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--oppa-green)] transition hover:border-[var(--oppa-green)] hover:bg-[var(--oppa-green-soft)]">
              <ImagePlus size={16} />
              <span>{newAddon[group.id]?.imageFile ? 'Change image' : 'Upload'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setNewAddon((current) => ({
                    ...current,
                    [group.id]: { ...(current[group.id] || createEmptyAddonDraft()), imageFile: file, preview: typeof reader.result === 'string' ? reader.result : DEFAULT_ADDON_IMAGE },
                  }));
                };
                reader.readAsDataURL(file);
              }} />
            </label>

            <button type="button" onClick={() => addAddon(group.id)} className="flex items-center justify-center gap-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105">
              <Save size={15} />
              Add
            </button>
          </div>

          {(() => {
            const selectedImageFile = newAddon[group.id]?.imageFile;
            return selectedImageFile ? (
              <div className="mt-2 text-xs text-[var(--oppa-text-muted)]">
                Selected image: {selectedImageFile.name}
              </div>
            ) : null;
          })()}
        </div>
      </section>)}</div>
    </AdminLayout>
  );
};

export default AdminAddonsPage;
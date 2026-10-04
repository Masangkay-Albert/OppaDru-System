import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ImagePlus, PackageOpen, Plus, Save } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { AvailabilitySwitch, ConfirmDialog, EmptyState, PageHeader, RowActionsMenu } from '../components/AdminUI';
import { productService } from '../../../services/productService';
import type { AddonGroup } from '../../../types/product.types';
import { categories } from '../../../data/mockData';
import { getAddonImage } from '../../../data/productImages';

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

const handlePriceInput = (
  value: string,
  onValidValue: (normalized: string) => void,
  onError: (message: string) => void,
) => {
  if (value === '') {
    onError('');
    onValidValue('');
    return;
  }

  if (!/^\d*\.?\d*$/.test(value)) {
    onError('Price must be a valid number. Letters and symbols are not allowed.');
    return;
  }

  const normalized = sanitizePositivePriceInput(value);
  if (!normalized) {
    onError('Price must be a valid positive number.');
    return;
  }

  onError('');
  onValidValue(normalized);
};

const editableCategories = categories.filter((category) => category.id !== 'all');

const AddonImage: React.FC<{ image?: string; name: string; preview?: string }> = ({ image, name, preview }) => {
  const [failed, setFailed] = useState(false);
  const source = preview || image;
  const hasUploadedPhoto = Boolean(source && source !== '/oppadrulogo.jpg' && source !== 'oppadrulogo.jpg' && !failed);
  return hasUploadedPhoto && source
    ? <img src={getAddonImage(source)} alt={name} onError={() => setFailed(true)} className="size-10 shrink-0 rounded-xl object-cover" />
    : <span aria-label={`${name} image placeholder`} className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-sm font-bold text-green-700">{name.trim().charAt(0).toUpperCase() || <PackageOpen size={18} />}</span>;
};

const AdminAddonsPage: React.FC = () => {
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newGroup, setNewGroup] = useState({ name: '', categories: [] as string[] });
  const [newAddon, setNewAddon] = useState<Record<number, AddonDraft>>({});
  const [editingAddon, setEditingAddon] = useState<Record<number, AddonDraft>>({});
  const [editingGroups, setEditingGroups] = useState<Record<number, { name: string; categories: string[]; selection_type: 'single' | 'multiple'; supports_quantity: boolean }>>({});
  const [message, setMessage] = useState('');
  const [priceError, setPriceError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'addon' | 'group'; id: number; name: string } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});
  const [addingAddonGroup, setAddingAddonGroup] = useState<number | null>(null);

  const refresh = async () => {
    try {
      setGroups(await productService.getAdminAddonGroups());
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh().catch((error: unknown) => {
      console.error('Unable to load add-on configuration:', error);
      setMessage('Unable to load add-on configuration.');
    }); }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const toggleCategory = (category: string) => setNewGroup((current) => ({
    ...current,
    categories: current.categories.includes(category)
      ? current.categories.filter((item) => item !== category)
      : [...current.categories, category],
  }));

  const addGroup = async () => {
    if (!newGroup.name.trim() || newGroup.categories.length === 0) return;
    try {
      await productService.createAddonGroup({ name: newGroup.name, applicable_categories: newGroup.categories, selection_type: 'multiple', supports_quantity: false });
      setNewGroup({ name: '', categories: [] });
      await refresh();
    } catch (error) {
      console.error('Unable to create add-on group:', error);
      setMessage(error instanceof Error ? error.message : 'Unable to create add-on group.');
    }
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
      setAddingAddonGroup(null);
      setMessage('Add-on added successfully.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add this add-on.');
    }
  };

  const saveAddon = async (addonId: number) => {
    const draft = editingAddon[addonId];
    if (!draft) return;

    try {
      const image = draft.imageFile
        ? await productService.uploadImage(draft.imageFile, 'addons')
        : undefined;
      await productService.updateAddon(addonId, {
        name: draft.name,
        price: Number(draft.price) || 0,
        ...(image ? { image } : {}),
      });

      setEditingAddon((current) => { const next = { ...current }; delete next[addonId]; return next; });
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? `Image upload failed: ${error.message}` : 'Unable to save this add-on.');
    }
  };

  const toggleAddonAvailability = async (addonId: number, isActive: boolean) => {
    try {
      await productService.updateAddon(addonId, { is_active: !isActive });
      await refresh();
    } catch (error) {
      console.error('Unable to update add-on availability:', error);
      setMessage('Unable to update add-on availability.');
    }
  };

  const deleteAddon = async (addonId: number, addonName: string) => {
    setDeleteTarget({ type: 'addon', id: addonId, name: addonName });
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
    try {
      await productService.updateAddonGroup(groupId, { ...draft, applicable_categories: draft.categories });
      setEditingGroups((current) => { const next = { ...current }; delete next[groupId]; return next; });
      await refresh();
    } catch (error) {
      console.error('Unable to update add-on group:', error);
      setMessage(error instanceof Error ? error.message : 'Unable to update add-on group.');
    }
  };

  const deleteGroup = async (groupId: number, groupName: string) => {
    setDeleteTarget({ type: 'group', id: groupId, name: groupName });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'addon') {
        await productService.deleteAddon(deleteTarget.id);
      } else {
        await productService.deleteAddonGroup(deleteTarget.id);
      }
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete this item.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleGroupCategory = (groupId: number, category: string) => {
    const draft = editingGroups[groupId];
    if (!draft) return;
    setEditingGroups({
      ...editingGroups,
      [groupId]: { ...draft, categories: draft.categories.includes(category) ? draft.categories.filter((item) => item !== category) : [...draft.categories, category] },
    });
  };

  const getCategoryLabels = (group: AddonGroup) => (group.applicable_categories || [])
    .map((id) => editableCategories.find((category) => category.id === id)?.name || id)
    .join(', ');

  const cancelNewAddon = (groupId: number) => {
    setAddingAddonGroup(null);
    setNewAddon((current) => ({ ...current, [groupId]: createEmptyAddonDraft() }));
    setPriceError('');
  };

  return (
    <AdminLayout>
      <PageHeader title="Add-ons" subtitle="Configure which options appear for each menu category." />
      {message && <p role="status" className={`mb-4 rounded-lg p-3 text-sm ${message.includes('successfully') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message}</p>}
      {priceError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{priceError}</p>}
      {deleteTarget && <ConfirmDialog title={deleteTarget.type === 'addon' ? `Delete "${deleteTarget.name}"?` : `Delete the "${deleteTarget.name}" add-on group?`} description={deleteTarget.type === 'addon' ? 'Past orders will keep their saved add-on details.' : 'This will also remove all add-ons under it.'} confirmLabel="Delete" onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />}

      <section className="admin-card mb-6 p-5">
        <h2 className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Create add-on group</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input aria-label="Add-on group name" value={newGroup.name} onChange={(event) => setNewGroup({ ...newGroup, name: event.target.value })} placeholder="Group name" className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--oppa-border)] px-3 text-sm" />
          <button type="button" disabled={!newGroup.name.trim() || newGroup.categories.length === 0} onClick={() => void addGroup()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} />Add group</button>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-[var(--oppa-text-muted)]">Apply to categories</p>
          <div className="flex flex-wrap gap-2">{editableCategories.map((category) => {
            const selected = newGroup.categories.includes(category.id);
            return <button type="button" aria-pressed={selected} key={category.id} onClick={() => toggleCategory(category.id)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${selected ? 'border-green-700 bg-green-700 text-white' : 'border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] hover:border-green-700'}`}>{selected && <Check size={13} />}{category.name}</button>;
          })}</div>
        </div>
      </section>

      {isLoading
        ? <div aria-busy="true" aria-label="Loading add-on groups" className="admin-card animate-pulse space-y-3 p-5">{[0, 1, 2].map((item) => <div key={item} className="admin-skeleton h-16 rounded-xl" />)}</div>
        : groups.length === 0
          ? <div className="admin-card"><EmptyState icon={<PackageOpen size={23} />} title="No add-on groups yet" description="Create a group to organize custom add-ons for your menu." /></div>
          : <div className="space-y-4">{groups.map((group) => {
            const isExpanded = expandedGroups[group.id] !== false;
            const groupActive = group.is_active !== false;
            const draftGroup = editingGroups[group.id];
            return <section key={group.id} className="admin-card overflow-visible p-0">
              <div className="flex min-w-0 flex-wrap items-center gap-3 p-4 sm:p-5">
                <button type="button" aria-expanded={isExpanded} onClick={() => setExpandedGroups((current) => ({ ...current, [group.id]: !isExpanded }))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-green-700 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-[var(--oppa-text)]">{group.name}</span>
                      {getCategoryLabels(group) && <span title={getCategoryLabels(group)} className="max-w-48 truncate rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-medium text-stone-600">{getCategoryLabels(group)}</span>}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--oppa-text-muted)]">{group.selection_type === 'single' ? 'Single selection' : 'Multiple selection'} · {group.addons.length} {group.addons.length === 1 ? 'item' : 'items'}{group.supports_quantity ? ' · Quantity enabled' : ''}</span>
                  </span>
                </button>
                <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3" onClick={(event) => event.stopPropagation()}>
                  <span className="text-xs font-medium text-[var(--oppa-text-muted)]">{groupActive ? 'Active' : 'Inactive'}</span>
                  <AvailabilitySwitch checked={groupActive} label={`Set ${group.name} ${groupActive ? 'inactive' : 'active'}`} activeText="Active" inactiveText="Inactive" onChange={() => { void productService.updateAddonGroup(group.id, { is_active: !groupActive }).then(refresh).catch((error: unknown) => { console.error('Unable to update group availability:', error); setMessage('Unable to update group availability.'); }); }} />
                  <RowActionsMenu label={group.name} items={[{ label: 'Edit group', onSelect: () => beginGroupEdit(group) }, { label: 'Delete group', destructive: true, onSelect: () => void deleteGroup(group.id, group.name) }]} />
                </div>
              </div>
              <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="border-t border-[var(--oppa-border)] px-4 pb-5 sm:px-5">
                    {draftGroup && <div className="mt-4 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-cream)]/50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input aria-label="Edit group name" value={draftGroup.name} onChange={(event) => setEditingGroups({ ...editingGroups, [group.id]: { ...draftGroup, name: event.target.value } })} className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--oppa-border)] px-3 text-sm" />
                        <select aria-label="Selection type" value={draftGroup.selection_type} onChange={(event) => setEditingGroups({ ...editingGroups, [group.id]: { ...draftGroup, selection_type: event.target.value as 'single' | 'multiple' } })} className="h-10 rounded-lg border border-[var(--oppa-border)] px-3 text-sm"><option value="single">Single selection</option><option value="multiple">Multiple selection</option></select>
                        <button type="button" onClick={() => void saveGroup(group.id)} disabled={!draftGroup.name.trim() || draftGroup.categories.length === 0} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save</button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">{editableCategories.map((category) => <button type="button" aria-pressed={draftGroup.categories.includes(category.id)} key={category.id} onClick={() => toggleGroupCategory(group.id, category.id)} className={`rounded-full border px-2.5 py-1 text-xs ${draftGroup.categories.includes(category.id) ? 'border-green-700 bg-green-700 text-white' : 'border-[var(--oppa-border)] bg-white text-[var(--oppa-text)]'}`}>{category.name}</button>)}</div>
                    </div>}

                    {group.addons.length === 0
                      ? <div className="mt-3 rounded-xl border border-dashed border-[var(--oppa-border)]">
                        <EmptyState icon={<PackageOpen size={20} />} title="No add-ons yet" description="Add the first option to this group." action={<button type="button" onClick={() => setAddingAddonGroup(group.id)} className="mt-1 inline-flex items-center gap-1 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white"><Plus size={14} />Add add-on</button>} />
                      </div>
                      : <div className="admin-scrollbar mt-3 grid gap-3 sm:grid-cols-2">{group.addons.map((addon) => {
                        const addonId = Number(addon.id);
                        const draft = editingAddon[addonId];
                        const available = addon.is_active !== false;
                        return <div key={addon.id} className={`min-w-0 rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 transition-opacity ${available ? '' : 'opacity-60'}`}>
                          {draft
                            ? <div className="grid grid-cols-[40px_minmax(0,1fr)_90px] items-center gap-3">
                              <AddonImage name={draft.name || addon.name} image={draft.image} preview={draft.preview} />
                              <input aria-label={`Edit ${addon.name}`} value={draft.name} onChange={(event) => setEditingAddon((current) => ({ ...current, [addonId]: { ...draft, name: event.target.value } }))} className="h-10 min-w-0 rounded-lg border border-[var(--oppa-border)] px-2 text-sm" />
                              <input aria-label={`Price for ${addon.name}`} type="text" inputMode="decimal" value={draft.price} onChange={(event) => handlePriceInput(event.target.value, (price) => setEditingAddon((current) => ({ ...current, [addonId]: { ...draft, price } })), setPriceError)} className="h-10 w-full rounded-lg border border-[var(--oppa-border)] px-2 text-right text-sm tabular-nums" />
                              <div className="col-span-3 flex items-center justify-between">
                                <label title="Upload add-on photo" className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-green-700 hover:bg-green-50"><ImagePlus size={17} /><input type="file" accept="image/*" className="hidden" onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (!file) return;
                                  const reader = new FileReader();
                                  reader.onload = () => setEditingAddon((current) => ({ ...current, [addonId]: { ...draft, imageFile: file, preview: typeof reader.result === 'string' ? reader.result : draft.preview } }));
                                  reader.readAsDataURL(file);
                                }} /></label>
                                <div className="flex gap-2"><button type="button" onClick={() => setEditingAddon((current) => { const next = { ...current }; delete next[addonId]; return next; })} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-xs">Cancel</button><button type="button" disabled={!draft.name.trim() || Number(draft.price) <= 0} onClick={() => void saveAddon(addonId)} className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save</button></div>
                              </div>
                            </div>
                            : <div className="grid grid-cols-[40px_minmax(0,1fr)_90px_auto_36px] items-center gap-4">
                              <AddonImage name={addon.name} image={addon.image} />
                              <span className="min-w-0 truncate text-sm font-medium text-[var(--oppa-text)]" title={addon.name}>{addon.name}</span>
                              <span className="tabular-nums w-[90px] text-right text-sm font-semibold text-[var(--oppa-text)]">₱{Number(addon.price).toFixed(2)}</span>
                              <AvailabilitySwitch checked={available} label={`Set ${addon.name} ${available ? 'unavailable' : 'available'}`} activeText="Available" inactiveText="Unavailable" onChange={() => void toggleAddonAvailability(addonId, available)} />
                              <RowActionsMenu label={addon.name} items={[{ label: 'Edit add-on', onSelect: () => setEditingAddon((current) => ({ ...current, [addonId]: { name: addon.name, price: String(addon.price), image: addon.image || '', preview: addon.image || '' } })) }, { label: 'Delete add-on', destructive: true, onSelect: () => void deleteAddon(addonId, addon.name) }]} />
                            </div>}
                        </div>;
                      })}</div>}

                    {addingAddonGroup === group.id && <div className="mt-3 rounded-xl border border-green-200 bg-green-50/50 p-4">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
                        <input aria-label="New add-on name" value={newAddon[group.id]?.name || ''} onChange={(event) => setNewAddon((current) => ({ ...current, [group.id]: { ...(current[group.id] || createEmptyAddonDraft()), name: event.target.value } }))} placeholder="Add-on name" className="h-10 min-w-0 rounded-lg border border-[var(--oppa-border)] px-3 text-sm" />
                        <input aria-label="New add-on price" type="text" inputMode="decimal" value={newAddon[group.id]?.price || ''} onChange={(event) => handlePriceInput(event.target.value, (price) => setNewAddon((current) => ({ ...current, [group.id]: { ...(current[group.id] || createEmptyAddonDraft()), price } })), setPriceError)} placeholder="Price (₱)" className="h-10 rounded-lg border border-[var(--oppa-border)] px-3 text-sm tabular-nums" />
                        <label title="Upload optional add-on photo" className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--oppa-border)] bg-white px-3 text-xs font-medium text-green-800 hover:bg-green-50"><ImagePlus size={16} />{newAddon[group.id]?.imageFile ? 'Photo selected' : 'Optional photo'}<input type="file" accept="image/*" className="hidden" onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => setNewAddon((current) => ({ ...current, [group.id]: { ...(current[group.id] || createEmptyAddonDraft()), imageFile: file, preview: typeof reader.result === 'string' ? reader.result : '' } }));
                          reader.readAsDataURL(file);
                        }} /></label>
                      </div>
                      <div className="mt-3 flex justify-end gap-2">
                        <button type="button" onClick={() => cancelNewAddon(group.id)} className="rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-xs font-medium">Cancel</button>
                        <button type="button" disabled={!newAddon[group.id]?.name.trim() || Number(newAddon[group.id]?.price) <= 0} onClick={() => void addAddon(group.id)} className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Save size={14} />Save add-on</button>
                      </div>
                    </div>}
                    {addingAddonGroup !== group.id && <button type="button" onClick={() => setAddingAddonGroup(group.id)} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"><Plus size={16} />Add add-on</button>}
                  </div>
                </div>
              </div>
            </section>;
          })}</div>}
    </AdminLayout>
  );
};

export default AdminAddonsPage;
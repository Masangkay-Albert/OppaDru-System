import React, { useEffect, useState } from 'react';
import { Plus, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { productService } from '../../../services/productService';
import type { AddonGroup } from '../../../types/product.types';
import { categories } from '../../../data/mockData';

const editableCategories = categories.filter((category) => category.id !== 'all');

const AdminAddonsPage: React.FC = () => {
  const [groups, setGroups] = useState<AddonGroup[]>([]);
  const [newGroup, setNewGroup] = useState({ name: '', categories: [] as string[] });
  const [newAddon, setNewAddon] = useState<Record<number, { name: string; price: string }>>({});
  const [editingAddon, setEditingAddon] = useState<Record<number, { name: string; price: string }>>({});
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
    const draft = newAddon[groupId];
    if (!draft?.name) return;
    await productService.createAddon(groupId, { name: draft.name, price: Number(draft.price) || 0 });
    setNewAddon((current) => ({ ...current, [groupId]: { name: '', price: '' } }));
    await refresh();
  };

  const saveAddon = async (addonId: number) => {
    const draft = editingAddon[addonId];
    if (!draft) return;
    await productService.updateAddon(addonId, { name: draft.name, price: Number(draft.price) || 0 });
    setEditingAddon((current) => { const next = { ...current }; delete next[addonId]; return next; });
    await refresh();
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
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-[var(--oppa-text)]">{group.name}</h2><p className="text-xs text-[var(--oppa-text-muted)]">{group.selection_type === 'single' ? 'Single selection' : 'Multiple selection'}{group.supports_quantity ? ' • Quantity enabled' : ''}</p></div><button onClick={() => productService.updateAddonGroup(group.id, { is_active: !((group as any).is_active ?? true) }).then(refresh)} className="text-xs text-[var(--oppa-green)]">{(group as any).is_active === false ? <><ToggleLeft size={16} className="inline" /> Inactive</> : <><ToggleRight size={16} className="inline" /> Active</>}</button></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{group.addons.map((addon) => { const draft = editingAddon[Number(addon.id)]; return <div key={addon.id} className="flex items-center gap-2 rounded-lg bg-[var(--oppa-cream)] px-3 py-2 text-sm">{draft ? <><input value={draft.name} onChange={(event) => setEditingAddon({ ...editingAddon, [Number(addon.id)]: { ...draft, name: event.target.value } })} className="min-w-0 flex-1 rounded border px-2 py-1" /><input type="number" min="0" value={draft.price} onChange={(event) => setEditingAddon({ ...editingAddon, [Number(addon.id)]: { ...draft, price: event.target.value } })} className="w-20 rounded border px-2 py-1" /><button onClick={() => saveAddon(Number(addon.id))} className="text-xs font-medium text-[var(--oppa-green)]">Save</button></> : <><span className="flex-1">{addon.name}</span><span className="font-medium">₱{Number(addon.price).toFixed(2)}</span><button onClick={() => setEditingAddon({ ...editingAddon, [Number(addon.id)]: { name: addon.name, price: String(addon.price) } })} className="text-xs text-[var(--oppa-green)]">Edit</button></>}</div>; })}</div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={newAddon[group.id]?.name || ''} onChange={(event) => setNewAddon({ ...newAddon, [group.id]: { ...(newAddon[group.id] || { price: '' }), name: event.target.value } })} placeholder="New add-on" className="flex-1 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm" /><input type="number" min="0" value={newAddon[group.id]?.price || ''} onChange={(event) => setNewAddon({ ...newAddon, [group.id]: { ...(newAddon[group.id] || { name: '' }), price: event.target.value } })} placeholder="Price" className="w-full rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm sm:w-28" /><button onClick={() => addAddon(group.id)} className="flex items-center justify-center gap-2 rounded-lg bg-[var(--oppa-green-soft)] px-4 py-2 text-sm text-[var(--oppa-text)]"><Save size={15} /> Add</button></div>
      </section>)}</div>
    </AdminLayout>
  );
};

export default AdminAddonsPage;
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import AdminLayout from '../components/AdminLayout';
import { ConfirmDialog } from '../components/AdminUI';
import { useToast } from '../../customer-side/components/ToastProvider';
import {
  archiveIngredient,
  adjustIngredientStock,
  countIngredientStock,
  createIngredient,
  downloadIngredientCsv,
  getMainBranchInventory,
  importIngredientCsv,
  receiveIngredientStock,
  updateIngredient,
} from '../../../services/mainBranchInventoryService';
import type {
  InventorySupplier,
  InventorySummary,
  MainBranchIngredient,
  MainBranchStockMovement,
  StockMovementType,
} from '../../../services/mainBranchInventoryService';
import { formatCurrency } from '../../../utils/formatters';
import { AdjustStockModal, CountStockModal, IngredientFormModal, QuickStockActionModal, ReceiveStockModal } from '../components/MainBranchInventoryModals';
import { RecipeManager, SupplierManager } from '../components/InventorySetupPanels';
import { RestockRequestsManager } from '../components/RestockRequestsManager';
import { IngredientList, InventoryMoreMenu, InventorySummaryCards, InventoryToolbar, RecentActivity } from '../components/InventoryDashboardSections';
import type { InventoryStatusFilter } from '../components/InventoryDashboardSections';

const PAGE_SIZE = 12;

const quantityLabel = (quantity: number | string, unit: string) => {
  const parsed = Number(quantity);
  return `${Number.isFinite(parsed) ? parsed.toLocaleString('en-PH', { maximumFractionDigits: 3 }) : '0'} ${unit}`;
};

const getIngredientStatus = (ingredient: MainBranchIngredient): 'out_of_stock' | 'low_stock' | 'in_stock' => {
  const quantity = Number(ingredient.usable_quantity ?? ingredient.quantity);
  if (quantity <= 0) return 'out_of_stock';
  return quantity <= Number(ingredient.reorder_level) ? 'low_stock' : 'in_stock';
};

const AdminInventoryPage: React.FC = () => {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [ingredients, setIngredients] = useState<MainBranchIngredient[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({ total: 0, low_stock: 0, out_of_stock: 0, needs_restocking: 0, stock_value: 0 });
  const [recentMovements, setRecentMovements] = useState<MainBranchStockMovement[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<NonNullable<import('../../../services/mainBranchInventoryService').InventoryListResponse['expiring_batches']>>([]);
  const [suppliers, setSuppliers] = useState<InventorySupplier[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(['Meat', 'Vegetables', 'Dairy', 'Dry goods', 'Beverages', 'Packaging', 'Other']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<InventoryStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MainBranchIngredient | null>(null);
  const [adjusting, setAdjusting] = useState<MainBranchIngredient | null>(null);
  const [adjustingType, setAdjustingType] = useState<'stock_out' | 'adjustment' | 'waste'>('stock_out');
  const [quickAction, setQuickAction] = useState<{ ingredient: MainBranchIngredient; type: 'stock_in' | 'stock_out' } | null>(null);
  const [receiving, setReceiving] = useState<MainBranchIngredient | null>(null);
  const [counting, setCounting] = useState<MainBranchIngredient | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<number | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<MainBranchIngredient | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [reload, setReload] = useState(0);
  const [csvErrors, setCsvErrors] = useState<Array<{ row: number; errors: string[] }>>([]);
  const [managingSuppliers, setManagingSuppliers] = useState(false);
  const [managingRecipes, setManagingRecipes] = useState(false);
  const [managingRestockRequests, setManagingRestockRequests] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await getMainBranchInventory();
        if (!active) return;
        setIngredients(result.ingredients);
        setSummary(result.summary);
        setRecentMovements(result.recent_movements);
        setExpiringBatches(result.expiring_batches || []);
        setSuppliers(result.suppliers || []);
        setCategoryOptions(result.categories || ['Meat', 'Vegetables', 'Dairy', 'Dry goods', 'Beverages', 'Packaging', 'Other']);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load main branch inventory.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [reload]);

  const categories = useMemo(() => [...new Set([...categoryOptions, ...ingredients.map((item) => item.category).filter(Boolean)])].sort(), [categoryOptions, ingredients]);
  const filteredIngredients = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = ingredients.filter((ingredient) => {
      const matchesQuery = !normalizedQuery
        || [ingredient.name, ingredient.category, ingredient.supplier_relation?.name || ingredient.supplier || ''].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesCategory = category === 'all' || ingredient.category === category;
      const ingredientStatus = getIngredientStatus(ingredient);
      const matchesStatus = status === 'all'
        || (status === 'attention' && ingredientStatus !== 'in_stock')
        || status === ingredientStatus;
      return matchesQuery && matchesCategory && matchesStatus;
    });

    return matches.sort((left, right) => {
      const rank = (ingredient: MainBranchIngredient) => {
        const currentStatus = getIngredientStatus(ingredient);
        return currentStatus === 'out_of_stock' ? 0 : currentStatus === 'low_stock' ? 1 : 2;
      };
      return rank(left) - rank(right) || left.name.localeCompare(right.name);
    });
  }, [ingredients, query, category, status]);

  const pageCount = Math.max(1, Math.ceil(filteredIngredients.length / PAGE_SIZE));
  const visibleIngredients = filteredIngredients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const clearFilters = () => { setQuery(''); setCategory('all'); setStatus('all'); setPage(1); };
  const refresh = () => {
    setPage(1);
    setReload((current) => current + 1);
    window.dispatchEvent(new Event('inventory-updated'));
  };

  const saveIngredient = async (values: {
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
  }, addAnother: boolean) => {
    setSaving(true);
    try {
      if (editing) await updateIngredient(editing.id, values);
      else await createIngredient(values);
      if (!addAnother) setCreating(false);
      setEditing(null);
      showToast(editing ? 'Ingredient details updated.' : addAnother ? 'Ingredient added. Add another ingredient.' : 'Ingredient added to main branch inventory.', 'success');
      refresh();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Could not save ingredient.';
      showToast(message, 'error');
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  const saveAdjustment = async (values: { type: StockMovementType; quantity: number; reason: string }) => {
    if (!adjusting) return;
    setSaving(true);
    try {
      await adjustIngredientStock(adjusting.id, values);
      showToast('Stock updated and movement recorded.', 'success');
      setAdjusting(null);
      refresh();
    } catch (adjustError) {
      showToast(adjustError instanceof Error ? adjustError.message : 'Could not adjust stock.', 'error');
      throw adjustError;
    } finally {
      setSaving(false);
    }
  };

  const saveQuickStock = async (values: { type: StockMovementType; quantity: number; reason: string }) => {
    if (!quickAction) return;
    setSaving(true);
    try {
      await adjustIngredientStock(quickAction.ingredient.id, values);
      setQuickAction(null);
      showToast(quickAction.type === 'stock_in' ? 'Stock added.' : 'Stock used.', 'success');
      refresh();
    } catch (stockError) {
      showToast(stockError instanceof Error ? stockError.message : 'Could not update stock.', 'error');
      throw stockError;
    } finally {
      setSaving(false);
    }
  };

  const saveReceiving = async (values: { quantity: number; unit_cost: number; supplier_id: number | null; occurred_at: string; invoice_reference: string; expires_at?: string }) => {
    if (!receiving) return;
    setSaving(true);
    try {
      await receiveIngredientStock(receiving.id, values);
      setReceiving(null);
      showToast('Stock received and weighted-average cost updated.', 'success');
      refresh();
    } catch (receiveError) {
      showToast(receiveError instanceof Error ? receiveError.message : 'Could not receive stock.', 'error');
      throw receiveError;
    } finally {
      setSaving(false);
    }
  };

  const saveCount = async (values: { quantity: number; reason: string }) => {
    if (!counting) return;
    setSaving(true);
    try {
      await countIngredientStock(counting.id, values);
      setCounting(null);
      showToast('Physical stock count applied and recorded.', 'success');
      refresh();
    } catch (countError) {
      showToast(countError instanceof Error ? countError.message : 'Could not apply stock count.', 'error');
      throw countError;
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await downloadIngredientCsv();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'ingredients.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      showToast(exportError instanceof Error ? exportError.message : 'Unable to export CSV.', 'error');
    }
  };

  const exportPdf = () => {
    const pdf = new jsPDF();
    pdf.setFontSize(18);
    pdf.text('Main branch ingredient inventory', 14, 18);
    autoTable(pdf, {
      startY: 25,
      head: [['Ingredient', 'Category', 'Quantity', 'Reorder', 'Unit cost', 'Status']],
      body: filteredIngredients.map((ingredient) => [
        ingredient.name,
        ingredient.category,
        quantityLabel(ingredient.quantity, ingredient.unit),
        quantityLabel(ingredient.reorder_level, ingredient.unit),
        ingredient.unit_cost === null ? '—' : formatCurrency(Number(ingredient.unit_cost)),
        getIngredientStatus(ingredient).replaceAll('_', ' '),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 112, 64] },
    });
    pdf.save('ingredients.pdf');
  };

  const importCsv = async (file: File) => {
    setCsvErrors([]);
    try {
      const result = await importIngredientCsv(file);
      setCsvErrors(result.errors);
      showToast(`${result.imported} ingredient${result.imported === 1 ? '' : 's'} imported${result.errors.length ? `; ${result.errors.length} row${result.errors.length === 1 ? '' : 's'} need attention` : ''}.`, result.errors.length ? 'error' : 'success');
      refresh();
    } catch (importError) {
      showToast(importError instanceof Error ? importError.message : 'Unable to import CSV.', 'error');
    }
  };

  const archive = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await archiveIngredient(archiveTarget.id);
      showToast(`${archiveTarget.name} was archived.`, 'success');
      setArchiveTarget(null);
      refresh();
    } catch (archiveError) {
      showToast(archiveError instanceof Error ? archiveError.message : 'Could not archive ingredient.', 'error');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl font-bold leading-tight text-[var(--oppa-text)] sm:text-4xl">Inventory</h1>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Track what you have in the kitchen. Main branch.</p>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <button type="button" onClick={() => setCreating(true)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--oppa-green-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] sm:flex-none">
              <Plus size={17} aria-hidden="true" /> Add ingredient
            </button>
            <InventoryMoreMenu
              onManageSuppliers={() => setManagingSuppliers(true)}
              onManageRecipes={() => setManagingRecipes(true)}
              onManageRestockRequests={() => setManagingRestockRequests(true)}
              onExportCsv={() => { void exportCsv(); }}
              onExportPdf={exportPdf}
              onImportCsv={(file) => { void importCsv(file); }}
            />
          </div>
        </header>
        {csvErrors.length > 0 && <section role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <h2 className="font-semibold">Some CSV rows need fixing</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">{csvErrors.map((item) => <li key={`${item.row}-${item.errors.join('|')}`}>Row {item.row}: {item.errors.join(' ')}</li>)}</ul>
        </section>}

        <InventorySummaryCards
          summary={summary}
          loading={loading || Boolean(error)}
          needsRestockingSelected={status === 'attention'}
          onNeedsRestocking={() => {
            setStatus(status === 'attention' ? 'all' : 'attention');
            setCategory('all');
            setQuery('');
            setPage(1);
          }}
        />
        {!loading && expiringBatches.length > 0 && <section role="alert" className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-950">
          <strong>{expiringBatches.length} batch{expiringBatches.length === 1 ? '' : 'es'} expiring soon.</strong>
          <span className="ml-1">{expiringBatches.slice(0, 4).map((batch) => `${batch.ingredient?.name || 'Ingredient'} (${batch.expires_at})`).join(', ')}</span>
        </section>}

        {error && ingredients.length > 0 && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={refresh} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw size={14} aria-hidden="true" />Retry</button></div>}

        <InventoryToolbar
          query={query}
          onQueryChange={(value) => { setQuery(value); setPage(1); }}
          status={status}
          onStatusChange={(value) => { setStatus(value); setPage(1); }}
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
          onClearFilters={clearFilters}
          onAddFirstIngredient={() => setCreating(true)}
          onRetry={refresh}
          onToggleDetails={(ingredient) => setExpandedDetails((current) => current === ingredient.id ? null : ingredient.id)}
          onAddStock={(ingredient) => setQuickAction({ ingredient, type: 'stock_in' })}
          onUseStock={(ingredient) => setQuickAction({ ingredient, type: 'stock_out' })}
          onReceiveStock={setReceiving}
          onAdjustStock={(ingredient) => { setAdjustingType('adjustment'); setAdjusting(ingredient); }}
          onLogWaste={(ingredient) => { setAdjustingType('waste'); setAdjusting(ingredient); }}
          onCountStock={setCounting}
          onEditIngredient={setEditing}
          onArchiveIngredient={setArchiveTarget}
          onViewHistory={(ingredient) => navigate(`/admin/inventory/history?ingredient_id=${ingredient.id}`)}
        />
        <RecentActivity movements={recentMovements} />
      </div>

      {(creating || editing) && <IngredientFormModal ingredient={editing || undefined} categories={categories} suppliers={suppliers} busy={saving} onClose={() => { setCreating(false); setEditing(null); }} onSave={saveIngredient} />}
      {quickAction && <QuickStockActionModal ingredient={quickAction.ingredient} type={quickAction.type} busy={saving} onClose={() => setQuickAction(null)} onSave={saveQuickStock} />}
      {adjusting && <AdjustStockModal ingredient={adjusting} initialType={adjustingType} busy={saving} onClose={() => setAdjusting(null)} onSave={saveAdjustment} />}
      {receiving && <ReceiveStockModal ingredient={receiving} suppliers={suppliers} busy={saving} onClose={() => setReceiving(null)} onSave={saveReceiving} />}
      {counting && <CountStockModal ingredient={counting} busy={saving} onClose={() => setCounting(null)} onSave={saveCount} />}
      {managingSuppliers && <SupplierManager suppliers={suppliers} onClose={() => setManagingSuppliers(false)} onChanged={refresh} />}
      {managingRecipes && <RecipeManager onClose={() => setManagingRecipes(false)} onChanged={refresh} />}
      {managingRestockRequests && <RestockRequestsManager onClose={() => setManagingRestockRequests(false)} onChanged={refresh} />}
      {archiveTarget && <ConfirmDialog title="Archive ingredient?" description={`${archiveTarget.name} will be hidden from the active inventory list. Its stock movement history will remain available.`} confirmLabel="Archive ingredient" busyLabel="Archiving…" busy={archiving} onCancel={() => { if (!archiving) setArchiveTarget(null); }} onConfirm={() => { void archive(); }} />}
    </AdminLayout>
  );
};

export default AdminInventoryPage;

import { API_URL } from './apiConfig';
import { fetchWithAdminAuth } from './adminAuthService';

export type StockMovementType = 'stock_in' | 'stock_out' | 'adjustment' | 'waste' | 'order_usage' | 'count_adjustment' | 'opening_stock';

export interface InventorySupplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  lead_time_days: number | null;
  notes: string | null;
  ingredients_count?: number;
}

export interface IngredientRecipe {
  id: number;
  ingredient_id: number;
  quantity: number | string;
  unit: string;
  ingredient: {
    id: number;
    name: string;
    unit: string;
    quantity?: number | string;
    unit_cost?: number | string | null;
    average_unit_cost?: number | string | null;
  };
}

export interface MainBranchIngredient {
  id: number;
  name: string;
  category: string;
  unit: string;
  purchase_unit: string | null;
  conversion_factor: number | string;
  quantity: number | string;
  usable_quantity?: number | string;
  reorder_level: number | string;
  unit_cost: number | string | null;
  average_unit_cost?: number | string | null;
  inventory_value?: number | string | null;
  stock_value?: number | string;
  purchase_history?: MainBranchStockMovement[];
  supplier: string | null;
  supplier_id: number | null;
  supplier_relation?: InventorySupplier | null;
  notes: string | null;
  updated_at: string;
}

export interface MainBranchStockMovement {
  id: number;
  ingredient_id: number | null;
  ingredient_name: string;
  unit: string;
  type: StockMovementType;
  quantity: number | string;
  quantity_change: number | string;
  quantity_before: number | string;
  quantity_after: number | string;
  reason: string | null;
  performed_by: string;
  created_at: string;
  occurred_at: string | null;
  unit_cost: number | string | null;
  total_cost?: number | string | null;
  purchase_quantity?: number | string | null;
  purchase_unit?: string | null;
  order_id: string | null;
  invoice_reference: string | null;
  supplier?: { id: number; name: string } | null;
  ingredient?: { id: number; name: string; unit: string } | null;
}

export interface InventorySummary {
  total: number;
  low_stock: number;
  out_of_stock: number;
  needs_restocking: number;
  stock_value: number | string;
}

export interface InventoryListResponse {
  ingredients: MainBranchIngredient[];
  all_ingredients?: Array<{ id: number; name: string; is_archived: boolean }>;
  summary: InventorySummary;
  recent_movements: MainBranchStockMovement[];
  suppliers?: InventorySupplier[];
  categories?: string[];
  expiring_batches?: Array<{ id: number; quantity_remaining: number | string; expires_at: string; ingredient?: { id: number; name: string; unit: string } }>;
}

export interface MovementHistoryResponse {
  data: MainBranchStockMovement[];
  current_page: number;
  last_page: number;
  total: number;
}

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetchWithAdminAuth(`${API_URL}${path}`, init);
  const payload = await response.json().catch(() => ({})) as {
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
  };
  if (!response.ok) {
    const validationMessage = payload.errors ? Object.values(payload.errors).flat().join(' ') : '';
    throw new Error(validationMessage || payload.message || 'Unable to complete the inventory request.');
  }
  if (payload.data === undefined) throw new Error('The inventory service returned an invalid response.');
  return payload.data;
};

export const getMainBranchInventory = () => request<InventoryListResponse>('/admin/inventory');

export const getInventorySummary = () => request<InventorySummary>('/admin/inventory/summary');

export const createIngredient = (values: Record<string, unknown>) =>
  request<MainBranchIngredient>('/admin/inventory', { method: 'POST', body: JSON.stringify(values) });

export const updateIngredient = (id: number, values: Record<string, unknown>) =>
  request<MainBranchIngredient>(`/admin/inventory/${id}`, { method: 'PUT', body: JSON.stringify(values) });

export const adjustIngredientStock = (id: number, values: { type: StockMovementType; quantity: number; reason: string }) =>
  request<MainBranchIngredient>(`/admin/inventory/${id}/adjustments`, { method: 'POST', body: JSON.stringify(values) });

export const receiveIngredientStock = (id: number, values: {
  quantity: number;
  total_price_paid?: string;
}) => request<MainBranchIngredient>(`/admin/inventory/${id}/receive`, { method: 'POST', body: JSON.stringify(values) });

export const countIngredientStock = (id: number, values: { quantity: number; reason: string }) =>
  request<MainBranchIngredient>(`/admin/inventory/${id}/count`, { method: 'POST', body: JSON.stringify(values) });

export const archiveIngredient = (id: number) =>
  request<{ id: number; is_archived: boolean }>(`/admin/inventory/${id}/archive`, { method: 'PATCH' });

export const getIngredientMovements = (id: number) =>
  request<MainBranchStockMovement[]>(`/admin/inventory/${id}/movements`);

export const createSupplier = (values: Omit<InventorySupplier, 'id' | 'ingredients_count'>) =>
  request<InventorySupplier>('/admin/inventory/suppliers', { method: 'POST', body: JSON.stringify(values) });

export const updateSupplier = (id: number, values: Omit<InventorySupplier, 'id' | 'ingredients_count'>) =>
  request<InventorySupplier>(`/admin/inventory/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(values) });

export const deleteSupplier = (id: number) =>
  request<{ id: number; deleted: boolean }>(`/admin/inventory/suppliers/${id}`, { method: 'DELETE' });

export interface ProductRecipeSet {
  product: { id: string; name: string; price: string | number };
  recipes: IngredientRecipe[];
  can_make: number | null;
}

export const getInventoryRecipes = () =>
  request<{ products: ProductRecipeSet[]; ingredients: Array<{ id: number; name: string; unit: string }> }>('/admin/inventory/recipes');

export const saveProductRecipes = (productId: string, recipes: Array<{ ingredient_id: number; quantity: number; unit: string }>) =>
  request<{ product_id: string; saved: boolean }>(`/admin/inventory/products/${encodeURIComponent(productId)}/recipes`, {
    method: 'PUT',
    body: JSON.stringify({ recipes }),
  });

export interface InventoryReport {
  ingredient_usage: Array<{ ingredient_name: string; quantity: number; unit: string }>;
  waste: Array<{ ingredient_name: string; quantity: number; unit: string }>;
  variance: Array<{ ingredient_name: string; variance: number | string; unit: string; reason: string | null; occurred_at: string }>;
  inventory_value: number | string;
  food_cost_by_product: Array<{ product_id: string; product_name: string; sales: number; ingredient_cost_per_portion: number | string; food_cost_percent: number | null }>;
}

export const getInventoryReport = (filters: { from?: string; to?: string } = {}) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
  return request<InventoryReport>(`/admin/inventory/reports?${query.toString()}`);
};

export interface AdminRestockRequest {
  id: number;
  branch_id: string;
  status: string;
  notes: string | null;
  created_at: string;
  branch: { id: string; name: string };
  items: Array<{
    id: number;
    requested_quantity: number | string;
    approved_quantity: number | string | null;
    ingredient: { id: number; name: string; unit: string };
  }>;
}

export const getRestockRequests = () =>
  request<{ data: AdminRestockRequest[]; current_page: number; last_page: number; total: number }>('/admin/inventory/restock-requests');

export const fulfillRestockRequest = (restockRequest: AdminRestockRequest) =>
  request<unknown>('/admin/inventory/transfers', {
    method: 'POST',
    body: JSON.stringify({
      branch_id: restockRequest.branch_id,
      request_id: restockRequest.id,
      items: restockRequest.items.map((item) => ({
        ingredient_id: item.ingredient.id,
        quantity: Number(item.requested_quantity),
      })),
      notes: `Fulfilled restock request #${restockRequest.id}`,
    }),
  });

export const rejectRestockRequest = (id: number, notes: string) =>
  request<AdminRestockRequest>(`/admin/inventory/restock-requests/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ notes }),
  });

export const downloadIngredientCsv = async (): Promise<Blob> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/inventory/export`);
  if (!response.ok) throw new Error('Unable to export ingredients.');
  return response.blob();
};

export const importIngredientCsv = async (file: File): Promise<{ imported: number; errors: Array<{ row: number; errors: string[] }> }> => {
  const form = new FormData();
  form.append('file', file);
  const response = await fetchWithAdminAuth(`${API_URL}/admin/inventory/import`, { method: 'POST', body: form });
  const payload = await response.json().catch(() => ({})) as {
    data?: { imported: number; errors: Array<{ row: number; errors: string[] }> };
    message?: string;
  };
  if (!response.ok) throw new Error(payload.message || 'Unable to import ingredients.');
  if (!payload.data) throw new Error('The inventory service returned an invalid response.');
  return payload.data;
};

export const getStockMovements = async (filters: {
  ingredient_id?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
}): Promise<MovementHistoryResponse> => {
  const query = new URLSearchParams();
  Object.entries({ ...filters, per_page: 15 }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return request<MovementHistoryResponse>(`/admin/inventory/movements?${query.toString()}`);
};

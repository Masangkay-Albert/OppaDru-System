import { API_URL } from './apiConfig';
import { fetchWithFranchiseAuth } from './franchiseAuthService';

export interface BranchIngredient {
  id: number;
  name: string;
  category: string;
  unit: string;
  quantity: number | string;
  reorder_level: number | string;
  unit_cost: number | string | null;
  average_unit_cost?: number | string | null;
  inventory_value?: number | string | null;
  purchase_unit?: string | null;
  conversion_factor?: number | string;
  purchase_history?: BranchIngredientMovement[];
  usable_quantity?: number | string;
  notes?: string | null;
  updated_at?: string | null;
  stock_value?: number | string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface BranchIngredientSummary {
  total: number;
  low_stock: number;
  out_of_stock: number;
  needs_restocking: number;
  stock_value: number | string;
}

export interface BranchIngredientMovement {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  type: 'stock_in' | 'stock_out' | 'adjustment' | 'waste' | 'order_usage' | 'count_adjustment' | 'opening_stock';
  unit: string;
  quantity_change: number | string;
  performed_by: string;
  occurred_at: string | null;
  created_at: string;
  quantity: number | string;
  purchase_quantity?: number | string | null;
  purchase_unit?: string | null;
  unit_cost?: number | string | null;
  total_cost?: number | string | null;
  supplier?: { id: number; name: string } | null;
  invoice_reference?: string | null;
  reason?: string | null;
}

export interface BranchRestockRequest {
  id: number;
  status: string;
  notes: string | null;
  created_at: string;
  items: Array<{
    id: number;
    requested_quantity: number | string;
    approved_quantity: number | string | null;
    ingredient: { id: number; name: string; unit: string };
  }>;
}

export interface BranchInventoryTransfer {
  id: number;
  reference: string;
  status: string;
  received_at: string | null;
  items: Array<{
    id: number;
    quantity: number | string;
    ingredient: { id: number; name: string; unit: string };
  }>;
}

export interface BranchIngredientInventory {
  ingredients: BranchIngredient[];
  available_ingredients: Array<Pick<BranchIngredient, 'id' | 'name' | 'category' | 'unit' | 'purchase_unit' | 'conversion_factor' | 'reorder_level'>>;
  suppliers: Array<{ id: number; name: string }>;
  summary: BranchIngredientSummary;
  recent_movements: BranchIngredientMovement[];
  expiring_soon: Array<{
    id: number;
    quantity_remaining: number | string;
    expires_at: string;
    ingredient: { id: number; name: string; unit: string };
  }>;
  restock_requests: BranchRestockRequest[];
  transfers: BranchInventoryTransfer[];
}

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetchWithFranchiseAuth(`${API_URL}${path}`, init);
  const payload = await response.json().catch(() => ({})) as {
    data?: T;
    message?: string;
    errors?: Record<string, string[]>;
  };
  if (!response.ok) {
    const validationMessage = payload.errors ? Object.values(payload.errors).flat().join(' ') : '';
    throw new Error(validationMessage || payload.message || 'Unable to complete the branch ingredient inventory request.');
  }
  if (payload.data === undefined) throw new Error('The branch inventory service returned an invalid response.');
  return payload.data;
};

export const getBranchIngredientInventory = () =>
  request<BranchIngredientInventory>('/franchise/inventory/ingredients');

export const adjustBranchIngredient = (
  id: number,
  values: { type: 'stock_in' | 'stock_out' | 'waste' | 'adjustment' | 'count_adjustment'; quantity: number; reason: string },
) => request<{ ingredient_id: number; saved: boolean }>(`/franchise/inventory/ingredients/${id}/adjustments`, {
  method: 'POST',
  body: JSON.stringify(values),
});

export const addBranchIngredient = (values: {
  initial_quantity?: number;
  reorder_level: number;
  unit_cost?: number | null;
  total_price_paid?: string;
  notes: string;
} & (
  | { ingredient_id: number }
  | {
    name: string;
    category: string;
    unit: string;
    purchase_unit: string;
    conversion_factor: number;
    supplier_id?: number | null;
  }
)) => request<BranchIngredient>('/franchise/inventory/ingredients', {
  method: 'POST',
  body: JSON.stringify(values),
});

export const updateBranchIngredient = (id: number, values: {
  reorder_level: number;
  unit_cost?: number | null;
  total_price_paid?: string;
  notes: string;
}) => request<BranchIngredient>(`/franchise/inventory/ingredients/${id}`, {
  method: 'PUT',
  body: JSON.stringify(values),
});

export const receiveBranchIngredientStock = (id: number, values: {
  quantity: number;
  total_price_paid?: string;
}) => request<BranchIngredient>(`/franchise/inventory/ingredients/${id}/receive`, {
  method: 'POST',
  body: JSON.stringify(values),
});

export const archiveBranchIngredient = (id: number) =>
  request<{ ingredient_id: number; is_archived: boolean }>(`/franchise/inventory/ingredients/${id}/archive`, { method: 'PATCH' });

export const submitRestockRequest = (values: {
  items: Array<{ ingredient_id: number; quantity: number }>;
  notes: string;
}) => request<BranchRestockRequest>('/franchise/inventory/restock-requests', {
  method: 'POST',
  body: JSON.stringify(values),
});

export const receiveBranchTransfer = (id: number) =>
  request<BranchInventoryTransfer>(`/franchise/inventory/transfers/${id}/receive`, { method: 'PATCH' });

export const getBranchIngredientHistory = (params: {
  page?: number;
  ingredient_id?: number;
  type?: BranchIngredientMovement['type'];
}) => {
  const search = new URLSearchParams();
  if (params.page) search.set('page', String(params.page));
  if (params.ingredient_id) search.set('ingredient_id', String(params.ingredient_id));
  if (params.type) search.set('type', params.type);
  return request<{
    data: BranchIngredientMovement[];
    current_page: number;
    last_page: number;
    total: number;
  }>(`/franchise/inventory/ingredients/history?${search.toString()}`);
};

export const importBranchIngredientInventory = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return request<{ imported: number; errors: Array<{ row: number; errors: string[] }> }>('/franchise/inventory/ingredients/import', {
    method: 'POST',
    body: formData,
  });
};

export const exportBranchIngredientInventory = async (): Promise<Blob> => {
  const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/inventory/ingredients/export`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(payload.message || 'Could not export branch ingredient inventory.');
  }
  return response.blob();
};

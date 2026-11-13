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
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
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

export const submitRestockRequest = (values: {
  items: Array<{ ingredient_id: number; quantity: number }>;
  notes: string;
}) => request<BranchRestockRequest>('/franchise/inventory/restock-requests', {
  method: 'POST',
  body: JSON.stringify(values),
});

export const receiveBranchTransfer = (id: number) =>
  request<BranchInventoryTransfer>(`/franchise/inventory/transfers/${id}/receive`, { method: 'PATCH' });

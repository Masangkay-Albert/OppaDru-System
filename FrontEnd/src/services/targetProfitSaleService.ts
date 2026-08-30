import { fetchWithAdminAuth } from './adminAuthService';
import { API_URL } from './apiConfig';

export const getTargetProfitSale = async (): Promise<number> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/target-profit-sales`);
  if (!response.ok) throw new Error('Failed to load sales target');
  const result = await response.json();
  return Number(result.data?.target_amount || 0);
};

export const updateTargetProfitSale = async (targetAmount: number): Promise<number> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/target-profit-sales`, {
    method: 'PUT',
    body: JSON.stringify({ target_amount: targetAmount }),
  });
  if (!response.ok) throw new Error('Failed to update sales target');
  const result = await response.json();
  return Number(result.data?.target_amount || 0);
};

export const deleteTargetProfitSale = async (): Promise<void> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/target-profit-sales`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to remove sales target');
};
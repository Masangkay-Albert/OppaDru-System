import { API_URL } from './apiConfig';
import { fetchWithFranchiseAuth } from './franchiseAuthService';

export const updateFranchiseSalesTarget = async (targetAmount: number): Promise<number> => {
  const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/reports/sales-target`, {
    method: 'PUT',
    body: JSON.stringify({ target_amount: targetAmount }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Sales target could not be saved.');
  return Number(result.data?.target_amount || 0);
};

export const deleteFranchiseSalesTarget = async (): Promise<void> => {
  const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/reports/sales-target`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || 'Sales target could not be removed.');
  }
};

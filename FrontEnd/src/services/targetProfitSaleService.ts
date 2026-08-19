const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const getHeaders = (): HeadersInit => {
  const token = localStorage.getItem('adminToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const getTargetProfitSale = async (): Promise<number> => {
  const response = await fetch(`${API_URL}/admin/target-profit-sales`, { headers: getHeaders() });
  if (!response.ok) throw new Error('Failed to load sales target');
  const result = await response.json();
  return Number(result.data?.target_amount || 0);
};

export const updateTargetProfitSale = async (targetAmount: number): Promise<number> => {
  const response = await fetch(`${API_URL}/admin/target-profit-sales`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ target_amount: targetAmount }),
  });
  if (!response.ok) throw new Error('Failed to update sales target');
  const result = await response.json();
  return Number(result.data?.target_amount || 0);
};

export const deleteTargetProfitSale = async (): Promise<void> => {
  const response = await fetch(`${API_URL}/admin/target-profit-sales`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!response.ok) throw new Error('Failed to remove sales target');
};
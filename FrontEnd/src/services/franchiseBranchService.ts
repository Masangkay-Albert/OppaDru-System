import { API_URL } from './apiConfig';

export interface FranchiseBranch {
  id: string;
  name: string;
  address?: string | null;
}

const SELECTED_BRANCH_KEY = 'selected_franchise_id';

export const getSelectedBranchId = (): string | null => {
  const value = localStorage.getItem(SELECTED_BRANCH_KEY);
  return value || null;
};

export const setSelectedBranchId = (branchId: string | null): void => {
  if (branchId) {
    localStorage.setItem(SELECTED_BRANCH_KEY, branchId);
  } else {
    localStorage.removeItem(SELECTED_BRANCH_KEY);
  }
};

export const getActiveBranches = async (): Promise<FranchiseBranch[]> => {
  const response = await fetch(`${API_URL}/franchises/active`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Unable to load the available branches.');
  }

  const result = await response.json();
  return Array.isArray(result.data) ? result.data as FranchiseBranch[] : [];
};

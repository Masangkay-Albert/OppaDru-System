import { API_URL } from './apiConfig';
import { fetchWithAdminAuth } from './adminAuthService';

export interface FranchiseSummary {
  id: string | number;
  name: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  created_at?: string;
  owner_admin_id?: string | number | null;
}

export interface FranchiseApplication {
  id: string | number;
  franchise_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  location?: string;
  notes?: string;
  status?: string;
  admin_notes?: string;
  reviewed_at?: string;
  created_at?: string;
}

export const getFranchises = async (): Promise<FranchiseSummary[]> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchises`);
  if (!response.ok) {
    throw new Error('Unable to load franchises');
  }

  const body = await response.json().catch(() => ({}));
  return Array.isArray(body?.data) ? body.data : [];
};

export const getFranchiseStats = async () => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchises/stats`);
  if (!response.ok) {
    throw new Error('Unable to load franchise stats');
  }

  const body = await response.json().catch(() => ({}));
  return body?.data ?? {};
};

export const getFranchiseApplications = async (): Promise<FranchiseApplication[]> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-applications`);
  if (!response.ok) {
    throw new Error('Unable to load franchise applications');
  }

  const body = await response.json().catch(() => ({}));
  return Array.isArray(body?.data) ? body.data : [];
};

export const reviewFranchiseApplication = async (id: string | number, action: 'approve' | 'reject', adminNotes?: string) => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-applications/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ action, admin_notes: adminNotes || '' }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || 'Unable to review franchise application');
  }

  return response.json().catch(() => ({}));
};

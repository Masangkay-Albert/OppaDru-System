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
  metadata?: Record<string, unknown> | null;
  users?: FranchiseAdminUser[];
}

export interface FranchiseAdminUser {
  id: string | number;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  created_at?: string;
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

const franchiseAdminRequest = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetchWithAdminAuth(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || 'Unable to complete the franchise request');
  }
  return body?.data as T;
};

export const getFranchiseDetail = (id: string | number) =>
  franchiseAdminRequest<FranchiseSummary>(`${API_URL}/admin/franchises/${id}`);

export const createFranchise = (data: Pick<FranchiseSummary, 'name' | 'email' | 'phone' | 'address' | 'status'>) =>
  franchiseAdminRequest<FranchiseSummary>(`${API_URL}/admin/franchises`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const updateFranchise = (id: string | number, data: Partial<Pick<FranchiseSummary, 'name' | 'email' | 'phone' | 'address' | 'status'>>) =>
  franchiseAdminRequest<FranchiseSummary>(`${API_URL}/admin/franchises/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const getFranchiseAdminOverview = async (id: string | number) => {
  const [summary, inventory, fulfillment, users] = await Promise.all([
    franchiseAdminRequest<Record<string, unknown>>(`${API_URL}/admin/franchises/${id}/summary`),
    franchiseAdminRequest<Record<string, unknown>>(`${API_URL}/admin/franchises/${id}/inventory`),
    franchiseAdminRequest<Record<string, unknown>>(`${API_URL}/admin/franchises/${id}/fulfillment`),
    franchiseAdminRequest<FranchiseAdminUser[]>(`${API_URL}/admin/franchises/${id}/users`),
  ]);
  return { summary, inventory, fulfillment, users };
};

export const createFranchiseManager = (id: string | number, data: { full_name: string; email: string; phone?: string; password: string }) =>
  franchiseAdminRequest<FranchiseAdminUser>(`${API_URL}/admin/franchises/${id}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const updateFranchiseManager = (id: string | number, userId: string | number, data: Partial<Pick<FranchiseAdminUser, 'full_name' | 'email' | 'phone' | 'is_active'>>) =>
  franchiseAdminRequest<FranchiseAdminUser>(`${API_URL}/admin/franchises/${id}/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const toggleFranchiseManager = (id: string | number, userId: string | number, isActive: boolean) =>
  franchiseAdminRequest<FranchiseAdminUser>(`${API_URL}/admin/franchises/${id}/users/${userId}/toggle-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  });

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

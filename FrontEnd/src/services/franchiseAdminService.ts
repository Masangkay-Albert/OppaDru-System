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
  franchise_id?: string | null;
  franchise_account_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  can_process_pos?: boolean;
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

export interface FranchiseAccount {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: string;
  locations_count?: number;
  managers_count?: number;
  total_orders?: number;
  total_sales?: number;
  locations?: Array<{
    id: string;
    name: string;
    address?: string | null;
    status: string;
  }>;
}

export interface FranchiseAdminActivity {
  id: string;
  order_number?: string | null;
  franchise_id: string;
  franchise_account_id: string;
  franchise_name?: string | null;
  location_name?: string | null;
  total: number;
  status: string;
  created_at: string;
}

export interface FranchiseAdminDashboard {
  accounts: FranchiseAccount[];
  recent_activity: FranchiseAdminActivity[];
}

export interface FranchiseAccountOverview {
  account: FranchiseAccount;
  locations: NonNullable<FranchiseAccount['locations']>;
  managers: FranchiseAdminUser[];
  staff: Array<{
    id: string;
    franchise_id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
  }>;
  performance: {
    total_locations: number;
    total_managers: number;
    total_staff: number;
    total_orders: number;
    total_sales: number;
    average_order_value: number;
    locations: Array<{
      franchise_id: string;
      location_name: string;
      total_orders: number;
      total_sales: number;
      inventory_items: number;
    }>;
  };
}

export const getFranchiseAccounts = async (): Promise<FranchiseAdminDashboard> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-accounts`);
  if (!response.ok) {
    throw new Error('Unable to load franchises');
  }

  const body = await response.json().catch(() => ({}));
  return {
    accounts: Array.isArray(body?.data) ? body.data : [],
    recent_activity: Array.isArray(body?.recent_activity) ? body.recent_activity : [],
  };
};

export const createFranchiseAccount = (data: Pick<FranchiseAccount, 'name' | 'email' | 'phone' | 'address' | 'status'>) =>
  franchiseAdminRequest<FranchiseAccount>(`${API_URL}/admin/franchise-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const getFranchiseAccountOverview = async (id: string): Promise<FranchiseAccountOverview> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-accounts/${id}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || 'Unable to load franchise details');
  }
  return body?.data as FranchiseAccountOverview;
};

export const updateFranchiseAccount = (id: string, data: Partial<Pick<FranchiseAccount, 'name' | 'email' | 'phone' | 'address' | 'status'>>) =>
  franchiseAdminRequest<FranchiseAccount>(`${API_URL}/admin/franchise-accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const createFranchiseLocation = (id: string, data: { name: string; email?: string; phone?: string; address?: string; status?: string }) =>
  franchiseAdminRequest<NonNullable<FranchiseAccount['locations']>[number]>(`${API_URL}/admin/franchise-accounts/${id}/locations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const createAccountFranchiseManager = (id: string, data: {
  franchise_id: string;
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  can_process_pos?: boolean;
}) =>
  franchiseAdminRequest<FranchiseAdminUser>(`${API_URL}/admin/franchise-accounts/${id}/managers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

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

export const createFranchiseManager = (id: string | number, data: { full_name: string; email: string; phone?: string; password: string; can_process_pos?: boolean }) =>
  franchiseAdminRequest<FranchiseAdminUser>(`${API_URL}/admin/franchises/${id}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const updateFranchiseManager = (id: string | number, userId: string | number, data: Partial<Pick<FranchiseAdminUser, 'full_name' | 'email' | 'phone' | 'is_active' | 'can_process_pos'>>) =>
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

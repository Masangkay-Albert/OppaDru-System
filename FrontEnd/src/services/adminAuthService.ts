// src/services/adminAuthService.ts
import { API_URL } from './apiConfig';

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
}

export type AdminRole = 'admin' | 'system_administrator';

export interface StoredAccount {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  role: 'customer' | 'employee' | AdminRole;
  contactNumber?: string;
  address?: string;
  position?: string; 
  dateRegistered?: string;
  created_at?: string;
}

const STORAGE_KEYS = {
  ADMIN_CURRENT: 'adminUser',
  ADMIN_TOKEN: 'adminToken',
  USERS: 'users', 
} as const;

export const setCurrentAdmin = (admin: AdminUser): void => {
  localStorage.setItem(STORAGE_KEYS.ADMIN_CURRENT, JSON.stringify(admin));
};

export const getStoredAdminToken = (): string | null => {
  const directToken = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN);
  if (directToken) return directToken;

  const storedAdmin = localStorage.getItem(STORAGE_KEYS.ADMIN_CURRENT);
  if (!storedAdmin) return null;

  try {
    const parsed = JSON.parse(storedAdmin) as AdminUser & { token?: string };
    return parsed.token || null;
  } catch {
    return null;
  }
};

export const setStoredAdminToken = (token: string): void => {
  localStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, token);

  const storedAdmin = localStorage.getItem(STORAGE_KEYS.ADMIN_CURRENT);
  if (storedAdmin) {
    try {
      const parsed = JSON.parse(storedAdmin) as AdminUser & { token?: string };
      localStorage.setItem(STORAGE_KEYS.ADMIN_CURRENT, JSON.stringify({ ...parsed, token }));
    } catch {
      // ignore malformed stored admin data
    }
  }
};

export const ensureAdminSession = async (): Promise<string | null> => {
  return getStoredAdminToken();
};

let adminSessionRefresh: Promise<string | null> | null = null;

const refreshAdminSession = async (): Promise<string | null> => {
  localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
  const storedAdmin = getCurrentAdmin();
  if (storedAdmin) {
    setCurrentAdmin(storedAdmin);
  }

  if (!adminSessionRefresh) {
    adminSessionRefresh = ensureAdminSession().finally(() => {
      adminSessionRefresh = null;
    });
  }

  return adminSessionRefresh;
};

export const fetchWithAdminAuth = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const token = await ensureAdminSession();
  if (!token) {
    return new Response(JSON.stringify({ message: 'Unauthenticated administrator.' }), {
      status: 401,
      statusText: 'Unauthorized',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const headers = new Headers(init.headers);
  if (init.body instanceof FormData) {
    headers.delete('Content-Type');
  } else {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(url, { ...init, headers });
  if (response.status !== 401) {
    return response;
  }

  const refreshedToken = await refreshAdminSession();
  if (!refreshedToken) {
    return response;
  }

  headers.set('Authorization', `Bearer ${refreshedToken}`);
  return fetch(url, { ...init, headers });
};

export const getCurrentAdmin = (): AdminUser | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.ADMIN_CURRENT);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    if (!parsed) return null;
    const role = parsed.role === 'system_administrator' ? 'system_administrator' : 'admin';
    return {
      id: String(parsed.id || 'admin-001'),
      fullName: String(parsed.fullName || parsed.full_name || parsed.name || 'Administrator'),
      email: String(parsed.email || 'admin@oppadru.com'),
      role,
    };
  } catch {
    return null;
  }
};

export const removeCurrentAdmin = (): void => {
  localStorage.removeItem(STORAGE_KEYS.ADMIN_CURRENT);
  localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
};

export const getAllAccounts = (): StoredAccount[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
};

export const getAccountById = (id: string): StoredAccount | undefined => {
  return getAllAccounts().find((account) => account.id === id);
};

export const getAccountDisplayName = (accountId?: string): string | undefined => {
  if (!accountId) return undefined;
  return getAccountById(accountId)?.fullName;
};

export const getAccountsByRole = (role: 'customer' | 'employee'): StoredAccount[] => {
  return getAllAccounts().filter((u) => (u.role || 'customer') === role);
};

export const saveAllAccounts = (accounts: StoredAccount[]): void => {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(accounts));
};

export const resetAccountPassword = (id: string, newPassword: string): boolean => {
  const accounts = getAllAccounts();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  accounts[idx] = { ...accounts[idx], password: newPassword };
  saveAllAccounts(accounts);
  return true;
};

export const deleteAccount = (id: string): void => {
  const accounts = getAllAccounts().filter((a) => a.id !== id);
  saveAllAccounts(accounts);
};

export const addEmployeeAccount = (data: {
  fullName: string;
  email: string;
  password: string;
  position: string;
  contactNumber?: string;
}): StoredAccount => {
  const newEmployee: StoredAccount = {
    id: `emp-${Date.now()}`,
    fullName: data.fullName,
    email: data.email,
    password: data.password,
    role: 'employee',
    position: data.position,
    contactNumber: data.contactNumber,
    dateRegistered: new Date().toISOString(),
  };
  const accounts = getAllAccounts();
  accounts.push(newEmployee);
  saveAllAccounts(accounts);
  return newEmployee;
};

// API-backed admin operations
const parseAdminResponse = async (response: Response) => {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errors = body?.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new Error(errors || body?.message || `Administrator request failed (${response.status}).`);
  }
  return body;
};

const apiAdminRequest = async (path: string, method: string, data?: Record<string, unknown>) => {
  const response = await fetchWithAdminAuth(`${API_URL}${path}`, {
    method,
    body: data ? JSON.stringify(data) : undefined,
  });
  return parseAdminResponse(response);
};

export const apiRegisterAdmin = async (data: {
  full_name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role?: AdminRole;
}) => apiAdminRequest('/admin/register', 'POST', data);

export const apiUpdateAdmin = async (id: string, data: { full_name: string; email: string }) =>
  apiAdminRequest(`/admin/admins/${encodeURIComponent(id)}`, 'PUT', data);

export const apiUpdateAdminRole = async (id: string, role: AdminRole) =>
  apiAdminRequest(`/admin/admins/${encodeURIComponent(id)}/role`, 'PATCH', { role });

export const apiResetAdminPassword = async (id: string, password: string, password_confirmation: string) =>
  apiAdminRequest(`/admin/admins/${encodeURIComponent(id)}/reset-password`, 'PUT', { password, password_confirmation });

export const apiDeleteAdmin = async (id: string) =>
  apiAdminRequest(`/admin/admins/${encodeURIComponent(id)}`, 'DELETE');

export const apiGetCurrentAdmin = async (): Promise<AdminUser> => {
  const body = await apiAdminRequest('/admin/me', 'GET');
  const rawAdmin = body.admin;
  return {
    id: String(rawAdmin.id),
    fullName: rawAdmin.full_name || rawAdmin.fullName || '',
    email: rawAdmin.email,
    role: rawAdmin.role === 'system_administrator' ? 'system_administrator' : 'admin',
  };
};

export const apiAdminLogin = async (email: string, password: string) => {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseAdminResponse(res);
};

export const apiGetAdmins = async (): Promise<StoredAccount[]> => {
  const body = await apiAdminRequest('/admin/list', 'GET');
  return (body.data || []).map((account: Record<string, unknown>) => ({
    id: String(account.id),
    fullName: String(account.full_name || account.fullName || ''),
    email: String(account.email || ''),
    role: account.role === 'system_administrator' ? 'system_administrator' : 'admin',
    dateRegistered: String(account.created_at || ''),
  }));
};

export const apiGetAdminCount = async (): Promise<number> => {
  const res = await fetchWithAdminAuth(`${API_URL}/admin/count`);
  if (!res.ok) throw new Error(`Failed to fetch admin count (${res.status}).`);
  const body = await res.json();
  return body.count || 0;
};

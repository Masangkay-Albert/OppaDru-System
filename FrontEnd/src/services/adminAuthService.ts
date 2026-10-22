// src/services/adminAuthService.ts
import { API_URL } from './apiConfig';

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: 'admin';
}

export interface StoredAccount {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: 'customer' | 'employee' | 'admin';
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
    const { token: _staleToken, ...adminWithoutToken } = storedAdmin as AdminUser & { token?: string };
    setCurrentAdmin(adminWithoutToken);
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
  const headers = new Headers(init.headers);
  if (init.body instanceof FormData) {
    headers.delete('Content-Type');
  } else {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

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
    const parsed = JSON.parse(stored) as any;
    if (!parsed) return null;
    return {
      id: String(parsed.id || 'admin-001'),
      fullName: parsed.fullName || parsed.full_name || parsed.name || 'System Administrator',
      email: parsed.email || 'admin@oppadru.com',
      role: 'admin',
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
export const apiRegisterAdmin = async (data: { full_name: string; email: string; password: string; password_confirmation: string }) => {
  // Use FormData to avoid backend JSON parsing issues in some environments
  const form = new FormData();
  form.append('full_name', data.full_name);
  form.append('email', data.email);
  form.append('password', data.password);
  form.append('password_confirmation', data.password_confirmation);

  const res = await fetch(`${API_URL}/admin/register`, {
    method: 'POST',
    body: form,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (body && body.errors) {
      const msgs = Object.values(body.errors).flat().join(' ');
      throw new Error(msgs || 'Validation failed');
    }
    throw new Error((body && body.message) || 'Failed to register admin');
  }
  return body;
};

export const apiAdminLogin = async (email: string, password: string) => {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Invalid admin credentials');
  }

  return res.json();
};

export const apiGetAdmins = async (): Promise<StoredAccount[] | null> => {
  const res = await fetchWithAdminAuth(`${API_URL}/admin/list`);
  if (!res.ok) return null;
  const body = await res.json();
  return (body.data || []).map((a: any) => ({ id: String(a.id), fullName: a.full_name || a.fullName || '', email: a.email, role: 'admin', dateRegistered: a.created_at }));
};

export const apiGetAdminCount = async (): Promise<number> => {
  const res = await fetchWithAdminAuth(`${API_URL}/admin/count`);
  if (!res.ok) throw new Error(`Failed to fetch admin count (${res.status}).`);
  const body = await res.json();
  return body.count || 0;
};

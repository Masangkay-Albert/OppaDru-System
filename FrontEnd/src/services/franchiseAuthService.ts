import { API_URL } from './apiConfig';

export interface FranchiseUser {
  id: string | number;
  full_name?: string;
  fullName?: string;
  name?: string;
  email: string;
  phone?: string;
  franchise_id?: string | number | null;
  is_active?: boolean;
  can_process_pos?: boolean;
  franchise?: {
    id?: string | number;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    status?: string;
  };
  token?: string;
}

const STORAGE_KEYS = {
  FRANCHISE_CURRENT: 'franchiseUser',
  FRANCHISE_TOKEN: 'franchiseToken',
} as const;

export const setCurrentFranchiseUser = (user: FranchiseUser): void => {
  localStorage.setItem(STORAGE_KEYS.FRANCHISE_CURRENT, JSON.stringify(user));
};

export const getStoredFranchiseToken = (): string | null => {
  const directToken = localStorage.getItem(STORAGE_KEYS.FRANCHISE_TOKEN);
  if (directToken) return directToken;

  const current = localStorage.getItem(STORAGE_KEYS.FRANCHISE_CURRENT);
  if (!current) return null;

  try {
    const parsed = JSON.parse(current) as FranchiseUser & { token?: string };
    return parsed.token || null;
  } catch {
    return null;
  }
};

export const setStoredFranchiseToken = (token: string): void => {
  localStorage.setItem(STORAGE_KEYS.FRANCHISE_TOKEN, token);

  const current = localStorage.getItem(STORAGE_KEYS.FRANCHISE_CURRENT);
  if (current) {
    try {
      const parsed = JSON.parse(current) as FranchiseUser & { token?: string };
      localStorage.setItem(STORAGE_KEYS.FRANCHISE_CURRENT, JSON.stringify({ ...parsed, token }));
    } catch {
      // ignore malformed stored franchise data
    }
  }
};

export const getCurrentFranchiseUser = (): FranchiseUser | null => {
  const current = localStorage.getItem(STORAGE_KEYS.FRANCHISE_CURRENT);
  if (!current) return null;

  try {
    const parsed = JSON.parse(current) as FranchiseUser;
    if (!parsed) return null;

    return {
      id: parsed.id ?? 'franchise-user-1',
      full_name: parsed.full_name || parsed.fullName || parsed.name || 'Franchise Manager',
      email: parsed.email || 'manager@oppadru.com',
      phone: parsed.phone,
      franchise_id: parsed.franchise_id,
      is_active: parsed.is_active,
      can_process_pos: parsed.can_process_pos,
      franchise: parsed.franchise,
      token: parsed.token,
    };
  } catch {
    return null;
  }
};

export const removeCurrentFranchiseUser = (): void => {
  localStorage.removeItem(STORAGE_KEYS.FRANCHISE_CURRENT);
  localStorage.removeItem(STORAGE_KEYS.FRANCHISE_TOKEN);
};

export const apiFranchiseLogin = async (email: string, password: string) => {
  const response = await fetch(`${API_URL}/franchise/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Invalid franchise credentials');
  }

  return data;
};

export const getAuthenticatedFranchiseUser = async (): Promise<FranchiseUser | null> => {
  const token = getStoredFranchiseToken();
  const response = await fetch(`${API_URL}/franchise/me`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    removeCurrentFranchiseUser();
    return null;
  }
  if (!response.ok) {
    throw new Error(data?.message || 'Unable to verify your franchise session.');
  }
  if (!data.franchise_user) {
    throw new Error('The franchise session response was incomplete.');
  }
  return data.franchise_user as FranchiseUser;
};

export const apiFranchiseLogout = async (): Promise<void> => {
  const token = getStoredFranchiseToken();
  const response = await fetch(`${API_URL}/franchise/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || 'Unable to sign out from the franchise portal.');
  }
};

export const fetchWithFranchiseAuth = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers || {});
  const token = getStoredFranchiseToken();

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...init, headers, credentials: 'include' });

  if (response.status === 401 || response.status === 403) {
    removeCurrentFranchiseUser();
  }

  return response;
};

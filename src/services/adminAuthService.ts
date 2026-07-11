// src/services/adminAuthService.ts

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
  position?: string; // for employees (e.g. Cashier)
  dateRegistered?: string;
}

const STORAGE_KEYS = {
  ADMIN_CURRENT: 'adminUser',
  USERS: 'users', 
} as const;

const ADMIN_ACCOUNT: AdminUser & { password: string } = {
  id: 'admin-001',
  fullName: 'System Administrator',
  email: 'admin@oppadru.com',
  password: 'Admin@123',
  role: 'admin',
};

export const validateAdminCredentials = (email: string, password: string): AdminUser | null => {
  if (email.trim().toLowerCase() === ADMIN_ACCOUNT.email && password === ADMIN_ACCOUNT.password) {
    const { password: _pw, ...safeAdmin } = ADMIN_ACCOUNT;
    return safeAdmin;
  }
  return null;
};

export const setCurrentAdmin = (admin: AdminUser): void => {
  localStorage.setItem(STORAGE_KEYS.ADMIN_CURRENT, JSON.stringify(admin));
};

export const getCurrentAdmin = (): AdminUser | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.ADMIN_CURRENT);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AdminUser;
  } catch {
    return null;
  }
};

export const removeCurrentAdmin = (): void => {
  localStorage.removeItem(STORAGE_KEYS.ADMIN_CURRENT);
};

// ---- Accounts management (customers + employees) ----
// Reuses the same "users" localStorage key the customer-side authService writes to,
// so any customer that registers on the customer side will automatically show up here.

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

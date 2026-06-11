// src/services/authService.ts
interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'customer' | 'admin' | 'employee';
}

interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  password: string;
  role: string;
}

const STORAGE_KEYS = {
  USERS: 'users',
  CURRENT_USER: 'user'
} as const;

export const getStoredUsers = (): StoredUser[] => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
};

export const saveUser = (user: StoredUser): void => {
  const users = getStoredUsers();
  users.push(user);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

export const validateCredentials = (email: string, password: string): StoredUser | null => {
  const users = getStoredUsers();
  const user = users.find(u => u.email === email && u.password === password);
  return user || null;
};

export const isEmailTaken = (email: string): boolean => {
  const users = getStoredUsers();
  return users.some(u => u.email === email);
};

export const setCurrentUser = (user: Omit<User, 'password'>): void => {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
};

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
};

export const removeCurrentUser = (): void => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

export const createUserObject = (
  id: string, 
  fullName: string, 
  email: string, 
  password: string
): StoredUser => ({
  id,
  fullName,
  email,
  password,
  role: 'customer'
});
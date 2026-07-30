const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin' | 'driver' | 'kitchen';
  created_at: string;
  updated_at: string;
}

export interface RegisterData {
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

class AuthService {
  private userKey = 'user';
  private tokenKey = 'auth_token';

  private getHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    const result = await response.json();
    this.setUser(result.user);
    this.setToken(result.token);
    return result;
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Invalid email or password');
    }

    const result = await response.json();
    this.setUser(result.user);
    this.setToken(result.token);
    return result;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_URL}/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } finally {
      this.clearAuth();
    }
  }

  async getUser(): Promise<User | null> {
    return this.getUserFromStorage();
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await fetch(`${API_URL}/user/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Update failed');
    }

    const result = await response.json();
    this.setUser(result.user);
    return result.user;
  }

  setUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  setToken(token?: string): void {
    if (token) {
      localStorage.setItem(this.tokenKey, token);
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUserFromStorage(): User | null {
    const user = localStorage.getItem(this.userKey);
    return user ? JSON.parse(user) : null;
  }

  clearAuth(): void {
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!this.getUserFromStorage() && !!this.getToken();
  }
}

export const authService = new AuthService();

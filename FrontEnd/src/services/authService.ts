import { API_URL } from './apiConfig';

const getApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  const error = await response.json().catch(() => ({}));
  const validationMessages = error.errors
    ? Object.values(error.errors).flat().join(' ')
    : '';
  return validationMessages || error.message || fallback;
};

export class AuthValidationError extends Error {
  public readonly validationErrors: Record<string, string[]>;

  constructor(
    message: string,
    validationErrors: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AuthValidationError';
    this.validationErrors = validationErrors;
  }
}

const readValidationErrors = (payload: unknown): Record<string, string[]> => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const rawErrors = (payload as Record<string, unknown>).errors;
  if (!rawErrors || typeof rawErrors !== 'object' || Array.isArray(rawErrors)) return {};

  return Object.fromEntries(
    Object.entries(rawErrors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages.filter((message): message is string => typeof message === 'string') : [],
    ]),
  );
};

export interface User {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin' | 'driver' | 'kitchen';
  created_at: string;
  updated_at: string;
  email_verified_at?: string | null;
}

export interface RegisterData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface VerifyPasswordResetData {
  email: string;
  phone: string;
}

export interface CompletePasswordResetData {
  email: string;
  reset_token: string;
  password: string;
  password_confirmation: string;
}

export interface AuthResponse {
  user: User;
  token?: string;
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
      const payload: unknown = await response.json().catch(() => null);
      const validationErrors = readValidationErrors(payload);
      const validationMessage = Object.values(validationErrors).flat().join(' ');
      const message = validationMessage
        || (payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>).message === 'string'
          ? String((payload as Record<string, unknown>).message)
          : 'Registration failed');
      throw new AuthValidationError(message, validationErrors);
    }

    const result = await response.json();
    this.clearAuth();
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
      throw new Error(await getApiErrorMessage(response, 'Invalid email or password'));
    }

    const result = await response.json();
    this.setUser(result.user);
    this.setToken(result.token);
    return result;
  }

  async forgotPassword(email: string): Promise<string> {
    const response = await fetch(`${API_URL}/customer/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Unable to send password reset link');
    }

    return result.message || 'If that email is registered, we\'ve sent a password reset link.';
  }

  async resetPassword(data: ResetPasswordData): Promise<string> {
    const response = await fetch(`${API_URL}/customer/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const validationMessages = result.errors
        ? Object.values(result.errors).flat().join(' ')
        : '';
      throw new Error(validationMessages || result.message || 'Unable to reset password');
    }

    return result.message || 'Password reset successful.';
  }

  async verifyPasswordReset(data: VerifyPasswordResetData): Promise<string> {
    const response = await fetch(`${API_URL}/customer/password-reset/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to verify your account details.'));
    }

    const result = await response.json();
    return result.reset_token;
  }

  async completePasswordReset(data: CompletePasswordResetData): Promise<string> {
    const response = await fetch(`${API_URL}/customer/password-reset/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(await getApiErrorMessage(response, 'Unable to update your password.'));
    }

    const result = await response.json();
    return result.message;
  }

  async resendVerification(email: string): Promise<string> {
    const response = await fetch(`${API_URL}/verification/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const result = await response.json();
    if (!response.ok) {
      const validationMessages = result.errors
        ? Object.values(result.errors).flat().join(' ')
        : '';
      throw new Error(validationMessages || result.message || 'Unable to resend verification email');
    }

    return result.message;
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
    const token = localStorage.getItem(this.tokenKey)?.trim();
    return token && token !== 'null' && token !== 'undefined' ? token : null;
  }

  getUserFromStorage(): User | null {
    const user = localStorage.getItem(this.userKey);
    return user ? JSON.parse(user) : null;
  }

  clearAuth(): void {
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.tokenKey);
  }

  expireSession(): void {
    this.clearAuth();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('customer-auth-expired'));
    }
  }

  isAuthenticated(): boolean {
    return !!this.getUserFromStorage() && !!this.getToken();
  }
}

export const authService = new AuthService();

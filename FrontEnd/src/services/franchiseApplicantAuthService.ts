import { API_URL } from './apiConfig';

export interface FranchiseApplicant {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  email_verified_at?: string | null;
}

interface ApplicantAuthResponse {
  applicant?: FranchiseApplicant;
  token?: string;
  message?: string;
  errors?: Record<string, string[]>;
}

const TOKEN_KEY = 'franchiseApplicantToken';
const APPLICANT_KEY = 'franchiseApplicant';

const apiRequest = async (path: string, body: Record<string, string | undefined>): Promise<ApplicantAuthResponse> => {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result: ApplicantAuthResponse = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessages = result.errors ? Object.values(result.errors).flat().join(' ') : '';
    throw new Error(validationMessages || result.message || 'Unable to complete this request.');
  }
  return result;
};

export const franchiseApplicantAuthService = {
  getToken: (): string | null => localStorage.getItem(TOKEN_KEY),

  getApplicant: (): FranchiseApplicant | null => {
    const stored = localStorage.getItem(APPLICANT_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored) as FranchiseApplicant;
    } catch {
      localStorage.removeItem(APPLICANT_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
  },

  async login(email: string, password: string): Promise<FranchiseApplicant> {
    const result = await apiRequest('/franchise-applicants/login', { email, password });
    if (!result.applicant || !result.token) {
      throw new Error('The applicant sign-in response was incomplete.');
    }
    localStorage.setItem(TOKEN_KEY, result.token);
    localStorage.setItem(APPLICANT_KEY, JSON.stringify(result.applicant));
    return result.applicant;
  },

  async register(data: {
    full_name: string;
    email: string;
    phone?: string;
    password: string;
    password_confirmation: string;
  }): Promise<string> {
    const result = await apiRequest('/franchise-applicants/register', data);
    return result.message || 'Account created. Please verify your email address before signing in.';
  },

  async resendVerification(email: string): Promise<string> {
    const result = await apiRequest('/franchise-applicants/verification/resend', { email });
    return result.message || 'Verification email accepted for delivery.';
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    try {
      if (token) {
        const response = await fetch(`${API_URL}/franchise-applicants/logout`, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.message || 'Unable to sign out from the applicant account.');
        }
      }
    } finally {
      this.clearAuth();
    }
  },

  clearAuth(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(APPLICANT_KEY);
  },
};

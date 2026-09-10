const API_URL = import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api';

export type DiscountVerificationStatus = 'pending' | 'approved' | 'rejected';
export type DiscountType = 'PWD' | 'Senior Citizen';

export interface DiscountVerificationRequest {
  id: string;
  order_id: string;
  discount_type: DiscountType;
  discount_rate: number;
  discount_amount: number;
  proof_image_url: string | null;
  status: DiscountVerificationStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  order?: {
    id: string;
    order_number: string;
    email: string;
    phone: string;
    total: number;
    status: string;
  };
}

const getAdminToken = (): string | null => localStorage.getItem('adminToken');

const buildHeaders = (includeJson = true): HeadersInit => {
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

export const listDiscountVerificationRequests = async (): Promise<DiscountVerificationRequest[]> => {
  const response = await fetch(`${API_URL}/admin/discount-verifications`, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch discount verification requests');
  }

  const data = await response.json();
  return Array.isArray(data?.data) ? data.data : [];
};

export const updateDiscountVerificationStatus = async (
  requestId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string,
): Promise<DiscountVerificationRequest> => {
  const response = await fetch(`${API_URL}/admin/discount-verifications/${requestId}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify({ action, rejection_reason: rejectionReason || null }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to update discount verification');
  }

  const data = await response.json();
  return data.request;
};

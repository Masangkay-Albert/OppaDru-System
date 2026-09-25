const API_URL = import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api';
import { fetchWithAdminAuth } from './adminAuthService';

export type DiscountApplicationStatus = 'pending' | 'approved' | 'rejected';
export type DiscountApplicationType = 'PWD' | 'Senior Citizen';

export interface DiscountApplicationRequest {
  id: string;
  user_id?: number;
  discount_type: DiscountApplicationType;
  full_name: string;
  id_number: string;
  expiry_date?: string | null;
  proof_image_url: string | null;
  status: DiscountApplicationStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  user?: {
    id: number;
    full_name: string;
    email: string;
  } | null;
}

export const listDiscountApplications = async (): Promise<DiscountApplicationRequest[]> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/discount-applications`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to fetch discount applications');
  }

  const data = await response.json();
  return Array.isArray(data?.data) ? data.data : [];
};

export const updateDiscountApplicationStatus = async (
  applicationId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string,
): Promise<DiscountApplicationRequest> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/discount-applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, rejection_reason: rejectionReason || null }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to update discount application');
  }

  const data = await response.json();
  return data.application;
};

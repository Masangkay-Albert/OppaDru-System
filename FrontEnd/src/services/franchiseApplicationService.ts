import { API_URL } from './apiConfig';
import { franchiseApplicantAuthService } from './franchiseApplicantAuthService';

export interface ApplicantFranchiseApplication {
  id: string;
  reference_number: string;
  franchise_name: string;
  contact_name: string;
  email: string;
  phone: string;
  location: string;
  status: string;
  next_step_instructions?: string | null;
  interview_at?: string | null;
  interview_type?: 'online' | 'onsite' | null;
  interview_location?: string | null;
  interview_meeting_url?: string | null;
  created_at: string;
  updated_at: string;
  documents?: Array<{ name: string; mime_type: string; size: number; uploaded_at?: string; document_type?: string }>;
  events?: Array<{
    id: number;
    status?: string | null;
    title: string;
    message?: string | null;
    created_at: string;
  }>;
  agreement_status?: string;
  agreement_prepared_at?: string | null;
  agreement_signed_at?: string | null;
  franchise_fee_amount?: string | number | null;
  franchise_fee_payment_status?: string;
  franchise_fee_payment_reference?: string | null;
  franchise_fee_payment_reject_reason?: string | null;
  requirements_reviewed_at?: string | null;
  required_documents?: Array<{
    label: string;
    required: boolean;
    status: string;
    template_name?: string | null;
    submitted_document_name?: string | null;
    reject_reason?: string | null;
  }>;
  location_readiness?: string;
  permit_compliance_status?: string;
  training_status?: string;
  operational_preparation_status?: string;
}

const request = async (path: string, init?: RequestInit) => {
  const token = franchiseApplicantAuthService.getToken();
  if (!token) throw new Error('Sign in to access your franchise applications.');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessages = body.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new Error(validationMessages || body.message || 'Unable to complete your application request.');
  }
  return body;
};

export const getMyFranchiseApplications = async (): Promise<ApplicantFranchiseApplication[]> => {
  const body = await request('/franchise-applications/me');
  return Array.isArray(body.data) ? body.data : [];
};

export const trackFranchiseApplication = async (referenceNumber: string, email: string): Promise<ApplicantFranchiseApplication> => {
  const response = await fetch(`${API_URL}/franchise-applications/track`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference_number: referenceNumber, email }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessages = body.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new Error(validationMessages || body.message || 'Unable to find your franchise application.');
  }
  return body.data as ApplicantFranchiseApplication;
};

const trackedRequest = async (path: string, init: RequestInit) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessages = body.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new Error(validationMessages || body.message || 'Unable to complete your application request.');
  }
  return body;
};

export const submitTrackedFranchiseDocuments = (
  referenceNumber: string,
  email: string,
  files: Record<number, File>,
) => {
  const form = new FormData();
  form.append('reference_number', referenceNumber);
  form.append('email', email);
  Object.entries(files).forEach(([index, file]) => form.append(`required_document_uploads[${index}]`, file));
  return trackedRequest('/franchise-applications/track/documents', { method: 'POST', body: form });
};

export const downloadTrackedFranchiseDocumentTemplate = async (
  referenceNumber: string,
  email: string,
  document: number,
): Promise<Blob> => {
  const response = await fetch(`${API_URL}/franchise-applications/track/document-template`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference_number: referenceNumber, email, document }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Unable to download this required document template.');
  }
  return response.blob();
};

export const submitTrackedFranchisePaymentProof = (
  referenceNumber: string,
  email: string,
  paymentReference: string,
  proof: File,
) => {
  const form = new FormData();
  form.append('reference_number', referenceNumber);
  form.append('email', email);
  form.append('payment_reference', paymentReference);
  form.append('proof', proof);
  return trackedRequest('/franchise-applications/track/payment-proof', { method: 'POST', body: form });
};

export const respondToFranchiseApplication = (
  id: string,
  response: string,
  documents: File[],
  requiredDocumentUploads: Record<number, File> = {},
) => {
  const form = new FormData();
  form.append('response', response);
  documents.forEach((document) => form.append('documents[]', document));
  Object.entries(requiredDocumentUploads).forEach(([index, file]) => {
    form.append(`required_document_uploads[${index}]`, file);
  });
  return request(`/franchise-applications/me/${id}/response`, { method: 'POST', body: form });
};

export const submitFranchiseApplicationPaymentProof = (id: string, proof: File) => {
  const form = new FormData();
  form.append('proof', proof);
  return request(`/franchise-applications/me/${id}/payment-proof`, { method: 'POST', body: form });
};

export const withdrawFranchiseApplication = (id: string) =>
  request(`/franchise-applications/me/${id}/withdraw`, { method: 'PATCH' });

export const downloadMyFranchiseApplicationDocument = async (id: string, document: number): Promise<Blob> => {
  const token = franchiseApplicantAuthService.getToken();
  if (!token) throw new Error('Sign in to access your franchise applications.');
  const response = await fetch(`${API_URL}/franchise-applications/${id}/documents/${document}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Unable to download this supporting document.');
  return response.blob();
};

export const downloadFranchiseRequiredDocumentTemplate = async (id: string, document: number): Promise<Blob> => {
  const token = franchiseApplicantAuthService.getToken();
  if (!token) throw new Error('Sign in to access your franchise applications.');
  const response = await fetch(`${API_URL}/franchise-applications/me/${id}/required-documents/${document}/template`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Unable to download this required document template.');
  return response.blob();
};

import { API_URL } from './apiConfig';
import { fetchWithAdminAuth } from './adminAuthService';

export interface FranchiseSummary {
  id: string | number;
  name: string;
  slug?: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  created_at?: string;
  owner_admin_id?: string | number | null;
  metadata?: Record<string, unknown> | null;
  users?: FranchiseAdminUser[];
}

export interface FranchiseAdminUser {
  id: string | number;
  franchise_id?: string | null;
  franchise_account_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  can_process_pos?: boolean;
  created_at?: string;
}

export interface FranchiseApplication {
  id: string | number;
  reference_number?: string;
  user_id?: string | null;
  franchise_name: string;
  contact_name: string;
  email: string;
  phone?: string;
  location?: string;
  applicant_address?: string;
  business_experience?: string;
  investment_capacity?: string | number;
  has_proposed_property?: boolean;
  opening_timeline?: string;
  business_information?: string;
  documents?: Array<{ name: string; size: number; mime_type: string; required_document_label?: string }>;
  notes?: string;
  status?: string;
  allowed_transitions?: string[];
  admin_notes?: string;
  next_step_instructions?: string;
  interview_at?: string | null;
  interview_type?: 'online' | 'onsite' | null;
  interview_location?: string | null;
  interview_notes?: string | null;
  interview_meeting_url?: string | null;
  location_assessment?: { result?: string; notes?: string } | null;
  agreement_status?: string;
  agreement_prepared_at?: string | null;
  agreement_signed_at?: string | null;
  franchise_fee_amount?: string | number | null;
  franchise_fee_payment_status?: string;
  franchise_fee_payment_reference?: string | null;
  required_documents?: Array<{
    label: string;
    required: boolean;
    status: string;
    template_name?: string | null;
    submitted_document_name?: string | null;
  }>;
  requirements_reviewed_at?: string | null;
  location_readiness?: string;
  permit_compliance_status?: string;
  training_status?: string;
  operational_preparation_status?: string;
  reviewed_at?: string;
  created_at?: string;
  franchise_account_id?: string | null;
  franchise_id?: string | null;
  activated_at?: string | null;
  events?: Array<{
    id: number;
    actor_type: string;
    status?: string;
    title: string;
    message?: string | null;
    is_internal: boolean;
    created_at: string;
  }>;
}

export interface FranchiseOpportunitySettings {
  investment: { minimum: string | null; maximum: string | null } | null;
  franchise_fee: string | null;
  requirements: string[];
  available_locations: string[];
  qualifications: string[];
  business_rules: string[];
  support: string[];
}

export interface FranchiseAccount {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: string;
  locations_count?: number;
  managers_count?: number;
  total_orders?: number;
  total_sales?: number;
  locations?: Array<{
    id: string;
    name: string;
    address?: string | null;
    status: string;
  }>;
}

export interface FranchiseAdminActivity {
  id: string;
  order_number?: string | null;
  franchise_id: string;
  franchise_account_id: string;
  franchise_name?: string | null;
  location_name?: string | null;
  total: number;
  status: string;
  created_at: string;
}

export interface FranchiseAdminDashboard {
  accounts: FranchiseAccount[];
  recent_activity: FranchiseAdminActivity[];
}

export interface FranchiseAccountOverview {
  account: FranchiseAccount;
  locations: NonNullable<FranchiseAccount['locations']>;
  managers: FranchiseAdminUser[];
  staff: Array<{
    id: string;
    franchise_id: string;
    name: string;
    email: string;
    role: string;
    is_active: boolean;
  }>;
  performance: {
    total_locations: number;
    total_managers: number;
    total_staff: number;
    total_orders: number;
    total_sales: number;
    average_order_value: number;
    locations: Array<{
      franchise_id: string;
      location_name: string;
      total_orders: number;
      total_sales: number;
      inventory_items: number;
    }>;
  };
}

export const getFranchiseAccounts = async (): Promise<FranchiseAdminDashboard> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-accounts`);
  if (!response.ok) {
    throw new Error('Unable to load franchises');
  }

  const body = await response.json().catch(() => ({}));
  return {
    accounts: Array.isArray(body?.data) ? body.data : [],
    recent_activity: Array.isArray(body?.recent_activity) ? body.recent_activity : [],
  };
};

export const createFranchiseAccount = (data: Pick<FranchiseAccount, 'name' | 'email' | 'phone' | 'address' | 'status'>) =>
  franchiseAdminRequest<FranchiseAccount>(`${API_URL}/admin/franchise-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const getFranchiseAccountOverview = async (id: string): Promise<FranchiseAccountOverview> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-accounts/${id}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || 'Unable to load franchise details');
  }
  return body?.data as FranchiseAccountOverview;
};

export const updateFranchiseAccount = (id: string, data: Partial<Pick<FranchiseAccount, 'name' | 'email' | 'phone' | 'address' | 'status'>>) =>
  franchiseAdminRequest<FranchiseAccount>(`${API_URL}/admin/franchise-accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const createFranchiseLocation = (id: string, data: { name: string; email?: string; phone?: string; address?: string; status?: string }) =>
  franchiseAdminRequest<NonNullable<FranchiseAccount['locations']>[number]>(`${API_URL}/admin/franchise-accounts/${id}/locations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const createAccountFranchiseManager = (id: string, data: {
  franchise_id: string;
  full_name: string;
  email: string;
  phone?: string;
  password: string;
  can_process_pos?: boolean;
}) =>
  franchiseAdminRequest<FranchiseAdminUser>(`${API_URL}/admin/franchise-accounts/${id}/managers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const getFranchises = async (): Promise<FranchiseSummary[]> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchises`);
  if (!response.ok) {
    throw new Error('Unable to load franchises');
  }

  const body = await response.json().catch(() => ({}));
  return Array.isArray(body?.data) ? body.data : [];
};

export const getFranchiseStats = async () => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchises/stats`);
  if (!response.ok) {
    throw new Error('Unable to load franchise stats');
  }

  const body = await response.json().catch(() => ({}));
  return body?.data ?? {};
};

const franchiseAdminRequest = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetchWithAdminAuth(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || 'Unable to complete the franchise request');
  }
  return body?.data as T;
};

export const getFranchiseDetail = (id: string | number) =>
  franchiseAdminRequest<FranchiseSummary>(`${API_URL}/admin/franchises/${id}`);

export const createFranchise = (data: Pick<FranchiseSummary, 'name' | 'email' | 'phone' | 'address' | 'status'>) =>
  franchiseAdminRequest<FranchiseSummary>(`${API_URL}/admin/franchises`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const updateFranchise = (id: string | number, data: Partial<Pick<FranchiseSummary, 'name' | 'email' | 'phone' | 'address' | 'status'>>) =>
  franchiseAdminRequest<FranchiseSummary>(`${API_URL}/admin/franchises/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const getFranchiseAdminOverview = async (id: string | number) => {
  const [summary, inventory, fulfillment, users] = await Promise.all([
    franchiseAdminRequest<Record<string, unknown>>(`${API_URL}/admin/franchises/${id}/summary`),
    franchiseAdminRequest<Record<string, unknown>>(`${API_URL}/admin/franchises/${id}/inventory`),
    franchiseAdminRequest<Record<string, unknown>>(`${API_URL}/admin/franchises/${id}/fulfillment`),
    franchiseAdminRequest<FranchiseAdminUser[]>(`${API_URL}/admin/franchises/${id}/users`),
  ]);
  return { summary, inventory, fulfillment, users };
};

export const createFranchiseManager = (id: string | number, data: { full_name: string; email: string; phone?: string; password: string; can_process_pos?: boolean }) =>
  franchiseAdminRequest<FranchiseAdminUser>(`${API_URL}/admin/franchises/${id}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const updateFranchiseManager = (id: string | number, userId: string | number, data: Partial<Pick<FranchiseAdminUser, 'full_name' | 'email' | 'phone' | 'is_active' | 'can_process_pos'>>) =>
  franchiseAdminRequest<FranchiseAdminUser>(`${API_URL}/admin/franchises/${id}/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });

export const toggleFranchiseManager = (id: string | number, userId: string | number, isActive: boolean) =>
  franchiseAdminRequest<FranchiseAdminUser>(`${API_URL}/admin/franchises/${id}/users/${userId}/toggle-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  });

export const getFranchiseApplications = async (): Promise<FranchiseApplication[]> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-applications`);
  if (!response.ok) {
    throw new Error('Unable to load franchise applications');
  }

  const body = await response.json().catch(() => ({}));
  return Array.isArray(body?.data) ? body.data : [];
};

export const getFranchiseOpportunitySettings = async (): Promise<FranchiseOpportunitySettings> => {
  const response = await fetch(`${API_URL}/franchise-opportunities`, { headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || 'Unable to load franchise opportunity settings.');
  return body?.data as FranchiseOpportunitySettings;
};

export const updateFranchiseOpportunitySettings = async (data: {
  investment_minimum: string | null;
  investment_maximum: string | null;
  franchise_fee: string | null;
  requirements: string;
  available_locations: string;
  qualifications: string;
  business_rules: string;
  support: string;
}) => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-opportunities`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessages = body.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new Error(validationMessages || body.message || 'Unable to update franchise opportunity settings.');
  }
  return body?.data as FranchiseOpportunitySettings;
};

export const getFranchiseApplication = async (id: string | number): Promise<FranchiseApplication> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-applications/${id}`);
  if (response.ok) {
    const body = await response.json().catch(() => ({}));
    return body?.data ?? body;
  }

  if (response.status === 405) {
    const applications = await getFranchiseApplications();
    const application = applications.find((item) => String(item.id) === String(id));
    if (application) return application;
  }

  const body = await response.json().catch(() => ({}));
  throw new Error(body?.message || 'Unable to load this franchise application.');
};

export const reviewFranchiseApplication = async (id: string | number, data: {
  status: string;
  admin_notes?: string;
  next_step_instructions?: string;
  interview_at?: string;
  interview_type?: 'online' | 'onsite';
  interview_location?: string | null;
  interview_notes?: string;
  interview_meeting_url?: string | null;
  location_assessment?: { result?: string; notes?: string };
}) => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-applications/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const requirements = Array.isArray(body?.requirements) ? body.requirements.join(' ') : '';
    throw new Error(requirements || body?.message || 'Unable to review franchise application');
  }

  return response.json().catch(() => ({}));
};

export const downloadFranchiseApplicationDocument = async (id: string | number, document: number): Promise<Blob> => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-applications/${id}/documents/${document}`);
  if (!response.ok) {
    throw new Error('Unable to download the supporting document.');
  }
  return response.blob();
};

export const updateFranchiseApplicationRequirements = async (id: string | number, data: {
  agreement_status: string;
  agreement_prepared_at?: string;
  agreement_signed_at?: string;
  franchise_fee_amount?: string;
  franchise_fee_payment_status: string;
  franchise_fee_payment_reference?: string;
  required_documents: Array<{ label: string; required: boolean; status: string; template_name?: string | null }>;
  location_readiness: string;
  permit_compliance_status: string;
  training_status: string;
  operational_preparation_status: string;
  internal_notes?: string;
  required_document_templates?: Record<number, File>;
}) => {
  const form = new FormData();
  const scalarFields: Record<string, string | undefined> = {
    agreement_status: data.agreement_status,
    agreement_prepared_at: data.agreement_prepared_at,
    agreement_signed_at: data.agreement_signed_at,
    franchise_fee_amount: data.franchise_fee_amount,
    franchise_fee_payment_status: data.franchise_fee_payment_status,
    franchise_fee_payment_reference: data.franchise_fee_payment_reference,
    location_readiness: data.location_readiness,
    permit_compliance_status: data.permit_compliance_status,
    training_status: data.training_status,
    operational_preparation_status: data.operational_preparation_status,
    internal_notes: data.internal_notes,
  };
  Object.entries(scalarFields).forEach(([key, value]) => form.append(key, value ?? ''));
  form.append('_method', 'PATCH');
  form.append('required_documents', JSON.stringify(data.required_documents));
  Object.entries(data.required_document_templates || {}).forEach(([index, file]) => {
    form.append(`required_document_templates[${index}]`, file);
  });
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-applications/${id}/requirements`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessages = body.errors ? Object.values(body.errors).flat().join(' ') : '';
    throw new Error(validationMessages || body.message || 'Unable to save franchise requirements.');
  }
  return body;
};

export const activateFranchiseApplication = async (id: string | number, data: {
  manager_full_name: string;
  manager_email: string;
  manager_phone?: string;
  manager_password: string;
  can_process_pos: boolean;
}) => {
  const response = await fetchWithAdminAuth(`${API_URL}/admin/franchise-applications/${id}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessages = body.errors ? Object.values(body.errors).flat().join(' ') : '';
    const requirements = Array.isArray(body.requirements) ? body.requirements.join(' ') : '';
    throw new Error(validationMessages || requirements || body.message || 'Unable to activate the franchise.');
  }
  return body;
};

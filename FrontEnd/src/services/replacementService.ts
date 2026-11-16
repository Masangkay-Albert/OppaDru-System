import { API_URL } from './apiConfig';

export type ReplacementIssueType =
  | 'hair_or_foreign_object'
  | 'wrong_item'
  | 'missing_item'
  | 'spilled_or_damaged'
  | 'not_fresh'
  | 'other';

export interface ReplacementRequestInfo {
  id: number;
  status: 'pending' | 'approved' | 'replacement_sent' | 'rejected' | 'replaced';
  reject_reason?: string | null;
  replacement_order_id?: string | null;
  replacement_order_number?: string | null;
  affected_items?: Array<{ order_item_id: number; name: string; quantity: number }>;
}

export interface ReplacementOrderState {
  can_report_problem: boolean;
  report_window_ended: boolean;
  request: ReplacementRequestInfo | null;
}

export interface ReplacementRequestListItem {
  id: number;
  order_id: string;
  order_number?: string;
  customer_phone?: string | null;
  customer_name: string;
  customer_email?: string;
  issue_type: ReplacementIssueType;
  affected_items: Array<{ order_item_id: number; name: string; quantity: number; unit_price?: number }>;
  description: string;
  photos: string[];
  status: string;
  reject_reason?: string | null;
  handled_by_name?: string | null;
  handled_at?: string | null;
  delivery_address?: string | null;
  delivered_at?: string | null;
  created_at?: string | null;
  replacement_order_id?: string | null;
  replacement_order_number?: string | null;
  past_request_count: number;
}

export interface ReplacementStats {
  count: number;
  item_count: number;
  cost: number;
  by_issue_type: Record<string, { count: number; item_count: number; cost: number }>;
}

const responseMessage = async (response: Response): Promise<string> => {
  const payload: unknown = await response.json().catch(() => ({}));
  if (typeof payload === 'object' && payload !== null && 'errors' in payload) {
    const errors = (payload as { errors?: Record<string, unknown> }).errors;
    if (errors) {
      const message = Object.values(errors)
        .flatMap((value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
        .join(' ');
      if (message) return message;
    }
  }
  return typeof payload === 'object' && payload !== null && 'message' in payload
    && typeof (payload as { message?: unknown }).message === 'string'
    ? (payload as { message: string }).message
    : 'The replacement request could not be completed.';
};

export const submitReplacementRequest = async (
  orderId: string,
  issueType: ReplacementIssueType,
  itemIds: number[],
  description: string,
  photos: File[],
): Promise<void> => {
  const body = new FormData();
  body.append('issue_type', issueType);
  body.append('description', description);
  itemIds.forEach((id) => body.append('item_ids[]', String(id)));
  photos.forEach((photo) => body.append('photos[]', photo));

  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_URL}/orders/${encodeURIComponent(orderId)}/replacement-requests`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
  if (!response.ok) throw new Error(await responseMessage(response));
};

export const getReplacementStatusLabel = (status: ReplacementRequestInfo['status']): string => {
  switch (status) {
    case 'pending': return 'Waiting for review';
    case 'approved': return 'Replacement being prepared';
    case 'replacement_sent': return 'Replacement on the way';
    case 'replaced': return 'Replaced';
    case 'rejected': return 'Not approved';
  }
};

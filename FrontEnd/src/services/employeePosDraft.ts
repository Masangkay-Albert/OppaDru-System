import { API_URL } from './apiConfig';
import { fetchWithEmployeeAuth } from './employeeAuth';

export interface EmployeePosDraft {
  cart: Record<string, unknown>;
  favorite_ids: string[];
  include_cutlery: boolean;
}

const browserSessionStorageKey = 'employee_pos_browser_session_id';

export const getEmployeePosBrowserSessionId = (): string => {
  const current = sessionStorage.getItem(browserSessionStorageKey);
  if (current) return current;

  const sessionId = crypto.randomUUID();
  sessionStorage.setItem(browserSessionStorageKey, sessionId);
  return sessionId;
};

const parseResponse = async (response: Response): Promise<EmployeePosDraft> => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Could not access the saved cashier order.');
  }
  const draft = payload.draft as Partial<EmployeePosDraft> | undefined;
  return {
    cart: draft?.cart && typeof draft.cart === 'object' ? draft.cart : {},
    favorite_ids: Array.isArray(draft?.favorite_ids) ? draft.favorite_ids : [],
    include_cutlery: Boolean(draft?.include_cutlery),
  };
};

export const loadEmployeePosDraft = async (browserSessionId: string): Promise<EmployeePosDraft> => {
  const params = new URLSearchParams({ browser_session_id: browserSessionId });
  const response = await fetchWithEmployeeAuth(`${API_URL}/employee/pos/draft?${params}`);
  return parseResponse(response);
};

export const saveEmployeePosDraft = async (
  browserSessionId: string,
  draft: EmployeePosDraft,
): Promise<void> => {
  const response = await fetchWithEmployeeAuth(`${API_URL}/employee/pos/draft`, {
    method: 'PUT',
    body: JSON.stringify({ browser_session_id: browserSessionId, ...draft }),
  });
  await parseResponse(response);
};

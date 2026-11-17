import { API_URL } from './apiConfig';

export interface CustomerReplacementNotification {
  id: string;
  title: string;
  content: string;
  date: string;
  read_at: string | null;
}

interface ReplacementNotificationResponse {
  data: CustomerReplacementNotification[];
}

export const customerReplacementNotificationService = {
  async getReplacementNotifications(): Promise<CustomerReplacementNotification[]> {
    const token = localStorage.getItem('auth_token');
    if (!token) return [];

    const response = await fetch(`${API_URL}/customer/replacement-notifications`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) return [];
    if (!response.ok) {
      throw new Error(`Could not load replacement notifications (${response.status}).`);
    }

    const payload = await response.json() as ReplacementNotificationResponse;
    if (!Array.isArray(payload.data)) {
      throw new Error('The replacement notification response was invalid.');
    }

    return payload.data;
  },
};

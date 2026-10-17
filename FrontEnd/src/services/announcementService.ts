import { API_URL } from './apiConfig';
import { fetchWithAdminAuth, getCurrentAdmin } from './adminAuthService';
import type {
  Announcement,
  AnnouncementCreateResult,
  AnnouncementFilters,
  AnnouncementFormData,
  AnnouncementStats,
  FacebookStatus,
  TargetAudience,
} from '../types/announcement.types';

const STORAGE_KEY = 'oppadru_announcements_cache_v2';

const defaultSeedAnnouncements: Announcement[] = [
  {
    id: 'ann-DEMO001',
    title: '✨ Welcome to Oppa Dru Refresh! Special Promo Week',
    content: 'We are thrilled to launch our new summer combo sets! Enjoy up to 15% off on our Korean Fried Chicken combos when ordering directly through our website.',
    target_audience: 'customers',
    target_audiences: ['customers'],
    image_url: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=1200&q=80',
    priority: 'promo',
    status: 'published',
    date_sent: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    author_name: 'System Administrator',
    created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
  },
  {
    id: 'ann-DEMO002',
    title: '🍗 New Menu Drop: Spicy Gangnam Wings!',
    content: 'Introducing our latest menu addition — Spicy Gangnam Wings! Extra crispy with our secret Korean chili glaze. Available for a limited time at all branches and for delivery.',
    target_audience: 'customers',
    target_audiences: ['customers'],
    image_url: 'https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1200&q=80',
    priority: 'high',
    status: 'published',
    date_sent: new Date(Date.now() - 3600 * 1000 * 28).toISOString(),
    author_name: 'Marketing Team',
    created_at: new Date(Date.now() - 3600 * 1000 * 28).toISOString(),
  },
  {
    id: 'ann-DEMO003',
    title: '🎉 Free Delivery This Weekend — No Minimum Order!',
    content: 'Celebrate the weekend with us! Enjoy FREE delivery on all orders this Saturday and Sunday. No minimum spend required — order your favorites from the comfort of your home.',
    target_audience: 'customers',
    target_audiences: ['customers'],
    image_url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1200&q=80',
    priority: 'normal',
    status: 'published',
    date_sent: new Date(Date.now() - 3600 * 1000 * 50).toISOString(),
    author_name: 'Operations Manager',
    created_at: new Date(Date.now() - 3600 * 1000 * 50).toISOString(),
  },
  {
    id: 'ann-DEMO004',
    title: '🏷️ Loyalty Rewards Program Launch',
    content: 'Earn points on every order and redeem them for free meals! Sign up for our loyalty program today and get 50 bonus points to start. Exclusive perks for our valued customers.',
    target_audience: 'customers',
    target_audiences: ['customers'],
    image_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    priority: 'promo',
    status: 'published',
    date_sent: new Date(Date.now() - 3600 * 1000 * 60).toISOString(),
    author_name: 'Customer Relations',
    created_at: new Date(Date.now() - 3600 * 1000 * 60).toISOString(),
  },
  {
    id: 'ann-DEMO005',
    title: '🌐 Holiday Operating Hours Notice',
    content: 'Please be advised that all Oppa Dru branches and delivery services will observe special operating hours during the upcoming public holiday. Store schedules will be from 10:00 AM to 7:00 PM.',
    target_audience: 'all',
    target_audiences: ['all'],
    image_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
    priority: 'urgent',
    status: 'published',
    date_sent: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
    author_name: 'System Administrator',
    created_at: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
  },
];

const getStoredAnnouncements = (): Announcement[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultSeedAnnouncements));
      return defaultSeedAnnouncements;
    }
    return JSON.parse(raw);
  } catch {
    return defaultSeedAnnouncements;
  }
};

const saveStoredAnnouncements = (list: Announcement[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota limits
  }
};

const calculateLocalStats = (list: Announcement[]): AnnouncementStats => {
  return {
    total: list.length,
    published: list.filter((a) => a.status === 'published').length,
    scheduled: list.filter((a) => a.status === 'scheduled').length,
    draft: list.filter((a) => a.status === 'draft').length,
    audiences: {
      all: list.filter((a) => a.target_audience === 'all' || a.target_audiences?.includes('all')).length,
      customers: list.filter((a) => a.target_audience === 'customers' || a.target_audiences?.includes('customers')).length,
    },
  };
};

export const announcementService = {
  /**
   * Fetch all announcements with filters and stats
   */
  async getAnnouncements(filters: AnnouncementFilters = {}): Promise<{
    announcements: Announcement[];
    stats: AnnouncementStats;
  }> {
    const params = new URLSearchParams();
    if (filters.audience && filters.audience !== 'all_filter') params.set('audience', filters.audience);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.priority && filters.priority !== 'all') params.set('priority', filters.priority);
    if (filters.search) params.set('search', filters.search);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.direction) params.set('direction', filters.direction);
    if (filters.from_date) params.set('from_date', filters.from_date);
    if (filters.to_date) params.set('to_date', filters.to_date);

    try {
      const url = `${API_URL}/admin/announcements?${params.toString()}`;
      const res = await fetchWithAdminAuth(url);
      if (res.ok) {
        const data = await res.json();
        if (data.announcements && Array.isArray(data.announcements)) {
          // Only update local full cache on unfiltered requests
          const isUnfiltered =
            (!filters.audience || filters.audience === 'all_filter') &&
            (!filters.status || filters.status === 'all') &&
            !filters.search;
          if (isUnfiltered && data.announcements.length > 0) {
            saveStoredAnnouncements(data.announcements);
          }

          return {
            announcements: data.announcements,
            stats: data.stats || calculateLocalStats(data.announcements),
          };
        }
      }
    } catch {
      // Fallback to local cache only if network request fails
    }

    // Local fallback
    let items = getStoredAnnouncements();
    if (filters.audience && filters.audience !== 'all_filter') {
      items = items.filter(
        (a) => a.target_audience === filters.audience || a.target_audiences?.includes(filters.audience as TargetAudience)
      );
    }
    if (filters.status && filters.status !== 'all') {
      items = items.filter((a) => a.status === filters.status);
    }
    if (filters.priority && filters.priority !== 'all') {
      items = items.filter((a) => a.priority === filters.priority);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.content.toLowerCase().includes(q) ||
          a.target_audience.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      const timeA = new Date(a.date_sent || a.created_at || 0).getTime();
      const timeB = new Date(b.date_sent || b.created_at || 0).getTime();
      return filters.direction === 'asc' ? timeA - timeB : timeB - timeA;
    });

    return {
      announcements: items,
      stats: calculateLocalStats(getStoredAnnouncements()),
    };
  },

  /**
   * Create a new announcement (supports file upload or URL)
   */
  async createAnnouncement(data: AnnouncementFormData): Promise<AnnouncementCreateResult> {
    const admin = getCurrentAdmin();
    const authorName = data.author_name || admin?.fullName || 'Admin';

    // Try API via FormData
    try {
      const formData = new FormData();
      formData.append('title', data.title);
      formData.append('content', data.content);
      formData.append('target_audience', data.target_audience || 'customers');
      formData.append('priority', data.priority);
      formData.append('status', data.status);
      formData.append('author_name', authorName);

      if (data.date_sent) formData.append('date_sent', data.date_sent);
      if (data.scheduled_at) formData.append('scheduled_at', data.scheduled_at);
      if (data.image_url) formData.append('image_url', data.image_url);
      if (data.imageFile) formData.append('image', data.imageFile);
      if (data.publish_to_facebook) formData.append('publish_to_facebook', '1');

      const res = await fetchWithAdminAuth(`${API_URL}/admin/announcements`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json().catch(() => null);
      if (res.ok) {
        if (json.announcement) {
          const list = getStoredAnnouncements();
          saveStoredAnnouncements([json.announcement, ...list]);
          return {
            announcement: json.announcement,
            facebookPublish: json.facebook_publish ?? null,
          };
        }
      }
      if (data.publish_to_facebook) {
        throw new Error(json?.message || 'The server could not create this announcement.');
      }
    } catch (error) {
      if (data.publish_to_facebook) {
        throw error;
      }
      // Fall through to local fallback
    }

    // Local fallback creation
    let imageUrl = data.image_url || null;
    if (data.imageFile && !imageUrl) {
      imageUrl = URL.createObjectURL(data.imageFile);
    }

    const newAnnouncement: Announcement = {
      id: `ann-${Date.now().toString(36).toUpperCase()}`,
      title: data.title,
      content: data.content,
      target_audience: data.target_audience || 'customers',
      target_audiences: [data.target_audience || 'customers'],
      image_url: imageUrl,
      priority: data.priority,
      status: data.status,
      date_sent: data.status === 'published' ? (data.date_sent || new Date().toISOString()) : data.date_sent,
      scheduled_at: data.scheduled_at,
      author_name: authorName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const current = getStoredAnnouncements();
    saveStoredAnnouncements([newAnnouncement, ...current]);
    return { announcement: newAnnouncement };
  },

  /**
   * Update announcement
   */
  async updateAnnouncement(id: string, data: Partial<AnnouncementFormData>): Promise<Announcement> {
    try {
      const formData = new FormData();
      if (data.title) formData.append('title', data.title);
      if (data.content) formData.append('content', data.content);
      if (data.target_audience) formData.append('target_audience', data.target_audience);
      if (data.priority) formData.append('priority', data.priority);
      if (data.status) formData.append('status', data.status);
      if (data.date_sent) formData.append('date_sent', data.date_sent);
      if (data.scheduled_at) formData.append('scheduled_at', data.scheduled_at);
      if (data.author_name) formData.append('author_name', data.author_name);
      if (data.remove_image) formData.append('remove_image', '1');
      if (data.image_url) formData.append('image_url', data.image_url);
      if (data.imageFile) formData.append('image', data.imageFile);

      const res = await fetchWithAdminAuth(`${API_URL}/admin/announcements/${id}`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const json = await res.json();
        if (json.announcement) {
          const list = getStoredAnnouncements().map((a) => (a.id === id ? json.announcement : a));
          saveStoredAnnouncements(list);
          return json.announcement;
        }
      }
    } catch {
      // Fallback
    }

    const list = getStoredAnnouncements();
    const existing = list.find((a) => a.id === id);
    if (!existing) throw new Error('Announcement not found.');

    let imageUrl = existing.image_url;
    if (data.remove_image) {
      imageUrl = null;
    } else if (data.imageFile) {
      imageUrl = URL.createObjectURL(data.imageFile);
    } else if (data.image_url !== undefined) {
      imageUrl = data.image_url;
    }

    const updated: Announcement = {
      ...existing,
      title: data.title ?? existing.title,
      content: data.content ?? existing.content,
      target_audience: data.target_audience ?? existing.target_audience,
      target_audiences: data.target_audience ? [data.target_audience] : existing.target_audiences,
      priority: data.priority ?? existing.priority,
      status: data.status ?? existing.status,
      date_sent: data.status === 'published' && !existing.date_sent ? new Date().toISOString() : (data.date_sent ?? existing.date_sent),
      scheduled_at: data.scheduled_at ?? existing.scheduled_at,
      image_url: imageUrl,
      updated_at: new Date().toISOString(),
    };

    saveStoredAnnouncements(list.map((a) => (a.id === id ? updated : a)));
    return updated;
  },

  /**
   * Delete an announcement
   */
  async deleteAnnouncement(id: string): Promise<boolean> {
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/admin/announcements/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const list = getStoredAnnouncements().filter((a) => a.id !== id);
        saveStoredAnnouncements(list);
        return true;
      }
    } catch {
      // Fallback
    }

    const list = getStoredAnnouncements().filter((a) => a.id !== id);
    saveStoredAnnouncements(list);
    return true;
  },

  /**
   * Quick toggle publish / draft status
   */
  async toggleStatus(id: string, newStatus?: string): Promise<Announcement> {
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/admin/announcements/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.announcement) {
          const list = getStoredAnnouncements().map((a) => (a.id === id ? json.announcement : a));
          saveStoredAnnouncements(list);
          return json.announcement;
        }
      }
    } catch {
      // Fallback
    }

    const list = getStoredAnnouncements();
    const item = list.find((a) => a.id === id);
    if (!item) throw new Error('Announcement not found.');

    const status = newStatus || (item.status === 'published' ? 'draft' : 'published');
    const updated: Announcement = {
      ...item,
      status: status as any,
      date_sent: status === 'published' && !item.date_sent ? new Date().toISOString() : item.date_sent,
      updated_at: new Date().toISOString(),
    };

    saveStoredAnnouncements(list.map((a) => (a.id === id ? updated : a)));
    return updated;
  },

  /**
   * Customer-specific: Get published announcements visible to customers.
   * Used by the CustomerAnnouncementBell component.
   */
  async getCustomerAnnouncements(): Promise<Announcement[]> {
    return this.getPublicAnnouncements();
  },

  /**
   * Public list for customer announcements.
   */
  async getPublicAnnouncements(): Promise<Announcement[]> {
    try {
      const res = await fetch(`${API_URL}/announcements?audience=customers`);
      if (res.ok) {
        const data = await res.json();
        if (data.announcements) return data.announcements;
      }
    } catch {
      // Fallback
    }

    const list = getStoredAnnouncements();
    return list.filter(
      (a) =>
        a.status === 'published' &&
        (a.target_audience === 'customers' ||
          a.target_audience === 'all' ||
          a.target_audiences?.includes('customers') ||
          a.target_audiences?.includes('all'))
    );
  },

  /**
   * Publish an announcement directly to Facebook Page via Graph API
   */
  async publishToFacebook(id: string): Promise<{
    success: boolean;
    message: string;
    post_id?: string;
    post_url?: string;
    announcement?: Announcement;
    need_config?: boolean;
  }> {
    const res = await fetchWithAdminAuth(`${API_URL}/admin/announcements/${id}/publish-facebook`, {
      method: 'POST',
    });
    const data = await res.json();
    if (res.ok && data.announcement) {
      const list = getStoredAnnouncements().map((a) => (a.id === id ? data.announcement : a));
      saveStoredAnnouncements(list);
    }
    return data;
  },

  /**
   * Get current Facebook Page connection status
   */
  async getFacebookStatus(): Promise<FacebookStatus> {
    try {
      const res = await fetchWithAdminAuth(`${API_URL}/admin/facebook/status`);
      if (res.ok) {
        const data = await res.json();
        return data.status;
      }
    } catch {
      return { configured: false, message: 'Unable to check Facebook connection status.' };
    }
    return { configured: false, message: 'Unable to check Facebook connection status.' };
  },

};

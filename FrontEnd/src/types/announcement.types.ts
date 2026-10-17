export type TargetAudience = 'all' | 'customers';
export type AnnouncementAudience = 'all' | 'customers';

export type AnnouncementPriority = 'normal' | 'high' | 'urgent' | 'promo';

export type AnnouncementStatus = 'published' | 'scheduled' | 'draft' | 'archived';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_audience: AnnouncementAudience;
  target_audiences?: AnnouncementAudience[];
  image_url?: string | null;
  image_path?: string | null;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  date_sent?: string | null;
  scheduled_at?: string | null;
  author_name?: string | null;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    facebook_post_id?: string;
    facebook_post_url?: string;
    facebook_published_at?: string;
    [key: string]: any;
  } | null;
}

export interface FacebookStatus {
  configured: boolean;
  connected?: boolean;
  page_id?: string;
  page_name?: string;
  page_link?: string;
  page_picture?: string | null;
  message?: string;
  error?: string;
}

export interface AnnouncementCreateResult {
  announcement: Announcement;
  facebookPublish?: {
    success: boolean;
    message?: string;
    post_url?: string;
  } | null;
}

export interface AnnouncementStats {
  total: number;
  published: number;
  scheduled: number;
  draft: number;
  audiences: {
    all: number;
    customers: number;
  };
}

export interface AnnouncementFilters {
  audience?: string;
  status?: string;
  priority?: string;
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  from_date?: string;
  to_date?: string;
}

export interface AnnouncementFormData {
  title: string;
  content: string;
  target_audience: TargetAudience;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  date_sent?: string;
  scheduled_at?: string;
  imageFile?: File | null;
  image_url?: string;
  remove_image?: boolean;
  author_name?: string;
  publish_to_facebook?: boolean;
}

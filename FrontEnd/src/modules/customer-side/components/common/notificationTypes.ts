import type { Announcement, AnnouncementPriority } from '../../../../types/announcement.types';
import type { Promo } from '../../../../services/promoService';

export type NotificationType = 'announcement' | 'promo' | 'replacement';

export interface UnifiedNotification {
  id: string;
  type: NotificationType;
  title: string;
  content: string;
  image_url: string | null;
  priority: AnnouncementPriority;
  date: string;
  isCompleted: boolean;
  rawAnnouncement?: Announcement;
  rawPromo?: Promo;
  promoCode?: string;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  endDate?: string | null;
}

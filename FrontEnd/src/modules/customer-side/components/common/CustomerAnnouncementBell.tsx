import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Flame,
  Megaphone,
  RotateCcw,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { announcementService } from '../../../../services/announcementService';
import { promoService, type Promo } from '../../../../services/promoService';
import type { Announcement, AnnouncementPriority } from '../../../../types/announcement.types';

const COMPLETED_STORAGE_KEY = 'oppadru_customer_completed_notifications';
const DELETED_STORAGE_KEY = 'oppadru_customer_deleted_notifications';

export type NotificationType = 'announcement' | 'promo';

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

const PRIORITY_BADGES: Record<AnnouncementPriority, { label: string; style: string }> = {
  normal: {
    label: 'Update',
    style:
      'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] border-[var(--oppa-green)]/25 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/80',
  },
  promo: {
    label: 'Special Promo',
    style:
      'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] border-[var(--oppa-green)]/25 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/80',
  },
  high: {
    label: 'Important',
    style:
      'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] border-[var(--oppa-green)]/25 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/80',
  },
  urgent: {
    label: 'Urgent Alert',
    style:
      'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] border-[var(--oppa-green)]/25 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/80',
  },
};

const formatRelativeTime = (isoDate?: string | null): string => {
  if (!isoDate) return 'Just now';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return 'Just now';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const getStoredIds = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredIds = (key: string, ids: string[]): void => {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Ignore storage quota limits
  }
};

interface CustomerAnnouncementBellProps {
  className?: string;
}

export const CustomerAnnouncementBell: React.FC<CustomerAnnouncementBellProps> = ({ className = '' }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [completedIds, setCompletedIds] = useState<string[]>(() => getStoredIds(COMPLETED_STORAGE_KEY));
  const [deletedIds, setDeletedIds] = useState<string[]>(() => getStoredIds(DELETED_STORAGE_KEY));

  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [expandedModal, setExpandedModal] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [undoDeletedItem, setUndoDeletedItem] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load active announcements & promos
  const fetchAllData = async () => {
    try {
      const [annList, promoList] = await Promise.all([
        announcementService.getCustomerAnnouncements().catch(() => []),
        promoService.getActivePromos().catch(() => []),
      ]);
      setAnnouncements(annList);
      setPromos(promoList);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchAllData();

    // 1. Polling interval every 15 seconds to catch new admin posts across clients
    const interval = setInterval(fetchAllData, 15000);

    // 2. Real-time event listener when admin creates or updates an announcement in the same browser
    const handleAnnouncementPublished = () => {
      fetchAllData();
    };

    // 3. Storage event listener when another tab updates announcements or promos
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'oppadru_announcements_cache_v2' ||
        e.key === 'oppadru_promos_cache' ||
        e.key === COMPLETED_STORAGE_KEY ||
        e.key === DELETED_STORAGE_KEY
      ) {
        fetchAllData();
        setCompletedIds(getStoredIds(COMPLETED_STORAGE_KEY));
        setDeletedIds(getStoredIds(DELETED_STORAGE_KEY));
      }
    };

    // 4. Tab visibility change: refresh when user returns to this tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAllData();
      }
    };

    window.addEventListener('oppadru_announcement_published', handleAnnouncementPublished);
    window.addEventListener('oppadru_announcement_updated', handleAnnouncementPublished);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('oppadru_announcement_published', handleAnnouncementPublished);
      window.removeEventListener('oppadru_announcement_updated', handleAnnouncementPublished);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpenDropdown(false);
      }
    };
    if (isOpenDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpenDropdown]);

  // Lock body scroll and keyboard shortcuts for modal
  useEffect(() => {
    if (expandedModal) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setExpandedModal(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = orig;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [expandedModal]);

  // Combine announcements and promos into a unified list
  const unifiedNotifications: UnifiedNotification[] = React.useMemo(() => {
    const items: UnifiedNotification[] = [];

    // Map announcements
    announcements.forEach((a) => {
      const isCompleted = completedIds.includes(a.id);
      items.push({
        id: a.id,
        type: 'announcement',
        title: a.title,
        content: a.content,
        image_url: a.image_url || null,
        priority: a.priority || 'normal',
        date: a.date_sent || a.created_at || new Date().toISOString(),
        isCompleted,
        rawAnnouncement: a,
      });
    });

    // Map active promos
    promos.forEach((p) => {
      const promoId = `promo-${p.id}`;
      const isCompleted = completedIds.includes(promoId);
      const discountText =
        p.discount_type === 'percent'
          ? `${p.discount_value}% OFF`
          : `₱${p.discount_value.toLocaleString()} OFF`;

      const codeNotice = p.code ? ` Use voucher code [${p.code}] at checkout.` : '';
      const minSpendNotice = p.min_order_amount ? ` Minimum spend ₱${p.min_order_amount.toLocaleString()}.` : '';

      items.push({
        id: promoId,
        type: 'promo',
        title: p.title || `Special Offer: ${discountText}`,
        content: (p.description ? p.description + '\n\n' : '') + `Enjoy ${discountText}!${codeNotice}${minSpendNotice}`,
        image_url: p.image_url || null,
        priority: 'promo',
        date: p.created_at || p.start_date || new Date().toISOString(),
        isCompleted,
        rawPromo: p,
        promoCode: p.code,
        discountType: p.discount_type,
        discountValue: p.discount_value,
        minOrderAmount: p.min_order_amount,
        maxDiscountAmount: p.max_discount_amount,
        endDate: p.end_date,
      });
    });

    // Filter out deleted items
    const nonDeleted = items.filter((item) => !deletedIds.includes(item.id));

    return nonDeleted.sort((a, b) => {
      const dateA = Date.parse(a.date);
      const dateB = Date.parse(b.date);
      return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    });
  }, [announcements, promos, completedIds, deletedIds]);

  // Unread / Incomplete counter
  const unreadCount = unifiedNotifications.filter((item) => !item.isCompleted).length;

  // Action Handler: Once marked as read, it stays read and CANNOT be marked as unread
  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!completedIds.includes(id)) {
      const next = [...completedIds, id];
      setCompletedIds(next);
      saveStoredIds(COMPLETED_STORAGE_KEY, next);
    }
  };

  const handleMarkAllComplete = () => {
    const allIds = unifiedNotifications.map((item) => item.id);
    const combined = Array.from(new Set([...completedIds, ...allIds]));
    setCompletedIds(combined);
    saveStoredIds(COMPLETED_STORAGE_KEY, combined);
  };

  const handleDeleteNotification = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = [...deletedIds, id];
    setDeletedIds(next);
    saveStoredIds(DELETED_STORAGE_KEY, next);
    setUndoDeletedItem(id);

    // If active modal was deleted, select next or close
    if (selectedNotificationId === id) {
      const remaining = unifiedNotifications.filter((item) => item.id !== id);
      if (remaining.length > 0) {
        setSelectedNotificationId(remaining[0].id);
      } else {
        setExpandedModal(false);
      }
    }

    setTimeout(() => {
      setUndoDeletedItem((curr) => (curr === id ? null : curr));
    }, 5000);
  };

  const handleRestoreDeleted = () => {
    setDeletedIds([]);
    saveStoredIds(DELETED_STORAGE_KEY, []);
    setUndoDeletedItem(null);
  };

  const handleUndoSingleDelete = (id: string) => {
    const next = deletedIds.filter((item) => item !== id);
    setDeletedIds(next);
    saveStoredIds(DELETED_STORAGE_KEY, next);
    setUndoDeletedItem(null);
  };

  const handleSelectNotification = (item: UnifiedNotification) => {
    setSelectedNotificationId(item.id);
    // Automatically mark as read when clicked to view full modal
    if (!item.isCompleted) {
      handleMarkAsRead(item.id);
    }
    setIsOpenDropdown(false);
    setExpandedModal(true);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Find currently active notification for large modal
  const activeNotification =
    unifiedNotifications.find((item) => item.id === selectedNotificationId) ||
    unifiedNotifications[0] ||
    null;

  const activeIndex = activeNotification
    ? unifiedNotifications.findIndex((item) => item.id === activeNotification.id)
    : -1;

  const handlePrevNotification = () => {
    if (activeIndex > 0) {
      const prev = unifiedNotifications[activeIndex - 1];
      setSelectedNotificationId(prev.id);
      if (!prev.isCompleted) handleMarkAsRead(prev.id);
    }
  };

  const handleNextNotification = () => {
    if (activeIndex >= 0 && activeIndex < unifiedNotifications.length - 1) {
      const next = unifiedNotifications[activeIndex + 1];
      setSelectedNotificationId(next.id);
      if (!next.isCompleted) handleMarkAsRead(next.id);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 1. Bell Icon Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpenDropdown((prev) => !prev)}
        className="relative flex items-center justify-center p-2 rounded-full !text-white hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-cream)]/70"
        aria-label="Announcements, promos, and alerts"
        aria-expanded={isOpenDropdown}
        title="Promos & Announcements"
      >
        <Bell
          size={20}
          className={unreadCount > 0 ? 'animate-pulse' : ''}
        />

        {/* Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[20px] h-5 items-center justify-center rounded-full bg-[var(--oppa-green)] px-1.5 text-[11px] font-extrabold text-white shadow-md ring-2 ring-[var(--oppa-green-dark)] animate-bounce-subtle">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 2. Dropdown Menu */}
      {isOpenDropdown && (
        <div className="customer-bell-dropdown absolute right-0 mt-3 w-[calc(100vw-2rem)] sm:w-[410px] max-w-[420px] rounded-2xl border border-[var(--oppa-border)] dark:border-[#2f4335] bg-white dark:bg-[#16251b] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--oppa-border)] dark:border-[#2f4335] px-4 py-3 bg-[var(--oppa-cream)]/80 dark:bg-[#1c2e22]">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--oppa-green)]/15 text-[var(--oppa-green)] dark:bg-emerald-500/20 dark:text-emerald-300">
                <Megaphone size={15} />
              </div>
              <div>
                <h3 className="font-serif text-sm font-bold text-slate-900 dark:text-white leading-none">
                  Notifications & Promos
                </h3>
                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllComplete}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60 transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck size={13} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpenDropdown(false)}
                className="p-1 rounded-md text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
                aria-label="Close notification dropdown"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Undo Deleted Bar (if any deleted) */}
          {undoDeletedItem && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 text-white text-[11px] animate-fadeIn">
              <span>Notification dismissed.</span>
              <button
                type="button"
                onClick={() => handleUndoSingleDelete(undoDeletedItem)}
                className="text-emerald-200 hover:underline font-bold flex items-center gap-1"
              >
                <RotateCcw size={11} />
                Undo
              </button>
            </div>
          )}

          {/* List of Notification Items */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--oppa-border)]/50 dark:divide-[#2f4335]">
            {unifiedNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-[var(--oppa-green-soft)]/60 dark:bg-emerald-950/60 text-[var(--oppa-green)] dark:text-emerald-300">
                  <Bell size={22} />
                </div>
                <p className="text-sm font-bold font-serif text-slate-900 dark:text-slate-100">
                  No Notifications
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-[260px] mx-auto">
                  Check back soon for new special promos, menu drops, and exciting announcements!
                </p>
                {deletedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreDeleted}
                    className="mt-3 text-xs text-[var(--oppa-green)] dark:text-emerald-300 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <RotateCcw size={12} />
                    Restore {deletedIds.length} dismissed notification{deletedIds.length > 1 ? 's' : ''}
                  </button>
                )}
              </div>
            ) : (
              unifiedNotifications.map((item) => {
                const priorityBadge = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.normal;
                const isPromo = item.type === 'promo';
                const priorityBadgeStyle = item.isCompleted
                  ? 'bg-white/15 text-[var(--oppa-cream)] border-white/20 dark:bg-white/10 dark:text-emerald-100 dark:border-white/15'
                  : priorityBadge.style;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectNotification(item)}
                    className={`group relative grid grid-cols-[3.5rem_minmax(0,1fr)_1.75rem] items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                      item.isCompleted
                        ? 'bg-[var(--oppa-green-dark)] text-[var(--oppa-cream)] hover:bg-[var(--oppa-green-dark)]/90 dark:bg-[#0e1912] dark:text-slate-100 dark:hover:bg-[#142219]'
                        : 'bg-[var(--oppa-green-soft)]/70 text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)] dark:bg-[#1c2e22] dark:text-slate-100 dark:hover:bg-[#223a2a]'
                    }`}
                  >
                    {/* Thumbnail Image or Icon Fallback */}
                    {item.image_url ? (
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-[#354b3c] bg-black/5 shadow-xs">
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isPromo && (
                          <div className="absolute top-1 right-1 rounded-full bg-[var(--oppa-green)] p-0.5 text-white shadow-xs">
                            <Sparkles size={10} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`flex size-14 shrink-0 items-center justify-center rounded-xl border ${
                          item.isCompleted
                            ? 'bg-white/10 text-[var(--oppa-cream)] border-white/20 dark:text-emerald-200 dark:border-white/15'
                            : 'bg-[var(--oppa-green-soft)]/60 text-[var(--oppa-green-dark)] border-[var(--oppa-green)]/25 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-700/60'
                        }`}
                      >
                        {isPromo ? <Sparkles size={20} /> : <Tag size={20} />}
                      </div>
                    )}

                    {/* Content Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${priorityBadgeStyle}`}>
                          {isPromo ? (
                            <>
                              <Sparkles size={9} className="inline mr-0.5" />
                              PROMO
                            </>
                          ) : (
                            priorityBadge.label
                          )}
                        </span>

                        {item.isCompleted ? (
                          <span className="inline-flex h-4 w-12 shrink-0 items-center justify-center gap-0.5 rounded-full border border-white/20 bg-white/15 px-1.5 text-[9px] font-bold text-[var(--oppa-cream)] dark:border-white/15 dark:bg-white/10 dark:text-emerald-100">
                            <Check size={9} className="stroke-[3]" />
                            Read
                          </span>
                        ) : (
                          <span
                            className="inline-flex h-4 w-12 shrink-0 items-center justify-center gap-1 rounded-full border border-white/20 bg-white/15 px-1.5 text-[9px] font-bold text-[var(--oppa-cream)] dark:border-white/15 dark:bg-white/10 dark:text-emerald-100"
                            title="Unread"
                          >
                            <span className="size-1.5 rounded-full bg-[var(--oppa-green)] dark:bg-emerald-300" />
                            Unread
                          </span>
                        )}

                        <span className={`text-[10px] font-medium flex items-center gap-0.5 ml-auto ${item.isCompleted ? 'text-white/80 dark:text-slate-300' : 'text-[var(--oppa-text-muted)] dark:text-slate-300'}`}>
                          <Clock size={10} />
                          {formatRelativeTime(item.date)}
                        </span>
                      </div>

                      <h4 className={`text-xs font-bold font-serif line-clamp-1 transition-colors ${item.isCompleted ? 'text-[var(--oppa-cream)] dark:text-slate-100 group-hover:text-white' : 'text-slate-700 dark:text-slate-100 group-hover:text-[var(--oppa-green-dark)] dark:group-hover:text-emerald-300'}`}>
                        {item.title}
                      </h4>

                      <p className={`text-[11px] line-clamp-2 mt-0.5 leading-snug ${item.isCompleted ? 'text-white/90 dark:text-slate-300' : 'text-slate-600 dark:text-slate-300'}`}>
                        {item.content}
                      </p>

                      {/* Promo Code Tag Pill (if applicable) */}
                      {isPromo && item.promoCode && (
                        <div className={`mt-1.5 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold ${item.isCompleted ? 'border-white/20 bg-white/10 text-[var(--oppa-cream)] dark:border-white/15 dark:text-emerald-100' : 'border-[var(--oppa-green)]/25 bg-[var(--oppa-green-soft)]/60 text-[var(--oppa-green-dark)] dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>
                          <span>CODE: {item.promoCode}</span>
                          {item.discountValue && (
                            <span className={item.isCompleted ? 'font-semibold text-white/80 dark:text-emerald-200' : 'font-semibold text-[var(--oppa-green-dark)] dark:text-emerald-300'}>
                              ({item.discountType === 'percent' ? `${item.discountValue}% OFF` : `₱${item.discountValue} OFF`})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Item Actions: Read & Delete buttons */}
                    <div className="flex w-7 flex-col items-center gap-1.5">
                      {/* Mark Read Button (Once read, stays read) */}
                      {item.isCompleted ? (
                        <div
                          className="flex size-7 shrink-0 cursor-default items-center justify-center rounded-full bg-white/15 text-[var(--oppa-cream)] dark:bg-white/10 dark:text-emerald-200"
                          title="Already read"
                        >
                          <Check size={13} className="stroke-[3]" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(item.id, e)}
                          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-[var(--oppa-cream)] transition-colors hover:bg-white/25 dark:bg-white/10 dark:text-emerald-100 dark:hover:bg-white/20"
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          <X size={13} />
                        </button>
                      )}

                      {/* Delete / Dismiss Notification Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNotification(item.id, e)}
                        className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors ${item.isCompleted ? 'text-white/70 dark:text-slate-400 hover:text-red-200 hover:bg-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'}`}
                        title="Delete notification"
                        aria-label="Delete notification"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {deletedIds.length > 0 && (
            <div className="border-t border-[var(--oppa-border)] dark:border-[#2f4335] px-4 py-2.5 bg-[var(--oppa-cream)]/70 dark:bg-[#1c2e22] flex justify-end text-xs">
              <button
                type="button"
                onClick={handleRestoreDeleted}
                className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-[var(--oppa-green)] dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={11} />
                Restore ({deletedIds.length})
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Large Centered Modal for Full Announcement / Promo Details */}
      {expandedModal && activeNotification && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpandedModal(false);
          }}
        >
          <div
            className="customer-bell-modal relative flex h-[88dvh] max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col rounded-3xl border border-[var(--oppa-border)] bg-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 dark:border-[#2f4335] dark:bg-[#16251b] sm:h-[min(88vh,760px)]"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--oppa-border)] dark:border-[#2f4335] px-5 sm:px-7 py-4 bg-[var(--oppa-cream)]/80 dark:bg-[#1c2e22] shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-10 items-center justify-center rounded-2xl shadow-xs ${
                    'bg-[var(--oppa-green)] text-white'
                  }`}
                >
                  {activeNotification.type === 'promo' ? <Sparkles size={20} /> : <Megaphone size={20} />}
                </div>
                <div>
                  <h2 className="font-serif text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">
                    {activeNotification.type === 'promo' ? 'Oppa Dru Promo Offer' : 'Official Oppa Dru Announcement'}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    Notification {activeIndex + 1} of {unifiedNotifications.length}
                  </p>
                </div>
              </div>

              {/* Prev / Next & Close Header Actions */}
              <div className="flex items-center gap-1.5">
                {unifiedNotifications.length > 1 && (
                  <div className="flex items-center gap-1 mr-2 border-r border-slate-200 dark:border-[#354b3c] pr-2">
                    <button
                      type="button"
                      disabled={activeIndex === 0}
                      onClick={handlePrevNotification}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-[#354b3c] text-slate-700 dark:text-slate-200 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Previous notification"
                      aria-label="Previous"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={activeIndex === unifiedNotifications.length - 1}
                      onClick={handleNextNotification}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-[#354b3c] text-slate-700 dark:text-slate-200 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                      title="Next notification"
                      aria-label="Next"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setExpandedModal(false)}
                  className="rounded-xl p-2 text-slate-500 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/10 hover:text-slate-900 dark:text-white transition-colors"
                  title="Close (Esc)"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable Content with Image and Details */}
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Visual Media Column */}
                <div className={activeNotification.image_url ? 'md:col-span-6' : 'md:col-span-4'}>
                  {activeNotification.image_url ? (
                    <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-[#354b3c] shadow-md bg-black/5 group">
                      <img
                        src={activeNotification.image_url}
                        alt={activeNotification.title}
                        className="w-full max-h-[380px] object-cover"
                      />
                      {activeNotification.type === 'promo' && activeNotification.discountValue && (
                        <div className="absolute top-3 left-3 rounded-full bg-[var(--oppa-green)] px-3 py-1 font-extrabold text-xs text-white shadow-lg flex items-center gap-1">
                          <Flame size={13} />
                          <span>
                            {activeNotification.discountType === 'percent'
                              ? `${activeNotification.discountValue}% OFF`
                              : `₱${activeNotification.discountValue} OFF`}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-[#354b3c] bg-[var(--oppa-cream)]/50 dark:bg-white/5 text-center">
                      <div className="size-16 rounded-full bg-[var(--oppa-green)]/15 text-[var(--oppa-green)] dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center justify-center mb-3">
                        {activeNotification.type === 'promo' ? <Sparkles size={30} /> : <Megaphone size={30} />}
                      </div>
                      <span className="font-serif font-bold text-sm text-slate-900 dark:text-slate-100">Oppa Dru Bulletin</span>
                      <span className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Fresh & Authentic Korean Fried Chicken</span>
                    </div>
                  )}
                </div>

                {/* Text Content & Information Column */}
                <div className={activeNotification.image_url ? 'md:col-span-6 space-y-4' : 'md:col-span-8 space-y-4'}>
                  {/* Badges / Meta row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        PRIORITY_BADGES[activeNotification.priority]?.style || ''
                      }`}
                    >
                      {activeNotification.type === 'promo' ? (
                        <>
                          <Sparkles size={12} className="inline mr-1" />
                          PROMO OFFER
                        </>
                      ) : (
                        PRIORITY_BADGES[activeNotification.priority]?.label || 'Notice'
                      )}
                    </span>

                    {/* Completion Status (Permanent once read) */}
                    {activeNotification.isCompleted ? (
                      <span
                        className="rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700"
                        title="Marked as read"
                      >
                        <Check size={13} className="stroke-[3]" />
                        <span>Read</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(activeNotification.id)}
                        className="rounded-full px-3 py-1 text-xs font-bold flex items-center gap-1.5 bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] hover:bg-[var(--oppa-green-soft)]/80 border border-[var(--oppa-green)]/25 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700 dark:hover:bg-emerald-900/60 transition-colors shadow-xs"
                        title="Click to mark as read"
                      >
                        <Check size={13} />
                        <span>Mark as Read</span>
                      </button>
                    )}

                    {/* Date Stamp */}
                    <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <Clock size={12} />
                      <span>
                        {new Date(activeNotification.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                  </div>

                  {/* Headline */}
                  <h1 className="font-serif text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
                    {activeNotification.title}
                  </h1>

                  {/* Promo Special Voucher Box (if Promo) */}
                  {activeNotification.type === 'promo' && activeNotification.promoCode && (
                    <div className="rounded-2xl border-2 border-dashed border-[var(--oppa-green)]/40 dark:border-emerald-500/70 bg-[var(--oppa-green-soft)]/40 dark:bg-emerald-950/30 p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Tag size={18} className="text-[var(--oppa-green-dark)] dark:text-emerald-300" />
                          <span className="font-serif font-bold text-sm text-[var(--oppa-green-dark)] dark:text-emerald-100">
                            Discount Voucher
                          </span>
                        </div>
                        {activeNotification.endDate && (
                          <span className="text-[11px] font-medium text-[var(--oppa-green-dark)] dark:text-emerald-300">
                            Valid until {new Date(activeNotification.endDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Code Pill & Copy Button */}
                      <div className="flex items-center justify-between gap-3 bg-white dark:bg-[#151c16] rounded-xl p-2.5 border border-[var(--oppa-green)]/25 dark:border-emerald-700/60 shadow-xs">
                        <div className="font-mono text-base sm:text-lg font-black tracking-wider text-[var(--oppa-green-dark)] dark:text-emerald-200 pl-2">
                          {activeNotification.promoCode}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(activeNotification.promoCode!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--oppa-green)] hover:bg-[var(--oppa-green-dark)] text-white text-xs font-bold transition-all active:scale-95 shadow-xs"
                        >
                          {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                        </button>
                      </div>

                      {/* Promo Terms / Min Order info */}
                      <div className="text-[11px] text-[var(--oppa-green-dark)]/80 dark:text-emerald-200/90 space-y-0.5">
                        {activeNotification.minOrderAmount ? (
                          <p>• Minimum order amount: ₱{activeNotification.minOrderAmount.toLocaleString()}</p>
                        ) : (
                          <p>• No minimum order required!</p>
                        )}
                        {activeNotification.maxDiscountAmount && (
                          <p>• Maximum discount capped at ₱{activeNotification.maxDiscountAmount.toLocaleString()}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans">
                    {activeNotification.content}
                  </div>

                </div>
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="flex items-center justify-between border-t border-[var(--oppa-border)] dark:border-[#2f4335] px-6 py-3.5 bg-[var(--oppa-cream)]/80 dark:bg-[#1c2e22] text-xs text-slate-600 dark:text-slate-300 font-medium shrink-0">
              <span className="hidden sm:inline">Use arrow keys (← / →) to browse, Esc to close</span>
              <button
                type="button"
                onClick={() => setExpandedModal(false)}
                className="ml-auto px-4 py-1.5 rounded-xl border border-slate-300 dark:border-[#354b3c] bg-white dark:bg-white/5 text-slate-800 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomerAnnouncementBell;

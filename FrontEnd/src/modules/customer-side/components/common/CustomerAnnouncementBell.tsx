import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Flame,
  Megaphone,
  RotateCcw,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { announcementService } from '../../../../services/announcementService';
import type { Announcement, AnnouncementPriority } from '../../../../types/announcement.types';
import NotificationItem from './NotificationItem';
import type { UnifiedNotification } from './notificationTypes';

const COMPLETED_STORAGE_KEY = 'oppadru_customer_completed_notifications';
const DELETED_STORAGE_KEY = 'oppadru_customer_deleted_notifications';

const PRIORITY_BADGES: Record<AnnouncementPriority, { label: string; style: string }> = {
  normal: { label: 'Update', style: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/60 dark:text-emerald-200' },
  promo: { label: 'Special Promo', style: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/60 dark:text-emerald-200' },
  high: { label: 'Important', style: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200' },
  urgent: { label: 'Urgent Alert', style: 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200' },
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
  const [completedIds, setCompletedIds] = useState<string[]>(() => getStoredIds(COMPLETED_STORAGE_KEY));
  const [deletedIds, setDeletedIds] = useState<string[]>(() => getStoredIds(DELETED_STORAGE_KEY));

  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [expandedModal, setExpandedModal] = useState(false);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [undoDeletedItem, setUndoDeletedItem] = useState<string | null>(null);
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'unread'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isClosingDropdown, setIsClosingDropdown] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeAnimationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeDropdown = React.useCallback(() => {
    if (!isOpenDropdown) return;
    setIsOpenDropdown(false);
    setIsClosingDropdown(true);
    if (closeAnimationTimeoutRef.current) clearTimeout(closeAnimationTimeoutRef.current);
    closeAnimationTimeoutRef.current = setTimeout(() => {
      setIsClosingDropdown(false);
      closeAnimationTimeoutRef.current = null;
    }, 150);
  }, [isOpenDropdown]);

  const openDropdown = () => {
    if (closeAnimationTimeoutRef.current) clearTimeout(closeAnimationTimeoutRef.current);
    closeAnimationTimeoutRef.current = null;
    setIsClosingDropdown(false);
    setIsOpenDropdown(true);
  };

  // Load public announcements, excluding promo announcements.
  const fetchAllData = async () => {
    try {
      const annList = await announcementService.getCustomerAnnouncements().catch(() => []);
      setAnnouncements(annList.filter((item) => item.priority !== 'promo'));
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(fetchAllData);

    // 1. Polling interval every 15 seconds to catch new admin posts across clients
    const interval = setInterval(fetchAllData, 15000);

    // 2. Real-time event listener when admin creates or updates an announcement in the same browser
    const handleAnnouncementPublished = () => {
      fetchAllData();
    };

    // 3. Storage event listener when another tab updates announcements.
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'oppadru_announcements_cache_v2' ||
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
        closeDropdown();
      }
    };
    if (isOpenDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpenDropdown, closeDropdown]);

  useEffect(() => {
    if (!isOpenDropdown) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDropdown();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpenDropdown, closeDropdown]);

  useEffect(() => () => {
    if (closeAnimationTimeoutRef.current) clearTimeout(closeAnimationTimeoutRef.current);
  }, []);

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

    // Filter out deleted items
    const nonDeleted = items.filter((item) => !deletedIds.includes(item.id));

    return nonDeleted.sort((a, b) => {
      const dateA = Date.parse(a.date);
      const dateB = Date.parse(b.date);
      return (Number.isFinite(dateB) ? dateB : 0) - (Number.isFinite(dateA) ? dateA : 0);
    });
  }, [announcements, completedIds, deletedIds]);

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

  const handleToggleRead = (item: UnifiedNotification) => {
    const next = item.isCompleted
      ? completedIds.filter((id) => id !== item.id)
      : [...completedIds, item.id];
    setCompletedIds(next);
    saveStoredIds(COMPLETED_STORAGE_KEY, next);
  };

  const handleDeleteNotification = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = Array.from(new Set([...deletedIds, id]));
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
    closeDropdown();
    setExpandedModal(true);
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((previous) => previous === code ? null : previous), 2000);
    } catch (error) {
      console.error('Unable to copy the promo code.', error);
    }
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

  const visibleNotifications = unifiedNotifications.filter((item) => (
    notificationFilter === 'all'
    || (notificationFilter === 'unread' && !item.isCompleted)
  ));
  const newNotifications = visibleNotifications.filter((item) => !item.isCompleted);
  const earlierNotifications = visibleNotifications.filter((item) => item.isCompleted);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 1. Bell Icon Trigger Button */}
      <button
        type="button"
        onClick={() => (isOpenDropdown ? closeDropdown() : openDropdown())}
        className="relative flex items-center justify-center p-2 rounded-full !text-white hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--oppa-cream)]/70"
        aria-label="Announcements and alerts"
        aria-expanded={isOpenDropdown}
        title="Announcements"
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
      {(isOpenDropdown || isClosingDropdown) && (
        <section className={`customer-bell-dropdown absolute right-0 z-50 flex max-h-[70vh] w-[390px] max-w-[calc(100vw-1.5rem)] flex-col rounded-2xl border border-gray-100 bg-white shadow-2xl dark:border-[#314638] dark:bg-[#101b14] ${isClosingDropdown ? 'customer-bell-dropdown--closing' : ''}`} aria-label="Notifications" aria-hidden={isClosingDropdown || undefined}>
          <div className="customer-bell-drag-handle" aria-hidden="true"><span /></div>
          <header className="sticky top-0 z-10 shrink-0 border-b border-gray-100 bg-[#fbf8f1] px-4 pb-3 pt-3.5 dark:border-white/10 dark:bg-[#1b2b20]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-800 dark:bg-green-950/70 dark:text-emerald-300" aria-hidden="true"><Megaphone size={16} /></span>
                <h3 className="truncate font-serif text-base font-semibold text-gray-900 dark:text-gray-50">Notifications</h3>
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-900 dark:bg-green-950/70 dark:text-emerald-200">{unreadCount} new</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {unreadCount > 0 && <button type="button" onClick={handleMarkAllComplete} className="text-xs font-semibold text-green-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 dark:text-emerald-300" title="Mark all as read">Mark all read</button>}
                <button type="button" onClick={closeDropdown} className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Close notifications"><X size={17} /></button>
              </div>
            </div>
            <div className="mt-3 flex gap-2" role="tablist" aria-label="Filter notifications">
              {([
                ['all', 'All'],
                ['unread', 'Unread'],
              ] as const).map(([filter, label]) => (
                <button key={filter} type="button" role="tab" aria-selected={notificationFilter === filter} onClick={() => setNotificationFilter(filter)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 ${notificationFilter === filter ? 'bg-green-800 text-white shadow-sm dark:bg-emerald-700' : 'bg-white text-gray-600 hover:bg-green-50 hover:text-green-900 dark:bg-[#142219] dark:text-gray-300 dark:hover:bg-green-950/60 dark:hover:text-emerald-200'}`}>{label}</button>
              ))}
            </div>
          </header>

          {undoDeletedItem && (
            <div className="flex shrink-0 items-center justify-between bg-green-900 px-4 py-2 text-xs text-white dark:bg-[#213d2a]" role="status">
              <span>Notification deleted.</span>
              <button type="button" onClick={() => handleUndoSingleDelete(undoDeletedItem)} className="inline-flex items-center gap-1 font-semibold text-emerald-100 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"><RotateCcw size={13} />Undo</button>
            </div>
          )}

          <div className="customer-notification-scroll min-h-0 flex-1 overflow-y-auto" aria-live="polite">
            {isLoading ? (
              <div className="space-y-0" role="status" aria-busy="true" aria-label="Loading notifications">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="flex animate-pulse items-center gap-3 border-b border-gray-100 px-4 py-4 dark:border-white/10">
                    <span className="size-12 shrink-0 rounded-xl bg-gray-200 dark:bg-white/10" />
                    <span className="min-w-0 flex-1 space-y-2"><span className="block h-3 w-2/3 rounded bg-gray-200 dark:bg-white/10" /><span className="block h-3 w-full rounded bg-gray-100 dark:bg-white/5" /><span className="block h-3 w-1/2 rounded bg-gray-100 dark:bg-white/5" /></span>
                  </div>
                ))}
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-green-50 text-green-800 dark:bg-green-950/60 dark:text-emerald-300"><Bell size={22} /></div>
                <p className="font-serif text-sm font-semibold text-gray-900 dark:text-gray-50">You're all caught up</p>
                <p className="mx-auto mt-1 max-w-[250px] text-xs leading-5 text-gray-600 dark:text-gray-300">New announcements will show up here.</p>
                {deletedIds.length > 0 && <button type="button" onClick={handleRestoreDeleted} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-green-800 hover:underline dark:text-emerald-300"><RotateCcw size={12} />Restore dismissed notifications</button>}
              </div>
            ) : (
              <>
                {newNotifications.length > 0 && (
                  <section aria-label="New notifications">
                    <h4 className="sticky top-0 z-[1] border-b border-gray-100 bg-white/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 backdrop-blur dark:border-white/10 dark:bg-[#101b14]/95 dark:text-gray-400">New</h4>
                    {newNotifications.map((item) => <NotificationItem key={item.id} item={item} onOpen={handleSelectNotification} onToggleRead={handleToggleRead} onDelete={(notification) => handleDeleteNotification(notification.id)} onCopyCode={handleCopyCode} copiedCode={copiedCode} />)}
                  </section>
                )}
                {earlierNotifications.length > 0 && (
                  <section aria-label="Earlier notifications">
                    <h4 className="sticky top-0 z-[1] border-b border-gray-100 bg-white/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 backdrop-blur dark:border-white/10 dark:bg-[#101b14]/95 dark:text-gray-400">Earlier</h4>
                    {earlierNotifications.map((item) => <NotificationItem key={item.id} item={item} onOpen={handleSelectNotification} onToggleRead={handleToggleRead} onDelete={(notification) => handleDeleteNotification(notification.id)} onCopyCode={handleCopyCode} copiedCode={copiedCode} />)}
                  </section>
                )}
              </>
            )}
          </div>
          <footer className="sticky bottom-0 flex shrink-0 items-center justify-center border-t border-gray-100 bg-[#fbf8f1] px-4 py-3 dark:border-white/10 dark:bg-[#1b2b20]">
            <button type="button" onClick={() => { if (unifiedNotifications[0]) { setSelectedNotificationId(unifiedNotifications[0].id); setExpandedModal(true); closeDropdown(); } }} disabled={unifiedNotifications.length === 0} className="text-xs font-semibold text-green-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300">View all notifications</button>
          </footer>
        </section>
      )}

      {copiedCode && (
        <div className="fixed bottom-5 right-5 z-[110] inline-flex items-center gap-2 rounded-xl bg-green-900 px-4 py-3 text-sm font-semibold text-white shadow-xl dark:bg-[#285136]" role="status" aria-live="polite">
          <Check size={16} aria-hidden="true" />Voucher code copied
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
                          {copiedCode === activeNotification.promoCode ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedCode === activeNotification.promoCode ? 'Copied!' : 'Copy Code'}</span>
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

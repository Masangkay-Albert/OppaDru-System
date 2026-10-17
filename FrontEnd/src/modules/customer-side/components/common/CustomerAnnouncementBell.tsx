import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Maximize2,
  Megaphone,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { announcementService } from '../../../../services/announcementService';
import type { Announcement, AnnouncementPriority } from '../../../../types/announcement.types';

const READ_STORAGE_KEY = 'oppadru_customer_read_announcements';

const PRIORITY_BADGES: Record<AnnouncementPriority, { label: string; style: string }> = {
  normal: { label: 'Update', style: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  promo: { label: 'Special Promo', style: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700' },
  high: { label: 'Important', style: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-300 dark:border-orange-700' },
  urgent: { label: 'Urgent Alert', style: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-700' },
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

const getStoredReadIds = (): string[] => {
  try {
    const raw = localStorage.getItem(READ_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredReadIds = (ids: string[]) => {
  try {
    localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage limits
  }
};

interface CustomerAnnouncementBellProps {
  className?: string;
}

export const CustomerAnnouncementBell: React.FC<CustomerAnnouncementBellProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => getStoredReadIds());
  const [isOpenDropdown, setIsOpenDropdown] = useState(false);
  const [expandedModal, setExpandedModal] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load customer announcements
  const fetchAnnouncements = async () => {
    try {
      const list = await announcementService.getCustomerAnnouncements();
      setAnnouncements(list);
    } catch {
      // Fallback
      setAnnouncements([]);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    // Poll every 60 seconds for newly published customer announcements
    const interval = setInterval(fetchAnnouncements, 60000);
    return () => clearInterval(interval);
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

  // Lock body scroll and support Escape key when expanded modal is open
  useEffect(() => {
    if (expandedModal) {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const handleKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setExpandedModal(false);
        } else if (e.key === 'ArrowRight' && selectedIndex < announcements.length - 1) {
          setSelectedIndex((prev) => prev + 1);
        } else if (e.key === 'ArrowLeft' && selectedIndex > 0) {
          setSelectedIndex((prev) => prev - 1);
        }
      };
      window.addEventListener('keydown', handleKey);

      return () => {
        document.body.style.overflow = orig;
        window.removeEventListener('keydown', handleKey);
      };
    }
  }, [expandedModal, selectedIndex, announcements.length]);

  const unreadCount = announcements.filter((a) => !readIds.includes(a.id)).length;

  const markAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const next = [...readIds, id];
      setReadIds(next);
      saveStoredReadIds(next);
    }
  };

  const markAllAsRead = () => {
    const allIds = announcements.map((a) => a.id);
    setReadIds(allIds);
    saveStoredReadIds(allIds);
  };

  const handleOpenDropdown = () => {
    setIsOpenDropdown(!isOpenDropdown);
  };

  const handleSelectAnnouncement = (index: number) => {
    setSelectedIndex(index);
    const item = announcements[index];
    if (item) markAsRead(item.id);
    setIsOpenDropdown(false);
    setExpandedModal(true);
  };

  const handleExpandAll = () => {
    setIsOpenDropdown(false);
    setExpandedModal(true);
    if (announcements[selectedIndex]) {
      markAsRead(announcements[selectedIndex].id);
    }
  };

  const activeAnnouncement = announcements[selectedIndex] || announcements[0];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* 1. Bell Icon Trigger Button */}
      <button
        type="button"
        onClick={handleOpenDropdown}
        className="relative flex items-center justify-center p-2 rounded-full text-[var(--oppa-cream)] hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
        aria-label="Customer announcements and notifications"
        aria-expanded={isOpenDropdown}
        title="Announcements & Promos"
      >
        <Bell size={20} className={unreadCount > 0 ? 'animate-bounce-subtle' : ''} />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-extrabold text-slate-950 shadow-md ring-2 ring-[var(--oppa-green-dark)] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 2. Small Dropdown / Popover Window */}
      {isOpenDropdown && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-[var(--oppa-border)] bg-white dark:bg-[#1b281f] text-[var(--oppa-text)] shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Dropdown Header */}
          <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-4 py-3 bg-[var(--oppa-cream)]/50 dark:bg-white/5">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-[var(--oppa-green)]" />
              <h3 className="font-serif text-sm font-bold text-[var(--oppa-text)]">Announcements</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-medium text-[var(--oppa-green)] hover:underline flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck size={12} />
                  <span>Mark read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpenDropdown(false)}
                className="p-1 rounded-md text-[var(--oppa-text-muted)] hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Dropdown List Items */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--oppa-border)]/50">
            {announcements.length === 0 ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]">
                  <Bell size={18} />
                </div>
                <p className="text-xs font-semibold text-[var(--oppa-text)]">No Announcements</p>
                <p className="text-[11px] text-[var(--oppa-text-muted)] mt-0.5">
                  Check back soon for exclusive deals and updates!
                </p>
              </div>
            ) : (
              announcements.map((item, idx) => {
                const isUnread = !readIds.includes(item.id);
                const priorityBadge = PRIORITY_BADGES[item.priority] || PRIORITY_BADGES.normal;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectAnnouncement(idx)}
                    className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors hover:bg-[var(--oppa-cream)] dark:hover:bg-white/5 ${
                      isUnread ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    {/* Thumbnail Image */}
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="size-14 rounded-xl object-cover shrink-0 border border-[var(--oppa-border)]"
                      />
                    ) : (
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]">
                        <Tag size={18} />
                      </div>
                    )}

                    {/* Content Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${priorityBadge.style}`}>
                          {item.priority === 'promo' && <Sparkles size={9} className="inline mr-0.5" />}
                          {priorityBadge.label}
                        </span>
                        <span className="text-[10px] text-[var(--oppa-text-muted)] flex items-center gap-0.5">
                          <Clock size={10} />
                          {formatRelativeTime(item.date_sent)}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold font-serif text-[var(--oppa-text)] line-clamp-1">
                        {item.title}
                      </h4>

                      <p className="text-[11px] text-[var(--oppa-text-muted)] line-clamp-2 mt-0.5 leading-snug">
                        {item.content}
                      </p>
                    </div>

                    {/* Unread Indicator Dot */}
                    {isUnread && (
                      <span className="size-2 rounded-full bg-amber-500 shrink-0 mt-1.5" title="Unread" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Dropdown Footer: Expand to Full Screen Button */}
          {announcements.length > 0 && (
            <div className="border-t border-[var(--oppa-border)] p-2.5 bg-[var(--oppa-cream)]/40 dark:bg-white/5 flex items-center justify-between">
              <span className="text-[11px] text-[var(--oppa-text-muted)] pl-2">
                Showing {announcements.length} update{announcements.length > 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={handleExpandAll}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--oppa-green)] px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-[var(--oppa-green-dark)] transition-colors"
              >
                <Maximize2 size={13} />
                <span>Expand Full Screen</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Full-Screen / Expanded Announcement Modal View */}
      {expandedModal && activeAnnouncement && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setExpandedModal(false);
          }}
        >
          <div
            className="relative my-auto flex flex-col w-full max-w-4xl max-h-[92vh] rounded-3xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] text-[var(--oppa-text)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Sticky Header */}
            <div className="flex items-center justify-between border-b border-[var(--oppa-border)] px-6 py-4 bg-[var(--oppa-surface-raised)] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h2 className="font-serif text-lg sm:text-xl font-bold text-[var(--oppa-text)]">
                    Oppa Dru Announcements
                  </h2>
                  <p className="text-xs text-[var(--oppa-text-muted)]">
                    Announcement {selectedIndex + 1} of {announcements.length}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedModal(false)}
                  className="rounded-xl p-2 text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-cream)] transition-colors"
                  title="Close (Esc)"
                  aria-label="Close full view"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body: Large Image Alongside Full Content */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                {/* Image Section (Alongside text on desktop, on top on mobile) */}
                {activeAnnouncement.image_url ? (
                  <div className="md:col-span-6 overflow-hidden rounded-2xl border border-[var(--oppa-border)] shadow-md bg-black/5">
                    <img
                      src={activeAnnouncement.image_url}
                      alt={activeAnnouncement.title}
                      className="w-full max-h-[420px] object-cover"
                    />
                  </div>
                ) : (
                  <div className="md:col-span-4 flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/20 text-center">
                    <div className="size-16 rounded-full bg-[var(--oppa-green)]/15 text-[var(--oppa-green-dark)] flex items-center justify-center mb-2">
                      <Sparkles size={32} />
                    </div>
                    <span className="font-serif font-bold text-sm text-[var(--oppa-text)]">Oppa Dru Special</span>
                    <span className="text-xs text-[var(--oppa-text-muted)]">Official Customer Bulletin</span>
                  </div>
                )}

                {/* Text Content Section */}
                <div className={activeAnnouncement.image_url ? 'md:col-span-6 space-y-4' : 'md:col-span-8 space-y-4'}>
                  {/* Priority Tag & Date Stamp */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${PRIORITY_BADGES[activeAnnouncement.priority]?.style || ''}`}>
                      {activeAnnouncement.priority === 'promo' && <Sparkles size={13} className="inline mr-1" />}
                      {PRIORITY_BADGES[activeAnnouncement.priority]?.label || 'Notice'}
                    </span>

                    <span className="flex items-center gap-1 text-xs text-[var(--oppa-text-muted)] font-medium">
                      <Clock size={13} />
                      <span>{new Date(activeAnnouncement.date_sent || activeAnnouncement.created_at || Date.now()).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}</span>
                    </span>
                  </div>

                  {/* Headline */}
                  <h1 className="font-serif text-2xl sm:text-3xl font-extrabold leading-tight text-[var(--oppa-text)]">
                    {activeAnnouncement.title}
                  </h1>

                  {/* Message Paragraphs */}
                  <div className="text-sm sm:text-base leading-relaxed text-[var(--oppa-text-muted)] whitespace-pre-wrap space-y-3 font-sans">
                    {activeAnnouncement.content}
                  </div>

                  {/* Customer Call to Action */}
                  <div className="pt-4 flex flex-wrap items-center gap-3 border-t border-[var(--oppa-border)]">
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedModal(false);
                        navigate('/customer');
                      }}
                      className="admin-button-primary flex items-center gap-2 px-5 py-2.5 text-sm font-bold shadow-md shadow-[var(--oppa-green)]/20"
                    >
                      <span>Explore Menu & Order</span>
                      <ExternalLink size={15} />
                    </button>
                    <span className="text-xs text-[var(--oppa-text-muted)]">
                      Broadcasted by Oppa Dru Team
                    </span>
                  </div>
                </div>
              </div>

              {/* Other Announcements Slider / Selector Bar */}
              {announcements.length > 1 && (
                <div className="border-t border-[var(--oppa-border)] pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                      More Announcements ({announcements.length})
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={selectedIndex === 0}
                        onClick={() => handleSelectAnnouncement(selectedIndex - 1)}
                        className="p-1.5 rounded-lg border border-[var(--oppa-border)] disabled:opacity-40 hover:bg-[var(--oppa-cream)] transition-colors"
                        title="Previous announcement"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={selectedIndex === announcements.length - 1}
                        onClick={() => handleSelectAnnouncement(selectedIndex + 1)}
                        className="p-1.5 rounded-lg border border-[var(--oppa-border)] disabled:opacity-40 hover:bg-[var(--oppa-cream)] transition-colors"
                        title="Next announcement"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {announcements.map((item, idx) => {
                      const isCurrent = idx === selectedIndex;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectAnnouncement(idx)}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            isCurrent
                              ? 'border-[var(--oppa-green)] bg-[var(--oppa-green-soft)]/30 ring-2 ring-[var(--oppa-green)]'
                              : 'border-[var(--oppa-border)] hover:bg-[var(--oppa-cream)]'
                          }`}
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="size-11 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="size-11 rounded-lg bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)] flex items-center justify-center shrink-0">
                              <Tag size={16} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate text-[var(--oppa-text)]">{item.title}</p>
                            <p className="text-[10px] text-[var(--oppa-text-muted)] truncate">{formatRelativeTime(item.date_sent)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Sticky Footer */}
            <div className="flex items-center justify-between border-t border-[var(--oppa-border)] px-6 py-3.5 bg-[var(--oppa-surface-raised)] text-xs text-[var(--oppa-text-muted)] shrink-0">
              <span>Use arrow keys (← / →) to navigate</span>
              <button
                type="button"
                onClick={() => setExpandedModal(false)}
                className="admin-button-secondary px-4 py-1.5 text-xs font-bold"
              >
                Close View
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

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, CheckCheck, Copy, Megaphone, MoreHorizontal, Sparkles, Trash2 } from 'lucide-react';
import type { UnifiedNotification } from './notificationTypes';

interface NotificationItemProps {
  item: UnifiedNotification;
  onOpen: (item: UnifiedNotification) => void;
  onToggleRead: (item: UnifiedNotification) => void;
  onDelete: (item: UnifiedNotification) => void;
  onCopyCode: (code: string) => void;
  copiedCode: string | null;
}

const relativeTime = (date: string): string => {
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return 'Just now';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return elapsedDays === 1 ? 'Yesterday' : `${elapsedDays}d ago`;
};

const NotificationItem = ({
  item,
  onOpen,
  onToggleRead,
  onDelete,
  onCopyCode,
  copiedCode,
}: NotificationItemProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isPromo = item.type === 'promo';
  const discountText = item.discountValue
    ? item.discountType === 'percent'
      ? `${item.discountValue}% OFF`
      : `₱${item.discountValue.toLocaleString()} OFF`
    : '';

  const requestDelete = () => {
    if (isDeleting) return;
    setIsDeleting(true);
    window.setTimeout(() => onDelete(item), 150);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Delete') {
      event.preventDefault();
      requestDelete();
    }
  };

  const renderActions = () => (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleRead(item);
          setShowMobileActions(false);
        }}
        className="customer-notification-action flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 dark:text-gray-300"
        title={item.isCompleted ? 'Mark as unread' : 'Mark as read'}
        aria-label={`${item.isCompleted ? 'Mark as unread' : 'Mark as read'}: ${item.title}`}
      >
        {item.isCompleted ? <CheckCheck size={16} /> : <Check size={16} />}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          requestDelete();
          setShowMobileActions(false);
        }}
        className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600/30 dark:text-gray-300 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        title="Delete"
        aria-label={`Delete notification: ${item.title}`}
      >
        <Trash2 size={16} />
      </button>
    </>
  );

  return (
    <article aria-hidden={isDeleting || undefined} className={`notification-item relative border-b border-gray-100 transition-colors duration-150 last:border-b-0 dark:border-white/10 ${item.isCompleted ? 'customer-notification-item-surface' : 'customer-notification-item-surface customer-notification-item-surface--unread'} ${isDeleting ? 'notification-item--deleting' : ''}`}>
      {!item.isCompleted && <span className="customer-notification-unread-dot absolute left-1 top-1/2 size-2 -translate-y-1/2 rounded-full" aria-label="Unread" />}
      <div className="grid grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={() => onOpen(item)}
          onKeyDown={handleKeyDown}
          className="col-span-2 grid min-w-0 grid-cols-[48px_minmax(0,1fr)] items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/40 dark:focus-visible:ring-emerald-400/40"
          aria-label={`Open ${item.title}${item.isCompleted ? '' : ', unread'}`}
        >
          {item.image_url && !imageFailed ? (
            <img
              src={item.image_url}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="size-12 rounded-xl border border-gray-100 object-cover dark:border-white/10"
            />
          ) : (
            <span className="customer-notification-icon flex size-12 items-center justify-center rounded-xl" aria-hidden="true">
              {isPromo ? <Sparkles size={20} /> : <Megaphone size={20} />}
            </span>
          )}
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className={`min-w-0 flex-1 truncate text-sm ${item.isCompleted ? 'font-medium text-gray-800 dark:text-gray-100' : 'font-semibold text-gray-900 dark:text-gray-50'}`}>
                {item.title}
              </span>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{relativeTime(item.date)}</span>
            </span>
            <span className={`mt-0.5 block line-clamp-2 text-[13px] leading-5 ${item.isCompleted ? 'text-gray-600 dark:text-gray-300' : 'text-gray-700 dark:text-gray-200'}`}>
              {item.content}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="customer-notification-badge inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                {isPromo ? <Sparkles size={11} /> : <Megaphone size={11} />}
                {isPromo ? 'Special Promo' : 'Announcement'}
              </span>
            </span>
          </span>
        </button>

        <div className="relative flex items-center justify-end">
          <div className="notification-item-actions hidden items-center gap-0.5 sm:flex">
            {renderActions()}
          </div>
          <button
            type="button"
            onClick={() => setShowMobileActions((visible) => !visible)}
            className="customer-notification-action flex size-8 items-center justify-center rounded-lg text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 dark:text-gray-300 sm:hidden"
            aria-label={`More actions for ${item.title}`}
            aria-expanded={showMobileActions}
          >
            <MoreHorizontal size={19} />
          </button>
          {showMobileActions && (
            <div className="absolute right-0 top-9 z-10 flex rounded-xl border border-gray-100 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#17251c] sm:hidden">
              {renderActions()}
            </div>
          )}
        </div>
      </div>
      {isPromo && item.promoCode && (
        <div className="ml-[76px] mt-[-6px] flex flex-wrap items-center gap-1.5 pb-3.5 pr-4">
          <button
            type="button"
            onClick={() => onCopyCode(item.promoCode!)}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-green-200 bg-white px-2 py-1 font-mono text-[11px] font-semibold text-green-900 transition-colors hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 dark:border-green-900 dark:bg-[#132219] dark:text-emerald-200 dark:hover:bg-green-950/60"
            aria-label={`Copy voucher code ${item.promoCode}${discountText ? `, ${discountText}` : ''}`}
          >
            <span className="truncate">{item.promoCode}{discountText ? ` · ${discountText}` : ''}</span>
            {copiedCode === item.promoCode ? <Check size={13} aria-label="Copied" /> : <Copy size={13} aria-hidden="true" />}
            <span className="sr-only">{copiedCode === item.promoCode ? 'Copied!' : 'Copy code'}</span>
          </button>
          {copiedCode === item.promoCode && <span className="text-xs font-medium text-green-800 dark:text-emerald-300" role="status">Copied!</span>}
        </div>
      )}
    </article>
  );
};

export default NotificationItem;

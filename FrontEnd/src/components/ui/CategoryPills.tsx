import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuLayers } from 'react-icons/lu';

interface CategoryPillsProps {
  categories: string[];
  max?: number;
}

const formatCategory = (category: string) => category.replaceAll('-', ' ');

export default function CategoryPills({ categories, max = 2 }: CategoryPillsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, openAbove: false });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const popoverId = useId();
  const visible = categories.slice(0, max);
  const remaining = categories.slice(max);
  const pillClass = 'inline-flex h-[25px] min-w-0 max-w-[92px] items-center whitespace-nowrap rounded-full border px-2.5 text-xs font-medium capitalize leading-none';

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const popoverHeight = popoverRef.current?.offsetHeight ?? 200;
    const openAbove = window.innerHeight - rect.bottom < popoverHeight && rect.top > popoverHeight;
    setPosition({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 288)),
      top: openAbove ? Math.max(8, rect.top - popoverHeight - 8) : rect.bottom + 8,
      openAbove,
    });
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)
        || (!containerRef.current?.contains(target) && !popoverRef.current?.contains(target))) {
        setIsOpen(false);
        setIsPinned(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsPinned(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
  }, []);

  if (!categories.length) {
    return (
      <span className={`${pillClass} max-w-none gap-1.5 border-[var(--promo-success-border)] bg-[var(--promo-success-bg)] text-[var(--promo-success-text)]`}>
        <LuLayers size={13} aria-hidden="true" />
        All Categories
      </span>
    );
  }

  const scheduleClose = () => {
    if (isPinned) return;
    closeTimerRef.current = window.setTimeout(() => setIsOpen(false), 140);
  };
  const cancelClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex min-w-0 items-center gap-1.5 whitespace-nowrap"
      onMouseEnter={() => {
        cancelClose();
        setIsOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      {visible.map((category) => (
        <span
          key={category}
          className={`${pillClass} border-[var(--promo-info-border)] bg-[var(--promo-info-bg)] text-[var(--promo-info-text)]`}
          title={formatCategory(category)}
        >
          <span className="truncate">{formatCategory(category)}</span>
        </span>
      ))}
      {remaining.length > 0 && (
        <button
          ref={triggerRef}
          type="button"
          aria-label={`Show all ${categories.length} categories`}
          aria-expanded={isOpen}
          aria-controls={popoverId}
          title={`Show all ${categories.length} categories`}
          onClick={() => {
            cancelClose();
            setIsPinned(true);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={scheduleClose}
          className={`${pillClass} max-w-none shrink-0 cursor-pointer border-[var(--oppa-border)] bg-[var(--oppa-surface)] px-2 text-[var(--oppa-text-muted)] transition-colors hover:border-[var(--oppa-green)] hover:text-[var(--oppa-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/40`}
        >
          +{remaining.length}
        </button>
      )}
      {isOpen && remaining.length > 0 && createPortal(
        <div
          ref={popoverRef}
          id={popoverId}
          role="region"
          aria-label={`All ${categories.length} applicable categories`}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ left: position.left, top: position.top }}
          className={`fixed z-[150] max-h-56 w-[min(18rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-3 shadow-xl ${position.openAbove ? 'origin-bottom' : 'origin-top'}`}
        >
          <ul className="flex flex-wrap gap-1.5">
            {categories.map((category, index) => (
              <li
                key={`${category}-${index}`}
                className={`${pillClass} max-w-full border-[var(--promo-info-border)] bg-[var(--promo-info-bg)] text-[var(--promo-info-text)]`}
                title={formatCategory(category)}
              >
                <span className="truncate">{formatCategory(category)}</span>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}

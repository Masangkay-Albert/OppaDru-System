import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { LoaderCircle, Search, X } from 'lucide-react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onValueChange?: (value: string) => void;
  icon?: ReactNode;
  resultsCount?: number;
  showResultsCount?: boolean;
  isLoading?: boolean;
  wrapperClassName?: string;
  debounceMs?: number;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({
  value,
  onChange,
  onValueChange,
  icon,
  resultsCount,
  showResultsCount = false,
  isLoading = false,
  wrapperClassName = '',
  debounceMs = 250,
  className = '',
  placeholder = 'Search...',
  'aria-label': ariaLabel,
  onFocus,
  onBlur,
  onKeyDown,
  ...inputProps
}, forwardedRef) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displayValue, setDisplayValue] = useState(value);
  const [debouncing, setDebouncing] = useState(false);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const updateInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const commitValue = (nextValue: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    setDebouncing(false);
    onValueChange?.(nextValue);
    onChange(nextValue);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    setDisplayValue(nextValue);
    onValueChange?.(nextValue);
    if (debounceMs <= 0) {
      setDebouncing(false);
      onChange(nextValue);
      return;
    }
    setDebouncing(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncing(false);
      onChange(nextValue);
      debounceRef.current = null;
    }, debounceMs);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && displayValue) {
      event.preventDefault();
      setDisplayValue('');
      commitValue('');
    } else if (event.key === 'Enter' && debouncing) {
      event.preventDefault();
      commitValue(displayValue);
    }
    onKeyDown?.(event);
  };

  useEffect(() => {
    const handleSlashShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handleSlashShortcut);
    return () => window.removeEventListener('keydown', handleSlashShortcut);
  }, []);

  return (
    <div role="search" aria-label={ariaLabel || 'Search'} className={`w-full ${wrapperClassName}`}>
      <div className="group relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted,#6b7280)] transition-colors group-focus-within:text-[var(--oppa-green,#176334)] dark:text-gray-400 dark:group-focus-within:text-emerald-400" aria-hidden="true">
          {icon || <Search size={20} />}
        </span>
        <input
          {...inputProps}
          ref={updateInputRef}
          type="text"
          role="searchbox"
          aria-label={ariaLabel || placeholder}
          value={displayValue}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`h-12 w-full rounded-xl border border-[var(--oppa-border,#e5e7eb)] bg-[var(--oppa-surface,#ffffff)] py-3 pl-12 pr-12 text-sm text-[var(--oppa-text,#111827)] shadow-[inset_0_1px_2px_rgba(28,61,46,0.04)] outline-none transition duration-150 placeholder:text-[var(--oppa-text-muted,#9ca3af)] hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 dark:border-gray-700 dark:bg-[#15251b] dark:text-gray-50 dark:placeholder:text-gray-400 dark:hover:border-emerald-700 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20 ${className}`}
        />
        <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {(isLoading || debouncing) && <LoaderCircle size={16} className="animate-spin text-green-700 dark:text-emerald-400" aria-label="Searching" />}
          {!displayValue && !isLoading && !debouncing && (
            <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400 dark:border-gray-600 dark:text-gray-400" aria-hidden="true">/</kbd>
          )}
          {displayValue && (
            <button
              type="button"
              onClick={() => {
                setDisplayValue('');
                commitValue('');
                inputRef.current?.focus();
              }}
              className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-green-50 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 dark:text-gray-300 dark:hover:bg-green-950/60 dark:hover:text-emerald-200"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </span>
      </div>
      {showResultsCount && !debouncing && displayValue.trim() && typeof resultsCount === 'number' && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
          {resultsCount} {resultsCount === 1 ? 'result' : 'results'} for '{displayValue.trim()}'
        </p>
      )}
    </div>
  );
});

export default SearchInput;

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LuCheck, LuChevronDown, LuSearch } from 'react-icons/lu';
import { INPUT_LIMITS } from '../../constants/inputLimits';

export interface SelectOption<Value extends string | number = string> {
  value: Value;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
  description?: string;
  badge?: ReactNode;
}

interface SelectProps<Value extends string | number = string> {
  options: SelectOption<Value>[];
  value?: Value;
  defaultValue?: Value;
  onChange?: (value: Value) => void;
  placeholder?: string;
  icon?: ReactNode;
  searchable?: boolean;
  disabled?: boolean;
  error?: string | boolean;
  label?: string;
  helperText?: string;
  name?: string;
  required?: boolean;
  'data-required'?: boolean | string;
  'data-validate'?: string;
  'data-validation-key'?: string;
  'data-validation-name'?: string;
  'data-min-length'?: number | string;
  'data-min'?: number | string;
  'data-max'?: number | string;
  className?: string;
  triggerClassName?: string;
  id?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
  renderValue?: (option: SelectOption<Value> | undefined) => ReactNode;
}

export default function Select<Value extends string | number = string>({
  options,
  value,
  defaultValue,
  onChange,
  placeholder = 'Select an option',
  icon,
  searchable,
  disabled = false,
  error,
  label,
  helperText,
  name,
  required = false,
  'data-required': dataRequired,
  'data-validate': dataValidate,
  'data-validation-key': validationKey,
  'data-validation-name': validationName,
  'data-min-length': dataMinLength,
  'data-min': dataMin,
  'data-max': dataMax,
  className = '',
  triggerClassName = '',
  id,
  autoFocus = false,
  'aria-label': ariaLabel,
  renderValue,
}: SelectProps<Value>) {
  const generatedId = useId();
  const triggerId = id || `${generatedId}-trigger`;
  const labelId = `${generatedId}-label`;
  const helperId = `${generatedId}-helper`;
  const errorId = `${generatedId}-error`;
  const listId = `${generatedId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typeaheadRef = useRef('');
  const typeaheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState<Value | undefined>(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const [opensUp, setOpensUp] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const selectedValue = value !== undefined ? value : uncontrolledValue;
  const selectedOption = options.find((option) => option.value === selectedValue);
  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : '';
  const showSearch = searchable ?? options.length > 8;
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return normalizedQuery
      ? options.filter((option) => (
        option.label.toLocaleLowerCase().includes(normalizedQuery)
        || String(option.value).toLocaleLowerCase().includes(normalizedQuery)
        || option.description?.toLocaleLowerCase().includes(normalizedQuery)
      ))
      : options;
  }, [options, query]);
  const activeOption = filteredOptions[activeIndex];
  const activeOptionId = activeOption
    ? `${listId}-option-${options.indexOf(activeOption)}`
    : undefined;
  const menuWidth = triggerRect
    ? Math.min(Math.max(triggerRect.width, 280), Math.max(0, window.innerWidth - 24))
    : undefined;
  const menuLeft = triggerRect && menuWidth !== undefined
    ? Math.max(12, Math.min(triggerRect.left, window.innerWidth - menuWidth - 12))
    : undefined;

  const openMenu = () => {
    if (disabled) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setTriggerRect(rect);
      setOpensUp(window.innerHeight - rect.bottom < 300);
    }
    const selectedIndex = filteredOptions.findIndex((option) => option.value === selectedValue && !option.disabled);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : filteredOptions.findIndex((option) => !option.disabled));
    setQuery('');
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectOption = (option: SelectOption<Value>) => {
    if (option.disabled) return;
    if (value === undefined) setUncontrolledValue(option.value);
    onChange?.(option.value);
    closeMenu(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleResize = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        setTriggerRect(rect);
        setOpensUp(window.innerHeight - rect.bottom < 300);
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('focusin', handleFocusIn);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    if (showSearch) requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [open, showSearch]);

  useEffect(() => () => {
    if (typeaheadTimeoutRef.current) clearTimeout(typeaheadTimeoutRef.current);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      if (!filteredOptions.length) return;
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      let nextIndex = activeIndex;
      for (let step = 0; step < filteredOptions.length; step += 1) {
        nextIndex = (nextIndex + direction + filteredOptions.length) % filteredOptions.length;
        if (!filteredOptions[nextIndex]?.disabled) break;
      }
      setActiveIndex(nextIndex);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const indices = filteredOptions
        .map((option, index) => option.disabled ? -1 : index)
        .filter((index) => index >= 0);
      if (!open) openMenu();
      setActiveIndex(event.key === 'Home' ? (indices[0] ?? -1) : (indices.at(-1) ?? -1));
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      if (activeOption) selectOption(activeOption);
      return;
    }
    if (!open && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeaheadRef.current += event.key.toLocaleLowerCase();
      if (typeaheadTimeoutRef.current) clearTimeout(typeaheadTimeoutRef.current);
      typeaheadTimeoutRef.current = setTimeout(() => {
        typeaheadRef.current = '';
      }, 500);
      const match = options.find((option) => (
        !option.disabled && option.label.toLocaleLowerCase().startsWith(typeaheadRef.current)
      ));
      if (match) {
        if (value === undefined) setUncontrolledValue(match.value);
        onChange?.(match.value);
      }
    } else if (open && !showSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeaheadRef.current += event.key.toLocaleLowerCase();
      if (typeaheadTimeoutRef.current) clearTimeout(typeaheadTimeoutRef.current);
      typeaheadTimeoutRef.current = setTimeout(() => {
        typeaheadRef.current = '';
      }, 500);
      const matchIndex = filteredOptions.findIndex((option) => (
        !option.disabled && option.label.toLocaleLowerCase().startsWith(typeaheadRef.current)
      ));
      if (matchIndex >= 0) setActiveIndex(matchIndex);
    }
  };

  useEffect(() => {
    if (!open || !activeOptionId) return;
    menuRef.current?.querySelector(`#${CSS.escape(activeOptionId)}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeOptionId, open]);

  const menu = open && typeof document !== 'undefined' ? createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close options"
        className="select-mobile-backdrop fixed inset-0 z-[200] bg-black/35 sm:hidden"
        onClick={() => closeMenu()}
      />
      <div
        ref={menuRef}
        className={`select-menu fixed z-[201] overflow-hidden rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-2 shadow-lg ${
          opensUp ? 'select-menu--up' : ''
        }`}
        style={triggerRect && window.innerWidth >= 640 ? {
          left: menuLeft,
          top: opensUp ? undefined : triggerRect.bottom + 6,
          bottom: opensUp ? window.innerHeight - triggerRect.top + 6 : undefined,
          width: menuWidth,
          maxWidth: window.innerWidth - 24,
        } : undefined}
      >
        {showSearch && (
          <label className="relative mb-1.5 block">
            <span className="sr-only">Search options</span>
            <LuSearch size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]" />
            <input
              ref={searchRef}
              type="search"
              role="searchbox"
              aria-label="Search options"
              aria-controls={listId}
              aria-activedescendant={activeOptionId}
              value={query}
              maxLength={INPUT_LIMITS.search.max}
              onChange={(event) => {
                setQuery(event.target.value.slice(0, INPUT_LIMITS.search.max));
                const nextIndex = filteredOptions.findIndex((option) => !option.disabled);
                setActiveIndex(nextIndex);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeMenu(true);
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  if (!filteredOptions.length) return;
                  const direction = event.key === 'ArrowDown' ? 1 : -1;
                  let nextIndex = activeIndex;
                  for (let step = 0; step < filteredOptions.length; step += 1) {
                    nextIndex = (nextIndex + direction + filteredOptions.length) % filteredOptions.length;
                    if (!filteredOptions[nextIndex]?.disabled) break;
                  }
                  setActiveIndex(nextIndex);
                } else if (event.key === 'Home' || event.key === 'End') {
                  event.preventDefault();
                  const indices = filteredOptions
                    .map((option, index) => option.disabled ? -1 : index)
                    .filter((index) => index >= 0);
                  setActiveIndex(event.key === 'Home' ? (indices[0] ?? -1) : (indices.at(-1) ?? -1));
                } else if ((event.key === 'Enter' || event.key === ' ') && activeOption) {
                  event.preventDefault();
                  selectOption(activeOption);
                }
              }}
              placeholder="Search options..."
              className="h-10 w-full rounded-lg border border-[var(--oppa-border)] bg-[var(--oppa-cream)] pl-9 pr-3 text-sm text-[var(--oppa-text)] outline-none focus:border-[var(--oppa-green)] focus:ring-2 focus:ring-[var(--oppa-green)]/20"
            />
          </label>
        )}
        <div
          id={listId}
          role="listbox"
          aria-label={label || ariaLabel || placeholder}
          className="select-options max-h-[280px] overflow-y-auto"
        >
          {filteredOptions.length ? filteredOptions.map((option, index) => {
            const optionIndex = options.indexOf(option);
            const isSelected = option.value === selectedValue;
            const isActive = index === activeIndex;
            return (
              <button
                key={`${typeof option.value}-${option.value}`}
                id={`${listId}-option-${optionIndex}`}
                type="button"
                tabIndex={-1}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? 'bg-[var(--oppa-green-soft)] font-semibold text-[var(--oppa-green-dark)]'
                    : isActive
                      ? 'bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]'
                      : 'text-[var(--oppa-text)] hover:bg-[var(--oppa-green-soft)] hover:text-[var(--oppa-green-dark)]'
                }`}
              >
                {option.icon && <span className="shrink-0">{option.icon}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-normal break-words leading-5">{option.label}</span>
                  {option.description && <span className="mt-0.5 block whitespace-normal break-words text-xs font-normal text-[var(--oppa-text-muted)]">{option.description}</span>}
                </span>
                {option.badge}
                {isSelected && <LuCheck size={16} aria-hidden="true" className="shrink-0" />}
              </button>
            );
          }) : (
            <p className="px-3 py-2.5 text-sm text-[var(--oppa-text-muted)]">No options found.</p>
          )}
        </div>
      </div>
    </>,
    document.body,
  ) : null;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {label && (
        <label id={labelId} htmlFor={triggerId} className="mb-1.5 block text-sm font-medium text-[var(--oppa-text)]">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={triggerId}
        autoFocus={autoFocus}
        type="button"
        role="combobox"
        aria-label={ariaLabel || (!label ? placeholder : undefined)}
        aria-labelledby={label ? labelId : undefined}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-activedescendant={open ? activeOptionId : undefined}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        data-validation-key={validationKey}
        aria-describedby={errorMessage ? errorId : helperText ? helperId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        className={`flex h-11 w-full items-center gap-2.5 rounded-xl border bg-[var(--oppa-surface)] px-4 text-left text-sm font-medium text-[var(--oppa-text)] transition-colors duration-150 hover:border-[var(--oppa-green)] focus-visible:border-[var(--oppa-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]/20 disabled:cursor-not-allowed disabled:opacity-55 ${
          hasError ? 'border-[var(--promo-danger-border)]' : open ? 'border-[var(--oppa-green)] ring-2 ring-[var(--oppa-green)]/20' : 'border-[var(--oppa-border)]'
        } ${triggerClassName}`}
      >
        {icon && <span className="shrink-0 text-[var(--oppa-text-muted)]">{icon}</span>}
        <span className={`min-w-0 flex-1 truncate ${selectedOption ? '' : 'text-[var(--oppa-text-muted)]'}`}>
          {renderValue ? renderValue(selectedOption) : selectedOption?.label ?? placeholder}
        </span>
        <LuChevronDown size={17} aria-hidden="true" className={`shrink-0 text-[var(--oppa-text-muted)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {(name || required) && (
        <input
          type="text"
          name={name}
          value={selectedValue ?? ''}
          data-validation-key={validationKey}
          data-validation-name={validationName || label}
          data-required={dataRequired ?? (required ? 'true' : undefined)}
          data-validate={dataValidate}
          data-min-length={dataMinLength}
          data-min={dataMin}
          data-max={dataMax}
          tabIndex={-1}
          disabled={disabled}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-px opacity-0"
          onChange={() => undefined}
        />
      )}
      {helperText && !errorMessage && <p id={helperId} className="mt-1.5 text-xs text-[var(--oppa-text-muted)]">{helperText}</p>}
      {errorMessage && <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-[var(--promo-danger-text)]">{errorMessage}</p>}
      {menu}
    </div>
  );
}

import { forwardRef, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { sanitizeInputValue } from '../../constants/inputLimits';
import type { InputFilter } from '../../constants/inputLimits';

type LimitedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  error?: string;
  inputFilter?: InputFilter;
  showCounter?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

type LimitedTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & {
  error?: string;
  inputFilter?: InputFilter;
  showCounter?: boolean;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
};

const counterClass = 'mt-1 block min-h-4 text-right text-xs leading-4 text-[var(--oppa-text-muted)]';

export const LimitedInput = forwardRef<HTMLInputElement, LimitedInputProps>(({
  error,
  inputFilter,
  showCounter = false,
  maxLength,
  value,
  defaultValue,
  onChange,
  ...props
}, ref) => {
  const [currentValue, setCurrentValue] = useState(String(value ?? defaultValue ?? ''));
  const currentLength = String(value ?? currentValue).length;
  const errorId = props.id ? `${props.id}-validation-error` : undefined;
  const describedBy = [props['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.currentTarget.value;
    const nextValue = inputFilter ? sanitizeInputValue(rawValue, inputFilter) : rawValue;
    if (nextValue !== rawValue) event.currentTarget.value = nextValue;
    if (value === undefined) setCurrentValue(nextValue);
    onChange?.(event);
  };

  return (
    <>
      <input {...props} ref={ref} aria-invalid={Boolean(error) || props['aria-invalid']} aria-describedby={describedBy} maxLength={maxLength} value={value} defaultValue={defaultValue} onChange={handleChange} />
      {error && <span id={errorId} role="alert" className="mt-1 block min-h-4 text-xs leading-4 text-[var(--promo-danger-text)]">{error}</span>}
      {showCounter && maxLength !== undefined && <span className={counterClass}>{currentLength}/{maxLength}</span>}
    </>
  );
});
LimitedInput.displayName = 'LimitedInput';

export const LimitedTextarea: React.FC<LimitedTextareaProps> = ({
  error,
  inputFilter,
  showCounter = false,
  maxLength,
  value,
  defaultValue,
  onChange,
  ...props
}) => {
  const [currentValue, setCurrentValue] = useState(String(value ?? defaultValue ?? ''));
  const currentLength = String(value ?? currentValue).length;
  const errorId = props.id ? `${props.id}-validation-error` : undefined;
  const describedBy = [props['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const rawValue = event.currentTarget.value;
    const nextValue = inputFilter ? sanitizeInputValue(rawValue, inputFilter) : rawValue;
    if (nextValue !== rawValue) event.currentTarget.value = nextValue;
    if (value === undefined) setCurrentValue(nextValue);
    onChange?.(event);
  };

  return (
    <>
      <textarea {...props} aria-invalid={Boolean(error) || props['aria-invalid']} aria-describedby={describedBy} maxLength={maxLength} value={value} defaultValue={defaultValue} onChange={handleChange} />
      {error && <span id={errorId} role="alert" className="mt-1 block min-h-4 text-xs leading-4 text-[var(--promo-danger-text)]">{error}</span>}
      {showCounter && maxLength !== undefined && <span className={counterClass}>{currentLength}/{maxLength}</span>}
    </>
  );
};

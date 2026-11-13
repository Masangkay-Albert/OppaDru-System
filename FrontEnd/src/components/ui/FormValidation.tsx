import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useRef,
  useState,
} from 'react';
import type {
  FormEvent,
  FormHTMLAttributes,
  ReactElement,
  ReactNode,
} from 'react';

type AlertVariant = 'error' | 'success' | 'info';

interface FormAlertProps {
  children: ReactNode;
  variant?: AlertVariant;
  className?: string;
}

export function FormAlert({ children, variant = 'error', className = '' }: FormAlertProps) {
  const variantClass = {
    error: 'border-[var(--promo-danger-border)] bg-[var(--promo-danger-bg)] text-[var(--promo-danger-text)]',
    success: 'border-[var(--oppa-green)]/25 bg-[var(--oppa-green-soft)] text-[var(--oppa-green-dark)]',
    info: 'border-[var(--oppa-border)] bg-[var(--oppa-cream)] text-[var(--oppa-text)]',
  }[variant];

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`mb-4 rounded-xl border p-3.5 text-sm ${variantClass} ${className}`}
    >
      {children}
    </div>
  );
}

interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  helperText?: ReactNode;
  error?: string;
  leadingIcon?: ReactNode;
  trailingSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
}

export function FormField({
  id,
  label,
  required = false,
  optional = false,
  helperText,
  error,
  leadingIcon,
  trailingSlot,
  children,
  className = '',
  labelClassName = '',
}: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className={`mb-1.5 block text-sm font-medium text-[var(--oppa-text)] ${labelClassName}`}>
        {label}
        {required && <span aria-hidden="true" className="ml-1 text-[var(--promo-danger-text)]">*</span>}
        {optional && <span className="ml-1 font-normal text-[var(--oppa-text-muted)]">(Optional)</span>}
      </label>
      <div className="relative">
        {leadingIcon && (
          <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--oppa-text-muted)]">
            {leadingIcon}
          </span>
        )}
        {children}
        {trailingSlot && <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{trailingSlot}</span>}
      </div>
      <div className="mt-1 min-h-4 text-xs leading-4">
        {error
          ? <span id={`${id}-error`} role="alert" className="text-[var(--promo-danger-text)]">{error}</span>
          : helperText && <span id={`${id}-helper`} className="text-[var(--oppa-text-muted)]">{helperText}</span>}
      </div>
    </div>
  );
}

type ValidatedFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  children: ReactNode;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

interface UseFormValidationOptions {
  onSubmit?: ValidatedFormProps['onSubmit'];
}

function useFormValidation(_options: UseFormValidationOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  return { isSubmitting, setIsSubmitting };
}

export function ValidatedForm({ children, onSubmit, ...formProps }: ValidatedFormProps) {
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inject disabled on submit buttons when submitting
  const injectSubmitting = (nodes: ReactNode): ReactNode =>
    Children.map(nodes, (node) => {
      if (!isValidElement(node)) return node;
      const element = node as ReactElement<Record<string, unknown>>;
      const typeName = typeof element.type === 'string' ? element.type : (element.type as { name?: string }).name;
      if (typeName === 'button' && (element.props.type === 'submit' || !element.props.type)) {
        return isSubmitting ? cloneElement(element, { disabled: true }) : node;
      }
      if ('children' in element.props && element.props.children) {
        return cloneElement(element, {}, injectSubmitting(element.props.children as ReactNode));
      }
      return node;
    });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (submitting.current) { event.preventDefault(); return; }
    // Native validation already ran; if we're here the form is valid.
    event.preventDefault();
    if (!onSubmit) return;
    submitting.current = true;
    setIsSubmitting(true);
    const settle = () => { submitting.current = false; setIsSubmitting(false); };
    try {
      const result = onSubmit(event);
      if (result && typeof (result as Promise<void>).then === 'function') {
        void Promise.resolve(result).finally(settle);
      } else {
        requestAnimationFrame(settle);
      }
    } catch { settle(); }
  };

  return (
    <form {...formProps} onSubmit={handleSubmit} aria-busy={isSubmitting || formProps['aria-busy'] || undefined}>
      {injectSubmitting(children)}
    </form>
  );
}

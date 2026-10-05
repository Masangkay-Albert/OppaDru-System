import React from 'react';

interface CardFieldProps {
  label: string;
  value: string;
  placeholder: string;
  icon?: React.ReactNode;
  type?: 'text' | 'password';
  maxLength?: number;
  uppercase?: boolean;
  isFocused?: boolean;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export const CardField: React.FC<CardFieldProps> = ({
  label,
  value,
  placeholder,
  icon,
  type = 'text',
  maxLength,
  uppercase = false,
  isFocused = false,
  onChange,
  onFocus,
  onBlur,
}) => {
  return (
    <div className="credit-card-field">
      <label className="credit-card-field-label block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        {icon && (
          <div className="credit-card-field-icon absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`credit-card-field-input w-full ${icon ? 'pl-10' : 'px-4'} py-3 border-2 rounded-xl focus:border-[#2d6a4f] focus:outline-none transition ${
            uppercase ? 'uppercase' : ''
          } ${isFocused ? 'border-[#2d6a4f] ring-2 ring-[#2d6a4f]/20' : 'border-gray-200'}`}
          maxLength={maxLength}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>
    </div>
  );
};

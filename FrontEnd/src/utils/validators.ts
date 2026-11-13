// src/utils/validators.ts

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhilippinePhone = (phone: string): boolean => {
  const normalized = phone.trim().replace(/[\s()-]/g, '').replace(/^\+63/, '0');
  return /^09\d{9}$/.test(normalized);
};

export const validateMinimumLength = (value: string, minimum: number): boolean =>
  value.length >= minimum;

export const validateMaximumLength = (value: string, maximum: number): boolean =>
  value.length <= maximum;

export const validateStrongPassword = (password: string): boolean =>
  password.length >= 8
  && /[A-Z]/.test(password)
  && /[a-z]/.test(password)
  && /\d/.test(password)
  && /[^A-Za-z0-9]/.test(password);

export const validateConfirmMatch = (password: string, confirmation: string): boolean =>
  confirmation.length > 0 && password === confirmation;

export const validatePositiveNumber = (value: string): boolean => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
};

export const validateCurrency = (value: string): boolean =>
  /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value));

export const validateIntegerStock = (value: string): boolean =>
  /^\d+$/.test(value);

export const validateOrderNumber = (value: string): boolean =>
  /^[A-Z0-9-]{3,30}$/i.test(value);

export const validateUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateImageFile = (file: File | undefined): boolean => {
  if (!file) return true;
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedExtensions = /\.(jpe?g|png|webp)$/i;
  return file.size <= 2 * 1024 * 1024
    && (allowedTypes.includes(file.type) || allowedExtensions.test(file.name));
};

export const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (!validateStrongPassword(password)) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters with upper/lowercase, a number, and a symbol',
    };
  }
  return { isValid: true };
};

export const validateFullName = (name: string): { isValid: boolean; message?: string } => {
  if (!name.trim()) {
    return { isValid: false, message: 'Full name is required' };
  }
  if (name.trim().length < 2) {
    return { isValid: false, message: 'Name must be at least 2 characters' };
  }
  return { isValid: true };
};

export const validatePhoneNumber = (phone: string): { isValid: boolean; message?: string } => {
  if (!phone) return { isValid: true }; 
  
  if (!validatePhilippinePhone(phone)) {
    return { isValid: false, message: 'Enter a valid phone number (e.g. 09123456789)' };
  }
  return { isValid: true };
};

export const validateAddress = (address: { street: string; floor?: string; note?: string }): { isValid: boolean; message?: string } => {
  if (!address.street.trim()) {
    return { isValid: false, message: 'Street address is required' };
  }
  return { isValid: true };
};

export const validatePasswordsMatch = (password: string, confirmPassword: string): { isValid: boolean; message?: string } => {
  if (password !== confirmPassword) {
    return { isValid: false, message: 'Passwords do not match' };
  }
  return { isValid: true };
};

export const validateRegistrationForm = (
  fullName: string,
  email: string,
  password: string,
  confirmPassword: string
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  const nameValidation = validateFullName(fullName);
  if (!nameValidation.isValid) errors.push(nameValidation.message!);
  
  if (!validateEmail(email)) errors.push('Enter a valid email address');
  
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) errors.push(passwordValidation.message!);
  
  const matchValidation = validatePasswordsMatch(password, confirmPassword);
  if (!matchValidation.isValid) errors.push(matchValidation.message!);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
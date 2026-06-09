// src/utils/validators.ts

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; message?: string } => {
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters' };
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
  
  const phoneRegex = /^[0-9]{10,11}$/;
  if (!phoneRegex.test(phone.replace(/[^0-9]/g, ''))) {
    return { isValid: false, message: 'Please enter a valid phone number' };
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
  
  if (!validateEmail(email)) errors.push('Please enter a valid email address');
  
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) errors.push(passwordValidation.message!);
  
  const matchValidation = validatePasswordsMatch(password, confirmPassword);
  if (!matchValidation.isValid) errors.push(matchValidation.message!);
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
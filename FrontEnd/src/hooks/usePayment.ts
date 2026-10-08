import { useState, useCallback } from 'react';
import { paymentService, type OTPRequestResult } from '../services/paymentService';
import type { PaymentResult } from '../modules/customer-side/components/checkout/paymentTypes';
import { useToast } from '../modules/customer-side/components/ToastProvider';

export const usePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const { showToast } = useToast();

  const requestGCashOTP = useCallback(async (mobileNumber: string): Promise<OTPRequestResult> => {
    setIsSendingOtp(true);
    setError(null);
    try {
      const response = await paymentService.requestGCashOTP(mobileNumber);
      if (!response.success) {
        setError(response.message);
        showToast(response.message, 'error');
      } else {
        showToast(response.message, 'success');
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send OTP';
      setError(message);
      showToast(message, 'error');
      return { success: false, message };
    } finally {
      setIsSendingOtp(false);
    }
  }, [showToast]);

  const processGCash = useCallback(async (
    mobileNumber: string,
    enteredOtp: string,
    expectedOtp: string,
    amount: number
  ) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await paymentService.processGCash(mobileNumber, enteredOtp, expectedOtp, amount);
      setResult(response);
      if (response.success) {
        showToast(response.message, 'success');
      } else {
        showToast(response.message, 'error');
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      showToast(message, 'error');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [showToast]);

  const processCard = useCallback(async (data: {
    cardNumber: string;
    cardHolderName: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    amount: number;
    items: Array<{ id: string; quantity: number; selectedSize?: string; selectedAddons?: Array<{ id: string; price: number; quantity?: number }> }>;
    deliveryType: 'standard' | 'priority' | 'scheduled';
    voucherDiscount: number;
    discountRate: number;
    deliveryCoordinates?: { lat: number; lng: number };
    franchiseId?: string | null;
  }) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await paymentService.processCard(data);
      setResult(response);
      if (response.success) {
        showToast(response.message, 'success');
      } else {
        showToast(response.message, 'error');
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      showToast(message, 'error');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [showToast]);

  const confirmQRPayment = useCallback(async (referenceNumber: string, amount: number): Promise<PaymentResult | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await paymentService.confirmQRPayment(referenceNumber, amount);
      setResult(response);
      if (response.success) {
        showToast(response.message, 'success');
      } else {
        showToast(response.message, 'error');
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment verification failed';
      setError(message);
      showToast(message, 'error');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [showToast]);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setIsSendingOtp(false);
    setError(null);
    setResult(null);
  }, []);

  const formatCurrency = useCallback((amount: number): string => {
    return paymentService.formatCurrency(amount);
  }, []);

  return {
    isProcessing,
    isSendingOtp,
    error,
    result,
    requestGCashOTP,
    processGCash,
    processCard,
    confirmQRPayment,
    reset,
    formatCurrency
  };
};
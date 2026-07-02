// src/hooks/usePayment.ts
import { useState } from 'react';
import { paymentService, type PaymentResult, type OTPRequestResult } from '../services/paymentService';

export const usePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const requestGCashOTP = async (mobileNumber: string): Promise<OTPRequestResult> => {
    setIsSendingOtp(true);
    setError(null);
    try {
      const response = await paymentService.requestGCashOTP(mobileNumber);
      if (!response.success) {
        setError(response.message);
      }
      return response;
    } finally {
      setIsSendingOtp(false);
    }
  };

  const processGCash = async (
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
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const processCard = async (data: {
    cardNumber: string;
    cardHolderName: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
    amount: number;
  }) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await paymentService.processCard(data);
      setResult(response);
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setIsProcessing(false);
    setIsSendingOtp(false);
    setError(null);
    setResult(null);
  };

  return {
    isProcessing,
    isSendingOtp,
    error,
    result,
    requestGCashOTP,
    processGCash,
    processCard,
    reset,
    formatCurrency: paymentService.formatCurrency
  };
};
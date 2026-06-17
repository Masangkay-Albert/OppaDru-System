// src/hooks/usePayment.ts
import { useState } from 'react';
import { paymentService, type PaymentResult } from '../services/paymentService';

export const usePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const processGCash = async (mobileNumber: string, amount: number) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await paymentService.processGCash(mobileNumber, amount);
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
    setError(null);
    setResult(null);
  };

  return {
    isProcessing,
    error,
    result,
    processGCash,
    processCard,
    reset,
    formatCurrency: paymentService.formatCurrency
  };
};
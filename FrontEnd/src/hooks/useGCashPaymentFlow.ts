import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaymentResult } from '../modules/customer-side/components/checkout/paymentTypes';
import type { CartItem } from '../types/product.types';

const API_URL = 'https://oppadru-system-1.onrender.com/api';
const APP_URL = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://oppadru-system-1.onrender.com');

export type GCashPaymentStep = 'display' | 'confirming' | 'result';

interface UseGCashPaymentFlowProps {
  isOpen: boolean;
  amount: number;
  items: CartItem[];
  deliveryType: 'standard' | 'priority' | 'scheduled';
  voucherDiscount: number;
  discountRate: number;
  deliveryCoordinates?: { lat: number; lng: number };
  onPaymentComplete: (result: PaymentResult) => void;
  onPaymentCreated?: (reference: string) => void;
}

export const useGCashPaymentFlow = ({
  isOpen,
  amount,
  items,
  deliveryType,
  voucherDiscount,
  discountRate,
  deliveryCoordinates,
  onPaymentComplete,
  onPaymentCreated,
}: UseGCashPaymentFlowProps) => {
  const [step, setStep] = useState<GCashPaymentStep>('display');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [isCopied, setIsCopied] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionHandledRef = useRef(false);
  const paymentCreationRef = useRef<Promise<void> | null>(null);

  const handleClose = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    setStep('display');
    setResult(null);
  }, []);

  const handleRetry = useCallback(() => {
    setStep('display');
    setResult(null);
    setTimeRemaining(300);
    setReferenceNumber('');
  }, []);

  const handleCopyReference = useCallback(async () => {
    if (!referenceNumber) return;
    await navigator.clipboard.writeText(referenceNumber);
    setIsCopied(true);
    window.setTimeout(() => setIsCopied(false), 2000);
  }, [referenceNumber]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const generateQRData = useCallback(() => `${APP_URL}/payment/confirm/${referenceNumber}`, [referenceNumber]);

  useEffect(() => {
    if (!isOpen) return;

    completionHandledRef.current = false;
    setReferenceNumber('');
    setStep('display');
    setTimeRemaining(300);
    setIsCopied(false);
    setResult(null);

    if (paymentCreationRef.current) return;

    paymentCreationRef.current = fetch(`${API_URL}/payment/gcash/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        delivery_type: deliveryType,
        voucher_discount: voucherDiscount,
        discount_rate: discountRate,
        delivery_coordinates: deliveryCoordinates,
        items: items.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          selected_addons: item.selectedAddons?.map((addon) => ({ id: addon.id, price: addon.price, quantity: 1 })) || [],
        })),
      }),
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.success || !data.reference) {
        setResult({
          success: false,
          message: data.message || 'Unable to start GCash payment.',
          timestamp: new Date().toISOString(),
          paymentMethod: 'gcash',
          amount,
        });
        setStep('result');
        return;
      }

      setReferenceNumber(data.reference);
      onPaymentCreated?.(data.reference);
    }).catch(() => {
      setResult({
        success: false,
        message: 'Unable to connect to the payment server.',
        timestamp: new Date().toISOString(),
        paymentMethod: 'gcash',
        amount,
      });
      setStep('result');
    }).finally(() => {
      paymentCreationRef.current = null;
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [amount, deliveryCoordinates, deliveryType, discountRate, isOpen, items, onPaymentCreated, voucherDiscount]);

  useEffect(() => {
    if (!isOpen || !referenceNumber) return;

    const handlePaymentConfirmed = () => {
      if (completionHandledRef.current) return;
      completionHandledRef.current = true;
      if (pollRef.current) clearInterval(pollRef.current);

      const successResult: PaymentResult = {
        success: true,
        referenceNumber,
        message: 'Payment confirmed!',
        timestamp: new Date().toISOString(),
        paymentMethod: 'gcash',
        amount,
      };

      setResult(successResult);
      setStep('result');
      onPaymentComplete(successResult);
      autoCloseRef.current = window.setTimeout(() => handleClose(), 1500);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GCASH_PAYMENT_CONFIRMED' && event.data.reference === referenceNumber) {
        handlePaymentConfirmed();
      }
    };

    const closeAfterStorageUpdate = (event: StorageEvent) => {
      if (event.key === `gcash_payment_confirmed_${referenceNumber}`) {
        handlePaymentConfirmed();
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', closeAfterStorageUpdate);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', closeAfterStorageUpdate);
    };
  }, [amount, handleClose, isOpen, onPaymentComplete, referenceNumber]);

  useEffect(() => {
    if (!isOpen || step !== 'display') return;

    const timer = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen || step !== 'display' || !referenceNumber) return;

    const checkPaymentStatus = async () => {
      try {
        const response = await fetch(`${API_URL}/payment/status/${referenceNumber}`);
        const data = await response.json();

        if (data.status === 'paid') {
          setStep('confirming');
          if (completionHandledRef.current) return;
          completionHandledRef.current = true;
          if (pollRef.current) clearInterval(pollRef.current);

          const successResult: PaymentResult = {
            success: true,
            referenceNumber,
            message: 'Payment confirmed!',
            timestamp: new Date().toISOString(),
            paymentMethod: 'gcash',
            amount,
          };

          setResult(successResult);
          setStep('result');
          onPaymentComplete(successResult);
          autoCloseRef.current = window.setTimeout(() => handleClose(), 1500);
        } else if (['failed', 'expired', 'cancelled'].includes(data.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          setResult({
            success: false,
            referenceNumber,
            message: `Payment ${data.status}.`,
            timestamp: new Date().toISOString(),
            paymentMethod: 'gcash',
            amount,
          });
          setStep('result');
        }
      } catch {
        // Preserve the existing fire-and-forget polling behavior.
      }
    };

    pollRef.current = window.setInterval(checkPaymentStatus, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [amount, handleClose, isOpen, onPaymentComplete, referenceNumber, step]);

  return {
    step,
    referenceNumber,
    timeRemaining,
    isCopied,
    result,
    handleClose,
    handleRetry,
    handleCopyReference,
    formatTime,
    generateQRData,
    setResult,
  };
};

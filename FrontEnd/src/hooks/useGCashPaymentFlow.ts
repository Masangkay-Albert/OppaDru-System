import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaymentResult } from '../modules/customer-side/components/checkout/paymentTypes';
import type { CartItem } from '../types/product.types';

const API_URL = import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api';
const APP_URL = import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://oppadru-system-1.onrender.com');

export type GCashPaymentStep = 'display' | 'confirming' | 'result';

interface UseGCashPaymentFlowProps {
  isOpen: boolean;
  amount: number;
  items: CartItem[];
  deliveryType?: 'standard' | 'priority' | 'scheduled' | 'onsite';
  promoCode?: string | null;
  cashierMode?: boolean;
  discountType?: 'PWD' | 'Senior Citizen' | null;
  discountIdNumber?: string;
  discountRate?: number;
  deliveryCoordinates?: { lat: number; lng: number };
  franchiseId?: string | null;
  onPaymentComplete: (result: PaymentResult) => void;
  onPaymentCreated?: (reference: string) => void;
}

export const useGCashPaymentFlow = ({
  isOpen,
  amount,
  items,
  deliveryType = 'standard',
  promoCode,
  cashierMode = false,
  discountType,
  discountIdNumber,
  discountRate = 0,
  deliveryCoordinates,
  franchiseId,
  onPaymentComplete,
  onPaymentCreated,
}: UseGCashPaymentFlowProps) => {
  const [step, setStep] = useState<GCashPaymentStep>('display');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(300);
  const [isCopied, setIsCopied] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(amount);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completionHandledRef = useRef(false);
  const paymentCreationRef = useRef<Promise<void> | null>(null);
  const latestPropsRef = useRef({
    amount,
    items,
    deliveryType,
    promoCode,
    cashierMode,
    discountType,
    discountIdNumber,
    discountRate,
    deliveryCoordinates,
    franchiseId,
    onPaymentComplete,
    onPaymentCreated,
  });
  useEffect(() => {
    latestPropsRef.current = {
      amount,
      items,
      deliveryType,
      promoCode,
      cashierMode,
      discountType,
      discountIdNumber,
      discountRate,
      deliveryCoordinates,
      franchiseId,
      onPaymentComplete,
      onPaymentCreated,
    };
  });

  const handleClose = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    setStep('display');
    setReferenceNumber('');
    setTimeRemaining(300);
    setIsCopied(false);
    setResult(null);
    setPaymentAmount(amount);
    setRetryAttempt(0);
  }, [amount]);

  const handleRetry = useCallback(() => {
    setStep('display');
    setResult(null);
    setTimeRemaining(300);
    setReferenceNumber('');
    setIsCopied(false);
    setPaymentAmount(amount);
    setRetryAttempt((attempt) => attempt + 1);
  }, [amount]);

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

  const generateQRData = useCallback(
    () => `${APP_URL}/payment/confirm/${referenceNumber}?amount=${paymentAmount}&returnUrl=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/cashier/pos')}`,
    [paymentAmount, referenceNumber]
  );

  useEffect(() => {
    if (!isOpen) return;

    const current = latestPropsRef.current;
    completionHandledRef.current = false;

    if (paymentCreationRef.current) return;

    const token = current.cashierMode
      ? sessionStorage.getItem('employee_token')
      : localStorage.getItem('auth_token');
    const paymentUrl = current.cashierMode
      ? `${API_URL}/employee/pos/payments/gcash`
      : `${API_URL}/payment/gcash/create`;
    paymentCreationRef.current = fetch(paymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token
          ? { Authorization: `******}` }
          : {}),
      },
      body: JSON.stringify({
        amount: current.amount,
        store_time: new Date().toISOString(),
        delivery_type: current.deliveryType,
        promo_code: current.promoCode || undefined,
        ...(current.cashierMode ? {
          discount_type: current.discountType || undefined,
          discount_id_number: current.discountIdNumber || undefined,
        } : {}),
        discount_rate: current.discountRate,
        delivery_coordinates: current.deliveryCoordinates,
        franchise_id: current.franchiseId || null,
        items: current.items.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          selected_size: item.selectedSize,
          selected_addons: item.selectedAddons?.map((addon) => ({
            id: addon.id,
            price: addon.price,
            quantity: addon.quantity || 1,
          })) || [],
        })),
      }),
    }).then(async (response) => {
      const data = await response.json();
      const payment = current.cashierMode ? data.data : data;
      if (!response.ok || !data.success || !payment?.reference) {
        setResult({
          success: false,
          message: data.message || 'Unable to start GCash payment.',
          timestamp: new Date().toISOString(),
          paymentMethod: 'gcash',
          amount: current.amount,
        });
        setStep('result');
        return;
      }

      setPaymentAmount(Number(payment.amount) || current.amount);
      setReferenceNumber(payment.reference);
      current.onPaymentCreated?.(payment.reference);
    }).catch(() => {
      setResult({
        success: false,
        message: 'Unable to connect to the payment server.',
        timestamp: new Date().toISOString(),
        paymentMethod: 'gcash',
        amount: current.amount,
      });
      setStep('result');
    }).finally(() => {
      paymentCreationRef.current = null;
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [isOpen, retryAttempt]);

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
        amount: paymentAmount,
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
  }, [amount, handleClose, isOpen, onPaymentComplete, paymentAmount, referenceNumber]);

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
            amount: paymentAmount,
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
  }, [amount, handleClose, isOpen, onPaymentComplete, paymentAmount, referenceNumber, step]);

  return {
    step,
    referenceNumber,
    timeRemaining,
    isCopied,
    result,
    paymentAmount,
    handleClose,
    handleRetry,
    handleCopyReference,
    formatTime,
    generateQRData,
    setResult,
  };
};

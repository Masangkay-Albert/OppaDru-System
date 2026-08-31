export type PaymentMethod = 'gcash' | 'credit_card' | 'cash_on_delivery';

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  referenceNumber?: string;
  message: string;
  timestamp: string;
  paymentMethod: PaymentMethod;
  amount: number;
}

export type PaymentResultLike = PaymentResult;

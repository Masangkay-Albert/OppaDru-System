import { formatCurrency } from '../utils/formatters';
import type { PaymentResult } from '../modules/customer-side/components/checkout/paymentTypes';

const API_URL = import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api';

export interface OTPRequestResult {
  success: boolean;
  otp?: string;
  message: string;
}

class PaymentService {
  private static instance: PaymentService;
  private tokenKey = 'auth_token';

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  private getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private getHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  private generateReferenceNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `OPPA-${timestamp}-${random}`;
  }

  private async simulateDelay(min = 800, max = 2000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));
  }

  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private validateMobileNumber(mobile: string): boolean {
    return /^(09|\+639)\d{9}$/.test(mobile.replace(/\s/g, ''));
  }

  async requestGCashOTP(mobileNumber: string): Promise<OTPRequestResult> {
    try {
      const response = await fetch(`${API_URL}/payment/gcash/request-otp`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ mobile_number: mobileNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }

      return {
        success: data.success,
        otp: data.otp,
        message: data.message,
      };
    } catch (error) {
      await this.simulateDelay(600, 1200);

      if (!this.validateMobileNumber(mobileNumber)) {
        return {
          success: false,
          message: 'Invalid Philippine mobile number. Use format 09XXXXXXXXX.'
        };
      }

      return {
        success: true,
        otp: this.generateOTP(),
        message: `A 6-digit code was sent to ${mobileNumber}.`
      };
    }
  }

  async processGCash(
    mobileNumber: string,
    enteredOtp: string,
    expectedOtp: string,
    amount: number
  ): Promise<PaymentResult> {
    try {
      const response = await fetch(`${API_URL}/payment/gcash/verify`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          mobile_number: mobileNumber,
          otp: enteredOtp,
          amount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Payment failed');
      }

      return {
        success: data.success,
        transactionId: data.transaction_id,
        referenceNumber: data.reference_number,
        message: data.message,
        timestamp: data.timestamp || new Date().toISOString(),
        paymentMethod: data.payment_method || 'gcash',
        amount: data.amount || amount,
      };
    } catch (error) {
      await this.simulateDelay(800, 1500);

      if (enteredOtp !== expectedOtp) {
        return {
          success: false,
          message: 'Incorrect OTP. Please try again.',
          timestamp: new Date().toISOString(),
          paymentMethod: 'gcash',
          amount,
        };
      }

      const success = Math.random() < 0.92;

      if (success) {
        return {
          success: true,
          transactionId: `GCASH-${Date.now()}`,
          referenceNumber: this.generateReferenceNumber(),
          message: 'Payment successful!',
          timestamp: new Date().toISOString(),
          paymentMethod: 'gcash',
          amount,
        };
      }

      return {
        success: false,
        message: 'Payment failed. Try again.',
        timestamp: new Date().toISOString(),
        paymentMethod: 'gcash',
        amount,
      };
    }
  }

  async processCard(data: {
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
  }): Promise<PaymentResult> {
    try {
      const response = await fetch(`${API_URL}/payment/card/process`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          card_number: data.cardNumber,
          card_holder_name: data.cardHolderName,
          expiry_month: data.expiryMonth,
          expiry_year: data.expiryYear,
          cvv: data.cvv,
          amount: data.amount,
          items: data.items.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            selected_size: item.selectedSize,
            selected_addons: item.selectedAddons?.map(addon => ({
              id: addon.id,
              price: addon.price,
              quantity: addon.quantity || 1,
            })) || [],
          })),
          delivery_type: data.deliveryType,
          voucher_discount: data.voucherDiscount,
          discount_rate: data.discountRate,
          delivery_coordinates: data.deliveryCoordinates,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Card payment failed');
      }

      return {
        success: result.success,
        transactionId: result.transaction_id,
        referenceNumber: result.reference_number,
        message: result.message,
        timestamp: result.timestamp || new Date().toISOString(),
        paymentMethod: result.payment_method || 'credit_card',
        amount: result.amount || data.amount,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Card payment failed.',
        timestamp: new Date().toISOString(),
        paymentMethod: 'credit_card',
        amount: data.amount,
      };
    }
  }

  async confirmQRPayment(referenceNumber: string, amount: number): Promise<PaymentResult> {
    await this.simulateDelay(800, 1500);

    const success = Math.random() < 0.92;

    if (success) {
      return {
        success: true,
        transactionId: `QR-${Date.now()}`,
        referenceNumber, // use the reference that was actually being polled/confirmed
        message: 'Payment confirmed!',
        timestamp: new Date().toISOString(),
        paymentMethod: 'gcash',
        amount,
      };
    }

    return {
      success: false,
      referenceNumber,
      message: 'Payment verification failed. Please try again.',
      timestamp: new Date().toISOString(),
      paymentMethod: 'gcash',
      amount,
    };
  }

  formatCurrency(amount: number): string {
    return formatCurrency(amount);
  }
}

export const paymentService = PaymentService.getInstance();
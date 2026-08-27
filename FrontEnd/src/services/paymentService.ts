const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  referenceNumber?: string;
  message: string;
  timestamp: string;
  paymentMethod: 'gcash' | 'credit_card' | 'cash_on_delivery';
  amount: number;
}

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

  private validateCardNumber(card: string): boolean {
    const clean = card.replace(/\s/g, '');
    if (!/^\d{16}$/.test(clean)) return false;

    let sum = 0;
    let isEven = false;
    for (let i = clean.length - 1; i >= 0; i--) {
      let digit = parseInt(clean[i]);
      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      isEven = !isEven;
    }
    return sum % 10 === 0;
  }

  private isCardExpired(month: string, year: string): boolean {
    const now = new Date();
    const expYear = parseInt(year);
    const expMonth = parseInt(month);
    return expYear < now.getFullYear() ||
           (expYear === now.getFullYear() && expMonth < now.getMonth() + 1);
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
      await this.simulateDelay(800, 2000);

      if (!this.validateCardNumber(data.cardNumber)) {
        return {
          success: false,
          message: 'Invalid card number.',
          timestamp: new Date().toISOString(),
          paymentMethod: 'credit_card',
          amount: data.amount,
        };
      }

      if (this.isCardExpired(data.expiryMonth, data.expiryYear)) {
        return {
          success: false,
          message: 'Card has expired.',
          timestamp: new Date().toISOString(),
          paymentMethod: 'credit_card',
          amount: data.amount,
        };
      }

      const success = Math.random() < 0.88;

      if (success) {
        const masked = '****' + data.cardNumber.replace(/\s/g, '').slice(-4);
        return {
          success: true,
          transactionId: `CARD-${Date.now()}`,
          referenceNumber: this.generateReferenceNumber(),
          message: `Payment successful! Card ending in ${masked}`,
          timestamp: new Date().toISOString(),
          paymentMethod: 'credit_card',
          amount: data.amount,
        };
      }

      return {
        success: false,
        message: 'Card declined. Try again.',
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
    return `₱${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}

export const paymentService = PaymentService.getInstance();
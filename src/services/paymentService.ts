// src/services/paymentService.ts

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  referenceNumber?: string;
  message: string;
  timestamp: string;
  paymentMethod: 'gcash' | 'credit_card' | 'cash_on_delivery';
  amount: number;
}

class PaymentService {
  private static instance: PaymentService;
  private isProcessing: boolean = false;

  private constructor() {}

  public static getInstance(): PaymentService {
    if (!PaymentService.instance) {
      PaymentService.instance = new PaymentService();
    }
    return PaymentService.instance;
  }

  private generateReferenceNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `OPPA-${timestamp}-${random}`;
  }

  private async simulateDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
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

  async processGCash(mobileNumber: string, amount: number): Promise<PaymentResult> {
    if (this.isProcessing) {
      return {
        success: false,
        message: 'Payment in progress. Please wait.',
        timestamp: new Date().toISOString(),
        paymentMethod: 'gcash',
        amount
      };
    }

    this.isProcessing = true;
    try {
      if (!this.validateMobileNumber(mobileNumber)) {
        return {
          success: false,
          message: 'Invalid Philippine mobile number.',
          timestamp: new Date().toISOString(),
          paymentMethod: 'gcash',
          amount
        };
      }

      const otp = this.generateOTP();
      alert(`📱 GCash OTP: ${otp}\n\nEnter this code to complete payment.`);

      await this.simulateDelay();
      const success = Math.random() < 0.9;

      if (success) {
        return {
          success: true,
          transactionId: `GCASH-${Date.now()}`,
          referenceNumber: this.generateReferenceNumber(),
          message: 'Payment successful!',
          timestamp: new Date().toISOString(),
          paymentMethod: 'gcash',
          amount
        };
      }

      return {
        success: false,
        message: 'Payment failed. Try again.',
        timestamp: new Date().toISOString(),
        paymentMethod: 'gcash',
        amount
      };
    } finally {
      this.isProcessing = false;
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
    if (this.isProcessing) {
      return {
        success: false,
        message: 'Payment in progress. Please wait.',
        timestamp: new Date().toISOString(),
        paymentMethod: 'credit_card',
        amount: data.amount
      };
    }

    this.isProcessing = true;
    try {
      if (!this.validateCardNumber(data.cardNumber)) {
        return {
          success: false,
          message: 'Invalid card number.',
          timestamp: new Date().toISOString(),
          paymentMethod: 'credit_card',
          amount: data.amount
        };
      }

      if (this.isCardExpired(data.expiryMonth, data.expiryYear)) {
        return {
          success: false,
          message: 'Card has expired.',
          timestamp: new Date().toISOString(),
          paymentMethod: 'credit_card',
          amount: data.amount
        };
      }

      await this.simulateDelay();
      const success = Math.random() < 0.85;

      if (success) {
        const masked = '****' + data.cardNumber.replace(/\s/g, '').slice(-4);
        return {
          success: true,
          transactionId: `CARD-${Date.now()}`,
          referenceNumber: this.generateReferenceNumber(),
          message: `Payment successful! Card ending in ${masked}`,
          timestamp: new Date().toISOString(),
          paymentMethod: 'credit_card',
          amount: data.amount
        };
      }

      return {
        success: false,
        message: 'Card declined. Try again.',
        timestamp: new Date().toISOString(),
        paymentMethod: 'credit_card',
        amount: data.amount
      };
    } finally {
      this.isProcessing = false;
    }
  }

  formatCurrency(amount: number): string {
    return `₱${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}

export const paymentService = PaymentService.getInstance();
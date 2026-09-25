import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './Authcontext';

export interface Address {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

export interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'gcash';
  last4?: string;
  name: string;
  isDefault: boolean;
}

export interface UserPreferences {
  defaultDeliveryOption: 'standard' | 'priority';
  useCutlery: boolean;
  language: 'en' | 'fil';
  emailNotifications: boolean;
  smsNotifications: boolean;
  promoNotifications: boolean;
}

export interface DiscountInfo {
  isPWD: boolean;
  isSenior: boolean;
  idNumber: string;
  fullName: string;
  expiryDate: string;
  rejectionReason: string;
  status: 'pending' | 'approved' | 'rejected' | 'not_requested';
}

export interface PricingSettings {
  delivery_base_fee: number;
  delivery_base_distance_km: number;
  delivery_per_km_rate: number;
  delivery_free_subtotal: number;
  delivery_max_fee: number;
  service_fee_rate: number;
  service_fee_min: number;
  service_fee_max: number;
  merchant_latitude: number;
  merchant_longitude: number;
  service_fee?: number;
  delivery_fee_standard?: number;
  delivery_fee_priority?: number;
  vat_rate: number;
}

interface SettingsContextType {
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  preferences: UserPreferences;
  discountInfo: DiscountInfo;
  pricing: PricingSettings;
  isLoading: boolean;
  addAddress: (address: Omit<Address, 'id'>) => void;
  updateAddress: (id: string, address: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  addPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => void;
  deletePaymentMethod: (id: string) => void;
  setDefaultPaymentMethod: (id: string) => void;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
  updateDiscountInfo: (discount: Partial<DiscountInfo>) => void;
  getActiveDiscount: () => { type: 'PWD' | 'Senior' | null; discountRate: number };
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
};

const defaultPreferences: UserPreferences = {
  defaultDeliveryOption: 'standard',
  useCutlery: true,
  language: 'en',
  emailNotifications: true,
  smsNotifications: true,
  promoNotifications: true,
};

const defaultDiscountInfo: DiscountInfo = {
  isPWD: false,
  isSenior: false,
  idNumber: '',
  fullName: '',
  expiryDate: '',
  rejectionReason: '',
  status: 'not_requested',
};

const defaultPricing: PricingSettings = {
  delivery_base_fee: 49,
  delivery_base_distance_km: 3,
  delivery_per_km_rate: 10,
  delivery_free_subtotal: 0,
  delivery_max_fee: 150,
  service_fee_rate: 0.03,
  service_fee_min: 15,
  service_fee_max: 80,
  merchant_latitude: 14.329,
  merchant_longitude: 120.936,
  service_fee: 15,
  delivery_fee_standard: 49,
  delivery_fee_priority: 49,
  vat_rate: 0.12,
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
  const [discountInfo, setDiscountInfo] = useState<DiscountInfo>(defaultDiscountInfo);
  const [pricing, setPricing] = useState<PricingSettings>(defaultPricing);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api'}/settings/pricing`)
      .then(response => response.json())
      .then(data => { if (data.settings) setPricing(prev => ({ ...prev, ...data.settings })); })
      .catch(() => setPricing(defaultPricing));
  }, []);

  useEffect(() => {
    if (user?.id) {
      const savedAddresses = localStorage.getItem(`addresses_${user.id}`);
      setAddresses(savedAddresses ? JSON.parse(savedAddresses) : []);

      const savedPaymentMethods = localStorage.getItem(`paymentMethods_${user.id}`);
      setPaymentMethods(savedPaymentMethods ? JSON.parse(savedPaymentMethods) : []);

      const savedPreferences = localStorage.getItem(`preferences_${user.id}`);
      setPreferences(savedPreferences ? JSON.parse(savedPreferences) : defaultPreferences);

      const savedDiscount = localStorage.getItem(`discount_${user.id}`);
      const restoredDiscount = savedDiscount ? JSON.parse(savedDiscount) : defaultDiscountInfo;
      setDiscountInfo({ ...defaultDiscountInfo, ...restoredDiscount });

      const token = localStorage.getItem('auth_token');
      if (token) {
        fetch(`${import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api'}/discount/applications/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then((response) => response.ok ? response.json() : null)
          .then((data) => {
            const latest = Array.isArray(data?.data) ? data.data[0] : null;
            if (!latest) {
              setDiscountInfo({ ...defaultDiscountInfo, fullName: user.full_name || '' });
              return;
            }

            const nextType = latest.discount_type === 'PWD' ? 'PWD' : 'Senior Citizen';
            const isApproved = latest.status === 'approved';
            setDiscountInfo((prev) => ({
              ...prev,
              isPWD: isApproved && nextType === 'PWD',
              isSenior: isApproved && nextType === 'Senior Citizen',
              idNumber: latest.id_number || prev.idNumber,
              fullName: user.full_name || latest.full_name || prev.fullName,
              expiryDate: latest.expiry_date || prev.expiryDate,
              rejectionReason: latest.rejection_reason || '',
              status: latest.status || prev.status,
            }));
          })
          .catch(() => undefined);
      }
    }
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`addresses_${user.id}`, JSON.stringify(addresses));
    }
  }, [addresses, user?.id]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`paymentMethods_${user.id}`, JSON.stringify(paymentMethods));
    }
  }, [paymentMethods, user?.id]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`preferences_${user.id}`, JSON.stringify(preferences));
    }
  }, [preferences, user?.id]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`discount_${user.id}`, JSON.stringify(discountInfo));
    }
  }, [discountInfo, user?.id]);

  const addAddress = (address: Omit<Address, 'id'>) => {
    const newAddress: Address = {
      ...address,
      id: `addr_${Date.now()}`,
    };
    setAddresses(prev => {
      if (address.isDefault) {
        return prev.map(a => ({ ...a, isDefault: false })).concat(newAddress);
      }
      if (prev.length === 0) {
        return [{ ...newAddress, isDefault: true }];
      }
      return [...prev, newAddress];
    });
  };

  const updateAddress = (id: string, updated: Partial<Address>) => {
    setAddresses(prev =>
      prev.map(address => {
        if (address.id === id) {
          return { ...address, ...updated };
        }
        if (updated.isDefault) {
          return { ...address, isDefault: false };
        }
        return address;
      })
    );
  };

  const deleteAddress = (id: string) => {
    setAddresses(prev => prev.filter(address => address.id !== id));
  };

  const setDefaultAddress = (id: string) => {
    setAddresses(prev =>
      prev.map(address => ({
        ...address,
        isDefault: address.id === id,
      }))
    );
  };

  const addPaymentMethod = (method: Omit<PaymentMethod, 'id'>) => {
    const newMethod: PaymentMethod = {
      ...method,
      id: `pm_${Date.now()}`,
    };
    setPaymentMethods(prev => {
      if (method.isDefault) {
        return prev.map(m => ({ ...m, isDefault: false })).concat(newMethod);
      }
      if (prev.length === 0) {
        return [{ ...newMethod, isDefault: true }];
      }
      return [...prev, newMethod];
    });
  };

  const deletePaymentMethod = (id: string) => {
    setPaymentMethods(prev => prev.filter(method => method.id !== id));
  };

  const setDefaultPaymentMethod = (id: string) => {
    setPaymentMethods(prev =>
      prev.map(method => ({
        ...method,
        isDefault: method.id === id,
      }))
    );
  };

  const updatePreferences = (newPreferences: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...newPreferences }));
  };

  const updateDiscountInfo = (discount: Partial<DiscountInfo>) => {
    setDiscountInfo(prev => ({ ...prev, ...discount }));
  };

  const getActiveDiscount = () => {
    if (discountInfo.status === 'approved' && discountInfo.isPWD) {
      return { type: 'PWD' as const, discountRate: 0.20 };
    }
    if (discountInfo.status === 'approved' && discountInfo.isSenior) {
      return { type: 'Senior' as const, discountRate: 0.20 };
    }
    return { type: null, discountRate: 0 };
  };

  return (
    <SettingsContext.Provider
      value={{
        addresses,
        paymentMethods,
        preferences,
        discountInfo,
        pricing,
        isLoading,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        addPaymentMethod,
        deletePaymentMethod,
        setDefaultPaymentMethod,
        updatePreferences,
        updateDiscountInfo,
        getActiveDiscount,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
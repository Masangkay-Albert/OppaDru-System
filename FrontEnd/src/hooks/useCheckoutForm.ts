import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/Authcontext';
import { authService } from '../services/authService';

export interface Address {
  block: string; 
  lot: string;   
  street: string;
  floor: string;
  note: string;

}

export interface TempPerson {
  fullName: string;
  email: string;
  phone: string;
}

export const useCheckoutForm = () => {
  const { user } = useAuth();
  const resolvedUser = user ?? authService.getUserFromStorage();

  const [address, setAddress] = useState<Address>({ block: '', lot: '', street: '', floor: '', note: '' }); 
  const [tempPerson, setTempPerson] = useState<TempPerson>({
    fullName: resolvedUser?.full_name || '',
    email: resolvedUser?.email || '',
    phone: resolvedUser?.phone || ''
  });
  const [deliveryType, setDeliveryType] = useState<'standard' | 'priority'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash_on_delivery');
  const [voucherDiscount, setVoucherDiscount] = useState(0);

  useEffect(() => {
    if (!resolvedUser) return;

    setTempPerson(prev => ({
      fullName: prev.fullName || resolvedUser.full_name || '',
      email: prev.email || resolvedUser.email || '',
      phone: prev.phone || resolvedUser.phone || '',
    }));
  }, [resolvedUser]);

  const updateAddress = useCallback((field: keyof Address, value: string) => {
    setAddress(prev => ({ ...prev, [field]: value }));
  }, []);

  const updatePerson = useCallback((field: keyof TempPerson, value: string) => {
    setTempPerson(prev => ({ ...prev, [field]: value }));
  }, []);

  const isValid = useCallback(() => {
    return !!address.street && !!tempPerson.fullName && !!tempPerson.phone;
  }, [address.street, tempPerson.fullName, tempPerson.phone]);

  return {
    address,
    setAddress,
    updateAddress,
    tempPerson,
    setTempPerson,
    updatePerson,
    deliveryType,
    setDeliveryType,
    paymentMethod,
    setPaymentMethod,
    voucherDiscount,
    setVoucherDiscount,
    isValid
  };
};

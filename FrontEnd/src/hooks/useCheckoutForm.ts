import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/Authcontext';

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

  const [address, setAddress] = useState<Address>({ block: '', lot: '', street: '', floor: '', note: '' }); 
  const [tempPerson, setTempPerson] = useState<TempPerson>({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: ''
  });
  const [deliveryType, setDeliveryType] = useState<'standard' | 'priority'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash_on_delivery');
  const [voucherDiscount, setVoucherDiscount] = useState(0);

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
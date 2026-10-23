import { createContext, useContext } from 'react';

export const CashierStatusContext = createContext<((status: string) => void) | null>(null);

export const useCashierLayoutStatus = () => {
  const setStatus = useContext(CashierStatusContext);
  if (!setStatus) throw new Error('useCashierLayoutStatus must be used within CashierLayout');
  return setStatus;
};

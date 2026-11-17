import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { API_URL } from '../services/apiConfig';

export type StoreHoursState = 'open' | 'last_order_passed' | 'closed';

export interface StoreHoursStatus {
  state: StoreHoursState;
  current_store_time: string;
  next_opening_at: string;
  next_opening_label: string;
  configured_hours: {
    opening: string;
    last_order: string;
    closing: string;
    timezone: string;
  };
  order_closed_message: string;
  simulation_enabled: boolean;
}

interface StoreHoursContextValue {
  status: StoreHoursStatus | null;
  isLoading: boolean;
  refreshStatus: () => Promise<void>;
}

const StoreHoursContext = createContext<StoreHoursContextValue | undefined>(undefined);

const isStoreHoursStatus = (value: unknown): value is StoreHoursStatus => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const hours = candidate.configured_hours;
  if (typeof hours !== 'object' || hours === null) return false;
  const configuredHours = hours as Record<string, unknown>;

  return (candidate.state === 'open' || candidate.state === 'last_order_passed' || candidate.state === 'closed')
    && typeof candidate.current_store_time === 'string'
    && typeof candidate.next_opening_at === 'string'
    && typeof candidate.next_opening_label === 'string'
    && typeof candidate.order_closed_message === 'string'
    && typeof candidate.simulation_enabled === 'boolean'
    && typeof configuredHours.opening === 'string'
    && typeof configuredHours.last_order === 'string'
    && typeof configuredHours.closing === 'string'
    && typeof configuredHours.timezone === 'string';
};

export const StoreHoursProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [status, setStatus] = useState<StoreHoursStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestInFlightRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    if (requestInFlightRef.current) return;
    requestInFlightRef.current = true;

    try {
      const response = await fetch(`${API_URL}/store-hours`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Could not check store hours.');

      const payload: unknown = await response.json();
      if (!isStoreHoursStatus(payload)) throw new Error('Store hours response was invalid.');

      setStatus(payload);
    } catch (error) {
      console.error('Failed to check store hours:', error);
      setStatus(null);
    } finally {
      requestInFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    const interval = window.setInterval(() => void refreshStatus(), 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshStatus();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshStatus]);

  return (
    <StoreHoursContext.Provider value={{ status, isLoading, refreshStatus }}>
      {children}
    </StoreHoursContext.Provider>
  );
};

export const useStoreHours = (): StoreHoursContextValue => {
  const context = useContext(StoreHoursContext);
  if (!context) throw new Error('useStoreHours must be used within StoreHoursProvider.');
  return context;
};

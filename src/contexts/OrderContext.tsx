// src/contexts/OrderContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { CartItem } from '../types/product.types';
import { ORDER_STATUS, type OrderStatus } from '../utils/constants';
import { OPPA_DRU_STORE_COORDS, calculateDistance, getRoutePoints, type Coordinates } from '../services/geocodingService';

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  deliveryAddress: string;
  deliveryAddressCoords: Coordinates;
  status: OrderStatus;
  driverPosition: Coordinates;
  startPosition: Coordinates;
  routePoints: Coordinates[];
  currentRouteIndex: number;
  distance: number;
  eta: number;
  createdAt: Date;
}

interface OrderContextType {
  currentOrder: Order | null;
  placeOrder: (items: CartItem[], total: number, deliveryAddress: string, addressCoords: Coordinates) => void;
  clearOrder: () => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const useOrder = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrder must be used within OrderProvider');
  }
  return context;
};

export const OrderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(60000); // 60 seconds (1 minuto) travel time - mas mabagal

  const stopSimulation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };

  const startDriverSimulation = (destination: Coordinates, routePoints: Coordinates[]) => {
    stopSimulation();
    
    startTimeRef.current = Date.now();
    const totalPoints = routePoints.length;

    const updatePosition = () => {
      const elapsed = Date.now() - startTimeRef.current;
      let progress = Math.min(1, elapsed / durationRef.current);
      
      setCurrentOrder(prev => {
        if (!prev) return null;
        
        if (progress >= 1) {
          stopSimulation();
          return {
            ...prev,
            status: ORDER_STATUS.DELIVERED,
            driverPosition: destination,
            eta: 0,
            currentRouteIndex: 100
          };
        }
        
        const pointIndex = Math.floor(progress * (totalPoints - 1));
        const currentPosition = routePoints[pointIndex];
        const progressPercent = Math.floor(progress * 100);
        
        let remainingDistance = 0;
        for (let i = pointIndex; i < totalPoints - 1; i++) {
          remainingDistance += calculateDistance(
            routePoints[i].lat, routePoints[i].lng,
            routePoints[i + 1].lat, routePoints[i + 1].lng
          );
        }
        const newEta = Math.max(1, Math.ceil(remainingDistance * 2));
        
        let newStatus = prev.status;
        if (progress >= 0.9 && newStatus !== ORDER_STATUS.ARRIVING_SOON) {
          newStatus = ORDER_STATUS.ARRIVING_SOON;
        } else if (progress > 0.1 && newStatus === ORDER_STATUS.PREPARING) {
          newStatus = ORDER_STATUS.ON_THE_WAY;
        }
        
        return {
          ...prev,
          driverPosition: currentPosition,
          eta: newEta,
          status: newStatus,
          currentRouteIndex: progressPercent
        };
      });
      
      animationRef.current = requestAnimationFrame(updatePosition);
    };
    
    animationRef.current = requestAnimationFrame(updatePosition);
  };

  const placeOrder = (
    items: CartItem[],
    total: number,
    deliveryAddress: string,
    addressCoords: Coordinates
  ) => {
    const distance = calculateDistance(
      OPPA_DRU_STORE_COORDS.lat,
      OPPA_DRU_STORE_COORDS.lng,
      addressCoords.lat,
      addressCoords.lng
    );
    
    const eta = Math.max(1, Math.ceil(distance * 2));
    const routePoints = getRoutePoints(
      { lat: OPPA_DRU_STORE_COORDS.lat, lng: OPPA_DRU_STORE_COORDS.lng },
      addressCoords
    );
    
    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      items,
      total,
      deliveryAddress,
      deliveryAddressCoords: addressCoords,
      status: ORDER_STATUS.PREPARING,
      driverPosition: { lat: OPPA_DRU_STORE_COORDS.lat, lng: OPPA_DRU_STORE_COORDS.lng },
      startPosition: { lat: OPPA_DRU_STORE_COORDS.lat, lng: OPPA_DRU_STORE_COORDS.lng },
      routePoints,
      currentRouteIndex: 0,
      distance,
      eta,
      createdAt: new Date()
    };
    
    setCurrentOrder(newOrder);

    // Start driver simulation after 3 seconds (preparation time)
    setTimeout(() => {
      startDriverSimulation(addressCoords, routePoints);
    }, 3000);
  };

  const clearOrder = () => {
    stopSimulation();
    setCurrentOrder(null);
  };

  useEffect(() => {
    return () => stopSimulation();
  }, []);

  return (
    <OrderContext.Provider value={{ currentOrder, placeOrder, clearOrder }}>
      {children}
    </OrderContext.Provider>
  );
};
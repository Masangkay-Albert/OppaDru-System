// src/contexts/FavoritesContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types/product.types';
import { useAuth } from '../contexts/Authcontext';

interface OrderCount {
  productId: string;
  count: number;
  lastOrderDate: number; 
}

interface FavoritesContextType {
  favorites: Product[];
  orderCounts: OrderCount[];
  addOrder: (product: Product) => void;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: Product) => void;
  showNotification: boolean;
  newFavoriteName: string;
  clearNotification: () => void;
  getOrderCount: (productId: string) => number;
  getLastOrderedProduct: () => string | null;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider');
  return context;
};

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [orderCounts, setOrderCounts] = useState<OrderCount[]>([]);
  const [lastOrderedProductId, setLastOrderedProductId] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState('');
  const [notificationTimer, setNotificationTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user?.id) {
      const savedFavorites = localStorage.getItem(`favorites_${user.id}`);
      setFavorites(savedFavorites ? JSON.parse(savedFavorites) : []);

      // Load order counts for this user
      const savedOrderCounts = localStorage.getItem(`orderCounts_${user.id}`);
      setOrderCounts(savedOrderCounts ? JSON.parse(savedOrderCounts) : []);

      // Load last ordered product for this user
      const savedLastOrdered = localStorage.getItem(`lastOrderedProductId_${user.id}`);
      setLastOrderedProductId(savedLastOrdered || null);
    } else {
      // Clear data when no user is logged in
      setFavorites([]);
      setOrderCounts([]);
      setLastOrderedProductId(null);
      setShowNotification(false);
      setNewFavoriteName('');
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`favorites_${user.id}`, JSON.stringify(favorites));
    }
  }, [favorites, user?.id]);

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`orderCounts_${user.id}`, JSON.stringify(orderCounts));
    }
  }, [orderCounts, user?.id]);

  useEffect(() => {
    if (user?.id) {
      if (lastOrderedProductId) {
        localStorage.setItem(`lastOrderedProductId_${user.id}`, lastOrderedProductId);
      } else {
        localStorage.removeItem(`lastOrderedProductId_${user.id}`);
      }
    }
  }, [lastOrderedProductId, user?.id]);

  const clearNotificationTimer = () => {
    if (notificationTimer) {
      clearTimeout(notificationTimer);
      setNotificationTimer(null);
    }
  };

  const addOrder = (product: Product) => {
    if (!user?.id) {
      console.warn('Cannot add order: User not logged in');
      return;
    }

    const isConsecutive = lastOrderedProductId === product.id;
    
    setOrderCounts(prev => {
      let newPrev = [...prev];
      
      if (isConsecutive) {
        const existing = prev.find(p => p.productId === product.id);
        
        if (existing) {
          const newCount = existing.count + 1;
          newPrev = prev.map(p => 
            p.productId === product.id ? { ...p, count: newCount, lastOrderDate: Date.now() } : p
          );
          
          console.log(`Consecutive order! ${product.name} count: ${newCount}`);

          if (newCount === 3) {
            setFavorites(currentFavorites => {
              if (!currentFavorites.some(f => f.id === product.id)) {
                const newFavorites = [...currentFavorites, product];
                
                clearNotificationTimer();
                setNewFavoriteName(product.name);
                setShowNotification(true);
                
                const timer = setTimeout(() => {
                  setShowNotification(false);
                  setNotificationTimer(null);
                }, 3000);
                setNotificationTimer(timer);
                
                return newFavorites;
              }
              return currentFavorites;
            });
          }
        } else {
          newPrev = [...prev, { productId: product.id, count: 1, lastOrderDate: Date.now() }];
          console.log(`First time ordering ${product.name}, count: 1`);
        }
      } else {
        console.log(`Different product! Resetting all counts. Last was: ${lastOrderedProductId}, Now: ${product.id}`);
        newPrev = [{ productId: product.id, count: 1, lastOrderDate: Date.now() }];
      }
      
      return newPrev;
    });

    setLastOrderedProductId(product.id);
  };

  const isFavorite = (productId: string) => favorites.some(f => f.id === productId);

  const toggleFavorite = (product: Product) => {
    if (!user?.id) {
      console.warn('Cannot toggle favorite: User not logged in');
      return;
    }

    setFavorites(prev => 
      prev.some(f => f.id === product.id)
        ? prev.filter(f => f.id !== product.id)
        : [...prev, product]
    );
  };

  const clearNotification = () => {
    clearNotificationTimer();
    setShowNotification(false);
  };

  const getOrderCount = (productId: string) => {
    const order = orderCounts.find(o => o.productId === productId);
    return order?.count || 0;
  };

  const getLastOrderedProduct = () => lastOrderedProductId;

  return (
    <FavoritesContext.Provider value={{
      favorites,
      orderCounts,
      addOrder,
      isFavorite,
      toggleFavorite,
      showNotification,
      newFavoriteName,
      clearNotification,
      getOrderCount,
      getLastOrderedProduct
    }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export type { FavoritesContextType };
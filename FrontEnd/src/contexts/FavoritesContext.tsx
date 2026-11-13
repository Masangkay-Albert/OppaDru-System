import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types/product.types';
import { useAuth } from './Authcontext';

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
  clearFavoriteNotification: () => void;
  favoriteNotificationCount: number;
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
  const getActiveUserId = (): string | null => {
    if (user?.id) return user.id;
    try {
      const raw = sessionStorage.getItem('employee_auth');
      if (raw) {
        const emp = JSON.parse(raw);
        return emp?.id ? `emp_${emp.id}` : null;
      }
    } catch {
      return null;
    }
  };
  const activeUserId = getActiveUserId();

  const [favorites, setFavorites] = useState<Product[]>([]);
  const [orderCounts, setOrderCounts] = useState<OrderCount[]>([]);
  const [lastOrderedProductId, setLastOrderedProductId] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState('');
  const [favoriteNotificationCount, setFavoriteNotificationCount] = useState(0);
  const [notificationTimer, setNotificationTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeUserId) {
      const savedFavorites = localStorage.getItem(`favorites_${activeUserId}`);
      setFavorites(savedFavorites ? JSON.parse(savedFavorites) : []);

      const savedOrderCounts = localStorage.getItem(`orderCounts_${activeUserId}`);
      setOrderCounts(savedOrderCounts ? JSON.parse(savedOrderCounts) : []);

      const savedLastOrdered = localStorage.getItem(`lastOrderedProductId_${activeUserId}`);
      setLastOrderedProductId(savedLastOrdered || null);

      const savedNotificationCount = localStorage.getItem(`favoriteNotificationCount_${activeUserId}`);
      setFavoriteNotificationCount(savedNotificationCount ? JSON.parse(savedNotificationCount) : 0);
    } else {
      setFavorites([]);
      setOrderCounts([]);
      setLastOrderedProductId(null);
      setShowNotification(false);
      setNewFavoriteName('');
      setFavoriteNotificationCount(0);
    }
  }, [activeUserId]);

  useEffect(() => {
    if (activeUserId) {
      localStorage.setItem(`favorites_${activeUserId}`, JSON.stringify(favorites));
    }
  }, [favorites, activeUserId]);

  useEffect(() => {
    if (activeUserId) {
      localStorage.setItem(`orderCounts_${activeUserId}`, JSON.stringify(orderCounts));
    }
  }, [orderCounts, activeUserId]);

  useEffect(() => {
    if (activeUserId) {
      if (lastOrderedProductId) {
        localStorage.setItem(`lastOrderedProductId_${activeUserId}`, lastOrderedProductId);
      } else {
        localStorage.removeItem(`lastOrderedProductId_${activeUserId}`);
      }
    }
  }, [lastOrderedProductId, activeUserId]);

  useEffect(() => {
    if (activeUserId) {
      localStorage.setItem(`favoriteNotificationCount_${activeUserId}`, JSON.stringify(favoriteNotificationCount));
    }
  }, [favoriteNotificationCount, activeUserId]);

  const clearNotificationTimer = () => {
    if (notificationTimer) {
      clearTimeout(notificationTimer);
      setNotificationTimer(null);
    }
  };

  const addOrder = (product: Product) => {
    if (!activeUserId) {
      console.warn('Cannot add order: User not logged in');
      return;
    }

    const isConsecutive = lastOrderedProductId === product.id;
    
    setOrderCounts(prev => {
      if (isConsecutive) {
        const existing = prev.find(p => p.productId === product.id);

        if (existing) {
          const newCount = existing.count + 1;
          const updatedCounts = prev.map(p =>
            p.productId === product.id ? { ...p, count: newCount, lastOrderDate: Date.now() } : p
          );

          if (newCount === 3) {
            setFavorites(currentFavorites => {
              if (!currentFavorites.some(f => f.id === product.id)) {
                const newFavorites = [...currentFavorites, product];

                clearNotificationTimer();
                setNewFavoriteName(product.name);
                setShowNotification(true);
                setFavoriteNotificationCount(prevCount => prevCount + 1);

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

          return updatedCounts;
        }

        return [...prev, { productId: product.id, count: 1, lastOrderDate: Date.now() }];
      }

      return [{ productId: product.id, count: 1, lastOrderDate: Date.now() }];
    });

    setLastOrderedProductId(product.id);
  };

  const clearFavoriteNotification = () => {
    setFavoriteNotificationCount(0);
  };

  const isFavorite = (productId: string) => favorites.some(f => f.id === productId);

  const toggleFavorite = (product: Product) => {
    if (!activeUserId) {
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
      clearFavoriteNotification,
      favoriteNotificationCount,
      getOrderCount,
      getLastOrderedProduct
    }}>
      {children}
    </FavoritesContext.Provider>
  );
};

export type { FavoritesContextType };
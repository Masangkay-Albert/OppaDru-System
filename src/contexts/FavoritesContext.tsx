import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types/product.types';

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
  const [favorites, setFavorites] = useState<Product[]>(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const [orderCounts, setOrderCounts] = useState<OrderCount[]>(() => {
    const saved = localStorage.getItem('orderCounts');
    return saved ? JSON.parse(saved) : [];
  });

  const [lastOrderedProductId, setLastOrderedProductId] = useState<string | null>(() => {
    return localStorage.getItem('lastOrderedProductId');
  });

  const [showNotification, setShowNotification] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState('');
  const [notificationTimer, setNotificationTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('orderCounts', JSON.stringify(orderCounts));
  }, [orderCounts]);

  useEffect(() => {
    if (lastOrderedProductId) {
      localStorage.setItem('lastOrderedProductId', lastOrderedProductId);
    } else {
      localStorage.removeItem('lastOrderedProductId');
    }
  }, [lastOrderedProductId]);

  const clearNotificationTimer = () => {
    if (notificationTimer) {
      clearTimeout(notificationTimer);
      setNotificationTimer(null);
    }
  };

  const addOrder = (product: Product) => {
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
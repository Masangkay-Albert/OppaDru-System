// src/contexts/FavoritesContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Product } from '../types/product.types';

interface OrderCount {
  productId: string;
  count: number;
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

  const [showNotification, setShowNotification] = useState(false);
  const [newFavoriteName, setNewFavoriteName] = useState('');

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('orderCounts', JSON.stringify(orderCounts));
  }, [orderCounts]);

  const addOrder = (product: Product) => {
    setOrderCounts(prev => {
      const existing = prev.find(p => p.productId === product.id);
      let newCount = 1;
      let newPrev = prev;
      
      if (existing) {
        newCount = existing.count + 1;
        newPrev = prev.map(p => 
          p.productId === product.id ? { ...p, count: newCount } : p
        );
      } else {
        newPrev = [...prev, { productId: product.id, count: 1 }];
      }

      // Check if order count reaches 3 and not already in favorites
      if (newCount === 3 && !favorites.some(f => f.id === product.id)) {
        setFavorites(prevFav => [...prevFav, product]);
        setNewFavoriteName(product.name);
        setShowNotification(true);
        setTimeout(() => setShowNotification(false), 3000);
      }

      return newPrev;
    });
  };

  const isFavorite = (productId: string) => favorites.some(f => f.id === productId);

  const toggleFavorite = (product: Product) => {
    setFavorites(prev => 
      prev.some(f => f.id === product.id)
        ? prev.filter(f => f.id !== product.id)
        : [...prev, product]
    );
  };

  const clearNotification = () => setShowNotification(false);

  return (
    <FavoritesContext.Provider value={{
      favorites,
      orderCounts,
      addOrder,
      isFavorite,
      toggleFavorite,
      showNotification,
      newFavoriteName,
      clearNotification
    }}>
      {children}
    </FavoritesContext.Provider>
  );
};
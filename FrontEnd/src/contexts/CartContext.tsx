import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem } from '../types/product.types';
import { useAuth } from './Authcontext';
import { authService } from '../services/authService';
import { generateCartItemId } from '../services/cartService';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'cartItemId'>) => void;
  editCartItem: (oldCartItemId: string, updatedItem: Omit<CartItem, 'cartItemId'>) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const resolvedUser = user ?? authService.getUserFromStorage();

  const resolveCurrentKey = useCallback((): string => {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const isEmployeeContext = /\/(employee|cashier|kitchen|staff)\b/.test(currentPath);

    try {
      const rawEmployee = localStorage.getItem('employee_auth');
      if (rawEmployee && isEmployeeContext) {
        const emp = JSON.parse(rawEmployee);
        if (emp?.id) return `cart_employee_${emp.id}`;
      }
    } catch {}

    if (resolvedUser?.id) {
      return `cart_user_${resolvedUser.id}`;
    }

    try {
      const rawEmployee = localStorage.getItem('employee_auth');
      if (rawEmployee) {
        const emp = JSON.parse(rawEmployee);
        if (emp?.id) return `cart_employee_${emp.id}`;
      }
    } catch {}

    return 'cart_employee_register';
  }, [resolvedUser?.id]);

  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const key = resolveCurrentKey();
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load cart when user session changes
  useEffect(() => {
    const key = resolveCurrentKey();
    try {
      const saved = localStorage.getItem(key);
      setCartItems(saved ? JSON.parse(saved) : []);
    } catch {
      setCartItems([]);
    }
  }, [resolveCurrentKey]);

  // Persist cart when cartItems changes
  useEffect(() => {
    const key = resolveCurrentKey();
    try {
      localStorage.setItem(key, JSON.stringify(cartItems));
    } catch (e) {
      console.warn('Failed to save cart:', e);
    }
  }, [cartItems, resolveCurrentKey]);

  const addToCart = (item: Omit<CartItem, 'cartItemId'>) => {
    if (!item.id) {
      return;
    }
    
    const cartItemId = generateCartItemId(
      item.id,
      item.selectedAddons,
      item.specialInstructions,
      item.selectedSize
    );

    setCartItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(existing => existing.cartItemId === cartItemId);

      if (existingItemIndex !== -1) {
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + item.quantity
        };
        return updatedItems;
      }

      return [...prevItems, { ...item, cartItemId }];
    });
  };

  const editCartItem = (oldCartItemId: string, updatedItem: Omit<CartItem, 'cartItemId'>) => {
    if (!updatedItem.id) {
      return;
    }
    
    const newCartItemId = generateCartItemId(
      updatedItem.id,
      updatedItem.selectedAddons,
      updatedItem.specialInstructions,
      updatedItem.selectedSize
    );

    setCartItems(prevItems => {
      const withoutOld = prevItems.filter(item => item.cartItemId !== oldCartItemId);
      const matchIndex = withoutOld.findIndex(item => item.cartItemId === newCartItemId);

      if (matchIndex !== -1) {
        const merged = [...withoutOld];
        merged[matchIndex] = {
          ...merged[matchIndex],
          quantity: merged[matchIndex].quantity + updatedItem.quantity
        };
        return merged;
      }

      return [...withoutOld, { ...updatedItem, cartItemId: newCartItemId }];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      const addonsTotal = item.selectedAddons?.reduce((sum, a) => sum + Number(a.price || 0), 0) || 0;
      return total + (item.price * item.quantity) + addonsTotal;
    }, 0);
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      editCartItem,
      removeFromCart,
      updateQuantity,
      clearCart,
      getTotalPrice,
      getTotalItems
    }}>
      {children}
    </CartContext.Provider>
  );
};

export type { CartContextType };
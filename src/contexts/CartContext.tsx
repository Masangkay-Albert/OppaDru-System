import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem } from '../types/product.types';
import { useAuth } from './Authcontext';
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
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const getCartKey = useCallback(() => {
    if (user?.id) {
      return `cart_user_${user.id}`;
    }
    return 'cart_guest';
  }, [user]);

  useEffect(() => {
    if (user) {
      const savedCart = localStorage.getItem(getCartKey());
      setCartItems(savedCart ? JSON.parse(savedCart) : []);
    } else {
      setCartItems([]);
    }
  }, [user, getCartKey]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(getCartKey(), JSON.stringify(cartItems));
    }
  }, [cartItems, user, getCartKey]);

  const addToCart = (item: Omit<CartItem, 'cartItemId'>) => {
    const cartItemId = generateCartItemId(item.id, item.selectedAddons, item.specialInstructions);

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
    const newCartItemId = generateCartItemId(
      updatedItem.id,
      updatedItem.selectedAddons,
      updatedItem.specialInstructions
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
      const addonsTotal = item.selectedAddons?.reduce((sum, a) => sum + a.price, 0) || 0;
      return total + (item.price + addonsTotal) * item.quantity;
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
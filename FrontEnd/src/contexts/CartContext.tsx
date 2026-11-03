import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CartItem, Product } from '../types/product.types';
import { authService } from '../services/authService';
import { generateCartItemId } from '../services/cartService';
import { getSelectedBranchId } from '../services/franchiseBranchService';
import {
  branchCartStorageKey,
  branchCartStoragePrefix,
  EMPLOYEE_CART,
  getBranchCartItemCount as countCartItems,
  legacyCartKeyForOwner,
  loadBranchCarts,
  normalizeBranchCart,
  readCartAtStorageKey,
  UNASSIGNED_BRANCH,
  updateBranchCart,
  writeBranchCart,
} from '../services/branchCartStorage';
import type { BranchCart } from '../services/branchCartStorage';
import { useAuth } from './Authcontext';

interface CartContextType {
  activeBranchId: string | null;
  branchCarts: Record<string, BranchCart>;
  cartItems: CartItem[];
  useCutlery: boolean;
  addToCart: (item: Omit<CartItem, 'cartItemId'>) => void;
  editCartItem: (oldCartItemId: string, updatedItem: Omit<CartItem, 'cartItemId'>) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateCartItemPrice: (cartItemId: string) => void;
  validateCartAgainstMenu: (products: Product[]) => void;
  setUseCutlery: (value: boolean) => void;
  setActiveBranchId: (branchId: string | null) => void;
  getBranchCartItemCount: (branchId: string) => number;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const resolvedUser = user ?? authService.getUserFromStorage();
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  const isEmployeeContext = /\/(employee|cashier|kitchen|staff)\b/.test(path);
  const employeeId = (() => {
    try {
      const rawEmployee = sessionStorage.getItem('employee_auth');
      const employee = rawEmployee ? JSON.parse(rawEmployee) : null;
      return employee?.id ? String(employee.id) : null;
    } catch {
      return null;
    }
  })();
  const owner = isEmployeeContext
    ? `employee:${employeeId || 'register'}`
    : resolvedUser?.id
      ? `user:${resolvedUser.id}`
      : 'guest';
  const legacyKey = isEmployeeContext
    ? employeeId ? `cart_employee_${employeeId}` : 'cart_employee_register'
    : legacyCartKeyForOwner(owner);

  return (
    <CartStateProvider
      key={owner}
      owner={owner}
      legacyKey={legacyKey}
      isEmployeeContext={isEmployeeContext}
    >
      {children}
    </CartStateProvider>
  );
};

const CartStateProvider: React.FC<{
  children: React.ReactNode;
  owner: string;
  legacyKey: string;
  isEmployeeContext: boolean;
}> = ({ children, owner, legacyKey, isEmployeeContext }) => {
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(() =>
    isEmployeeContext ? null : getSelectedBranchId(),
  );
  const [branchCarts, setBranchCarts] = useState<Record<string, BranchCart>>(() =>
    isEmployeeContext
      ? { [EMPLOYEE_CART]: readCartAtStorageKey(localStorage, legacyKey) }
      : loadBranchCarts(localStorage, owner, legacyKey, getSelectedBranchId()),
  );

  const activeCartId = isEmployeeContext ? EMPLOYEE_CART : activeBranchId || UNASSIGNED_BRANCH;
  const activeCart = branchCarts[activeCartId] || { items: [], useCutlery: false };
  const cartItems = activeCart.items;
  const useCutlery = activeCart.useCutlery;

  const writeCart = useCallback((branchId: string, update: (current: BranchCart) => BranchCart) => {
    const key = isEmployeeContext
      ? legacyKey
      : branchCartStorageKey(owner, branchId);
    let next: BranchCart;
    try {
      if (isEmployeeContext) {
        next = update(readCartAtStorageKey(localStorage, key, localStorage.getItem('cutleryPreference') === 'true'));
        localStorage.setItem(key, JSON.stringify(next.items));
      } else {
        next = updateBranchCart(localStorage, owner, branchId, update);
      }
    } catch (error) {
      console.warn('Failed to save cart:', error);
      return;
    }
    setBranchCarts((carts) => ({ ...carts, [branchId]: next }));
  }, [isEmployeeContext, legacyKey, owner]);

  const setActiveBranchId = useCallback((branchId: string | null) => {
    if (isEmployeeContext) return;
    const nextBranchId = branchId || null;
    const destination = nextBranchId || UNASSIGNED_BRANCH;
    const destinationKey = branchCartStorageKey(owner, destination);
    const savedDestination = localStorage.getItem(destinationKey);

    if (!savedDestination && nextBranchId) {
      const unassignedKey = branchCartStorageKey(owner, UNASSIGNED_BRANCH);
      const unassigned = localStorage.getItem(unassignedKey);
      if (unassigned) {
        writeBranchCart(localStorage, owner, destination, readCartAtStorageKey(localStorage, unassignedKey));
        localStorage.removeItem(unassignedKey);
      }
    }

    setActiveBranchIdState(nextBranchId);
    setBranchCarts((carts) => ({
      ...carts,
      [destination]: readCartAtStorageKey(localStorage, destinationKey),
    }));
  }, [isEmployeeContext, owner]);

  useEffect(() => {
    if (isEmployeeContext) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'selected_franchise_id') {
        const branchId = event.newValue || null;
        const activeId = branchId || UNASSIGNED_BRANCH;
        setActiveBranchIdState(branchId);
        setBranchCarts((carts) => ({
          ...carts,
          [activeId]: readCartAtStorageKey(
            localStorage,
            branchCartStorageKey(owner, activeId),
          ),
        }));
        return;
      }
      const keyPrefix = branchCartStoragePrefix(owner);
      if (!event.key?.startsWith(keyPrefix)) return;
      let branchId = event.key.slice(keyPrefix.length);
      try {
        branchId = decodeURIComponent(branchId);
      } catch {
        // Keep the stored key as-is if it was not URI encoded.
      }
      setBranchCarts((carts) => {
        const next = { ...carts };
        if (event.newValue === null) delete next[branchId];
        else {
          try {
            next[branchId] = normalizeBranchCart(JSON.parse(event.newValue));
          } catch {
            next[branchId] = { items: [], useCutlery: false };
          }
        }
        return next;
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [isEmployeeContext, owner]);

  const addToCart = useCallback((item: Omit<CartItem, 'cartItemId'>) => {
    if (!item.id) return;
    const cartItemId = generateCartItemId(item.id, item.selectedAddons, item.specialInstructions, item.selectedSize);
    writeCart(activeCartId, (current) => {
      const index = current.items.findIndex((existing) => existing.cartItemId === cartItemId);
      if (index >= 0) {
        const items = [...current.items];
        items[index] = { ...items[index], quantity: items[index].quantity + item.quantity };
        return { ...current, items };
      }
      return { ...current, items: [...current.items, { ...item, cartItemId }] };
    });
  }, [activeCartId, writeCart]);

  const editCartItem = useCallback((oldCartItemId: string, updatedItem: Omit<CartItem, 'cartItemId'>) => {
    if (!updatedItem.id) return;
    const cartItemId = generateCartItemId(updatedItem.id, updatedItem.selectedAddons, updatedItem.specialInstructions, updatedItem.selectedSize);
    writeCart(activeCartId, (current) => {
      const items = current.items.filter((item) => item.cartItemId !== oldCartItemId);
      const match = items.findIndex((item) => item.cartItemId === cartItemId);
      if (match >= 0) {
        items[match] = { ...items[match], quantity: items[match].quantity + updatedItem.quantity };
      } else {
        items.push({ ...updatedItem, cartItemId });
      }
      return { ...current, items };
    });
  }, [activeCartId, writeCart]);

  const removeFromCart = useCallback((cartItemId: string) =>
    writeCart(activeCartId, (current) => ({ ...current, items: current.items.filter((item) => item.cartItemId !== cartItemId) })),
  [activeCartId, writeCart]);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    writeCart(activeCartId, (current) => ({
      ...current,
      items: current.items.map((item) => item.cartItemId === cartItemId ? { ...item, quantity } : item),
    }));
  }, [activeCartId, removeFromCart, writeCart]);

  const updateCartItemPrice = useCallback((cartItemId: string) =>
    writeCart(activeCartId, (current) => ({
      ...current,
      items: current.items.map((item) => item.cartItemId === cartItemId && item.currentBranchPrice != null
        ? { ...item, price: item.currentBranchPrice, cartIssue: undefined, currentBranchPrice: undefined }
        : item),
    })), [activeCartId, writeCart]);

  const validateCartAgainstMenu = useCallback((products: Product[]) => {
    const currentProducts = new Map(products.map((product) => [product.id, product]));
    writeCart(activeCartId, (current) => ({
      ...current,
      items: current.items.map((item) => {
        const product = currentProducts.get(item.id);
        if (!product) {
          return { ...item, cartIssue: 'unavailable' as const, currentBranchPrice: undefined };
        }
        if (Number(product.price) !== Number(item.price)) {
          return { ...item, cartIssue: 'price-changed' as const, currentBranchPrice: Number(product.price) };
        }
        return { ...item, cartIssue: undefined, currentBranchPrice: undefined };
      }),
    }));
  }, [activeCartId, writeCart]);

  const setUseCutlery = useCallback((value: boolean) =>
    writeCart(activeCartId, (current) => ({ ...current, useCutlery: value })),
  [activeCartId, writeCart]);

  const clearCart = useCallback(() =>
    writeCart(activeCartId, (current) => ({ ...current, items: [] })),
  [activeCartId, writeCart]);

  const getBranchCartItemCount = useCallback((branchId: string) => {
    const cart = branchCarts[branchId] || readCartAtStorageKey(localStorage, branchCartStorageKey(owner, branchId));
    return countCartItems(cart);
  }, [branchCarts, owner]);

  const getTotalPrice = useCallback(() => cartItems.reduce((total, item) => {
    const addonsTotal = item.selectedAddons?.reduce((sum, addon) => sum + Number(addon.price || 0), 0) || 0;
    return total + item.price * item.quantity + addonsTotal;
  }, 0), [cartItems]);

  const getTotalItems = useCallback(() =>
    cartItems.reduce((total, item) => total + item.quantity, 0), [cartItems]);

  const value = useMemo(() => ({
    activeBranchId,
    branchCarts,
    cartItems,
    useCutlery,
    addToCart,
    editCartItem,
    removeFromCart,
    updateQuantity,
    updateCartItemPrice,
    validateCartAgainstMenu,
    setUseCutlery,
    setActiveBranchId,
    getBranchCartItemCount,
    clearCart,
    getTotalPrice,
    getTotalItems,
  }), [
    activeBranchId, branchCarts, cartItems, useCutlery, getBranchCartItemCount,
    getTotalItems, getTotalPrice, setActiveBranchId, addToCart, editCartItem,
    removeFromCart, updateQuantity, updateCartItemPrice, validateCartAgainstMenu,
    setUseCutlery, clearCart,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export type { CartContextType };

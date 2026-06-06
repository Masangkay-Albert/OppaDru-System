// src/modules/customer-side/components/CartSidebar.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../contexts/CartContext';
import type { CartItem } from '../../../types/product.types';

interface CartSidebarProps {
  onClose?: () => void;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart, getTotalPrice } = useCart();
  const [useCutlery, setUseCutlery] = useState(false);

  const DELIVERY_FEE = 49;
  const SERVICE_FEE = 29;
  const VAT_RATE = 0.12;

  const calculateItemTotal = (item: CartItem) => {
    const addonsTotal = item.selectedAddons?.reduce((sum, a) => sum + a.price, 0) || 0;
    return (item.price + addonsTotal) * item.quantity;
  };

  const subtotal = cartItems.reduce((sum, i) => sum + calculateItemTotal(i), 0);
  const deliveryFee = DELIVERY_FEE;
  const serviceFee = SERVICE_FEE;
  const vat = (subtotal + deliveryFee + serviceFee) * VAT_RATE;
  const total = subtotal + deliveryFee + serviceFee + vat;

  const hasItems = cartItems.length > 0;

  const handleCheckout = () => {
    if (hasItems) {
      navigate('/checkout');
    }
  };

  return (
    <div className="w-full lg:w-96 bg-white h-full lg:h-screen flex flex-col border-l border-gray-200 shadow-lg">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Your Cart</h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
              ✕
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {hasItems ? `${cartItems.length} item${cartItems.length !== 1 ? 's' : ''}` : 'Your cart is empty'}
        </p>
      </div>

      {/* Cart Items - Empty State */}
      {!hasItems ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6M9 21h6M12 15v6" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium text-lg">Hungry?</p>
            <p className="text-gray-400 text-sm mt-2">You haven't added anything to your cart!</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {cartItems.map((item) => {
            const itemTotal = calculateItemTotal(item);
            
            return (
              <div key={item.id} className="px-5 py-4 hover:bg-gray-50 transition">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm font-medium text-gray-800">{item.name}</span>
                  <span className="text-sm font-semibold text-gray-900">₱{itemTotal}</span>
                </div>
                
                {item.selectedAddons && item.selectedAddons.length > 0 && (
                  <div className="mb-2">
                    {item.selectedAddons.map((addon) => (
                      <span key={addon.id} className="text-xs text-gray-400 block">
                        + {addon.name} (₱{addon.price})
                      </span>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:border-[#2d6a4f] transition flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="text-sm font-medium text-gray-700 min-w-[20px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:border-[#2d6a4f] transition flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-400 hover:text-red-600 transition p-1"
                    title="Remove item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Section - Laging nakikita */}
      <div className="border-t border-gray-200 bg-white">
        {/* Price Summary */}
        <div className="px-5 py-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-800">{hasItems ? `₱${subtotal}` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Standard delivery</span>
            <span className="text-gray-800">{hasItems ? `₱${deliveryFee}` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Service fee</span>
            <span className="text-gray-800">{hasItems ? `₱${serviceFee}` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">VAT (12%)</span>
            <span className="text-gray-800">{hasItems ? `₱${Math.round(vat)}` : '—'}</span>
          </div>
        </div>
        
        {/* Cutlery Option */}
        <div className="px-5 py-3 border-t border-gray-100">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
              <span className="text-sm text-gray-700">Cutlery</span>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={useCutlery}
                onChange={(e) => setUseCutlery(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-[#2d6a4f] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </div>
          </label>
          {!useCutlery && (
            <p className="text-xs text-gray-400 mt-2">No cutlery provided. Thanks for reducing waste!</p>
          )}
        </div>

        {/* Total */}
        <div className="px-5 py-3 border-t border-gray-200 bg-white">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Total</span>
            <span className={`text-xl font-bold ${hasItems ? 'text-[#2d6a4f]' : 'text-gray-400'}`}>
              {hasItems ? `₱${Math.round(total)}` : '—'}
            </span>
          </div>
          <p className="text-xs text-gray-400 text-right mt-0.5">(incl. fees and tax)</p>
        </div>

        {/* Buttons */}
        <div className="p-4 border-t border-gray-200 bg-white">
          {hasItems ? (
            <button 
              onClick={handleCheckout}
              className="w-full py-3 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition shadow-sm"
            >
              Checkout →
            </button>
          ) : (
            <button 
              disabled
              className="w-full py-3 bg-gray-100 text-gray-400 rounded-xl font-semibold cursor-not-allowed"
            >
              See summary
            </button>
          )}
          <button
            onClick={clearCart}
            className="w-full mt-3 py-2 text-gray-400 text-sm hover:text-red-500 transition flex items-center justify-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
            Clear Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartSidebar;
// src/modules/customer-side/components/cart/CartSidebar.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../../contexts/CartContext';
import CartItemComponent from './CartItem';
import CartSummary from './CartSummary';
import { calculateItemTotal, calculateSubtotal } from '../../../../services/cartService';

interface CartSidebarProps {
  onClose?: () => void;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  const [useCutlery, setUseCutlery] = useState(() => {
    const saved = localStorage.getItem('cutleryPreference');
    return saved ? JSON.parse(saved) : false;
  });

  const subtotal = calculateSubtotal(cartItems);
  const hasItems = cartItems.length > 0;

  const handleCutleryChange = (value: boolean) => {
    setUseCutlery(value);
    localStorage.setItem('cutleryPreference', JSON.stringify(value));
  };

  const handleCheckout = () => {
    if (hasItems) {
      navigate('/checkout');
    }
  };

  return (
    <div className="w-full lg:w-96 bg-white h-full lg:h-screen flex flex-col border-l border-gray-200 shadow-lg">
      <div className="px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Your Cart</h2>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {hasItems ? `${cartItems.length} item${cartItems.length !== 1 ? 's' : ''}` : 'Your cart is empty'}
        </p>
      </div>

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
          {cartItems.map((item) => (
            <CartItemComponent 
              key={item.id}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              calculateItemTotal={calculateItemTotal}
            />
          ))}
        </div>
      )}

      <CartSummary 
        subtotal={subtotal}
        hasItems={hasItems}
        useCutlery={useCutlery}
        onCutleryChange={handleCutleryChange}
      />

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
  );
};

export default CartSidebar;
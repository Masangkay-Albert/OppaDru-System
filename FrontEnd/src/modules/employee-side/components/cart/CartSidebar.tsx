import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../../contexts/CartContext';
import CartItemComponent from './CartItem';
import CartSummary from './CartSummary';
import ProductModal from '../product/ProductModal';
import { calculateItemTotal, calculateSubtotal } from '../../../../services/cartService';
import type { CartItem } from '../../../../types/product.types';
import { FiX, FiShoppingBag, FiTrash2 } from 'react-icons/fi';
import { formatCurrency } from '../../../../utils/formatters';

interface CartSidebarProps {
  onClose?: () => void;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
  const [useCutlery, setUseCutlery] = useState(() => {
    const saved = localStorage.getItem('employee_cutleryPreference');
    return saved ? JSON.parse(saved) : false;
  });

  const subtotal = calculateSubtotal(cartItems);
  const hasItems = cartItems.length > 0;

  const handleCutleryChange = (value: boolean) => {
    setUseCutlery(value);
    localStorage.setItem('employee_cutleryPreference', JSON.stringify(value));
  };

  const handleCheckout = () => {
    if (hasItems) {
      navigate('/employee/checkout');
    }
  };

  return (
    <div className="w-full lg:w-96 bg-white h-full lg:h-screen flex flex-col border-l border-gray-200 shadow-lg">
      <div className="px-5 py-4 border-b border-gray-200 bg-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-800">Current Order</h2>
            {hasItems && (
              <span className="bg-[#E3EFE7] text-[var(--oppa-green)] text-xs font-bold px-2 py-0.5 rounded-full">
                Register
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasItems && (
              <button
                onClick={clearCart}
                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded-lg transition"
                title="Clear current order"
              >
                <FiTrash2 size={13} />
                Clear
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:rotate-90 transition-all duration-300 text-2xl">
                <FiX />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {hasItems ? `${cartItems.length} item${cartItems.length !== 1 ? 's' : ''} in queue` : 'No items added yet'}
        </p>
      </div>

      {!hasItems ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <FiShoppingBag className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-700 font-semibold text-lg">Order Register Empty</p>
            <p className="text-gray-400 text-sm mt-1">Tap items on the menu to begin taking an order</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {cartItems.map((item) => (
            <CartItemComponent
              key={item.cartItemId}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={removeFromCart}
              onEdit={setEditingItem}
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
            className="w-full py-3.5 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white rounded-xl font-bold hover:shadow-lg transition-all hover:scale-[1.02] flex items-center justify-between px-5"
          >
            <span>Charge / Pay</span>
            <span>{formatCurrency(subtotal)} →</span>
          </button>
        ) : (
          <button
            disabled
            className="w-full py-3 bg-gray-100 text-gray-400 rounded-xl font-semibold cursor-not-allowed text-center"
          >
            Add items to proceed
          </button>
        )}
      </div>

      {editingItem && (
        <ProductModal
          product={editingItem}
          editMode
          editCartItemId={editingItem.cartItemId}
          initialQuantity={editingItem.quantity}
          initialAddons={editingItem.selectedAddons}
          initialInstructions={editingItem.specialInstructions}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
};

export default CartSidebar;

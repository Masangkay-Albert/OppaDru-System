import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../../contexts/CartContext';
import CartItemComponent from './CartItem';
import CartSummary from './CartSummary';
import ProductModal from '../product/ProductModal';
import { calculateItemTotal, calculateSubtotal } from '../../../../services/cartService';
import type { CartItem } from '../../../../types/product.types';
import { FiX, FiShoppingBag, FiTrash2 } from 'react-icons/fi';

interface CartSidebarProps {
  onClose?: () => void;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);
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
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:rotate-90 transition-all duration-300 text-2xl">
              <FiX />
            </button>
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
              <FiShoppingBag className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium text-lg">Hungry?</p>
            <p className="text-gray-400 text-sm mt-2">You haven't added anything to your cart!</p>
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
            className="w-full py-3 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-[1.02]"
          >
            Checkout
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
          className="w-full mt-3 py-2 text-gray-400 text-sm hover:text-red-500 transition flex items-center justify-center gap-2"
        >
          <FiTrash2 className="w-4 h-4" />
          Clear Cart
        </button>
      </div>

      {editingItem && (
        <ProductModal
          product={editingItem}
          editMode
          editCartItemId={editingItem.cartItemId}
          initialQuantity={editingItem.quantity}
          initialAddons={editingItem.selectedAddons}
          initialInstructions={editingItem.specialInstructions}
          initialSize={editingItem.selectedSize}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  );
};

export default CartSidebar;
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../../contexts/CartContext';
import CartItemComponent from './CartItem';
import CartSummary from './CartSummary';
import ProductModal from '../product/ProductModal';
import { calculateItemTotal, calculateSubtotal } from '../../../../services/cartService';
import type { CartItem } from '../../../../types/product.types';
import { FiX, FiShoppingBag, FiTrash2 } from 'react-icons/fi';
import { useToast } from '../ToastProvider';

interface CartSidebarProps {
  onClose?: () => void;
}

const CartSidebar: React.FC<CartSidebarProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, updateCartItemPrice, clearCart, useCutlery, setUseCutlery } = useCart();
  const { showToast, confirmDialog } = useToast();
  const [editingItem, setEditingItem] = useState<CartItem | null>(null);

  const subtotal = calculateSubtotal(cartItems);
  const hasItems = cartItems.length > 0;

  const handleCheckout = () => {
    if (!hasItems) return;
    if (cartItems.some((item) => item.cartIssue)) {
      showToast('Resolve unavailable items or price changes before checkout.', 'warning');
      return;
    }
    navigate('/checkout');
  };

  const handleRemove = async (item: CartItem) => {
    const confirmed = await confirmDialog({
      title: 'Remove item?',
      message: `Remove ${item.name} from this branch’s cart?`,
      confirmLabel: 'Remove item',
      danger: true,
    });
    if (confirmed) removeFromCart(item.cartItemId);
  };

  const handleClearCart = async () => {
    if (!hasItems) return;
    const confirmed = await confirmDialog({
      title: 'Clear cart?',
      message: 'Clear all items from your cart? This action cannot be undone.',
      confirmLabel: 'Clear',
      danger: true,
    });
    if (confirmed) clearCart();
  };

  return (
    <div className="menu-cart-sidebar w-full lg:w-96 bg-white h-full lg:h-screen flex flex-col border-l border-gray-200 shadow-lg">
      <div className="menu-cart-header px-5 py-4 border-b border-gray-200 bg-white">
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
        <div className="menu-cart-empty flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center">
            <div className="menu-cart-empty-icon w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
              <FiShoppingBag className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium text-lg">Hungry?</p>
            <p className="text-gray-400 text-sm mt-2">You haven't added anything to your cart!</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {cartItems.map((item) => (
            <CartItemComponent
              key={item.cartItemId}
              item={item}
              onUpdateQuantity={updateQuantity}
              onRemove={() => void handleRemove(item)}
              onEdit={setEditingItem}
              onUpdatePrice={() => updateCartItemPrice(item.cartItemId)}
              calculateItemTotal={calculateItemTotal}
            />
          ))}
        </div>
      )}

      <CartSummary
        subtotal={subtotal}
        hasItems={hasItems}
        useCutlery={useCutlery}
        onCutleryChange={setUseCutlery}
      />

      <div className="menu-cart-actions space-y-3 border-t border-gray-200 bg-white p-4">
        {hasItems ? (
          <button
            onClick={handleCheckout}
            className="min-h-12 w-full rounded-xl bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] py-3 font-bold text-white shadow-sm transition hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f] focus-visible:ring-offset-2"
          >
            Checkout
          </button>
        ) : (
          <button
            disabled
            className="min-h-12 w-full cursor-not-allowed rounded-xl bg-gray-100 py-3 font-semibold text-gray-400"
          >
            See summary
          </button>
        )}
        {hasItems && (
          <button
            type="button"
            onClick={() => void handleClearCart()}
            className="menu-cart-clear-button inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            <FiTrash2 className="size-4" aria-hidden="true" />
            Clear Cart
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
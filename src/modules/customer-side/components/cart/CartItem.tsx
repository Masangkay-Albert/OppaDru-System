// src/modules/customer-side/components/cart/CartItem.tsx
import React from 'react';
import type { CartItem as CartItemType } from '../../../../types/product.types'; 

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  calculateItemTotal: (item: CartItemType) => number;
}

const CartItemComponent: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemove, calculateItemTotal }) => {
  const itemTotal = calculateItemTotal(item);

  return (
    <div className="px-5 py-4 hover:bg-gray-50 transition">
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
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            className="w-7 h-7 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:border-[#2d6a4f] transition flex items-center justify-center"
          >
            -
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[20px] text-center">
            {item.quantity}
          </span>
          <button
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="w-7 h-7 rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:border-[#2d6a4f] transition flex items-center justify-center"
          >
            +
          </button>
        </div>
        <button
          onClick={() => onRemove(item.id)}
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
};

export default CartItemComponent;
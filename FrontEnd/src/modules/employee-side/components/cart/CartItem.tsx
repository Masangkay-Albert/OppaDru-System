import React from 'react';
import type { CartItem as CartItemType } from '../../../../types/product.types';
import { FiTrash2 } from 'react-icons/fi';
import { formatCurrency } from '../../../../utils/formatters';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (cartItemId: string, quantity: number) => void;
  onRemove: (cartItemId: string) => void;
  onEdit: (item: CartItemType) => void;
  calculateItemTotal: (item: CartItemType) => number;
}

const CartItemComponent: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemove, onEdit, calculateItemTotal }) => {
  const baseTotal = calculateItemTotal(item);

  return (
    <div
      className="px-5 py-4 hover:bg-[#fff9f5] transition cursor-pointer"
      onClick={() => onEdit(item)}
      title="Click to edit add-ons"
    >
      <div className="flex gap-3">
        {item.image && (
          <img
            src={item.image}
            alt={item.name}
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-gray-100 shadow-sm"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-[#1b4d3e] block truncate">{item.name}</span>
              {item.selectedSize && (
                <span className="text-xs font-medium text-[#7f4f24] mt-0.5 block">{item.selectedSize}</span>
              )}
            </div>
            <span className="text-sm font-bold text-[#1b4d3e] whitespace-nowrap">{formatCurrency(baseTotal)}</span>
          </div>

          {item.selectedAddons && item.selectedAddons.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {item.selectedAddons.map((addon) => (
                <div key={addon.id} className="flex justify-between items-center text-xs text-[#7f4f24]/70">
                  <span>+ {addon.name}</span>
                  <span>{formatCurrency(addon.price)}</span>
                </div>
              ))}
            </div>
          )}

          {item.specialInstructions && (
            <p className="text-xs text-[#7f4f24]/60 italic mt-1">"{item.specialInstructions}"</p>
          )}

          <div className="flex items-center justify-between mt-3">
            <div
              className="flex items-center gap-2 bg-[#f7f3ee] rounded-full px-1 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
                className="w-7 h-7 rounded-full bg-white text-[#2d6a4f] font-semibold shadow-sm hover:bg-[#2d6a4f] hover:text-white transition flex items-center justify-center"
              >
                -
              </button>
              <span className="text-sm font-medium text-[#1b4d3e] min-w-[18px] text-center">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
                className="w-7 h-7 rounded-full bg-white text-[#2d6a4f] font-semibold shadow-sm hover:bg-[#2d6a4f] hover:text-white transition flex items-center justify-center"
              >
                +
              </button>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(item.cartItemId);
              }}
              className="text-[#d94f4f]/70 hover:text-[#d94f4f] transition p-1.5 hover:bg-[#d94f4f]/10 rounded-full"
              title="Remove item"
            >
              <FiTrash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItemComponent;

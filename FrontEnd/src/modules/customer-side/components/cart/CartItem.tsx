import React from 'react';
import type { CartItem as CartItemType } from '../../../../types/product.types';
import { formatCurrency } from '../../../../utils/formatters';
import { FiTrash2 } from 'react-icons/fi';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (cartItemId: string, quantity: number) => void;
  onRemove: () => void;
  onEdit: (item: CartItemType) => void;
  onUpdatePrice: () => void;
  calculateItemTotal: (item: CartItemType) => number;
}

const CartItemComponent: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemove, onEdit, onUpdatePrice, calculateItemTotal }) => {
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
              {item.priceUpdateNotice && (
                <span className="mt-1 block rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800" role="status">
                  {item.priceUpdateNotice.removedOptions && 'Old size/add-on choices removed. '}
                  {item.priceUpdateNotice.previousPrice !== item.priceUpdateNotice.currentPrice
                    ? `Price updated from ${formatCurrency(item.priceUpdateNotice.previousPrice)} to ${formatCurrency(item.priceUpdateNotice.currentPrice)} for this branch.`
                    : `Current price: ${formatCurrency(item.priceUpdateNotice.currentPrice)}.`}
                </span>
              )}
            </div>
            {item.cartIssue && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
                <p>{item.cartIssue === 'unavailable'
                  ? 'This item is no longer available at the selected branch.'
                  : `The price changed for this branch${item.currentBranchPrice != null ? ` to ₱${item.currentBranchPrice.toFixed(2)}` : ''}.`}</p>
                {item.cartIssue === 'price-changed' && (
                  <button type="button" onClick={(event) => { event.stopPropagation(); onUpdatePrice(); }} className="mt-2 font-semibold underline underline-offset-2">
                    Accept new price
                  </button>
                )}
              </div>
            )}
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
                onRemove();
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
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
      className="border-b border-gray-100 px-4 py-3 transition hover:bg-[#fff9f5] cursor-pointer last:border-b-0 sm:px-5"
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
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="block whitespace-normal break-words text-sm font-semibold text-[#1b4d3e]">{item.name}</span>
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
            <span className="text-sm font-bold text-[#1b4d3e] whitespace-nowrap">{formatCurrency(baseTotal)}</span>
          </div>

          {item.cartIssue && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
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

          <div className="mt-3 flex items-end justify-between gap-3">
            <div
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label={`Decrease quantity of ${item.name}`}
                onClick={() => onUpdateQuantity(item.cartItemId, item.quantity - 1)}
                className="flex size-8 items-center justify-center rounded-md text-base font-semibold text-[#2d6a4f] transition hover:bg-[#e3f1e6] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
              >
                -
              </button>
              <span className="min-w-7 text-center text-sm font-semibold tabular-nums text-[#1b4d3e]">
                {item.quantity}
              </span>
              <button
                type="button"
                aria-label={`Increase quantity of ${item.name}`}
                onClick={() => onUpdateQuantity(item.cartItemId, item.quantity + 1)}
                className="flex size-8 items-center justify-center rounded-md text-base font-semibold text-[#2d6a4f] transition hover:bg-[#e3f1e6] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
              >
                +
              </button>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              type="button"
              aria-label={`Remove ${item.name} from cart`}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-700 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
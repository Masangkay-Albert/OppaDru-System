import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Product, CartItem, Addon, AddonGroup } from '../../../../types/product.types';
import { useCart } from '../../../../contexts/CartContext';
import { useFavorites } from '../../../../contexts/FavoritesContext';
import { useStoreHours } from '../../../../contexts/StoreHoursContext';
import QuantitySelector from './QuantitySelector';
import AddonsSection from '../common/AddonsSection';
import { FiX } from 'react-icons/fi';
import '../../../../styles/modal.css';
import { productService } from '../../../../services/productService';
import { calculateProductOptionsTotal } from '../../../../services/productOptionRules';
import { formatCurrency } from '../../../../utils/formatters';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  editMode?: boolean;
  editCartItemId?: string;
  initialQuantity?: number;
  initialAddons?: Addon[];
  initialInstructions?: string;
}

const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  editMode = false,
  editCartItemId,
  initialQuantity,
  initialAddons,
  initialInstructions,
}) => {
  const { addToCart, editCartItem } = useCart();
  const { addOrder } = useFavorites();
  const { status: storeHours } = useStoreHours();
  const canOrder = storeHours?.state === 'open';
  const orderingClosed = storeHours?.state === 'closed' || storeHours?.state === 'last_order_passed';
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [isLoadingAddons, setIsLoadingAddons] = useState(false);
  const [addonLoadError, setAddonLoadError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
      setQuantity(1);
      setSelectedAddons([]);
      setSpecialInstructions('');
    }, 200);
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleClose]);

  useEffect(() => {
    if (product) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    return () => previousFocus?.focus();
  }, [product?.id]);

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) || []);
    if (!focusable.length) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!dialogRef.current?.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => {
    if (product) {
      setQuantity(initialQuantity ?? 1);
      setSelectedAddons(initialAddons ?? []);
      setSpecialInstructions(initialInstructions ?? '');
    }
  }, [product?.id, editCartItemId]);

  useEffect(() => {
    if (!product) return;
    const embeddedGroups = product.addonGroups || [];
    setAddonGroups(embeddedGroups);
    setAddonLoadError(false);
    if (embeddedGroups.length > 0) {
      setIsLoadingAddons(false);
      return;
    }

    let isCurrentRequest = true;
    setIsLoadingAddons(true);
    productService.getAddonGroups(product.category, product.id)
      .then((groups) => {
        if (isCurrentRequest) setAddonGroups(groups);
      })
      .catch(() => {
        if (isCurrentRequest) {
          setAddonGroups([]);
          setAddonLoadError(true);
        }
      })
      .finally(() => {
        if (isCurrentRequest) setIsLoadingAddons(false);
      });

    return () => { isCurrentRequest = false; };
  }, [product?.id, product?.category]);

  if (!product || typeof document === 'undefined') return null;

  const getTotalPrice = () => calculateProductOptionsTotal(Number(product.price || 0), quantity, selectedAddons);

  const toggleAddon = (addon: Addon, group: AddonGroup) => {
    setSelectedAddons(prev => {
      const existing = prev.find((item) => item.id === addon.id);
      if (existing) return prev.filter((item) => item.id !== addon.id);
      const withoutGroup = group.selection_type === 'single'
        ? prev.filter((item) => !group.addons.some((groupAddon) => groupAddon.id === item.id))
        : prev;
      return [...withoutGroup, { ...addon, addon_group_id: group.id }];
    });
  };

  const handleSubmit = () => {
    if (!product.isAvailable || !canOrder) return;

    const cartItemData: Omit<CartItem, 'cartItemId'> = {
      ...product,
      price: Number(product.price || 0),
      quantity,
      selectedAddons: selectedAddons.length > 0 ? selectedAddons : undefined,
      specialInstructions: specialInstructions || undefined,
      selectedSize: undefined,
    };

    if (editMode && editCartItemId) {
      editCartItem(editCartItemId, cartItemData);
    } else {
      addToCart(cartItemData);
      for (let i = 0; i < quantity; i++) {
        addOrder(product);
      }
    }

    handleClose();
  };

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[1000] bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />

      <div className="fixed inset-0 z-[1001] flex items-center justify-center p-3 sm:p-5">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
          onKeyDown={handleDialogKeyDown}
          className={`flex h-[min(88dvh,760px)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-[#e7e4dc] bg-white shadow-2xl transition-all duration-200 ${
            isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 bg-gradient-to-r from-[#276343] to-[#1b4d3e] px-5 py-4 text-white sm:px-6">
            <h2 id="product-modal-title" className="min-w-0 truncate font-serif text-lg font-bold">{product.name}</h2>
            <button ref={closeButtonRef} type="button" aria-label="Close product details" onClick={handleClose} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xl opacity-85 transition hover:bg-white/15 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <FiX />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <p className="mb-1 text-2xl font-extrabold text-[#276343]">{formatCurrency(Number(product.price || 0))}</p>
            <p className="mb-5 text-sm leading-relaxed text-gray-600">{product.description}</p>

            {!product.isAvailable && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                This item is currently not available for ordering.
              </div>
            )}

            {product.isAvailable && (
              <>
                <div className="mb-5">
                  <label className="block font-semibold text-sm text-gray-800 mb-2">Quantity</label>
                  <QuantitySelector
                    quantity={quantity}
                    onIncrease={() => setQuantity(quantity + 1)}
                    onDecrease={() => setQuantity(Math.max(1, quantity - 1))}
                  />
                </div>

                {isLoadingAddons ? (
                  <div className="mb-5">
                    <div className="space-y-3 animate-pulse" aria-live="polite">
                      <div className="h-4 w-28 rounded bg-gray-200" />
                      <div className="space-y-2">
                        {[0, 1, 2].map((item) => (
                          <div key={item} className="h-12 rounded-xl bg-gray-100" />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : addonLoadError ? (
                  <p className="mb-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      Add-ons are temporarily unavailable. You can still add this item.
                  </p>
                ) : addonGroups.length > 0 ? (
                    <div className="mb-5 space-y-5">
                      {addonGroups.map((group) => (
                        <AddonsSection
                          key={group.id}
                          group={group}
                          selectedAddons={selectedAddons}
                          onToggleAddon={(addon) => toggleAddon(addon, group)}
                        />
                      ))}
                    </div>
                ) : null}

                <div className="mb-5">
                  <label className="block font-semibold text-sm text-gray-800 mb-2">Special Instructions</label>
                  <textarea
                    className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm resize-none focus:border-[#2d6a4f] focus:outline-none transition-colors"
                    placeholder="e.g. No mayo, extra spicy..."
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    rows={2}
                  />
                  <p className="text-xs text-gray-400 mt-1">Special requests are subject to the restaurant's approval.</p>
                </div>
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-4 sm:px-6">
            <div className="mb-3 flex items-center justify-between font-bold">
              <span>Total:</span>
              <span className="text-xl text-[#276343]">{formatCurrency(getTotalPrice())}</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!product.isAvailable || !canOrder}
              className={`min-h-12 w-full rounded-xl px-4 py-3 font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#276343] focus-visible:ring-offset-2 ${
                product.isAvailable && canOrder
                  ? 'bg-[#276343] text-white shadow-sm hover:bg-[#1f5338] hover:shadow-md active:scale-[0.99]'
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
            >
              {orderingClosed ? 'Ordering closed' : product.isAvailable ? (editMode ? 'Update Cart' : 'Add to Cart') : 'Not Available'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
};

export default ProductModal;
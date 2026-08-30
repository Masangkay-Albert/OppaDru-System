import React, { useState, useEffect } from 'react';
import type { Product, CartItem, Addon, AddonGroup } from '../../../../types/product.types';
import { useCart } from '../../../../contexts/CartContext';
import { useFavorites } from '../../../../contexts/FavoritesContext';
import QuantitySelector from './QuantitySelector';
import AddonsSection from '../common/AddonsSection';
import { FiX } from 'react-icons/fi';
import '../../../../styles/modal.css';
import { productService } from '../../../../services/productService';

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
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [isLoadingAddons, setIsLoadingAddons] = useState(false);
  const [addonLoadError, setAddonLoadError] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    if (product) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [product]);

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

  if (!product) return null;

  const getAddonsTotal = () => selectedAddons.reduce((sum, addon) => sum + Number(addon.price || 0), 0);
  const getTotalPrice = () => (product.price + getAddonsTotal()) * quantity;

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

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
      setQuantity(1);
      setSelectedAddons([]);
      setSpecialInstructions('');
    }, 200);
  };

  const handleSubmit = () => {
    if (!product.isAvailable) return;

    const cartItemData: Omit<CartItem, 'cartItemId'> = {
      ...product,
      quantity,
      selectedAddons: selectedAddons.length > 0 ? selectedAddons : undefined,
      specialInstructions: specialInstructions || undefined,
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

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />

      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
          className={`w-[90%] max-w-[520px] max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-200 ${
            isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white shrink-0">
            <h2 id="product-modal-title" className="font-bold text-lg">{product.name}</h2>
            <button aria-label="Close product details" onClick={handleClose} className="text-2xl opacity-80 hover:opacity-100 hover:rotate-90 transition-all duration-300 cursor-pointer">
              <FiX />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-3xl font-extrabold text-[#2d6a4f] mb-2">₱{Number(product.price).toFixed(2)}</p>
            <p className="text-sm text-gray-500 mb-4">{product.description}</p>

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

                <div className="mb-5 min-h-[180px]">
                  {isLoadingAddons ? (
                    <div className="space-y-3 animate-pulse" aria-live="polite">
                      <div className="h-4 w-28 rounded bg-gray-200" />
                      <div className="space-y-2">
                        {[0, 1, 2].map((item) => (
                          <div key={item} className="h-12 rounded-xl bg-gray-100" />
                        ))}
                      </div>
                    </div>
                  ) : addonLoadError ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                      Add-ons are temporarily unavailable. You can still add this item.
                    </p>
                  ) : addonGroups.length > 0 ? (
                    <div className="space-y-5">
                      {addonGroups.map((group) => (
                        <AddonsSection
                          key={group.id}
                          group={group}
                          selectedAddons={selectedAddons}
                          onToggleAddon={(addon) => toggleAddon(addon, group)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-xs text-gray-400">
                      No add-ons available for this item.
                    </div>
                  )}
                </div>

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

          <div className="p-6 border-t border-gray-200 bg-white shrink-0">
            <div className="flex justify-between items-center font-bold text-lg mb-3">
              <span>Total:</span>
              <span className="text-[#2d6a4f] text-2xl">₱{getTotalPrice().toFixed(2)}</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!product.isAvailable}
              className={`w-full py-3 rounded-xl font-bold transition-all ${
                product.isAvailable
                  ? 'bg-gradient-to-r from-[#e76f51] to-[#f4a261] text-white hover:shadow-lg hover:scale-[1.02]'
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
            >
              {product.isAvailable ? (editMode ? 'Update Cart' : 'Add to Cart') : 'Not Available'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductModal;
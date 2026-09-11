import React, { useState, useEffect, useCallback } from 'react';
import type { Product, Addon, AddonGroup, ProductSize } from '../../../../types/product.types';
import { useCart } from '../../../../contexts/CartContext';
import QuantitySelector from './QuantitySelector';
import AddonsSection from '../common/AddonsSection';
import { FiX } from 'react-icons/fi';
import { productService } from '../../../../services/productService';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  editMode?: boolean;
  editCartItemId?: string;
  initialQuantity?: number;
  initialAddons?: Addon[];
  initialInstructions?: string;
  initialSize?: ProductSize;
}

const SIZE_REQUIRED_CATEGORIES = ['fruity-soda-milk', 'fresh-lemonade'];
const SIZE_OPTIONS: Array<{ value: ProductSize; label: string }> = [
  { value: 'Small', label: 'Small' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Large', label: 'Large' },
];

const ProductModal: React.FC<ProductModalProps> = ({
  product,
  onClose,
  editMode = false,
  editCartItemId,
  initialQuantity,
  initialAddons,
  initialInstructions,
  initialSize,
}) => {
  const { addToCart, editCartItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(initialSize ?? null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [isLoadingAddons, setIsLoadingAddons] = useState(false);
  const [addonLoadError, setAddonLoadError] = useState(false);
  const [sizeError, setSizeError] = useState('');

  const requiresSizeSelection = useCallback((category?: string) => {
    return SIZE_REQUIRED_CATEGORIES.includes(String(category || '').toLowerCase().trim());
  }, []);

  const getSizePrice = useCallback((size: ProductSize | null) => {
    if (!product) return 0;
    if (!requiresSizeSelection(product.category) || !size) return Number(product.price || 0);

    const basePrice = Number(product.price || 0);
    const priceAdjustments: Record<ProductSize, number> = {
      Small: -10,
      Medium: 0,
      Large: 20,
    };

    return Number((basePrice + (priceAdjustments[size] ?? 0)).toFixed(2));
  }, [product, requiresSizeSelection]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Safely control scroll lock
  useEffect(() => {
    if (product) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [product]);

  useEffect(() => {
    if (product) {
      const isSizeReq = requiresSizeSelection(product.category);
      setQuantity(initialQuantity ?? 1);
      setSelectedAddons(initialAddons ?? []);
      setSpecialInstructions(initialInstructions ?? '');
      setSelectedSize(initialSize ?? (isSizeReq ? 'Medium' : null));
      setSizeError('');
    }
  }, [product?.id, editCartItemId, initialSize, product?.category, requiresSizeSelection]);

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

    return () => {
      isCurrentRequest = false;
    };
  }, [product?.id, product?.category]);

  const handleClose = () => {
    document.body.style.overflow = '';
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
      setQuantity(1);
      setSelectedAddons([]);
      setSpecialInstructions('');
      document.body.style.overflow = '';
    }, 180);
  };

  const handleToggleAddon = (addon: Addon) => {
    setSelectedAddons((prev) => {
      const group = addonGroups.find((g) => g.addons.some((a) => a.id === addon.id));
      const isSingleSelection = group?.selection_type === 'single';

      if (isSingleSelection) {
        const otherAddons = prev.filter((a) => !group.addons.some((ga) => ga.id === a.id));
        const isCurrentSelected = prev.some((a) => a.id === addon.id);
        return isCurrentSelected ? otherAddons : [...otherAddons, addon];
      }

      const exists = prev.some((a) => a.id === addon.id);
      return exists ? prev.filter((a) => a.id !== addon.id) : [...prev, addon];
    });
  };

  const handleSelectSize = (size: ProductSize) => {
    setSelectedSize(size);
    setSizeError('');
  };

  const handleSave = () => {
    if (!product || !product.isAvailable) return;

    const isSizeRequired = requiresSizeSelection(product.category);
    const resolvedSize = selectedSize || (isSizeRequired ? 'Medium' : undefined);
    const resolvedPrice = getSizePrice(resolvedSize || null);

    const payload = {
      ...product,
      price: resolvedPrice,
      quantity,
      selectedAddons,
      specialInstructions: specialInstructions.trim() || undefined,
      selectedSize: resolvedSize || undefined,
    };

    if (editMode && editCartItemId) {
      editCartItem(editCartItemId, payload);
    } else {
      addToCart(payload);
    }

    try {
      window.dispatchEvent(new CustomEvent('oppa_cart_item_added', {
        detail: { name: product.name, quantity }
      }));
    } catch {}

    handleClose();
  };

  if (!product) return null;

  const isSizeRequired = requiresSizeSelection(product.category);
  const addonsTotal = selectedAddons.reduce((sum, addon) => sum + Number(addon.price || 0), 0);
  const currentUnitPrice = getSizePrice(selectedSize);
  const totalPrice = (currentUnitPrice + addonsTotal) * quantity;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-[100] transition-opacity duration-200 ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-modal-title"
          className={`w-[90%] max-w-[520px] max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-200 ${
            isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white shrink-0">
            <h2 id="product-modal-title" className="font-bold text-lg">{product.name}</h2>
            <button
              aria-label="Close product modal"
              onClick={handleClose}
              className="text-2xl opacity-80 hover:opacity-100 hover:rotate-90 transition-all duration-300 cursor-pointer"
            >
              <FiX />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-3xl font-extrabold text-[#2d6a4f]">₱{currentUnitPrice.toFixed(2)}</p>
              <span className="text-xs bg-[#E3EFE7] text-[#1C3D2E] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {product.category || 'Menu Item'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-5 leading-relaxed">{product.description}</p>

            {/* Size Selector */}
            {isSizeRequired && (
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-semibold text-sm text-gray-800">
                    Choose Size <span className="text-red-500">*</span>
                  </label>
                  {sizeError && <span className="text-xs font-medium text-red-600">{sizeError}</span>}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {SIZE_OPTIONS.map((sizeOption) => {
                    const isSelected = selectedSize === sizeOption.value;
                    const optionPrice = getSizePrice(sizeOption.value);

                    return (
                      <button
                        key={sizeOption.value}
                        type="button"
                        onClick={() => handleSelectSize(sizeOption.value)}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                          isSelected
                            ? 'border-[#2d6a4f] bg-[#eaf5ef] text-[#1b4d3e] shadow-sm ring-2 ring-[#2d6a4f]/20 font-bold'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-[#2d6a4f]/40 hover:bg-[#f7faf8]'
                        }`}
                      >
                        <div className="text-sm">{sizeOption.label}</div>
                        <div className="text-xs opacity-75">₱{optionPrice.toFixed(2)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="mb-5">
              <label className="block font-semibold text-sm text-gray-800 mb-2">Quantity</label>
              <QuantitySelector
                quantity={quantity}
                onIncrease={() => setQuantity((q) => q + 1)}
                onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
              />
            </div>

            {/* Addons Section */}
            <div className="mb-5">
              {isLoadingAddons ? (
                <div className="space-y-3 animate-pulse" aria-live="polite">
                  <div className="h-4 w-28 rounded bg-gray-200" />
                  <div className="h-12 rounded-xl bg-gray-100" />
                </div>
              ) : addonLoadError ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  Add-ons could not be loaded. You can still add this item.
                </p>
              ) : addonGroups.length > 0 ? (
                <div className="space-y-4">
                  {addonGroups.map((group) => (
                    <AddonsSection
                      key={group.id}
                      group={group}
                      selectedAddons={selectedAddons}
                      onToggleAddon={handleToggleAddon}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {/* Special Instructions */}
            <div className="mb-4">
              <label className="block font-semibold text-sm text-gray-800 mb-2">Special Instructions</label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl text-sm resize-none focus:border-[#2d6a4f] focus:outline-none focus:ring-1 focus:ring-[#2d6a4f] transition-colors"
                placeholder="e.g. Less spicy, extra sauce, separate packaging..."
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Footer with Add to Order button */}
          <div className="p-5 border-t border-gray-100 bg-gray-50/50 shrink-0">
            <div className="flex justify-between items-center font-bold text-base mb-3">
              <span className="text-gray-600">Item Total:</span>
              <span className="text-[#2d6a4f] text-2xl font-extrabold">₱{totalPrice.toFixed(2)}</span>
            </div>
            <button
              onClick={handleSave}
              disabled={!product.isAvailable}
              className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 text-base ${
                product.isAvailable
                  ? 'bg-gradient-to-r from-[#e76f51] to-[#f4a261] hover:from-[#d65f42] hover:to-[#e49251] text-white hover:shadow-lg hover:scale-[1.01]'
                  : 'bg-gray-300 text-gray-600 cursor-not-allowed'
              }`}
            >
              <span>{editMode ? 'Update Order Item' : 'Add to Register Order'}</span>
              <span>— ₱{totalPrice.toFixed(2)}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductModal;

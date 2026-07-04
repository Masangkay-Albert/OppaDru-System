import React, { useState, useEffect } from 'react';
import type { Product, CartItem, Addon } from '../../../../types/product.types';
import { useCart } from '../../../../contexts/CartContext';
import { useFavorites } from '../../../../contexts/FavoritesContext';
import { addons as allAddons } from '../../../../data/mockData';
import QuantitySelector from './QuantitySelector';
import AddonsSection from '../common/AddonsSection';
import { FiX } from 'react-icons/fi';
import '../../../../styles/modal.css';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  editMode?: boolean;
  editCartItemId?: string;
  initialQuantity?: number;
  initialAddons?: Addon[];
  initialInstructions?: string;
}

const addonsByProduct: Record<string, Addon[]> = {};

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

  if (!product) return null;

  const addons = addonsByProduct[product.id] || allAddons;

  const getAddonsTotal = () => selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
  const getTotalPrice = () => (product.price + getAddonsTotal()) * quantity;

  const toggleAddon = (addon: Addon) => {
    setSelectedAddons(prev =>
      prev.find(a => a.id === addon.id)
        ? prev.filter(a => a.id !== addon.id)
        : [...prev, addon]
    );
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
          className={`w-[90%] max-w-[520px] max-h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-200 ${
            isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white shrink-0">
            <h2 className="font-bold text-lg">{product.name}</h2>
            <button onClick={handleClose} className="text-2xl opacity-80 hover:opacity-100 hover:rotate-90 transition-all duration-300 cursor-pointer">
              <FiX />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-3xl font-extrabold text-[#2d6a4f] mb-2">₱{product.price}</p>
            <p className="text-sm text-gray-500 mb-4">{product.description}</p>

            <div className="mb-5">
              <label className="block font-semibold text-sm text-gray-800 mb-2">Quantity</label>
              <QuantitySelector
                quantity={quantity}
                onIncrease={() => setQuantity(quantity + 1)}
                onDecrease={() => setQuantity(Math.max(1, quantity - 1))}
              />
            </div>

            <AddonsSection addons={addons} selectedAddons={selectedAddons} onToggleAddon={toggleAddon} />

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
          </div>

          <div className="p-6 border-t border-gray-200 bg-white shrink-0">
            <div className="flex justify-between items-center font-bold text-lg mb-3">
              <span>Total:</span>
              <span className="text-[#2d6a4f] text-2xl">₱{getTotalPrice()}</span>
            </div>
            <button onClick={handleSubmit} className="w-full py-3 bg-gradient-to-r from-[#e76f51] to-[#f4a261] text-white rounded-xl font-bold hover:shadow-lg transition-all hover:scale-[1.02]">
              {editMode ? 'Update Cart' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductModal;
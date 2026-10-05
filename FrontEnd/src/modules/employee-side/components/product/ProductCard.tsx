import React from 'react';
import type { Product } from '../../../../types/product.types';
import { useFavorites } from '../../../../contexts/FavoritesContext';
import { FiHeart } from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';
import oppaDruLogo from '../../../../assets/oppadrulogo.jpg';
import { formatCurrency } from '../../../../utils/formatters';

interface ProductCardProps {
  product: Product;
  onOpenModal: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenModal }) => {
  const { isFavorite, toggleFavorite } = useFavorites();

  const handleOpen = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    if (!product.isAvailable) return;
    onOpenModal(product);
  };

  return (
    <div 
      className={`bg-white rounded-2xl overflow-hidden border border-gray-200/80 transition-all duration-300 group flex flex-col h-full ${
        product.isAvailable
          ? 'cursor-pointer hover:-translate-y-2 hover:shadow-2xl hover:border-[var(--oppa-green)]/30'
          : 'opacity-70 grayscale-[0.4] cursor-not-allowed'
      }`}
      onClick={() => handleOpen()}
    >
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            onError={(event) => {
              event.currentTarget.src = oppaDruLogo;
            }}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={oppaDruLogo}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute bottom-3 right-3 bg-[var(--oppa-green)] text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg">
          {formatCurrency(product.price)}
        </div>
        {!product.isAvailable && (
          <div className="absolute top-3 left-3 bg-red-600/90 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg">
            Not Available
          </div>
        )}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(product);
          }}
          className="absolute top-3 right-3 text-2xl bg-white/90 backdrop-blur-sm rounded-full w-9 h-9 flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
          title="Toggle Quick Favorite"
        >
          {isFavorite(product.id) ? (
            <FaHeart className="text-red-500" />
          ) : (
            <FiHeart className="text-gray-400" />
          )}
        </button>
      </div>
      
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-gray-800 mb-1 text-base line-clamp-1">{product.name}</h3>
        <p className="text-gray-500 text-xs mb-3 line-clamp-2 flex-1">{product.description}</p>
        <button 
          onClick={(e) => handleOpen(e)}
          disabled={!product.isAvailable}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all mt-auto ${
            product.isAvailable
              ? 'bg-[#C1440E] hover:bg-[#a23a0c] text-white hover:scale-[1.02]'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          {product.isAvailable ? 'Add to Order' : 'Not Available'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;

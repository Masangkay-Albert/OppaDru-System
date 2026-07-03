// src/modules/customer-side/components/product/ProductCard.tsx
import React from 'react';
import type { Product } from '../../../../types/product.types';
import { useFavorites } from '../../../../contexts/FavoritesContext';
import { FiHeart } from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';

interface ProductCardProps {
  product: Product;
  onOpenModal: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenModal }) => {
  const { isFavorite, toggleFavorite } = useFavorites();

  return (
    <div 
      className="bg-white rounded-2xl overflow-hidden border border-gray-200/80 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-[#1b7a3d]/30 cursor-pointer group flex flex-col h-full"
      onClick={() => onOpenModal(product)}
    >
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-500 text-sm font-medium">
            Image
          </div>
        )}
        <div className="absolute bottom-3 right-3 bg-gradient-to-r from-[#1b7a3d] to-[#0f5c2c] text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-lg">
          ₱{product.price}
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(product);
          }}
          className="absolute top-3 right-3 text-2xl bg-white/90 backdrop-blur-sm rounded-full w-9 h-9 flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
        >
          {isFavorite(product.id) ? (
            <FaHeart className="text-[#d62828]" />
          ) : (
            <FiHeart className="text-gray-400" />
          )}
        </button>
      </div>
      
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-gray-800 mb-1 text-base line-clamp-1">{product.name}</h3>
        <p className="text-gray-500 text-xs mb-3 line-clamp-2 flex-1">{product.description}</p>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal(product);
          }}
          className="w-full py-2.5 bg-gradient-to-r from-[#d62828] to-[#b31f1f] text-white rounded-xl text-sm font-semibold hover:shadow-lg transition-all hover:scale-[1.02] mt-auto"
        >
          Order Now
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
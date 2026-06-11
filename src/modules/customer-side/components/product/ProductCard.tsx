// ProductCard.tsx
import React from 'react';
import type { Product } from '../../../../types/product.types';
import { useFavorites } from '../../../../contexts/FavoritesContext';

interface ProductCardProps {
  product: Product;
  onOpenModal: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onOpenModal }) => {
  const { isFavorite, toggleFavorite } = useFavorites();

  return (
    <div 
      className="bg-white rounded-xl overflow-hidden border border-gray-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[#2d6a4f] cursor-pointer"
      onClick={() => onOpenModal(product)}
    >
      <div className="relative h-44 bg-gray-200 flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center bg-gray-300 text-gray-500 text-sm font-medium">
          Image
        </div>
        <div className="absolute bottom-3 right-3 bg-[#2d6a4f] text-white px-3 py-1 rounded-full font-bold text-sm shadow-md">
          ₱{product.price}
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(product);
          }}
          className="absolute top-3 right-3 text-2xl bg-white/80 rounded-full w-8 h-8 flex items-center justify-center shadow-md"
        >
          {isFavorite(product.id) ? '❤️' : '🤍'}
        </button>
      </div>
      
      {/* Content Section */}
      <div className="p-4">
        <h3 className="font-bold text-gray-800 mb-1 text-base">{product.name}</h3>
        <p className="text-gray-500 text-xs mb-3 line-clamp-2">{product.description}</p>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onOpenModal(product);
          }}
          className="w-full py-2 bg-[#e76f51] text-white rounded-lg text-sm font-semibold hover:bg-[#f4a261] transition-all hover:scale-[1.02]"
        >
          Order Now
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
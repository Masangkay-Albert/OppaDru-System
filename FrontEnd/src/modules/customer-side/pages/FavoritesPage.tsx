// src/modules/customer-side/pages/FavoritesPage.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../../../contexts/FavoritesContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import ProductCard from '../components/product/ProductCard';
import ProductModal from '../components/product/ProductModal';
import type { Product } from '../../../types/product.types';
import { FiArrowLeft, FiHeart } from 'react-icons/fi';
import '../../../styles/secondary-pages.css';

const FavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const { favorites, clearFavoriteNotification } = useFavorites();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    clearFavoriteNotification();
  }, []);

  const handleOpenModal = useCallback((product: Product) => {
    scrollPositionRef.current = window.scrollY;
    setSelectedProduct(product);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedProduct(null);
    window.scrollTo({
      top: scrollPositionRef.current,
      behavior: 'instant'
    });
  }, []);

  return (
    <div className="secondary-page secondary-favorites min-h-screen bg-gradient-to-br from-[#fdf6ed] via-[#fff5ee] to-[#e8f5e9]">
      <NavbarCustomer />

      <div className="secondary-page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="secondary-page-header flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/customer')}
            className="back-menu-button flex items-center gap-2 text-[#7f4f24] hover:text-[#2d6a4f] transition-all duration-300 font-medium text-sm bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm hover:shadow-md"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>
          <div className="h-8 w-px bg-[#e76f51]/20"></div>
          <h1 className="secondary-page-title text-2xl sm:text-3xl font-serif font-bold text-[#2d6a4f]">My Favorites</h1>
        </div>

        {favorites.length === 0 ? (
          <div className="secondary-empty-state text-center py-20 bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-[#e76f51]/10">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <FiHeart className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-gray-700 mb-3">No Favorites Yet</h2>
            <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed">
              You'll see all your favorites here, to make ordering even faster. Just look for the ❤️.
            </p>
            <button
              onClick={() => navigate('/customer')}
              className="secondary-primary-button mt-8 px-8 py-3 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white rounded-full font-semibold hover:shadow-xl transition-all hover:scale-[1.02] text-sm"
            >
              Browse Menu
            </button>
          </div>
        ) : (
          <div className="favorites-product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {favorites.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenModal={handleOpenModal}
              />
            ))}
          </div>
        )}
      </div>

      <ProductModal product={selectedProduct} onClose={handleCloseModal} />
    </div>
  );
};

export default FavoritesPage;
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../../../contexts/FavoritesContext';
import NavbarEmployee from '../components/navigation/NavbarEmployee';
import ProductCard from '../components/product/ProductCard';
import ProductModal from '../components/product/ProductModal';
import type { Product } from '../../../types/product.types';
import { FiArrowLeft, FiHeart } from 'react-icons/fi';

const EmployeeFavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const { favorites, clearFavoriteNotification } = useFavorites();
  const employeeBranchId = (() => {
    try {
      const employee = JSON.parse(sessionStorage.getItem('employee_auth') || 'null') as {
        franchise_id?: string | null;
        branch_id?: string | null;
      } | null;
      const branchId = employee?.franchise_id || employee?.branch_id;
      return branchId ? String(branchId) : null;
    } catch (error) {
      console.warn('Could not read the employee branch for favorites.', error);
      return null;
    }
  })();
  const branchFavorites = favorites.filter((product) => (
    !product.franchise_id || String(product.franchise_id) === String(employeeBranchId || '')
  ));
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const scrollPositionRef = useRef<number>(0);

  useEffect(() => {
    clearFavoriteNotification();
  }, [clearFavoriteNotification]);

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
    <div className="min-h-screen bg-gradient-to-br from-[#fdf6ed] via-[#fff5ee] to-[#e8f5e9]">
      <NavbarEmployee />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/employee')}
            className="flex items-center gap-2 text-[#7f4f24] hover:text-[#2d6a4f] transition-all duration-300 font-medium text-sm bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm hover:shadow-md"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>Back to Register</span>
          </button>
          <div className="h-8 w-px bg-[#e76f51]/20"></div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#2d6a4f]">Quick Favorites</h1>
            <p className="text-xs text-gray-500 mt-0.5">Popular & frequently ordered items for fast checkout</p>
          </div>
        </div>

        {branchFavorites.length === 0 ? (
          <div className="text-center py-20 bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border border-[#e76f51]/10">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <FiHeart className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-gray-700 mb-2">No Quick Favorites Saved</h2>
            <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed mb-6">
              Star items on the register menu to access popular combos and customer favorites quickly.
            </p>
            <button
              onClick={() => navigate('/employee')}
              className="px-6 py-2.5 bg-[var(--oppa-green)] text-white font-semibold rounded-xl text-sm hover:bg-[var(--oppa-green-dark)] transition"
            >
              Browse Register Menu
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {branchFavorites.map((product) => (
              <ProductCard key={product.id} product={product} onOpenModal={handleOpenModal} />
            ))}
          </div>
        )}
      </div>

      <ProductModal product={selectedProduct} onClose={handleCloseModal} />
    </div>
  );
};

export default EmployeeFavoritesPage;

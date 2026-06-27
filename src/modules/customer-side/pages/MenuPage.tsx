import React, { useState, useRef, useCallback } from 'react';
import { useAuth } from '../../../contexts/Authcontext';
import { useCart } from '../../../contexts/CartContext';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { products, categories } from '../../../data/mockData';
import type { Product, ProductCategory } from '../../../types/product.types';
import ProductCard from '../components/product/ProductCard';
import ProductModal from '../components/product/ProductModal';
import CartSidebar from '../components/cart/CartSidebar';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import PromoBanner from '../components/common/PromoBanner';
import NotificationToast from '../components/common/ProductNotification';
import GreetingBanner from '../components/common/GreetingBanner';
import { FiShoppingCart, FiMenu, FiX, FiSearch } from 'react-icons/fi';
import foodpandaLogo from '../../../assets/foodpanda.png';
import '../../../styles/global.css';

const MenuPage: React.FC = () => {
  const { user } = useAuth();
  const { getTotalItems } = useCart();
  const { showNotification, newFavoriteName, clearNotification } = useFavorites();
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const scrollPositionRef = useRef<number>(0);
  const mainContentRef = useRef<HTMLDivElement>(null);

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

  const handleCategoryChange = (category: ProductCategory) => {
    setSelectedCategory(category);
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalItems = getTotalItems();

  const getSelectedCategoryName = () => {
    const cat = categories.find(c => c.id === selectedCategory);
    return cat ? cat.name : 'All';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf6ed] via-[#fff5ee] to-[#e8f5e9]">
      <NotificationToast 
        message={newFavoriteName} 
        isVisible={showNotification} 
        onClose={clearNotification} 
      />
      <NavbarCustomer />
      <PromoBanner />

      {totalItems > 0 && (
        <button 
          onClick={() => setIsMobileCartOpen(true)} 
          className="lg:hidden fixed bottom-5 right-5 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white px-5 py-3 rounded-full shadow-2xl z-40 font-semibold text-sm flex items-center gap-2 hover:shadow-xl transition-all duration-300 hover:scale-105"
        >
          <FiShoppingCart className="text-base" />
          Cart 
          <span className="bg-[#e76f51] rounded-full px-2.5 py-0.5 text-xs ml-1 animate-pulse">{totalItems}</span>
        </button>
      )}

      <button 
        onClick={() => setIsMobileCategoryOpen(true)} 
        className="lg:hidden fixed bottom-5 left-5 bg-white/90 backdrop-blur-sm text-[#2d6a4f] px-4 py-3 rounded-full shadow-2xl z-40 font-semibold text-sm flex items-center gap-2 border border-[#2d6a4f]/20 hover:shadow-xl transition-all duration-300"
      >
        <FiMenu className="text-lg" />
        {getSelectedCategoryName()}
      </button>

      <div className="flex flex-col lg:flex-row">
        <aside className="hidden lg:block w-72 bg-white/95 backdrop-blur-sm border-r border-[#e76f51]/10 p-6 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto shadow-sm">
          <div className="mb-6 pb-4 border-b-2 border-[#e76f51]/20">
            <h2 className="text-2xl font-serif font-extrabold text-[#2d6a4f]">Menu</h2>
            <p className="text-xs text-[#7f4f24]/70 mt-1">Browse by category</p>
          </div>
          <nav className="flex flex-col gap-1.5">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id as ProductCategory)}
                className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-[#d8f3dc] to-[#e8f5e9] text-[#2d6a4f] shadow-sm'
                    : 'text-[#7f4f24] hover:bg-[#fff5ee]'
                }`}
              >
                <span className="flex-1">{category.name}</span>
                {selectedCategory === category.id && (
                  <span className="w-1.5 h-6 bg-[#e76f51] rounded-full ml-2"></span>
                )}
              </button>
            ))}
          </nav>

          <div className="mt-6 pt-6 border-t border-[#e76f51]/20">
            <p className="text-xs text-[#7f4f24]/60 mb-3">Order on</p>
            <a 
              href="https://www.foodpanda.ph/restaurant/l4fv/oppa-dru-zone-1"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:opacity-80 transition-opacity duration-300"
            >
              <img 
                src={foodpandaLogo} 
                alt="Order on Foodpanda" 
                className="h-10 w-auto object-contain"
              />
            </a>
          </div>
        </aside>

        <main ref={mainContentRef} className="flex-1 p-4 sm:p-6 lg:p-8">
          <GreetingBanner 
            userName={user?.fullName?.split(' ')[0]}
            onCategoryClick={handleCategoryChange}
          />

          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for your favorite food..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-11 rounded-xl border-2 border-[#e76f51]/20 bg-white/90 focus:border-[#2d6a4f] focus:outline-none focus:shadow-lg transition-all text-sm"
              />
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#e76f51] text-base" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onOpenModal={handleOpenModal} />
            ))}
          </div>

          <div className="lg:hidden mt-8 pt-6 border-t border-[#e76f51]/20">
            <p className="text-xs text-[#7f4f24]/60 mb-3 text-center">Order on</p>
            <a 
              href="https://www.foodpanda.ph/restaurant/l4fv/oppa-dru-zone-1"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:opacity-80 transition-opacity duration-300 flex justify-center"
            >
              <img 
                src={foodpandaLogo} 
                alt="Order on Foodpanda" 
                className="h-10 w-auto object-contain"
              />
            </a>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#7f4f24]">No products found</p>
            </div>
          )}
        </main>

        <div className="hidden lg:block">
          <CartSidebar />
        </div>

        {isMobileCartOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[45] animate-fadeIn" onClick={() => setIsMobileCartOpen(false)} />
            <div className="fixed right-0 top-0 h-full w-full max-w-[320px] bg-white z-[46] animate-slideInRight overflow-y-auto">
              <CartSidebar onClose={() => setIsMobileCartOpen(false)} />
            </div>
          </>
        )}

        {isMobileCategoryOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[45] animate-fadeIn" onClick={() => setIsMobileCategoryOpen(false)} />
            <div className="fixed left-0 top-0 h-full w-full max-w-[280px] bg-white z-[46] animate-slideInLeft overflow-y-auto">
              <div className="sticky top-0 flex justify-between items-center p-4 border-b border-[#e76f51]/20 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white">
                <h3 className="font-bold">Menu Categories</h3>
                <button onClick={() => setIsMobileCategoryOpen(false)} className="text-xl hover:rotate-90 transition-transform duration-300">
                  <FiX />
                </button>
              </div>
              <nav className="flex flex-col p-2 gap-1">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      handleCategoryChange(category.id as ProductCategory);
                      setIsMobileCategoryOpen(false);
                    }}
                    className={`px-4 py-3 rounded-lg text-sm font-medium text-left ${
                      selectedCategory === category.id
                        ? 'bg-gradient-to-r from-[#d8f3dc] to-[#e8f5e9] text-[#2d6a4f]'
                        : 'text-[#7f4f24] hover:bg-[#fff5ee]'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </nav>
            </div>
          </>
        )}
      </div>

      <ProductModal product={selectedProduct} onClose={handleCloseModal} />
    </div>
  );
};

export default MenuPage;
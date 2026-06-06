// MenuPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../../../contexts/Authcontext';
import { useCart } from '../../../contexts/CartContext';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { products, categories } from '../../../data/mockData';
import type { Product, ProductCategory } from '../../../types/product.types';
import ProductCard from '../components/ProductCard';
import ProductModal from '../components/ProductModal';
import CartSidebar from '../components/CartSidebar';
import NavbarCustomer from '../components/NavbarCustomer';
import PromoBanner from '../components/PromoBanner';
import NotificationToast from '../components/NotificationToast';
import GreetingBanner from '../components/GreetingBanner';
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
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NotificationToast 
        message={newFavoriteName} 
        isVisible={showNotification} 
        onClose={clearNotification} 
      />
      <NavbarCustomer />
      <PromoBanner />

      {/* Mobile Buttons */}
      {totalItems > 0 && (
        <button 
          onClick={() => setIsMobileCartOpen(true)} 
          className="lg:hidden fixed bottom-5 right-5 bg-[#2d6a4f] text-white px-4 py-2 rounded-full shadow-lg z-40 font-semibold text-sm"
        >
          Cart <span className="bg-[#e76f51] rounded-full px-2 py-0.5 text-xs ml-1">{totalItems}</span>
        </button>
      )}

      <button 
        onClick={() => setIsMobileCategoryOpen(true)} 
        className="lg:hidden fixed bottom-5 left-5 bg-[#2d6a4f] text-white px-4 py-2 rounded-full shadow-lg z-40 font-semibold text-sm flex items-center gap-2"
      >
        ☰ {getSelectedCategoryName()}
      </button>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar Categories - Desktop */}
        <aside className="hidden lg:block w-64 bg-white/90 backdrop-blur-sm border-r border-[#e76f51]/20 p-6 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <div className="mb-6 pb-4 border-b-2 border-[#e76f51]/30">
            <h2 className="text-2xl font-extrabold text-[#2d6a4f]">Menu</h2>
            <p className="text-xs text-[#7f4f24] mt-1">Browse by category</p>
          </div>
          <nav className="flex flex-col gap-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id as ProductCategory)}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                  selectedCategory === category.id
                    ? 'bg-[#d8f3dc] text-[#2d6a4f]'
                    : 'text-[#7f4f24] hover:bg-[#fff3e0]'
                }`}
              >
                <span className="flex-1">{category.name}</span>
                {selectedCategory === category.id && <span className="w-1 h-5 bg-[#e76f51] rounded-full ml-2"></span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {/* GREETING BANNER  */}
          <GreetingBanner 
            userName={user?.fullName?.split(' ')[0]}
            onCategoryClick={setSelectedCategory}
          />

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for your favorite food..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-10 rounded-xl border-2 border-[#e76f51]/30 bg-white/90 focus:border-[#2d6a4f] focus:outline-none focus:shadow-lg transition-all text-sm"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#e76f51] text-base">🔍</span>
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onOpenModal={setSelectedProduct} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#7f4f24]">No products found</p>
            </div>
          )}
        </main>

        {/* Desktop Cart Sidebar */}
        <div className="hidden lg:block">
          <CartSidebar />
        </div>

        {/* Mobile Cart Drawer */}
        {isMobileCartOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[45] animate-fadeIn" onClick={() => setIsMobileCartOpen(false)} />
            <div className="fixed right-0 top-0 h-full w-full max-w-[320px] bg-white z-[46] animate-slideInRight overflow-y-auto">
              <CartSidebar onClose={() => setIsMobileCartOpen(false)} />
            </div>
          </>
        )}

        {/* Mobile Category Drawer */}
        {isMobileCategoryOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[45] animate-fadeIn" onClick={() => setIsMobileCategoryOpen(false)} />
            <div className="fixed left-0 top-0 h-full w-full max-w-[280px] bg-white z-[46] animate-slideInLeft overflow-y-auto">
              <div className="sticky top-0 flex justify-between items-center p-4 border-b border-[#e76f51]/20 bg-[#2d6a4f] text-white">
                <h3 className="font-bold">Menu Categories</h3>
                <button onClick={() => setIsMobileCategoryOpen(false)} className="text-xl">✕</button>
              </div>
              <nav className="flex flex-col p-2 gap-1">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id as ProductCategory);
                      setIsMobileCategoryOpen(false);
                    }}
                    className={`px-4 py-3 rounded-lg text-sm font-medium text-left ${
                      selectedCategory === category.id
                        ? 'bg-[#d8f3dc] text-[#2d6a4f]'
                        : 'text-[#7f4f24] hover:bg-[#fff3e0]'
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

      {/* Product Modal */}
      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
    </div>
  );
};

export default MenuPage; 
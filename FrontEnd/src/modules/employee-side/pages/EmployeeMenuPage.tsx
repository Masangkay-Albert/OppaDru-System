import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../../contexts/CartContext';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { categories } from '../../../data/mockData';
import type { Product, ProductCategory } from '../../../types/product.types';
import ProductCard from '../components/product/ProductCard';
import ProductModal from '../components/product/ProductModal';
import CartSidebar from '../components/cart/CartSidebar';
import NavbarEmployee from '../components/navigation/NavbarEmployee';
import NotificationToast from '../components/common/ProductNotification';
import GreetingBanner from '../components/common/GreetingBanner';
import SearchInput from '../../../components/ui/SearchInput';
import { FiShoppingCart, FiMenu, FiX, FiTrendingUp } from 'react-icons/fi';
import '../../../styles/global.css';
import { productService } from '../../../services/productService';

const EmployeeMenuPage: React.FC = () => {
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<any>(null);
  const { getTotalItems } = useCart();
  const { showNotification, newFavoriteName, clearNotification } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const scrollPositionRef = useRef<number>(0);
  const mainContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('employee_auth');
      if (raw) setEmployee(JSON.parse(raw));
    } catch {
      setEmployee(null);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productService.getAvailableProducts();
      setProducts(data);
    } catch {
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    const refreshProducts = () => {
      if (document.visibilityState === 'visible') void fetchProducts();
    };
    const initialFetchId = window.setTimeout(() => void fetchProducts(), 0);
    const intervalId = window.setInterval(refreshProducts, 15000);
    const handleProductsUpdated = () => refreshProducts();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchProducts();
    };
    window.addEventListener('products-updated', handleProductsUpdated);
    window.addEventListener('focus', refreshProducts);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(initialFetchId);
      window.clearInterval(intervalId);
      window.removeEventListener('products-updated', handleProductsUpdated);
      window.removeEventListener('focus', refreshProducts);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchProducts]);

  const [addedItemToast, setAddedItemToast] = useState<string | null>(null);

  useEffect(() => {
    const handleItemAdded = (e: any) => {
      const name = e.detail?.name || 'Item';
      setAddedItemToast(`Added "${name}" to register order!`);
      const timer = setTimeout(() => setAddedItemToast(null), 2500);
      return () => clearTimeout(timer);
    };
    window.addEventListener('oppa_cart_item_added', handleItemAdded);
    return () => window.removeEventListener('oppa_cart_item_added', handleItemAdded);
  }, []);

  const handleOpenModal = useCallback((product: Product) => {
    scrollPositionRef.current = window.scrollY;
    setSelectedProduct(product);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedProduct(null);
    document.body.style.overflow = '';
    window.scrollTo({
      top: scrollPositionRef.current,
      behavior: 'instant'
    });
  }, []);

  const handleCategoryChange = (category: ProductCategory) => {
    setSelectedCategory(category);
  };

  const filteredProducts = products
    .filter(product => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return a.name.localeCompare(b.name);
    });

  const totalItems = getTotalItems();

  const getSelectedCategoryName = () => {
    const cat = categories.find(c => c.id === selectedCategory);
    return cat ? cat.name : 'All';
  };

  const staffDisplayName = employee?.fullName?.split(' ')[0] || employee?.full_name?.split(' ')[0] || 'Staff';

  return (
    <div className="min-h-screen bg-[#FBF6ED]">
      <NotificationToast 
        message={addedItemToast || newFavoriteName} 
        isVisible={Boolean(addedItemToast) || showNotification} 
        onClose={() => {
          setAddedItemToast(null);
          clearNotification();
        }} 
      />
      <NavbarEmployee />

      {totalItems > 0 && (
        <button 
          onClick={() => setIsMobileCartOpen(true)} 
          className="lg:hidden fixed bottom-5 right-5 bg-[#1C3D2E] text-white px-5 py-3 rounded-full shadow-xl z-40 font-semibold text-sm flex items-center gap-2 hover:shadow-2xl transition-all duration-300 hover:scale-105"
        >
          <FiShoppingCart className="text-base" />
          Register Order 
          <span className="bg-[#C1440E] rounded-full px-2.5 py-0.5 text-xs ml-1">{totalItems}</span>
        </button>
      )}

      <button 
        onClick={() => setIsMobileCategoryOpen(true)} 
        className="lg:hidden fixed bottom-5 left-5 bg-white text-[#1C3D2E] px-4 py-3 rounded-full shadow-xl z-40 font-semibold text-sm flex items-center gap-2 border border-[#1C3D2E]/15 hover:shadow-2xl transition-all duration-300"
      >
        <FiMenu className="text-lg" />
        {getSelectedCategoryName()}
      </button>

      <div className="flex flex-col lg:flex-row">
        {/* Category Sidebar */}
        <aside className="hidden lg:block w-72 bg-white border-r border-gray-100 p-6 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <div className="mb-6 pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-serif font-extrabold text-[#1C3D2E]">Register Menu</h2>
            <p className="text-xs text-gray-500 mt-1">Select category to filter items</p>
          </div>
          <nav className="flex flex-col gap-1.5">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id as ProductCategory)}
                className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                  selectedCategory === category.id
                    ? 'bg-[#E3EFE7] text-[#1C3D2E]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="flex-1">{category.name}</span>
                {selectedCategory === category.id && (
                  <span className="w-1.5 h-6 bg-[#C1440E] rounded-full ml-2"></span>
                )}
              </button>
            ))}
          </nav>

          <div className="pt-4 mt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => navigate('/employee/popular')}
              className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition shadow-xs group"
            >
              <FiTrendingUp className="text-amber-600 text-sm group-hover:scale-110 transition-transform" />
              <span className="flex-1 text-left">Most Popular This Month</span>
              <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full font-black">TOP 10</span>
            </button>
          </div>
        </aside>

        {/* Main Products Grid */}
        <main ref={mainContentRef} className="flex-1 p-4 sm:p-6 lg:p-8">
          <GreetingBanner 
            userName={staffDisplayName}
            onCategoryClick={handleCategoryChange}
          />

          <div className="mb-6">
            <SearchInput
              aria-label="Search menu items"
              placeholder="Search menu items for customer order..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onOpenModal={handleOpenModal} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-16 bg-white/60 rounded-3xl border border-gray-100 mt-4">
              <p className="text-gray-500 font-medium">No menu items found matching "{searchTerm}"</p>
            </div>
          )}
        </main>

        {/* POS Cart Sidebar on desktop */}
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

        {/* Mobile Categories Drawer */}
        {isMobileCategoryOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[45] animate-fadeIn" onClick={() => setIsMobileCategoryOpen(false)} />
            <div className="fixed left-0 top-0 h-full w-full max-w-[280px] bg-white z-[46] animate-slideInLeft overflow-y-auto">
              <div className="sticky top-0 flex justify-between items-center p-4 border-b border-gray-100 bg-[#1C3D2E] text-white">
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
                        ? 'bg-[#E3EFE7] text-[#1C3D2E]'
                        : 'text-gray-600 hover:bg-gray-50'
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

export default EmployeeMenuPage;

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../../contexts/Authcontext';
import { useCart } from '../../../contexts/CartContext';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { categories } from '../../../data/mockData';
import type { Product, ProductCategory } from '../../../types/product.types';
import ProductCard from '../components/product/ProductCard';
import ProductModal from '../components/product/ProductModal';
import CartSidebar from '../components/cart/CartSidebar';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import NotificationToast from '../components/common/ProductNotification';
import GreetingBanner from '../components/common/GreetingBanner';
import { FiShoppingCart, FiMenu, FiX, FiSearch } from 'react-icons/fi';
import { LuStore } from 'react-icons/lu';
import foodpandaLogo from '../../../assets/foodpanda.png';
import '../../../styles/global.css';
import { productService } from '../../../services/productService';
import { getActiveBranches, getSelectedBranchId, setSelectedBranchId } from '../../../services/franchiseBranchService';
import type { FranchiseBranch } from '../../../services/franchiseBranchService';
import '../../../styles/menu-design.css';

const MenuPage: React.FC = () => {
  const { user } = useAuth();
  const { getTotalItems, cartItems, clearCart } = useCart();
  const { showNotification, newFavoriteName, clearNotification } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<FranchiseBranch[]>([]);
  const [mainBranch, setMainBranch] = useState<FranchiseBranch | null>(null);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(() => getSelectedBranchId());
  const [branchError, setBranchError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const scrollPositionRef = useRef<number>(0);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productService.getAvailableProducts(selectedBranchId);
      setProducts(data);
      setBranchError('');
    } catch (error) {
      setProducts([]);
      setBranchError(error instanceof Error ? error.message : 'Unable to load this branch menu.');
    }
  }, [selectedBranchId]);

  useEffect(() => {
    getActiveBranches()
      .then((activeBranches) => {
        setBranches(activeBranches);
        const main = activeBranches.find((branch) => branch.is_main) || null;
        setMainBranch(main);
        const savedBranchId = getSelectedBranchId();
        const selectedId = savedBranchId && activeBranches.some((branch) => branch.id === savedBranchId)
          ? savedBranchId
          : main?.id || null;
        if (selectedId !== savedBranchId) {
          setSelectedBranchId(selectedId);
        }
        setSelectedBranchIdState(selectedId);
        setBranchesLoaded(true);
      })
      .catch((error: unknown) => {
        setBranchError(error instanceof Error ? error.message : 'Unable to load branches.');
      });
  }, []);

  useEffect(() => {
    if (!branchesLoaded) return;

    const refreshProducts = () => {
      if (document.visibilityState === 'visible') void fetchProducts();
    };
    const initialFetchId = window.setTimeout(() => void fetchProducts(), 0);
    const handleProductsUpdated = () => refreshProducts();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void fetchProducts();
    };
    window.addEventListener('products-updated', handleProductsUpdated);
    window.addEventListener('focus', refreshProducts);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearTimeout(initialFetchId);
      window.removeEventListener('products-updated', handleProductsUpdated);
      window.removeEventListener('focus', refreshProducts);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [branchesLoaded, fetchProducts, selectedBranchId]);

  const handleBranchChange = (branchId: string) => {
    if (branchId === (selectedBranchId || '')) return;
    if (cartItems.length > 0 && !window.confirm('Changing branches will clear your current cart. Continue?')) return;
    if (cartItems.length > 0) clearCart();
    const nextBranchId = branchId || null;
    setSelectedBranchId(nextBranchId);
    setSelectedBranchIdState(nextBranchId);
    setBranchError('');
  };

  const activeBranch = selectedBranchId
    ? branches.find((branch) => branch.id === selectedBranchId) || null
    : mainBranch;

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

  return (
    <div className="menu-page min-h-screen bg-[#FBF6ED]">
      <NotificationToast 
        message={newFavoriteName} 
        isVisible={showNotification} 
        onClose={clearNotification} 
      />
      <NavbarCustomer />
      {totalItems > 0 && (
        <button 
          onClick={() => setIsMobileCartOpen(true)} 
          className="lg:hidden fixed bottom-5 right-5 bg-[#1C3D2E] text-white px-5 py-3 rounded-full shadow-xl z-40 font-semibold text-sm flex items-center gap-2 hover:shadow-2xl transition-all duration-300 hover:scale-105"
        >
          <FiShoppingCart className="text-base" />
          Cart 
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
        <aside className="menu-sidebar hidden lg:block w-72 bg-white border-r border-gray-100 p-6 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          <div className="mb-6 pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-serif font-extrabold text-[#1C3D2E]">Menu</h2>
            <p className="text-xs text-gray-500 mt-1">Browse by category</p>
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

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3">Order on</p>
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

        <main ref={mainContentRef} className="menu-main flex-1 p-4 sm:p-6 lg:p-8">
          <GreetingBanner 
            userName={user?.full_name?.split(' ')[0]}
            onCategoryClick={handleCategoryChange}
          />

          <section className="menu-branch-control mb-6 rounded-2xl border border-[#dce8de] bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <label htmlFor="customer-branch" className="block text-sm font-bold text-[#1C3D2E]">
                  Choose which branch to order from
                </label>
                <p className="mt-0.5 text-xs text-gray-500">Menu availability can vary by location.</p>
              </div>
              <span className="rounded-full bg-[#E3EFE7] px-3 py-1 text-[11px] font-semibold text-[#1C3D2E]">
                {activeBranch?.is_main
                  ? <><LuStore className="mr-1 inline-block" aria-hidden="true" />Main branch</>
                  : 'Franchise branch'}
              </span>
            </div>
            <select
              id="customer-branch"
              value={selectedBranchId || ''}
              onChange={(event) => handleBranchChange(event.target.value)}
              className="menu-branch-select w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800 focus:border-[#1C3D2E] focus:outline-none focus:ring-2 focus:ring-[#1C3D2E]/10 sm:max-w-xl"
            >
              {branches.length === 0 && (
                <option value="" disabled>
                  {branchesLoaded ? 'No active branches available' : 'Loading branches...'}
                </option>
              )}
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}{branch.address ? `, ${branch.address}` : ''}</option>
              ))}
            </select>
            {branchError && <p className="mt-2 text-sm text-red-600">{branchError}</p>}
          </section>

          <div className="menu-search mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for your favorite food..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="menu-search-input w-full px-4 py-3 pl-11 rounded-xl border border-gray-200 bg-white focus:border-[#1C3D2E] focus:outline-none focus:ring-1 focus:ring-[#1C3D2E] transition-all text-sm"
              />
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base" />
            </div>
          </div>

          <div className="menu-product-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} onOpenModal={handleOpenModal} />
            ))}
          </div>

          <div className="lg:hidden mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3 text-center">Order on</p>
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
              <p className="text-gray-500">No products found</p>
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

export default MenuPage;
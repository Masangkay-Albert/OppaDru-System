import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../../../contexts/Authcontext';
import { useCart } from '../../../contexts/CartContext';
import { useFavorites } from '../../../contexts/FavoritesContext';
import { useToast } from '../components/ToastProvider';
import { categories } from '../../../data/mockData';
import type { Product, ProductCategory } from '../../../types/product.types';
import ProductCard from '../components/product/ProductCard';
import Top3PopularMeals from '../components/product/Top3PopularMeals';
import ProductModal from '../components/product/ProductModal';
import CartSidebar from '../components/cart/CartSidebar';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import NotificationToast from '../components/common/ProductNotification';
import GreetingBanner from '../components/common/GreetingBanner';
import { FiShoppingCart, FiMenu, FiX } from 'react-icons/fi';
import { LuStore } from 'react-icons/lu';
import foodpandaLogo from '../../../assets/foodpanda.png';
import '../../../styles/global.css';
import { productService } from '../../../services/productService';
import Select from '../../../components/ui/Select';
import SearchInput from '../../../components/ui/SearchInput';
import { getActiveBranches, getSelectedBranchId, setSelectedBranchId } from '../../../services/franchiseBranchService';
import type { FranchiseBranch } from '../../../services/franchiseBranchService';
import '../../../styles/menu-design.css';

const MenuPage: React.FC = () => {
  const { user } = useAuth();
  const { getTotalItems, activeBranchId, setActiveBranchId, getBranchCartItemCount, validateCartAgainstMenu } = useCart();
  const { showToast } = useToast();
  const { showNotification, newFavoriteName, clearNotification } = useFavorites();
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<FranchiseBranch[]>([]);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [branchError, setBranchError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isMobileCategoryOpen, setIsMobileCategoryOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const scrollPositionRef = useRef<number>(0);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const unavailableBranchNoticeRef = useRef<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productService.getAvailableProducts(activeBranchId);
      setProducts(data);
      validateCartAgainstMenu(data);
      setBranchError('');
    } catch (error) {
      setProducts([]);
      setBranchError(error instanceof Error ? error.message : 'Unable to load this branch menu.');
    }
  }, [activeBranchId, validateCartAgainstMenu]);

  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    const loadBranches = async () => {
      const requestId = ++latestRequest;
      try {
        const activeBranches = await getActiveBranches();
        if (!active || requestId !== latestRequest) return;
        setBranches(activeBranches);
        const main = activeBranches.find((branch) => branch.is_main) || null;
        const savedBranchId = getSelectedBranchId();
        const savedBranchIsAvailable = Boolean(savedBranchId && activeBranches.some((branch) => branch.id === savedBranchId));
        const selectedId = savedBranchIsAvailable
          ? savedBranchId
          : main?.id || activeBranches[0]?.id || null;
        if (selectedId !== savedBranchId) {
          setSelectedBranchId(selectedId);
        }
        setActiveBranchId(selectedId);
        setBranchError('');
        if (savedBranchId && !savedBranchIsAvailable && unavailableBranchNoticeRef.current !== savedBranchId) {
          unavailableBranchNoticeRef.current = savedBranchId;
          const nextBranchName = activeBranches.find((branch) => branch.id === selectedId)?.name;
          showToast(
            nextBranchName
              ? `Your selected branch is no longer active. We switched you to ${nextBranchName}.`
              : 'Your selected branch is no longer active. No active branches are available right now.',
            nextBranchName ? 'success' : 'error',
          );
        }
        setBranchesLoaded(true);
      } catch (error: unknown) {
        if (active && requestId === latestRequest) {
          setBranchError(error instanceof Error ? error.message : 'Unable to load branches.');
          setBranchesLoaded(true);
        }
      }
    };
    const refreshWhenActive = () => {
      if (document.visibilityState === 'visible') void loadBranches();
    };

    void loadBranches();
    window.addEventListener('focus', refreshWhenActive);
    document.addEventListener('visibilitychange', refreshWhenActive);
    const refreshInterval = window.setInterval(refreshWhenActive, 30000);
    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhenActive);
      document.removeEventListener('visibilitychange', refreshWhenActive);
    };
  }, [setActiveBranchId, showToast]);

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
  }, [branchesLoaded, fetchProducts, activeBranchId]);

  const handleBranchChange = (branchId: string) => {
    if (branchId === (activeBranchId || '')) return;
    const previousBranchName = branches.find((branch) => branch.id === activeBranchId)?.name;
    const previousCartCount = activeBranchId ? getBranchCartItemCount(activeBranchId) : 0;
    const nextBranchName = branches.find((branch) => branch.id === branchId)?.name;
    const nextBranchId = branchId || null;
    setSelectedBranchId(nextBranchId);
    setActiveBranchId(nextBranchId);
    setBranchError('');
    if (nextBranchName) {
      showToast(
        previousCartCount && previousBranchName
          ? `Switched to ${nextBranchName}. Your ${previousBranchName} cart is saved.`
          : `Switched to ${nextBranchName}.`,
        'success',
      );
    }
  };

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
            <div className="mb-3">
              <div>
                <label htmlFor="customer-branch" className="block text-sm font-bold text-[#1C3D2E]">
                  Choose which branch to order from
                </label>
                <p className="mt-0.5 text-xs text-gray-500">Menu availability can vary by location.</p>
              </div>
            </div>
            <Select
              id="customer-branch"
              aria-label="Choose a branch"
              value={activeBranchId || ''}
              onChange={handleBranchChange}
              icon={<LuStore size={18} aria-hidden="true" />}
              disabled={branchesLoaded && branches.length === 0}
              placeholder={branchesLoaded ? 'Select a branch' : 'Loading branches...'}
              options={branches.map((branch) => {
                const itemCount = getBranchCartItemCount(branch.id);
                return {
                  value: branch.id,
                  label: branch.name,
                  description: branch.address || undefined,
                  badge: itemCount > 0
                    ? <span className="shrink-0 rounded-full bg-[var(--oppa-green)] px-2 py-0.5 text-xs font-semibold text-white">{itemCount}</span>
                    : undefined,
                };
              })}
              className="w-full sm:max-w-xl"
              triggerClassName="h-12"
            />
            {branchError && <p className="mt-2 text-sm text-red-600">{branchError}</p>}
          </section>

          <Top3PopularMeals products={products} franchiseId={activeBranchId} onSelectProduct={handleOpenModal} />

          <div className="menu-search mb-6">
            <SearchInput
              aria-label="Search menu dishes"
              placeholder="Search for chicken, rice meals, snacks…"
              value={searchTerm}
              onChange={setSearchTerm}
              resultsCount={filteredProducts.length}
              showResultsCount
              wrapperClassName="w-full"
            />
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
              <p className="text-gray-600 dark:text-gray-300">
                {searchTerm.trim() ? `No dishes found for '${searchTerm.trim()}'` : 'No products found'}
              </p>
              {searchTerm.trim() && <button type="button" onClick={() => setSearchTerm('')} className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/30 dark:text-emerald-300 dark:hover:bg-green-950/60">Clear search</button>}
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
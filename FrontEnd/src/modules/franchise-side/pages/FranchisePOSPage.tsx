import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, CreditCard, Heart, Minus, Plus, Search, ShoppingBag, Smartphone, Store, UserRound } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { fetchWithEmployeeAuth } from '../../../services/employeeAuth';
import { getProductImage } from '../../../data/productImages';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';
import type { Addon, AddonGroup, ProductSize } from '../../../types/product.types';
import type { Product } from '../../../services/productService';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { formatCurrency } from '../../../utils/formatters';

interface PosCartLine {
  key: string;
  product: Product;
  quantity: number;
  selectedSize?: ProductSize;
  selectedAddons: Addon[];
  specialInstructions?: string;
}

interface BranchProduct extends Product {
  branch_stock?: number | null;
  branch_stock_tracked?: boolean;
  branch_enabled?: boolean;
  branch_available?: boolean;
  low_stock?: boolean;
}

interface PosOrder {
  id?: string;
  order_number: string;
  total: number;
  payment_method: string;
  status: string;
  items?: Array<{ product_name?: string; product_price?: number; quantity?: number }>;
  payment_reference?: string;
  cashTendered?: number;
  changeDue?: number;
  customerName?: string;
  diningOption?: 'dine_in' | 'takeout';
  includeCutlery?: boolean;
}

interface PendingPosState {
  cart: Record<string, PosCartLine>;
  customerName: string;
  phone: string;
  diningOption: 'dine_in' | 'takeout';
  discountType: '' | 'PWD' | 'Senior Citizen';
  discountIdNumber: string;
  includeCutlery: boolean;
  customerNotes: string;
}

const pendingPaymentStorageKey = (reference: string) => `franchise_pos_payment_${reference}`;

const FranchisePOSPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
  const location = useLocation();
  const employeeData = (() => {
    try {
      return JSON.parse(localStorage.getItem('employee_auth') || 'null') as {
        id?: string;
        fullName?: string;
        franchise_id?: string | null;
        position?: string;
        franchise?: { name?: string };
      } | null;
    } catch {
      return null;
    }
  })();
  const cashierMode = location.pathname === '/cashier/pos'
    && Boolean(employeeData?.franchise_id && employeeData.position?.toLowerCase() === 'cashier');
  const staffName = cashierMode ? (employeeData?.fullName || 'Cashier') : (franchiseUser?.full_name || 'Manager');
  const branchName = cashierMode
    ? employeeData?.franchise?.name || 'Branch POS Register'
    : franchiseUser?.franchise?.name || 'Branch menu';
  const favoriteStorageKey = `branch_pos_favorites_${cashierMode ? employeeData?.id || employeeData?.franchise_id : franchiseUser?.id || 'manager'}`;
  const fetchPosAuth = useCallback((url: string, init?: RequestInit) =>
    cashierMode ? fetchWithEmployeeAuth(url, init) : fetchWithFranchiseAuth(url, init), [cashierMode]);
  const [products, setProducts] = useState<BranchProduct[]>([]);
  const [cart, setCart] = useState<Record<string, PosCartLine>>({});
  const [configuringProduct, setConfiguringProduct] = useState<BranchProduct | null>(null);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isLoadingAddons, setIsLoadingAddons] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(favoriteStorageKey) || '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  const [stage, setStage] = useState<'menu' | 'checkout'>('menu');
  const [includeCutlery, setIncludeCutlery] = useState(() => {
    try {
      return localStorage.getItem(`branch_pos_cutlery_${favoriteStorageKey}`) === 'true';
    } catch {
      return false;
    }
  });
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [diningOption, setDiningOption] = useState<'dine_in' | 'takeout'>('takeout');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash' | 'credit_card'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [searchParams] = useSearchParams();
  const [cashTendered, setCashTendered] = useState('');
  const [terminalReference, setTerminalReference] = useState('');
  const [discountType, setDiscountType] = useState<'' | 'PWD' | 'Senior Citizen'>('');
  const [discountIdNumber, setDiscountIdNumber] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [completedOrder, setCompletedOrder] = useState<PosOrder | null>(null);

  useEffect(() => {
    const reference = searchParams.get('payment_reference');
    if (reference) {
      void Promise.resolve().then(() => {
        const pendingState = sessionStorage.getItem(pendingPaymentStorageKey(reference));
        if (pendingState) {
          try {
            const saved = JSON.parse(pendingState) as PendingPosState;
            setCart(saved.cart);
            setCustomerName(saved.customerName);
            setPhone(saved.phone);
            setDiningOption(saved.diningOption);
            setDiscountType(saved.discountType);
            setDiscountIdNumber(saved.discountIdNumber);
            setIncludeCutlery(Boolean(saved.includeCutlery));
            setCustomerNotes(saved.customerNotes || '');
          } catch {
            setError('Could not restore the POS order associated with this payment. Do not charge the customer again; contact HQ with the payment reference.');
            return;
          }
        }
        setPaymentReference(reference);
        setPaymentMethod('gcash');
        setPaymentCheckoutUrl('');
      });
    }
  }, [searchParams]);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetchPosAuth(`${API_URL}${cashierMode ? '/employee/pos/products' : '/franchise/products'}`);
        if (!response.ok) {
          throw new Error('Could not load the branch menu. Please sign in again or retry.');
        }
        const payload = await response.json();
        const branchProducts = Array.isArray(payload) ? payload : payload.data;
        setProducts((branchProducts || [])
          .map((product: Product) => ({
            ...product,
            price: Number(product.price),
            image: getProductImage(product.image || ''),
          })) as BranchProduct[]);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load the branch menu.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadProducts();
  }, [cashierMode, fetchPosAuth]);

  useEffect(() => {
    localStorage.setItem(favoriteStorageKey, JSON.stringify(favoriteIds));
  }, [favoriteIds, favoriteStorageKey]);

  useEffect(() => {
    localStorage.setItem(`branch_pos_cutlery_${favoriteStorageKey}`, String(includeCutlery));
  }, [favoriteStorageKey, includeCutlery]);

  const lines = Object.values(cart);
  const subtotal = Math.round(lines.reduce((sum, line) => sum + (Number(line.product.price) + line.selectedAddons.reduce((addonTotal, addon) => addonTotal + Number(addon.price) * Math.max(1, Number(addon.quantity || 1)), 0)) * line.quantity, 0));
  const discountAmount = discountType ? Math.round(subtotal * 0.20) : 0;
  const total = Math.max(0, Math.round(subtotal - discountAmount));
  const tenderedAmount = Number(cashTendered || 0);
  const changeDue = Math.max(0, Math.round(tenderedAmount - total));
  const filteredProducts = useMemo(
    () => products.filter((product) => {
      const matchesSearch = `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'all' || product.category.toLowerCase() === activeCategory;
      const matchesFavorite = !showFavoritesOnly || favoriteIds.includes(product.id);
      return matchesSearch && matchesCategory && matchesFavorite;
    }),
    [products, search, activeCategory, favoriteIds, showFavoritesOnly],
  );
  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))], [products]);

  const openProduct = async (product: BranchProduct) => {
    setConfiguringProduct(product);
    setAddonGroups([]);
    setSelectedAddons([]);
    setSelectedSize(['fruity-soda-milk', 'fresh-lemonade'].includes(product.category.toLowerCase()) ? 'Medium' : null);
    setSpecialInstructions('');
    setError('');
    setIsLoadingAddons(true);
    try {
      const params = new URLSearchParams({ category: product.category, product_id: product.id });
      const response = await fetchPosAuth(`${API_URL}${cashierMode ? '/employee/pos/addon-groups' : '/franchise/addon-groups'}?${params}`);
      const payload = await response.json().catch(() => []);
      if (!response.ok) throw new Error(payload.message || 'Could not load product options.');
      setAddonGroups(Array.isArray(payload) ? payload : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load product options.');
    } finally {
      setIsLoadingAddons(false);
    }
  };

  const addConfiguredProduct = () => {
    if (!configuringProduct) return;
    if (['fruity-soda-milk', 'fresh-lemonade'].includes(configuringProduct.category.toLowerCase()) && !selectedSize) {
      setError('Choose a size before adding this drink.');
      return;
    }
    const sizeAdjustment = selectedSize === 'Small' ? -10 : selectedSize === 'Large' ? 20 : 0;
    const configuredProduct = { ...configuringProduct, price: Math.max(0, Number(configuringProduct.price) + sizeAdjustment) };
    const sortedAddonIds = selectedAddons.map((addon) => addon.id).sort().join(',');
    const key = `${configuringProduct.id}:${selectedSize || ''}:${sortedAddonIds}`;
    setCart((current) => ({
      ...current,
      [key]: {
        key,
        product: configuredProduct,
        quantity: (current[key]?.quantity || 0) + 1,
        selectedSize: selectedSize || undefined,
        selectedAddons,
        specialInstructions: specialInstructions.trim() || undefined,
      },
    }));
    setPaymentReference('');
    setPaymentCheckoutUrl('');
    setPaymentConfirmed(false);
    setConfiguringProduct(null);
    setError('');
    setSuccess('');
    setCompletedOrder(null);
  };

  const setQuantity = (lineKey: string, quantity: number) => {
    setCart((current) => {
      const next = { ...current };
      if (quantity <= 0) {
        delete next[lineKey];
      } else {
        next[lineKey] = { ...next[lineKey], quantity };
      }
      return next;
    });
    setPaymentReference('');
    setPaymentCheckoutUrl('');
    setPaymentConfirmed(false);
    setTerminalReference('');
    setSuccess('');
    setCompletedOrder(null);
  };

  const paymentItems = () => lines.map(({ product, quantity, selectedSize, selectedAddons, specialInstructions: itemNotes }) => ({
    product_id: product.id,
    quantity,
    selected_size: selectedSize,
    selected_addons: selectedAddons.map(({ id, quantity: addonQuantity }) => ({ id, quantity: addonQuantity || 1 })),
    special_instructions: itemNotes,
  }));

  const startGatewayPayment = async () => {
    if (lines.length === 0) {
      setError('Add at least one item before starting payment.');
      return;
    }
    if (discountType && !discountIdNumber.trim()) {
      setError(`Enter the customer's ${discountType} ID number.`);
      return;
    }

    setIsStartingPayment(true);
    setError('');
    setPaymentConfirmed(false);
    try {
      const response = await fetchPosAuth(`${API_URL}${cashierMode ? '/employee/pos/payments/gcash' : '/franchise/pos/payments/gcash'}`, {
        method: 'POST',
        body: JSON.stringify({
          items: paymentItems(),
          payment_method: 'gcash',
          discount_type: discountType || undefined,
          discount_id_number: discountType ? discountIdNumber.trim() : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not start GCash payment.');
      const pendingState: PendingPosState = {
        cart,
        customerName,
        phone,
        diningOption,
        discountType,
        discountIdNumber,
        includeCutlery,
        customerNotes,
      };
      sessionStorage.setItem(pendingPaymentStorageKey(payload.data.reference), JSON.stringify(pendingState));
      setPaymentReference(payload.data.reference);
      setPaymentCheckoutUrl(payload.data.checkout_url || '');
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'Could not start GCash payment.');
    } finally {
      setIsStartingPayment(false);
    }
  };

  const verifyGatewayPayment = async () => {
    if (!paymentReference) return;
    setError('');
    try {
      const response = await fetch(`${API_URL}/payment/status/${encodeURIComponent(paymentReference)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not verify payment status.');
      if (!payload.confirmed) {
        setPaymentConfirmed(false);
        throw new Error(`Payment is not confirmed yet (status: ${payload.status || 'pending'}).`);
      }
      if (Math.round(Number(payload.amount)) !== total) {
        setPaymentConfirmed(false);
        throw new Error('The confirmed payment amount does not match the current order total.');
      }
      setPaymentConfirmed(true);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Could not verify payment status.');
    }
  };

  const submitOrder = async () => {
    if (lines.length === 0) {
      setError('Add at least one menu item to the order.');
      return;
    }
    if (discountType && !discountIdNumber.trim()) {
      setError(`Enter the customer's ${discountType} ID number.`);
      return;
    }
    if (paymentMethod === 'gcash' && (!paymentReference.trim() || !paymentConfirmed)) {
      setError('Complete and verify the GCash payment before placing the order.');
      return;
    }
    if (paymentMethod === 'credit_card' && !terminalReference.trim()) {
      setError('Enter the card terminal transaction reference.');
      return;
    }
    if (paymentMethod === 'cash' && tenderedAmount < total) {
      setError('Cash received must be at least the order total.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetchPosAuth(`${API_URL}${cashierMode ? '/employee/pos/orders' : '/franchise/pos/orders'}`, {
        method: 'POST',
        body: JSON.stringify({
          items: paymentItems(),
          customer_name: customerName.trim() || 'Walk-in Customer',
          phone: phone.trim(),
          dining_option: diningOption,
          payment_method: paymentMethod,
          payment_reference: paymentMethod === 'gcash' ? paymentReference.trim() : undefined,
          terminal_reference: paymentMethod === 'credit_card' ? terminalReference.trim() : undefined,
          cash_tendered: paymentMethod === 'cash' ? tenderedAmount : undefined,
          discount_type: discountType || undefined,
          discount_id_number: discountType ? discountIdNumber.trim() : undefined,
          include_cutlery: includeCutlery,
          notes: [customerNotes.trim(), ...lines.map((line) => line.specialInstructions || '')].filter(Boolean).join('; ') || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'The POS order could not be completed.');
      }

      setCompletedOrder({
        ...result.order,
        cashTendered: paymentMethod === 'cash' ? tenderedAmount : undefined,
        changeDue: paymentMethod === 'cash' ? Number(result.change_due || 0) : undefined,
        customerName: customerName.trim() || 'Walk-in Customer',
        diningOption,
        includeCutlery,
      });
      setSuccess(`Order ${result.order.order_number} completed. Change due: ${formatCurrency(Number(result.change_due || 0))}.`);
      if (paymentReference) {
        sessionStorage.removeItem(pendingPaymentStorageKey(paymentReference));
      }
      setCart({});
      setPaymentReference('');
      setPaymentCheckoutUrl('');
      setPaymentConfirmed(false);
      setTerminalReference('');
      setDiscountType('');
      setDiscountIdNumber('');
      setStage('menu');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The POS order could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf6ed] text-[#24312b]">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-[#078000] px-4 text-white shadow-md sm:px-6">
        <Link to={cashierMode ? '/cashier/pos' : '/franchise/pos'} className="flex min-w-0 items-center gap-3">
          <img src={oppaDruLogo} alt="" className="size-9 rounded-full border border-white/30 object-cover" />
          <span className="min-w-0"><strong className="block truncate font-serif text-sm sm:text-base">Oppa Dru Korean Fried Chicken</strong><small className="block text-[9px] font-semibold uppercase tracking-wide text-white/75">Onsite POS Register · {cashierMode ? 'Cashier' : 'Branch Manager'}</small></span>
        </Link>
        <nav className="flex shrink-0 items-center gap-3 text-xs font-semibold sm:gap-5 sm:text-sm">
          <Link to={cashierMode ? '/cashier/transactions' : '/franchise/orders'} className="flex items-center gap-1.5 hover:text-white/80"><ClipboardList size={16} /><span className="hidden sm:inline">Onsite Orders</span></Link>
          <button type="button" onClick={() => { setShowFavoritesOnly((value) => !value); setStage('menu'); }} className={`flex items-center gap-1.5 ${showFavoritesOnly ? 'text-yellow-200' : 'hover:text-white/80'}`}><Heart size={16} fill={showFavoritesOnly ? 'currentColor' : 'none'} /><span className="hidden sm:inline">Favorites</span></button>
          <span className="flex items-center gap-1.5 border-l border-white/20 pl-3 sm:pl-5"><span className="flex size-7 items-center justify-center rounded-full bg-white/15"><UserRound size={15} /></span><span className="hidden sm:inline">{staffName.split(' ')[0]}</span></span>
        </nav>
      </header>

      {error && <div role="alert" className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-6">{error}</div>}
      {success && <div role="status" className="mx-4 mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 sm:mx-6">{success}</div>}

      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="hidden border-r border-gray-100 bg-white p-5 lg:block">
          <div className="mb-5 border-b border-gray-100 pb-4"><h2 className="font-serif text-xl font-bold text-[#1c3d2e]">Register Menu</h2><p className="mt-1 text-xs text-gray-500">Select category to filter items</p></div>
          <nav className="flex flex-col gap-1" aria-label="Product categories">
            {[{ id: 'all', label: 'All' }, ...categories.map((category) => ({ id: category.toLowerCase(), label: category.replaceAll('-', ' ') }))].map(({ id, label }) => (
              <button key={id} type="button" onClick={() => { setActiveCategory(id); setShowFavoritesOnly(false); setStage('menu'); }} className={`flex items-center rounded-xl px-3 py-3 text-left text-sm capitalize ${activeCategory === id && !showFavoritesOnly ? 'bg-[#e3efe7] font-semibold text-[#1c3d2e]' : 'text-gray-600 hover:bg-gray-50'}`}><span className="flex-1">{label}</span>{activeCategory === id && !showFavoritesOnly && <span className="h-5 w-1 rounded-full bg-[#c1440e]" />}</button>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 p-4 sm:p-6">
          {stage === 'menu' ? (
            <>
              <section className="mb-5 rounded-2xl bg-[#078000] p-5 text-white shadow-md sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="font-serif text-xl font-bold sm:text-2xl">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, {staffName.split(' ')[0]}!</h1><p className="mt-1 text-sm text-white/85">Onsite POS Register active & ready · {branchName}</p></div><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Store size={13} className="mr-1 inline" />Branch Counter</span></div>
                <div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => <button key={category} type="button" onClick={() => { setActiveCategory(category.toLowerCase()); setShowFavoritesOnly(false); }} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold capitalize hover:bg-white/20">{category.replaceAll('-', ' ')}</button>)}</div>
              </section>
              <label className="relative mb-5 block"><Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu items for customer order..." className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm shadow-sm focus:border-[#1c3d2e] focus:outline-none" /></label>
              {isLoading ? <p className="py-12 text-center text-sm text-gray-500">Loading branch menu...</p> : filteredProducts.length === 0 ? <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">{showFavoritesOnly ? 'No favorite products saved for this register.' : 'No available products at this branch.'}</div> : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((product) => <article key={product.id} className={`overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition ${product.branch_available ? 'hover:-translate-y-0.5 hover:shadow-lg' : 'opacity-60'}`}>
                    <div className="relative h-40 bg-gradient-to-br from-emerald-500 to-emerald-700 sm:h-44">{product.image && <img src={product.image} alt={product.name} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                      <span className="absolute bottom-3 right-3 rounded-full bg-[#287d49] px-3 py-1.5 text-xs font-bold text-white shadow">{formatCurrency(Number(product.price))}</span>
                      <button type="button" aria-label={`${favoriteIds.includes(product.id) ? 'Remove' : 'Add'} ${product.name} ${favoriteIds.includes(product.id) ? 'from' : 'to'} favorites`} onClick={() => setFavoriteIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow hover:text-red-500"><Heart size={17} fill={favoriteIds.includes(product.id) ? 'currentColor' : 'none'} className={favoriteIds.includes(product.id) ? 'text-red-500' : ''} /></button>
                      {!product.branch_available && <span className="absolute left-3 top-3 rounded-full bg-red-600/90 px-2.5 py-1 text-[10px] font-bold text-white">{product.branch_stock_tracked && product.branch_stock === 0 ? 'Out of stock' : 'Unavailable'}</span>}
                    </div>
                    <div className="flex min-h-32 flex-col p-3.5"><h2 className="font-serif text-sm font-bold text-gray-800">{product.name}</h2><p className="mt-1 line-clamp-2 flex-1 text-xs text-gray-500">{product.description || 'Freshly prepared at this branch.'}</p>{product.branch_stock_tracked && <p className="mt-1 text-[10px] text-gray-500">{product.branch_stock} in branch stock</p>}<button type="button" disabled={!product.branch_available} onClick={() => void openProduct(product)} className="mt-3 w-full rounded-xl bg-[#c1440e] py-2.5 text-xs font-bold text-white hover:bg-[#a23a0c] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600">Add to Order</button></div>
                  </article>)}
                </div>
              )}
            </>
          ) : (
            <div className="mx-auto max-w-3xl">
              <div className="mb-5 flex items-center gap-3 border-b border-[#e76f51]/20 pb-3"><button type="button" onClick={() => setStage('menu')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#2d6a4f]"><ArrowLeft size={17} /> Back to Register Menu</button><span className="text-gray-300">|</span><h1 className="font-serif text-lg font-bold text-[#2d6a4f]">POS Register Checkout (Onsite)</h1></div>
              <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold">Dining Option</h2><div className="grid grid-cols-2 gap-2">{(['dine_in', 'takeout'] as const).map((option) => <button key={option} type="button" onClick={() => setDiningOption(option)} className={`rounded-xl border px-4 py-3 text-sm font-semibold capitalize ${diningOption === option ? 'border-[#2d6a4f] bg-[#e3efe7] text-[#2d6a4f]' : 'border-gray-200'}`}>{option === 'dine_in' ? 'Dine-in' : 'Takeout'}</button>)}</div>
              </section>
              <section className="mb-4 space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold">Customer Details (Optional)</h2><div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Customer name / callout<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Walk-in Customer" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal normal-case" /></label><label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Contact / phone #<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="09XX XXX XXXX (optional)" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal normal-case" /></label></div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Order notes / kitchen instructions<textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} placeholder="E.g., extra crispy, sauce on the side, no onions" maxLength={500} rows={2} className="mt-1 w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal normal-case" /></label>
              </section>
              <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="mb-3 text-sm font-bold">Discounts</h2><div className="flex flex-wrap gap-2">{[{ value: '', label: 'Regular (No Discount)' }, { value: 'Senior Citizen', label: 'Senior Citizen (20%)' }, { value: 'PWD', label: 'PWD (20%)' }].map(({ value, label }) => <button key={value || 'regular'} type="button" onClick={() => { setDiscountType(value as typeof discountType); setPaymentReference(''); setPaymentConfirmed(false); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${discountType === value ? 'bg-[#2d6a4f] text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>)}</div>{discountType && <label className="mt-3 block text-xs font-semibold"> {discountType} ID Card Number<input value={discountIdNumber} onChange={(event) => setDiscountIdNumber(event.target.value)} placeholder={`Enter ${discountType} ID #`} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal" /></label>}</section>
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-bold">Payment Processing</h2><div className="grid grid-cols-3 gap-2">{[{ value: 'cash', label: 'Cash', Icon: CheckCircle2 }, { value: 'gcash', label: 'GCash', Icon: Smartphone }, { value: 'credit_card', label: 'Card / Terminal', Icon: CreditCard }].map(({ value, label, Icon }) => <button key={value} type="button" onClick={() => { setPaymentMethod(value as typeof paymentMethod); setPaymentReference(''); setTerminalReference(''); setPaymentCheckoutUrl(''); setPaymentConfirmed(false); }} className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold ${paymentMethod === value ? 'border-[#2d6a4f] bg-[#e3efe7] text-[#2d6a4f]' : 'border-gray-200'}`}><Icon size={19} />{label}</button>)}</div>
                {paymentMethod === 'cash' && <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3"><label className="block text-[10px] font-bold uppercase text-gray-600">Cash tendered · Amount due {formatCurrency(total)}<input type="number" min={total} step="0.01" value={cashTendered} onChange={(event) => setCashTendered(event.target.value)} placeholder="₱ 0" className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base font-normal" /></label><div className="mt-2 flex flex-wrap gap-2">{[total, 100, 200, 500, 1000].filter((amount, index, values) => values.indexOf(amount) === index).map((amount) => <button key={amount} type="button" onClick={() => setCashTendered(String(amount))} className="rounded-md border bg-white px-2.5 py-1 text-[10px] font-semibold">{amount === total ? 'Exact' : `${formatCurrency(amount)}`}</button>)}</div><p className="mt-2 flex justify-between border-t pt-2 text-sm"><span>Change Due</span><strong>{formatCurrency(changeDue)}</strong></p></div>}
                {paymentMethod === 'credit_card' && <label className="mt-4 block text-[10px] font-bold uppercase text-gray-600">POS Terminal / Card Reference<input value={terminalReference} onChange={(event) => setTerminalReference(event.target.value)} placeholder="Enter terminal transaction #" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal normal-case" /></label>}
                {paymentMethod === 'gcash' && <div className="mt-4 space-y-2 rounded-xl bg-[#edf5ef] p-3 text-sm">{!paymentReference ? <button type="button" onClick={() => void startGatewayPayment()} disabled={isStartingPayment || lines.length === 0} className="w-full rounded-lg bg-[#2d6a4f] px-3 py-2.5 font-semibold text-white disabled:opacity-50">{isStartingPayment ? 'Starting secure payment...' : `Start GCash payment · ${formatCurrency(total)}`}</button> : <><p>Payment reference: <strong>{paymentReference}</strong></p>{paymentCheckoutUrl && <a href={paymentCheckoutUrl} target="_blank" rel="noreferrer" className="block rounded-lg border border-[#2d6a4f] bg-white px-3 py-2 text-center font-semibold text-[#2d6a4f]">Open GCash checkout</a>}<button type="button" onClick={() => void verifyGatewayPayment()} className={`w-full rounded-lg px-3 py-2.5 font-semibold ${paymentConfirmed ? 'bg-green-100 text-green-800' : 'border border-gray-300 bg-white'}`}>{paymentConfirmed ? 'Payment confirmed' : 'Check gateway payment status'}</button>{!paymentConfirmed && <button type="button" onClick={() => { setPaymentReference(''); setPaymentCheckoutUrl(''); }} className="w-full text-xs text-gray-500 underline">Start a different payment</button>}</>}</div>}
              </section>
            </div>
          )}
        </main>

        <aside className="flex min-h-[420px] flex-col border-l border-gray-100 bg-white lg:col-span-2 xl:col-span-1 xl:row-span-1">
          <div className="border-b border-gray-200 px-5 py-4"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold"><ShoppingBag size={19} /> Current Order</h2>{lines.length > 0 && <button type="button" onClick={() => { setCart({}); setPaymentReference(''); setTerminalReference(''); setPaymentCheckoutUrl(''); setPaymentConfirmed(false); }} className="text-xs font-medium text-red-600 hover:underline">Clear</button>}</div><p className="mt-0.5 text-sm text-gray-500">{lines.length ? `${lines.length} item${lines.length === 1 ? '' : 's'} added` : 'No items added yet'}</p></div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">{lines.map(({ key, product, quantity, selectedSize, selectedAddons }) => <div key={key} className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3 text-sm"><div className="min-w-0"><p className="font-medium">{quantity}x {product.name}</p>{selectedSize && <p className="text-xs text-gray-500">{selectedSize}</p>}{selectedAddons.map((addon) => <p key={addon.id} className="text-xs text-gray-500">+ {addon.name}</p>)}<p className="mt-1 text-xs font-semibold">{formatCurrency(((Number(product.price) + selectedAddons.reduce((sum, addon) => sum + Number(addon.price) * Math.max(1, Number(addon.quantity || 1)), 0)) * quantity))}</p></div><div className="flex items-center gap-2"><button type="button" aria-label={`Remove one ${product.name}`} onClick={() => setQuantity(key, quantity - 1)} className="rounded-full border p-1"><Minus size={13} /></button><span>{quantity}</span><button type="button" aria-label={`Add one ${product.name}`} onClick={() => setQuantity(key, quantity + 1)} className="rounded-full border p-1"><Plus size={13} /></button></div></div>)}
            {!lines.length && <div className="flex min-h-52 flex-col items-center justify-center text-center"><span className="mb-3 flex size-16 items-center justify-center rounded-full bg-gray-100 text-gray-400"><ShoppingBag size={27} /></span><strong className="text-gray-700">Order Register Empty</strong><p className="mt-1 text-xs text-gray-400">Tap items on the menu to begin taking an order</p></div>}
          </div>
          <div className="border-t border-gray-200">
            <div className="flex justify-between px-5 py-3 text-sm"><span className="text-gray-500">Order Subtotal</span><strong>{lines.length ? `${formatCurrency(subtotal)}` : '—'}</strong></div>
            <label className="flex cursor-pointer items-center justify-between border-t border-gray-100 px-5 py-3 text-sm"><span>Include Cutlery / Utensils</span><input type="checkbox" checked={includeCutlery} onChange={(event) => setIncludeCutlery(event.target.checked)} className="size-4 accent-[#2d6a4f]" /></label>
            <div className="p-4">{stage === 'menu' ? <button type="button" disabled={!lines.length} onClick={() => setStage('checkout')} className="w-full rounded-xl bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] px-4 py-3.5 text-left font-bold text-white shadow hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"><span className="flex items-center justify-between"><span>Charge / Pay</span><span>{formatCurrency(total)} →</span></span></button> : <div className="space-y-2 border-t pt-3 text-sm"><div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>{discountType && <div className="flex justify-between text-emerald-700"><span>Special Discount</span><span>-{formatCurrency(discountAmount)}</span></div>}<div className="flex justify-between text-xs text-gray-500"><span>VAT (12% inclusive)</span><span>{formatCurrency((total * 0.12))}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Total</span><span className="text-[#2d6a4f]">{formatCurrency(total)}</span></div><button type="button" onClick={() => void submitOrder()} disabled={isSubmitting || isLoading || !lines.length} className="w-full rounded-xl bg-[#2d6a4f] py-3.5 font-bold text-white hover:bg-[#1b4d3e] disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? 'Processing Sale...' : `Charge ${formatCurrency(total)}`}</button></div>}</div>
          </div>
        </aside>
      </div>

      {completedOrder && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="branch-pos-receipt-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center gap-2 text-[#2d6a4f]"><CheckCircle2 size={22} /><h2 id="branch-pos-receipt-title" className="text-lg font-bold">Order processed successfully</h2></div><p className="text-center font-serif text-lg font-bold">OPPA DRU KOREAN FRIED CHICKEN</p><p className="mb-4 text-center text-xs text-gray-500">ONSITE REGISTER RECEIPT · {branchName}</p><div className="space-y-2 border-y border-dashed py-3 text-sm"><p className="flex justify-between"><span>Order #</span><strong>{completedOrder.order_number}</strong></p><p className="flex justify-between"><span>Customer</span><span>{completedOrder.customerName}</span></p><p className="flex justify-between"><span>Dining</span><span>{completedOrder.diningOption === 'dine_in' ? 'Dine-in' : 'Takeout'}</span></p>{(completedOrder.items || []).map((item, index) => <p key={`${item.product_name}-${index}`} className="flex justify-between"><span>{item.quantity}x {item.product_name}</span><span>{formatCurrency((Number(item.product_price || 0) * Number(item.quantity || 1)))}</span></p>)}<p className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(Number(completedOrder.total))}</span></p><p className="flex justify-between text-xs text-gray-500"><span>Payment</span><span className="uppercase">{completedOrder.payment_method.replace('_', ' ')}</span></p>{completedOrder.payment_method === 'cash' && <><p className="flex justify-between text-xs"><span>Cash Tendered</span><span>{formatCurrency(Number(completedOrder.cashTendered || 0))}</span></p><p className="flex justify-between text-xs"><span>Change</span><span>{formatCurrency(Number(completedOrder.changeDue || 0))}</span></p></>}{completedOrder.includeCutlery && <p className="text-xs">Cutlery / utensils included</p>}</div><div className="mt-5 flex gap-2"><button type="button" onClick={() => window.print()} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold">Print Receipt</button><button type="button" onClick={() => { setCompletedOrder(null); setSuccess(''); setCustomerName(''); setPhone(''); setCustomerNotes(''); }} className="flex-1 rounded-xl bg-[#2d6a4f] py-2.5 text-sm font-semibold text-white">New Order</button></div></section></div>}

      {configuringProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={() => setConfiguringProduct(null)}>
          <section role="dialog" aria-modal="true" aria-label={`${configuringProduct.name} options`} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-semibold">{configuringProduct.name}</h2><p className="mt-1 text-sm text-gray-500">Base price {formatCurrency(Number(configuringProduct.price))}</p></div>
              <button onClick={() => setConfiguringProduct(null)} aria-label="Close options" className="rounded-lg px-3 py-1 text-gray-500 hover:bg-gray-100">Close</button>
            </div>
            {['fruity-soda-milk', 'fresh-lemonade'].includes(configuringProduct.category.toLowerCase()) && (
              <fieldset className="mb-5">
                <legend className="mb-2 text-sm font-semibold">Drink size</legend>
                <div className="grid grid-cols-3 gap-2">{(['Small', 'Medium', 'Large'] as const).map((size) => {
                  const adjustment = size === 'Small' ? -10 : size === 'Large' ? 20 : 0;
                  return <button key={size} type="button" onClick={() => setSelectedSize(size)} className={`rounded-xl border px-3 py-3 text-sm ${selectedSize === size ? 'border-[var(--oppa-green)] bg-[#edf5ef] font-semibold text-[var(--oppa-green)]' : 'border-gray-200'}`}>{size}<span className="mt-1 block text-xs">{adjustment > 0 ? `+${formatCurrency(adjustment)}` : adjustment < 0 ? `-${formatCurrency(Math.abs(adjustment))}` : 'Standard'}</span></button>;
                })}</div>
              </fieldset>
            )}
            {isLoadingAddons ? <p className="py-4 text-sm text-gray-500">Loading available add-ons...</p> : addonGroups.map((group) => (
              <fieldset key={group.id} className="mb-5">
                <legend className="mb-2 text-sm font-semibold">{group.name}</legend>
                <div className="space-y-2">{group.addons.filter((addon) => addon.is_active !== false && addon.is_available !== false).map((addon) => {
                  const checked = selectedAddons.some((selected) => selected.id === addon.id);
                  return <label key={addon.id} className="flex cursor-pointer items-center gap-3 rounded-xl bg-gray-50 p-3 hover:bg-[#edf5ef]">
                    <input type={group.selection_type === 'single' ? 'radio' : 'checkbox'} name={`pos-addon-group-${group.id}`} checked={checked} onChange={() => setSelectedAddons((current) => {
                      if (group.selection_type === 'single') {
                        const withoutGroup = current.filter((selected) => !group.addons.some((option) => option.id === selected.id));
                        return checked ? withoutGroup : [...withoutGroup, addon];
                      }
                      return checked ? current.filter((selected) => selected.id !== addon.id) : [...current, addon];
                    })} />
                    <span className="flex-1 text-sm">{addon.name}</span><span className="text-sm font-medium">+{formatCurrency(Number(addon.price))}</span>
                  </label>;
                })}</div>
              </fieldset>
            ))}
            <label className="mb-5 block text-sm font-semibold">Special instructions<textarea value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} maxLength={500} rows={2} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" placeholder="Optional request for the kitchen" /></label>
            {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <button type="button" disabled={isLoadingAddons} onClick={addConfiguredProduct} className="w-full rounded-xl bg-[var(--oppa-green)] px-4 py-3 font-semibold text-white disabled:opacity-50">Add to order · {formatCurrency((Math.max(0, Number(configuringProduct.price) + (selectedSize === 'Small' ? -10 : selectedSize === 'Large' ? 20 : 0)) + selectedAddons.reduce((sum, addon) => sum + Number(addon.price), 0)))}</button>
          </section>
        </div>
      )}
    </div>
  );
};

export default FranchisePOSPage;

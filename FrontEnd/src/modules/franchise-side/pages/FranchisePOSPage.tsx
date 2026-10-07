import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, ClipboardList, CreditCard, Heart, Minus, Plus, Search, ShoppingBag, Smartphone, Store, Trash2, UserRound, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { fetchWithEmployeeAuth } from '../../../services/employeeAuth';
import { getProductImage } from '../../../data/productImages';
import oppaDruLogo from '../../../assets/oppadrulogo.jpg';
import type { Addon, AddonGroup, ProductSize } from '../../../types/product.types';
import type { Product } from '../../../services/productService';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import { formatPeso } from '../../../utils/formatters';

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
  is_best_seller?: boolean;
  best_seller?: boolean;
}

interface PosOrder {
  id?: string;
  order_number: string;
  total: number;
  payment_method: string;
  status: string;
  items?: Array<{
    product_name?: string;
    product_price?: number;
    quantity?: number;
    selected_addons?: Array<{ price?: number; quantity?: number }>;
  }>;
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
  discountCardholderName?: string;
  includeCutlery: boolean;
  customerNotes: string;
  tableNumber?: string;
}

const pendingPaymentStorageKey = (reference: string) => `franchise_pos_payment_${reference}`;
const isBranchProductAvailable = (product: BranchProduct) =>
  product.branch_available ?? product.is_available ?? product.isAvailable ?? true;
const isBranchProductLowStock = (product: BranchProduct) =>
  Boolean(product.low_stock || (product.branch_stock_tracked && product.branch_stock !== null
    && product.branch_stock !== undefined && product.branch_stock > 0 && product.branch_stock <= 5));

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
  const cartStorageKey = `branch_pos_cart_${cashierMode ? employeeData?.id || employeeData?.franchise_id : franchiseUser?.id || 'manager'}`;
  const fetchPosAuth = useCallback((url: string, init?: RequestInit) =>
    cashierMode ? fetchWithEmployeeAuth(url, init) : fetchWithFranchiseAuth(url, init), [cashierMode]);
  const [products, setProducts] = useState<BranchProduct[]>([]);
  const [cart, setCart] = useState<Record<string, PosCartLine>>(() => {
    try {
      const saved = localStorage.getItem(cartStorageKey);
      return saved ? JSON.parse(saved) as Record<string, PosCartLine> : {};
    } catch {
      return {};
    }
  });
  const [configuringProduct, setConfiguringProduct] = useState<BranchProduct | null>(null);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [isLoadingAddons, setIsLoadingAddons] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showBestSellersOnly, setShowBestSellersOnly] = useState(false);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [showOrderDrawer, setShowOrderDrawer] = useState(false);
  const [editingNotesKey, setEditingNotesKey] = useState<string | null>(null);
  const [removedLine, setRemovedLine] = useState<PosCartLine | null>(null);
  const [cashierClock, setCashierClock] = useState(() => new Date());
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
  const [tableNumber, setTableNumber] = useState('');
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
  const [discountCardholderName, setDiscountCardholderName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [completedOrder, setCompletedOrder] = useState<PosOrder | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const handleSearchShortcut = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
        && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleSearchShortcut);
    return () => window.removeEventListener('keydown', handleSearchShortcut);
  }, []);

  useEffect(() => {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey]);

  useEffect(() => {
    const interval = window.setInterval(() => setCashierClock(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!removedLine) return;
    const timeout = window.setTimeout(() => setRemovedLine(null), 6000);
    return () => window.clearTimeout(timeout);
  }, [removedLine]);

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
            setDiscountCardholderName(saved.discountCardholderName || '');
            setIncludeCutlery(Boolean(saved.includeCutlery));
            setCustomerNotes(saved.customerNotes || '');
            setTableNumber(saved.tableNumber || '');
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
            image: product.image && !['/oppadrulogo.jpg', 'oppadrulogo.jpg'].includes(product.image)
              ? getProductImage(product.image)
              : '',
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
  const itemCount = lines.reduce((count, line) => count + line.quantity, 0);
  const subtotal = Math.round(lines.reduce((sum, line) => sum + (Number(line.product.price) + line.selectedAddons.reduce((addonTotal, addon) => addonTotal + Number(addon.price) * Math.max(1, Number(addon.quantity || 1)), 0)) * line.quantity, 0));
  const vatExemptBase = discountType ? Math.round(subtotal / 1.12) : 0;
  const discountAmount = discountType ? Math.round(vatExemptBase * 0.20) : 0;
  const total = discountType ? Math.max(0, vatExemptBase - discountAmount) : subtotal;
  const tenderedAmount = Number(cashTendered || 0);
  const changeDue = Math.max(0, Math.round((tenderedAmount - total) * 100) / 100);
  const quantityForProduct = (productId: string) =>
    lines.filter((line) => line.product.id === productId).reduce((quantity, line) => quantity + line.quantity, 0);
  const filteredProducts = useMemo(
    () => products.filter((product) => {
      const matchesSearch = `${product.name} ${product.category} ${product.description || ''}`.toLowerCase().includes(debouncedSearch);
      const matchesCategory = activeCategory === 'all' || product.category.toLowerCase() === activeCategory;
      const matchesFavorite = !showFavoritesOnly || favoriteIds.includes(product.id);
      const matchesBestSeller = !showBestSellersOnly || Boolean(product.is_best_seller || product.best_seller);
      const matchesAvailability = !showAvailableOnly || isBranchProductAvailable(product);
      return matchesSearch && matchesCategory && matchesFavorite && matchesBestSeller && matchesAvailability;
    }),
    [products, debouncedSearch, activeCategory, favoriteIds, showFavoritesOnly, showBestSellersOnly, showAvailableOnly],
  );
  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))], [products]);
  const categoryCount = (category: string) => category === 'all'
    ? products.length
    : products.filter((product) => product.category.toLowerCase() === category).length;
  const greetingTime = Number(new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(cashierClock));
  const greeting = greetingTime < 12 ? 'Morning' : greetingTime < 18 ? 'Afternoon' : 'Evening';
  const manilaDateTime = cashierClock.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const quickCashAmounts = [50, 100, 500, 1000, 1500]
    .map((denomination) => Math.ceil(total / denomination) * denomination)
    .filter((amount, index, amounts) => amount > total && amounts.indexOf(amount) === index)
    .slice(0, 4);
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneIsValid = !phoneDigits || /^09\d{9}$/.test(phoneDigits);
  const paymentIsValid = paymentMethod === 'cash'
    ? tenderedAmount >= total
    : paymentMethod === 'gcash'
      ? Boolean(paymentReference.trim() && paymentConfirmed)
      : Boolean(terminalReference.trim());
  const chargeDisabled = !lines.length || isSubmitting || isLoading
    || Boolean(discountType && (!discountIdNumber.trim() || !discountCardholderName.trim()))
    || !phoneIsValid || !paymentIsValid;
  const chargeHelperText = lines.length === 0
    ? 'Add items before charging.'
    : !phoneIsValid
      ? 'Enter a valid Philippine mobile number (09XX XXX XXXX).'
      : discountType && !discountIdNumber.trim()
        ? `Enter the ${discountType} ID number.`
        : discountType && !discountCardholderName.trim()
          ? `Enter the ${discountType} cardholder name.`
          : paymentMethod === 'cash' && tenderedAmount < total
            ? `Enter cash tendered ≥ ${formatPeso(total)}.`
            : paymentMethod === 'gcash' && !paymentConfirmed
              ? 'Complete and verify the GCash payment.'
              : paymentMethod === 'credit_card' && !terminalReference.trim()
                ? 'Enter the card terminal approval code.'
                : '';

  const adjustProductQuantity = (product: BranchProduct, adjustment: number) => {
    const existingLine = lines.find((line) => line.product.id === product.id);
    if (adjustment > 0 && !isBranchProductAvailable(product)) return;
    if (!existingLine) {
      if (adjustment > 0) void openProduct(product);
      return;
    }
    setQuantity(existingLine.key, existingLine.quantity + adjustment);
  };

  const removeCartLine = (line: PosCartLine) => {
    setRemovedLine(line);
    setCart((current) => {
      const next = { ...current };
      delete next[line.key];
      return next;
    });
    setPaymentReference('');
    setPaymentCheckoutUrl('');
    setPaymentConfirmed(false);
    setTerminalReference('');
  };

  const undoRemove = () => {
    if (!removedLine) return;
    setCart((current) => ({ ...current, [removedLine.key]: removedLine }));
    setRemovedLine(null);
  };

  const clearOrder = () => {
    if (!window.confirm('Clear all items from this order?')) return;
    setCart({});
    setPaymentReference('');
    setTerminalReference('');
    setPaymentCheckoutUrl('');
    setPaymentConfirmed(false);
    setRemovedLine(null);
  };

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
    if (discountType && (!discountIdNumber.trim() || !discountCardholderName.trim())) {
      setError(`Enter the customer's ${discountType} ID number and cardholder name.`);
      return;
    }
    if (!phoneIsValid) {
      setError('Enter a valid Philippine mobile number (09XX XXX XXXX).');
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
        discountCardholderName,
        includeCutlery,
        customerNotes,
        tableNumber,
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
    if (discountType && (!discountIdNumber.trim() || !discountCardholderName.trim())) {
      setError(`Enter the customer's ${discountType} ID number and cardholder name.`);
      return;
    }
    if (!phoneIsValid) {
      setError('Enter a valid Philippine mobile number (09XX XXX XXXX).');
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

    if (submitLockRef.current) return;
    submitLockRef.current = true;
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
          discount_cardholder_name: discountType ? discountCardholderName.trim() : undefined,
          include_cutlery: includeCutlery,
          notes: [diningOption === 'dine_in' && tableNumber.trim() ? `Table ${tableNumber.trim()}` : '', customerNotes.trim()].filter(Boolean).join('; ') || undefined,
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
      setSuccess(`Order ${result.order.order_number} completed. Change due: ${formatPeso(Number(result.change_due || 0))}.`);
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
      setDiscountCardholderName('');
      setStage('menu');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The POS order could not be completed.');
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handlePosShortcuts = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault();
        setPaymentMethod(event.key === '1' ? 'cash' : event.key === '2' ? 'gcash' : 'credit_card');
        setPaymentReference('');
        setTerminalReference('');
        setPaymentCheckoutUrl('');
        setPaymentConfirmed(false);
        return;
      }
      if (event.key === 'Escape') {
        if (configuringProduct) setConfiguringProduct(null);
        if (completedOrder) setCompletedOrder(null);
        if (showOrderDrawer) setShowOrderDrawer(false);
        return;
      }
    };
    window.addEventListener('keydown', handlePosShortcuts);
    return () => window.removeEventListener('keydown', handlePosShortcuts);
  }, [completedOrder, configuringProduct, showOrderDrawer]);

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
          <span className="flex items-center gap-1.5 border-l border-white/20 pl-3 sm:pl-5"><span className="flex size-7 items-center justify-center rounded-full bg-white/15"><UserRound size={15} /></span><span className="hidden sm:inline">{staffName.trim().split(/\s+/)[0]}</span></span>
        </nav>
      </header>

      {error && <div role="alert" className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mx-6">{error}</div>}
      {success && <div role="status" className="mx-4 mt-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 sm:mx-6">{success}</div>}

      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="hidden border-r border-gray-100 bg-white p-5 lg:block">
          <div className="mb-5 border-b border-gray-100 pb-4"><h2 className="font-serif text-xl font-bold text-[#1c3d2e]">Register Menu</h2><p className="mt-1 text-xs text-gray-500">Select category to filter items</p></div>
          <nav className="flex flex-col gap-1" aria-label="Product categories">
            {[{ id: 'all', label: 'All' }, ...categories.map((category) => ({ id: category.toLowerCase(), label: category.replaceAll('-', ' ') }))].map(({ id, label }) => (
              <button key={id} type="button" onClick={() => { setActiveCategory(id); setShowFavoritesOnly(false); setStage('menu'); }} aria-pressed={activeCategory === id && !showFavoritesOnly} className={`flex min-h-11 items-center rounded-xl px-3 py-3 text-left text-sm capitalize ${activeCategory === id && !showFavoritesOnly ? 'bg-[#e3efe7] font-semibold text-[#1c3d2e]' : 'text-gray-600 hover:bg-gray-50'}`}><span className="flex-1">{label}</span><span className="mr-2 text-xs tabular-nums text-gray-400">{categoryCount(id)}</span>{activeCategory === id && !showFavoritesOnly && <span className="h-5 w-1 rounded-full bg-[#2d6a4f]" />}</button>
            ))}
          </nav>
        </aside>

        <main onKeyDown={(event) => {
          if (event.key === 'Enter' && stage === 'checkout' && !event.shiftKey
            && !(event.target instanceof HTMLTextAreaElement) && !chargeDisabled) {
            event.preventDefault();
            void submitOrder();
          }
        }} className="min-w-0 p-4 pb-28 sm:p-6 sm:pb-28 xl:pb-6">
          {stage === 'menu' ? (
            <>
              <section className="mb-5 rounded-2xl bg-[#17643b] p-4 text-white shadow-md sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h1 className="font-serif text-xl font-bold sm:text-2xl">Good {greeting}, {staffName.trim().split(/\s+/)[0]}!</h1><p className="mt-1 text-sm text-white/90">Register active & ready · {branchName}</p></div>
                  <div className="text-right"><span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"><Store size={13} /> Counter Register</span><p className="mt-2 text-xs text-white/85">{manilaDateTime} · {itemCount} item{itemCount === 1 ? '' : 's'} in order</p></div>
                </div>
              </section>
              <nav aria-label="Product categories" className="sticky top-14 z-30 -mx-4 mb-4 flex gap-2 overflow-x-auto border-y border-gray-100 bg-[#fbf6ed]/95 px-4 py-2 backdrop-blur lg:hidden">
                {[{ id: 'all', label: 'All' }, ...categories.map((category) => ({ id: category.toLowerCase(), label: category.replaceAll('-', ' ') }))].map(({ id, label }) => <button key={id} type="button" onClick={() => { setActiveCategory(id); setShowFavoritesOnly(false); }} aria-pressed={activeCategory === id && !showFavoritesOnly} className={`min-h-11 shrink-0 rounded-full border px-3 text-xs font-semibold capitalize ${activeCategory === id && !showFavoritesOnly ? 'border-[#2d6a4f] bg-[#2d6a4f] text-white' : 'border-gray-200 bg-white text-gray-700'}`}>{label} <span className="opacity-75">({categoryCount(id)})</span></button>)}
              </nav>
              <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Product filters">
                {[
                  { id: 'all', label: 'All', active: !showFavoritesOnly && !showBestSellersOnly && !showAvailableOnly },
                  { id: 'favorites', label: 'Favorites', active: showFavoritesOnly },
                  { id: 'best-sellers', label: 'Best Sellers', active: showBestSellersOnly },
                  { id: 'available', label: 'Available only', active: showAvailableOnly },
                ].map((filter) => <button key={filter.id} type="button" aria-pressed={filter.active} onClick={() => {
                  setShowFavoritesOnly(filter.id === 'favorites' ? !showFavoritesOnly : false);
                  setShowBestSellersOnly(filter.id === 'best-sellers' ? !showBestSellersOnly : false);
                  setShowAvailableOnly(filter.id === 'available' ? !showAvailableOnly : false);
                }} className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${filter.active ? 'border-[#2d6a4f] bg-[#e3efe7] text-[#1c3d2e]' : 'border-gray-200 bg-white text-gray-600 hover:border-[#2d6a4f]'}`}>{filter.label}</button>)}
              </div>
              <label className="relative mb-5 block">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
                <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search menu items for customer order..." aria-label="Search menu items" className="min-h-12 w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-12 text-sm shadow-sm focus:border-[#1c3d2e] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/30" />
                {search ? <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus(); }} aria-label="Clear search" className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"><X size={17} /></button> : <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 text-xs text-gray-400 sm:block">/</span>}
              </label>
              {isLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading products">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-white"><div className="h-40 rounded-t-2xl bg-gray-200" /><div className="space-y-3 p-4"><div className="h-4 w-2/3 rounded bg-gray-200" /><div className="h-3 w-full rounded bg-gray-100" /><div className="h-10 rounded-xl bg-gray-100" /></div></div>)}</div> : filteredProducts.length === 0 ? <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center" role="status"><Search className="mx-auto mb-3 text-gray-400" size={28} /><h2 className="font-serif text-lg font-semibold text-gray-800">{debouncedSearch ? 'No results found' : 'No products match this filter'}</h2><p className="mt-1 text-sm text-gray-600">{showFavoritesOnly ? 'Favorite items will appear here.' : 'Try another search or choose a different category.'}</p>{debouncedSearch && <button type="button" onClick={() => setSearch('')} className="mt-4 min-h-11 rounded-xl bg-[#2d6a4f] px-4 text-sm font-semibold text-white">Clear search</button>}</div> : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((product) => {
                    const inCartQuantity = quantityForProduct(product.id);
                    const available = isBranchProductAvailable(product);
                    const favorite = favoriteIds.includes(product.id);
                    return <article key={product.id} className={`overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition duration-150 ${available ? 'hover:-translate-y-0.5 hover:shadow-lg' : 'opacity-65'}`}>
                      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-emerald-100 via-amber-50 to-lime-100 sm:h-44">
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-emerald-900/65"><Store size={36} /><span className="mt-2 text-xs font-semibold capitalize">{product.category.replaceAll('-', ' ')}</span></div>
                        {product.image && <img src={product.image} alt={product.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}
                        <span className="absolute bottom-3 right-3 rounded-full bg-[#17643b] px-3 py-2 text-sm font-bold text-white shadow tabular-nums">{formatPeso(Number(product.price))}</span>
                        <button type="button" aria-label={`${favorite ? 'Remove' : 'Add'} ${product.name} ${favorite ? 'from' : 'to'} favorites`} aria-pressed={favorite} onClick={() => setFavoriteIds((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])} className={`absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-white/95 text-gray-600 shadow transition-transform duration-150 hover:scale-105 hover:text-red-600 ${favorite ? 'text-red-600' : ''}`}><Heart size={19} fill={favorite ? 'currentColor' : 'none'} /></button>
                        {product.is_best_seller || product.best_seller ? <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white shadow">Best seller</span> : null}
                        {!available && <span className="absolute bottom-3 left-3 rounded-full bg-gray-800/90 px-2.5 py-1 text-xs font-bold text-white">{product.branch_stock_tracked && product.branch_stock === 0 ? 'Sold out' : 'Unavailable'}</span>}
                        {available && isBranchProductLowStock(product) && <span className="absolute left-3 top-3 rounded-full bg-orange-600 px-2.5 py-1 text-xs font-bold text-white shadow">Low stock</span>}
                      </div>
                      <div className="flex min-h-36 flex-col p-4">
                        <h2 className="font-serif text-base font-bold text-gray-900">{product.name}</h2>
                        <p className="mt-1 line-clamp-2 min-h-10 flex-1 text-[13px] leading-5 text-gray-600">{product.description || 'Freshly prepared at this branch.'}</p>
                        {inCartQuantity > 0 && <span className="mt-2 w-fit rounded-full bg-[#e3efe7] px-2.5 py-1 text-xs font-semibold text-[#1c3d2e]">In order ×{inCartQuantity}</span>}
                        {product.branch_stock_tracked && <p className="mt-1 text-xs text-gray-600">{product.branch_stock} in branch stock</p>}
                        {inCartQuantity ? <div className="mt-3 flex items-center justify-end gap-2">
                          <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => adjustProductQuantity(product, -1)} className="flex size-11 items-center justify-center rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"><Minus size={17} /></button>
                          <span className="min-w-8 text-center text-base font-bold tabular-nums">{inCartQuantity}</span>
                          <button type="button" disabled={!available} aria-label={`Add one ${product.name}`} onClick={() => adjustProductQuantity(product, 1)} className="flex size-11 items-center justify-center rounded-xl bg-[#2d6a4f] text-white hover:bg-[#1b4d3e] disabled:cursor-not-allowed disabled:bg-gray-300"><Plus size={17} /></button>
                        </div> : <button type="button" disabled={!available} onClick={() => void openProduct(product)} className="mt-3 min-h-11 self-start rounded-xl bg-[#2d6a4f] px-5 text-sm font-bold text-white transition-colors hover:bg-[#1b4d3e] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600">{available ? 'Add' : 'Sold out'}</button>}
                      </div>
                    </article>;
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="mx-auto max-w-3xl">
              <div className="mb-5 flex items-center gap-3 border-b border-[#e76f51]/20 pb-3"><button type="button" onClick={() => setStage('menu')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#2d6a4f]"><ArrowLeft size={17} /> Back to Register Menu</button><span className="text-gray-300">|</span><h1 className="font-serif text-lg font-bold text-[#2d6a4f]">POS Register Checkout (Onsite)</h1></div>
              <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-base font-bold">Dining Option</h2>
                <div className="grid grid-cols-2 gap-3">{(['dine_in', 'takeout'] as const).map((option) => <button key={option} type="button" aria-pressed={diningOption === option} onClick={() => setDiningOption(option)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${diningOption === option ? 'border-[#2d6a4f] bg-[#e3efe7] text-[#1c3d2e] ring-1 ring-[#2d6a4f]' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>{diningOption === option && <Check size={17} aria-hidden="true" />}{option === 'dine_in' ? 'Dine-in' : 'Takeout'}</button>)}</div>
                {diningOption === 'dine_in' && <label className="mt-4 block text-sm font-semibold text-gray-700">Table #<input value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} placeholder="Optional table number" className="mt-1 min-h-12 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base font-normal focus:border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20" /></label>}
              </section>
              <section className="mb-4 space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-bold">Customer Details <span className="font-normal text-gray-600">(Optional)</span></h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-gray-700">Customer name / callout<input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Walk-in Customer" className="mt-1 min-h-12 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base font-normal" /></label>
                  <label className="text-sm font-semibold text-gray-700">Contact / phone #<input type="tel" inputMode="tel" value={phone} onChange={(event) => { const digits = event.target.value.replace(/\D/g, '').slice(0, 11); setPhone([digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join(' ')); }} placeholder="09XX XXX XXXX (optional)" aria-invalid={!phoneIsValid} className="mt-1 min-h-12 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base font-normal" />{!phoneIsValid && <span className="mt-1 block text-xs text-red-700">Use a valid 11-digit number starting with 09.</span>}</label>
                </div>
                <label className="block text-sm font-semibold text-gray-700">Order notes / kitchen instructions<textarea value={customerNotes} onChange={(event) => setCustomerNotes(event.target.value)} placeholder="Add special instructions for the kitchen" maxLength={500} rows={3} className="mt-1 w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-base font-normal" /></label>
                <div className="flex flex-wrap gap-2" aria-label="Quick order notes">{['Extra crispy', 'Sauce on the side', 'No onions'].map((note) => <button key={note} type="button" aria-pressed={customerNotes.toLowerCase().includes(note.toLowerCase())} onClick={() => setCustomerNotes((current) => current.toLowerCase().includes(note.toLowerCase()) ? current.split(', ').filter((value) => value.toLowerCase() !== note.toLowerCase()).join(', ') : [current.trim(), note].filter(Boolean).join(', '))} className="min-h-11 rounded-full border border-gray-300 px-3 text-xs font-semibold text-gray-700 hover:border-[#2d6a4f] hover:text-[#1c3d2e]">{note}</button>)}</div>
              </section>
              <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-base font-bold">Discounts</h2>
                <div className="flex flex-wrap gap-2">{[{ value: '', label: 'Regular (No Discount)' }, { value: 'Senior Citizen', label: 'Senior Citizen (20%)' }, { value: 'PWD', label: 'PWD (20%)' }].map(({ value, label }) => <button key={value || 'regular'} type="button" aria-pressed={discountType === value} onClick={() => { setDiscountType(value as typeof discountType); setPaymentReference(''); setPaymentConfirmed(false); if (!value) { setDiscountIdNumber(''); setDiscountCardholderName(''); } }} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${discountType === value ? 'bg-[#2d6a4f] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{discountType === value && <Check size={16} aria-hidden="true" />}{label}</button>)}</div>
                {discountType && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Cardholder name<input value={discountCardholderName} onChange={(event) => setDiscountCardholderName(event.target.value)} placeholder="Name as shown on ID" className="mt-1 min-h-12 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base font-normal" required /></label><label className="text-sm font-semibold">{discountType} ID Number<input value={discountIdNumber} onChange={(event) => setDiscountIdNumber(event.target.value)} placeholder={`Enter ${discountType} ID #`} className="mt-1 min-h-12 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base font-normal" required /></label><p className="sm:col-span-2 text-xs text-gray-600" title="The 20% discount is applied to the VAT-exempt base amount.">VAT-exempt base + 20% statutory discount</p></div>}
              </section>
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-base font-bold">Payment Processing</h2>
                <div className="grid grid-cols-3 gap-2">{[{ value: 'cash', label: 'Cash', Icon: null }, { value: 'gcash', label: 'GCash', Icon: Smartphone }, { value: 'credit_card', label: 'Card / Terminal', Icon: CreditCard }].map(({ value, label, Icon }) => <button key={value} type="button" aria-pressed={paymentMethod === value} onClick={() => { setPaymentMethod(value as typeof paymentMethod); setPaymentReference(''); setTerminalReference(''); setPaymentCheckoutUrl(''); setPaymentConfirmed(false); }} className={`relative flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-3 text-sm font-semibold transition-colors ${paymentMethod === value ? 'border-2 border-[#2d6a4f] bg-[#e3efe7] text-[#1c3d2e]' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>{paymentMethod === value && <Check size={15} className="absolute right-2 top-2" aria-hidden="true" />}{Icon ? <Icon size={22} /> : <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full border-2 border-current text-lg font-bold leading-none">₱</span>}{label}</button>)}</div>
                {paymentMethod === 'cash' && <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center justify-between gap-2"><label htmlFor="cash-tendered" className="text-xs font-bold uppercase text-gray-700">Cash tendered</label><span className="text-xs text-gray-600">Amount due <strong className="tabular-nums text-gray-900">{formatPeso(total)}</strong></span></div>
                  <div className="relative mt-2"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-gray-600">₱</span><input id="cash-tendered" type="number" inputMode="decimal" min="0" step="0.01" value={cashTendered} onChange={(event) => setCashTendered(event.target.value)} placeholder="0.00" className="min-h-14 w-full rounded-lg border border-gray-300 bg-white py-3 pl-9 pr-3 text-xl font-bold tabular-nums focus:border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20" /></div>
                  <div className="mt-3 flex flex-wrap gap-2">{[{ amount: total, label: 'Exact' }, ...quickCashAmounts.map((amount) => ({ amount, label: formatPeso(amount) }))].map(({ amount, label }) => <button key={`${amount}-${label}`} type="button" onClick={() => setCashTendered(String(amount))} className="min-h-10 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold tabular-nums hover:border-[#2d6a4f]">{label}</button>)}</div>
                  <p className="mt-3 flex min-h-11 items-center justify-between border-t border-gray-200 pt-3 text-sm" aria-live="polite"><span className="font-semibold">Change Due</span><strong className={`text-lg tabular-nums ${tenderedAmount < total ? 'text-red-700' : 'text-[#2d6a4f]'}`}>{tenderedAmount < total ? `Insufficient: ${formatPeso(total - tenderedAmount)} short` : formatPeso(changeDue)}</strong></p>
                </div>}
                {paymentMethod === 'credit_card' && <div className="mt-4"><p className="mb-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Waiting for terminal… Enter the approval code once the terminal completes payment.</p><label className="block text-sm font-semibold text-gray-700">Card / Terminal Approval Code<input value={terminalReference} onChange={(event) => setTerminalReference(event.target.value)} placeholder="Enter terminal approval code" className="mt-1 min-h-12 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base font-normal normal-case" /></label></div>}
                {paymentMethod === 'gcash' && <div className="mt-4 space-y-2 rounded-xl bg-[#edf5ef] p-3 text-sm">{!paymentReference ? <button type="button" onClick={() => void startGatewayPayment()} disabled={isStartingPayment || lines.length === 0} className="min-h-11 w-full rounded-lg bg-[#2d6a4f] px-3 py-2.5 font-semibold text-white disabled:opacity-50">{isStartingPayment ? 'Starting secure payment...' : `Start GCash payment · ${formatPeso(total)}`}</button> : <><p>Payment reference: <strong>{paymentReference}</strong></p>{paymentCheckoutUrl && <a href={paymentCheckoutUrl} target="_blank" rel="noreferrer" className="block rounded-lg border border-[#2d6a4f] bg-white px-3 py-2 text-center font-semibold text-[#2d6a4f]">Open GCash checkout</a>}<button type="button" onClick={() => void verifyGatewayPayment()} className={`min-h-11 w-full rounded-lg px-3 py-2.5 font-semibold ${paymentConfirmed ? 'bg-green-100 text-green-800' : 'border border-gray-300 bg-white'}`}>{paymentConfirmed ? 'Payment confirmed' : 'Check gateway payment status'}</button>{!paymentConfirmed && <button type="button" onClick={() => { setPaymentReference(''); setPaymentCheckoutUrl(''); }} className="min-h-11 w-full text-xs text-gray-600 underline">Start a different payment</button>}</>}</div>}
              </section>
            </div>
          )}
        </main>

        <aside className={`fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] flex-col border-t border-gray-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-[height] xl:sticky xl:inset-auto xl:top-14 xl:col-span-1 xl:row-span-1 xl:h-[calc(100vh-3.5rem)] xl:min-h-0 xl:max-h-none xl:border-l xl:border-t-0 xl:shadow-none ${showOrderDrawer ? 'h-[82vh]' : 'h-[74px]'} xl:h-[calc(100vh-3.5rem)]`}>
          <div className="flex min-h-[72px] items-center justify-between border-b border-gray-200 px-4 py-3 xl:px-5">
            <button type="button" onClick={() => setShowOrderDrawer((open) => !open)} aria-expanded={showOrderDrawer} className="flex min-h-11 min-w-0 items-center gap-2 text-left xl:pointer-events-none">
              <ShoppingBag size={19} className="shrink-0" />
              <span className="min-w-0"><strong className="block text-base">Current Order <span className="ml-1 rounded-full bg-[#e3efe7] px-2 py-0.5 text-xs text-[#1c3d2e]">{itemCount}</span></strong><span className="block text-xs text-gray-600">{itemCount ? `${itemCount} item${itemCount === 1 ? '' : 's'} in queue` : 'Tap an item to start an order'}</span></span>
            </button>
            {lines.length > 0 && <button type="button" onClick={clearOrder} className="min-h-11 shrink-0 px-2 text-sm font-semibold text-red-700 hover:underline">Clear</button>}
          </div>
          <div className={`${showOrderDrawer ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col xl:flex`}>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {lines.map((line) => {
                const { key, product, quantity, selectedSize, selectedAddons, specialInstructions: itemNotes } = line;
                const lineTotal = (Number(product.price) + selectedAddons.reduce((sum, addon) => sum + Number(addon.price) * Math.max(1, Number(addon.quantity || 1)), 0)) * quantity;
                return <div key={key} className="border-b border-gray-100 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setEditingNotesKey(editingNotesKey === key ? null : key)} className="min-w-0 text-left">
                      <span className="block font-semibold text-gray-900">{quantity}× {product.name}</span>
                      {selectedSize && <span className="block text-xs text-gray-600">{selectedSize}</span>}
                      {selectedAddons.map((addon) => <span key={addon.id} className="block text-xs text-gray-600">+ {addon.name}</span>)}
                      {itemNotes && <span className="block text-xs text-gray-500">{itemNotes}</span>}
                      <span className="mt-1 block text-sm font-semibold tabular-nums">{formatPeso(lineTotal)}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => setQuantity(key, quantity - 1)} className="flex size-11 items-center justify-center rounded-xl border border-gray-300 hover:bg-gray-50"><Minus size={15} /></button>
                      <span className="min-w-7 text-center font-bold tabular-nums">{quantity}</span>
                      <button type="button" aria-label={`Add one ${product.name}`} onClick={() => setQuantity(key, quantity + 1)} className="flex size-11 items-center justify-center rounded-xl border border-gray-300 hover:bg-gray-50"><Plus size={15} /></button>
                      <button type="button" aria-label={`Remove ${product.name} from order`} onClick={() => removeCartLine(line)} className="ml-1 flex size-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50"><Trash2 size={17} /></button>
                    </div>
                  </div>
                  {editingNotesKey === key && <label className="mt-2 block text-xs font-semibold text-gray-600">Item notes<textarea value={itemNotes || ''} onChange={(event) => setCart((current) => ({ ...current, [key]: { ...current[key], specialInstructions: event.target.value || undefined } }))} placeholder="Add item-specific kitchen notes" maxLength={250} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal" /></label>}
                </div>;
              })}
              {!lines.length && <div className="flex min-h-52 flex-col items-center justify-center text-center"><span className="mb-3 flex size-16 items-center justify-center rounded-full bg-[#e3efe7] text-[#2d6a4f]"><ShoppingBag size={27} /></span><strong className="text-gray-800">Your order is empty</strong><p className="mt-1 text-sm text-gray-600">Tap an item to start an order</p></div>}
            </div>
            <div className="border-t border-gray-200 bg-white">
              <div className="flex justify-between px-5 py-3 text-sm"><span className="text-gray-700">Order Subtotal</span><strong className="tabular-nums" aria-live="polite">{formatPeso(subtotal)}</strong></div>
              <label className="flex min-h-12 cursor-pointer items-center justify-between border-t border-gray-100 px-5 py-3 text-sm"><span>Include Cutlery / Utensils</span><input type="checkbox" checked={includeCutlery} onChange={(event) => setIncludeCutlery(event.target.checked)} aria-checked={includeCutlery} className="size-5 accent-[#2d6a4f]" /></label>
              <div className="space-y-2 p-4">
                {stage === 'menu' ? <button type="button" disabled={!lines.length} onClick={() => { setStage('checkout'); setShowOrderDrawer(false); }} className="min-h-12 w-full rounded-xl bg-[#2d6a4f] px-4 py-3.5 text-left text-base font-bold text-white shadow transition-colors hover:bg-[#1b4d3e] disabled:cursor-not-allowed disabled:bg-gray-300"><span className="flex items-center justify-between"><span>Proceed to Checkout</span><span className="tabular-nums">{formatPeso(total)} →</span></span></button> : <>
                  <div className="flex justify-between text-sm text-gray-700"><span>Subtotal</span><span className="tabular-nums">{formatPeso(subtotal)}</span></div>
                  {discountType && <><div className="flex justify-between text-sm text-gray-600"><span>VAT-exempt base</span><span className="tabular-nums">{formatPeso(vatExemptBase)}</span></div><div className="flex justify-between text-sm font-medium text-emerald-700"><span>Discount ({discountType} 20%)</span><span className="tabular-nums">−{formatPeso(discountAmount)}</span></div></>}
                  <div className="flex justify-between text-sm text-gray-600"><span>VAT (12% inclusive)</span><span className="tabular-nums">{formatPeso(discountType ? 0 : Math.round(subtotal * 12 / 112))}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-3 text-lg font-bold"><span>Total</span><span className="tabular-nums text-[#2d6a4f]">{formatPeso(total)}</span></div>
                  <button type="button" onClick={() => void submitOrder()} disabled={chargeDisabled} className="min-h-12 w-full rounded-xl bg-[#2d6a4f] py-3.5 text-base font-bold text-white transition-colors hover:bg-[#1b4d3e] disabled:cursor-not-allowed disabled:bg-gray-300">{isSubmitting ? 'Processing Sale…' : `Charge ${formatPeso(total)}`}</button>
                  {!chargeDisabled && paymentMethod === 'credit_card' && <p className="text-center text-xs text-gray-600">Waiting for terminal approval code.</p>}
                  {chargeDisabled && chargeHelperText && <p className="text-center text-xs text-gray-600">{chargeHelperText}</p>}
                </>}
              </div>
            </div>
          </div>
          {!showOrderDrawer && <div className="flex flex-1 items-center gap-2 px-3 py-2 xl:hidden">
            {stage === 'menu' ? <button type="button" onClick={() => setShowOrderDrawer(true)} className="min-h-11 w-full rounded-xl bg-[#2d6a4f] px-4 text-sm font-bold text-white"><span className="flex items-center justify-between"><span>View Order · {itemCount} item{itemCount === 1 ? '' : 's'}</span><span className="tabular-nums">{formatPeso(total)}</span></span></button> : <button type="button" disabled={chargeDisabled} onClick={() => void submitOrder()} className="min-h-11 w-full rounded-xl bg-[#2d6a4f] px-4 text-base font-bold text-white disabled:bg-gray-300">{isSubmitting ? 'Processing…' : `Charge ${formatPeso(total)}`}</button>}
          </div>}
        </aside>
        {removedLine && <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-xl xl:bottom-5">Item removed <button type="button" onClick={undoRemove} className="font-bold underline underline-offset-2">Undo</button></div>}
      </div>

      {completedOrder && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onKeyDown={(event) => { if (event.key === 'Escape') setCompletedOrder(null); }}><section role="dialog" aria-modal="true" aria-labelledby="branch-pos-receipt-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-4 flex items-center gap-2 text-[#2d6a4f]"><CheckCircle2 size={22} /><h2 id="branch-pos-receipt-title" className="text-lg font-bold">Order processed successfully</h2></div><p className="text-center font-serif text-lg font-bold">OPPA DRU KOREAN FRIED CHICKEN</p><p className="mb-4 text-center text-xs text-gray-600">ONSITE REGISTER RECEIPT · {branchName}</p><div className="space-y-2 border-y border-dashed py-3 text-sm"><p className="flex justify-between"><span>Order #</span><strong>{completedOrder.order_number}</strong></p><p className="flex justify-between"><span>Customer</span><span>{completedOrder.customerName}</span></p><p className="flex justify-between"><span>Dining</span><span>{completedOrder.diningOption === 'dine_in' ? 'Dine-in' : 'Takeout'}</span></p>{(completedOrder.items || []).map((item, index) => { const quantity = Number(item.quantity || 1); const itemAmount = Number(item.product_price || 0) * quantity + (item.selected_addons || []).reduce((sum, addon) => sum + Number(addon.price || 0) * Math.max(1, Number(addon.quantity || 1)) * quantity, 0); return <p key={`${item.product_name}-${index}`} className="flex justify-between"><span>{quantity}x {item.product_name}</span><span className="tabular-nums">{formatPeso(itemAmount)}</span></p>; })}<p className="flex justify-between font-bold"><span>Total</span><span className="tabular-nums">{formatPeso(Number(completedOrder.total))}</span></p><p className="flex justify-between text-xs text-gray-600"><span>Payment</span><span className="uppercase">{completedOrder.payment_method.replace('_', ' ')}</span></p>{completedOrder.payment_method === 'cash' && <><p className="flex justify-between text-xs"><span>Cash Tendered</span><span className="tabular-nums">{formatPeso(Number(completedOrder.cashTendered || 0))}</span></p><p className="flex justify-between text-xs"><span>Change</span><span className="tabular-nums">{formatPeso(Number(completedOrder.changeDue || 0))}</span></p></>}{completedOrder.includeCutlery && <p className="text-xs">Cutlery / utensils included</p>}</div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => window.print()} className="min-h-11 rounded-xl border px-3 text-sm font-semibold">Print Receipt</button><button type="button" onClick={() => { setCompletedOrder(null); setSuccess(''); setCustomerName(''); setPhone(''); setCustomerNotes(''); setTableNumber(''); setDiscountCardholderName(''); setDiscountIdNumber(''); setCashTendered(''); setTerminalReference(''); setPaymentMethod('cash'); setDiningOption('takeout'); }} className="min-h-11 rounded-xl bg-[#2d6a4f] px-3 text-sm font-semibold text-white">New Order</button><Link to={cashierMode ? '/cashier/transactions' : '/franchise/orders'} onClick={() => setCompletedOrder(null)} className="col-span-2 flex min-h-11 items-center justify-center rounded-xl border border-[#2d6a4f] px-3 text-sm font-semibold text-[#1c3d2e]">View Order</Link></div></section></div>}

      {configuringProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={() => setConfiguringProduct(null)}>
          <section role="dialog" aria-modal="true" aria-label={`${configuringProduct.name} options`} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-semibold">{configuringProduct.name}</h2><p className="mt-1 text-sm text-gray-600">Base price {formatPeso(Number(configuringProduct.price))}</p></div>
              <button onClick={() => setConfiguringProduct(null)} aria-label="Close options" className="rounded-lg px-3 py-1 text-gray-500 hover:bg-gray-100">Close</button>
            </div>
            {['fruity-soda-milk', 'fresh-lemonade'].includes(configuringProduct.category.toLowerCase()) && (
              <fieldset className="mb-5">
                <legend className="mb-2 text-sm font-semibold">Drink size</legend>
                <div className="grid grid-cols-3 gap-2">{(['Small', 'Medium', 'Large'] as const).map((size) => {
                  const adjustment = size === 'Small' ? -10 : size === 'Large' ? 20 : 0;
                  return <button key={size} type="button" aria-pressed={selectedSize === size} onClick={() => setSelectedSize(size)} className={`min-h-12 rounded-xl border px-3 py-3 text-sm ${selectedSize === size ? 'border-[var(--oppa-green)] bg-[#edf5ef] font-semibold text-[var(--oppa-green)]' : 'border-gray-200'}`}>{size}<span className="mt-1 block text-xs tabular-nums">{adjustment > 0 ? `+${formatPeso(adjustment)}` : adjustment < 0 ? `−${formatPeso(Math.abs(adjustment))}` : 'Standard'}</span></button>;
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
                    <span className="flex-1 text-sm">{addon.name}</span><span className="text-sm font-medium tabular-nums">+{formatPeso(Number(addon.price))}</span>
                  </label>;
                })}</div>
              </fieldset>
            ))}
            <label className="mb-5 block text-sm font-semibold">Special instructions<textarea value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} maxLength={500} rows={2} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" placeholder="Optional request for the kitchen" /></label>
            {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <button type="button" disabled={isLoadingAddons} onClick={addConfiguredProduct} className="min-h-12 w-full rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-base font-semibold text-white disabled:opacity-50">Add to order · {formatPeso((Math.max(0, Number(configuringProduct.price) + (selectedSize === 'Small' ? -10 : selectedSize === 'Large' ? 20 : 0)) + selectedAddons.reduce((sum, addon) => sum + Number(addon.price), 0)))}</button>
          </section>
        </div>
      )}
    </div>
  );
};

export default FranchisePOSPage;

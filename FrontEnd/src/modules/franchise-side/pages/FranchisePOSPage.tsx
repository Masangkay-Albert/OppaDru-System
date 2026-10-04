import React, { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Search, ShoppingBag } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { API_URL } from '../../../services/apiConfig';
import { fetchWithFranchiseAuth } from '../../../services/franchiseAuthService';
import { getProductImage } from '../../../data/productImages';
import type { Addon, AddonGroup, ProductSize } from '../../../types/product.types';
import type { Product } from '../../../services/productService';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';

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
  order_number: string;
  total: number;
  payment_method: string;
  status: string;
}

interface PendingPosState {
  cart: Record<string, PosCartLine>;
  customerName: string;
  phone: string;
  diningOption: 'dine_in' | 'takeout';
  discountType: '' | 'PWD' | 'Senior Citizen';
  discountIdNumber: string;
}

const pendingPaymentStorageKey = (reference: string) => `franchise_pos_payment_${reference}`;

const FranchisePOSPage: React.FC = () => {
  const { franchiseUser } = useFranchiseAuth();
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
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [diningOption, setDiningOption] = useState<'dine_in' | 'takeout'>('takeout');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const [searchParams] = useSearchParams();
  const [cashTendered, setCashTendered] = useState('');
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
        const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/products`);
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
  }, []);

  const lines = Object.values(cart);
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.product.price) + line.selectedAddons.reduce((addonTotal, addon) => addonTotal + Number(addon.price) * Math.max(1, Number(addon.quantity || 1)), 0)) * line.quantity, 0);
  const discountAmount = discountType ? Math.round(subtotal * 20) / 100 : 0;
  const total = Math.max(0, subtotal - discountAmount);
  const tenderedAmount = Number(cashTendered || 0);
  const changeDue = Math.max(0, tenderedAmount - total);
  const filteredProducts = useMemo(
    () => products.filter((product) => {
      const matchesSearch = `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'all' || product.category.toLowerCase() === activeCategory;
      return matchesSearch && matchesCategory;
    }),
    [products, search, activeCategory],
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
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/addon-groups?${params}`);
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
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/pos/payments/gcash`, {
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
      if (Number(payload.amount) !== Number(total.toFixed(2))) {
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
    if (paymentMethod !== 'cash' && (!paymentReference.trim() || !paymentConfirmed)) {
      setError('Complete and verify the GCash payment before placing the order.');
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
      const response = await fetchWithFranchiseAuth(`${API_URL}/franchise/pos/orders`, {
        method: 'POST',
        body: JSON.stringify({
          items: paymentItems(),
          customer_name: customerName.trim() || 'Walk-in Customer',
          phone: phone.trim(),
          dining_option: diningOption,
          payment_method: paymentMethod,
          payment_reference: paymentMethod === 'cash' ? undefined : paymentReference.trim(),
          cash_tendered: paymentMethod === 'cash' ? tenderedAmount : undefined,
          discount_type: discountType || undefined,
          discount_id_number: discountType ? discountIdNumber.trim() : undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'The POS order could not be completed.');
      }

      setCompletedOrder(result.order);
      setSuccess(`Order ${result.order.order_number} completed. Change due: ₱${Number(result.change_due || 0).toFixed(2)}.`);
      if (paymentReference) {
        sessionStorage.removeItem(pendingPaymentStorageKey(paymentReference));
      }
      setCart({});
      setCashTendered('');
      setPaymentReference('');
      setPaymentCheckoutUrl('');
      setPaymentConfirmed(false);
      setDiscountType('');
      setDiscountIdNumber('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'The POS order could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--oppa-cream)] px-4 py-5 sm:px-6 lg:px-7">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--oppa-green)]">Franchise POS</p>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--oppa-text)]">POS · {franchiseUser?.franchise?.name || 'Branch menu'}</h1>
            <p className="mt-1 text-sm text-[var(--oppa-text-muted)]">Build an order from this branch’s menu and stock.</p>
          </div>
          <div className="rounded-xl bg-[var(--oppa-cream)] px-4 py-3 text-right">
            <p className="text-xs text-[var(--oppa-text-muted)]">Order total</p>
            <p className="text-xl font-bold text-[var(--oppa-green)]">₱{total.toFixed(2)}</p>
          </div>
        </header>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {success && <div role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{success}</div>}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-[var(--oppa-border)] bg-white p-4 shadow-sm sm:p-5">
            <label className="relative mb-4 block">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search branch menu"
                className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-4 text-sm"
              />
            </label>
            <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter menu by category">
              {[{ id: 'all', label: 'All items' }, ...categories.map((category) => ({ id: category.toLowerCase(), label: category.replaceAll('-', ' ') }))].map((item) => (
                <button key={item.id} type="button" onClick={() => setActiveCategory(item.id)} aria-pressed={activeCategory === item.id} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${activeCategory === item.id ? 'bg-[var(--oppa-green)] text-white' : 'bg-[var(--oppa-cream)] text-gray-600 hover:bg-[var(--oppa-green-soft)]'}`}>{item.label}</button>
              ))}
            </div>
            {isLoading ? (
              <p className="py-12 text-center text-sm text-[var(--oppa-text-muted)]">Loading menu...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="py-12 text-center text-sm text-[var(--oppa-text-muted)]">No available products at this branch.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {filteredProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => void openProduct(product)}
                    disabled={!product.branch_available}
                    className="overflow-hidden rounded-2xl border border-gray-200 text-left transition hover:-translate-y-0.5 hover:border-[var(--oppa-green)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {product.image && <img src={product.image} alt="" className="h-36 w-full object-cover" />}
                    <span className="block p-3.5">
                      <span className="block min-h-10 font-semibold text-[var(--oppa-text)]">{product.name}</span>
                      <span className="mt-1 block text-sm font-bold text-[var(--oppa-green)]">₱{Number(product.price).toFixed(2)}</span>
                      <span className={`mt-2 block text-xs font-medium ${product.branch_available ? 'text-green-700' : 'text-red-600'}`}>
                        {product.branch_available
                          ? product.branch_stock_tracked
                            ? `Available · ${product.branch_stock} in stock`
                            : 'Available'
                          : product.branch_stock_tracked && product.branch_stock === 0
                            ? 'Out of stock'
                            : 'Unavailable at this branch'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="h-fit rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm xl:sticky xl:top-5">
            <h2 className="mb-4 flex items-center justify-between gap-2 text-lg font-semibold text-[var(--oppa-text)]">
              <span className="flex items-center gap-2">
              <ShoppingBag size={19} /> Current order
              </span>
              {lines.length > 0 && <button onClick={() => { setCart({}); setPaymentReference(''); setPaymentCheckoutUrl(''); setPaymentConfirmed(false); }} className="text-xs font-medium text-red-600 hover:underline">Clear</button>}
            </h2>
            <div className="mb-4 max-h-56 space-y-3 overflow-y-auto">
              {lines.map(({ key, product, quantity, selectedSize, selectedAddons }) => (
                <div key={key} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{product.name}</p>
                    {selectedSize && <p className="text-xs text-gray-500">{selectedSize}</p>}
                    {selectedAddons.length > 0 && <p className="truncate text-xs text-gray-500">+ {selectedAddons.map((addon) => addon.name).join(', ')}</p>}
                    <p className="text-xs text-gray-500">₱{((Number(product.price) + selectedAddons.reduce((sum, addon) => sum + Number(addon.price) * Math.max(1, Number(addon.quantity || 1)), 0)) * quantity).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button aria-label={`Remove one ${product.name}`} onClick={() => setQuantity(key, quantity - 1)} className="rounded-full border p-1"><Minus size={14} /></button>
                    <span>{quantity}</span>
                    <button aria-label={`Add one ${product.name}`} onClick={() => setQuantity(key, quantity + 1)} className="rounded-full border p-1"><Plus size={14} /></button>
                  </div>
                </div>
              ))}
              {lines.length === 0 && <p className="py-5 text-center text-sm text-gray-500">No items added.</p>}
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-4">
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Customer name (optional)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone (optional)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select value={diningOption} onChange={(event) => setDiningOption(event.target.value as 'dine_in' | 'takeout')} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="takeout">Takeout</option>
                  <option value="dine_in">Dine in</option>
                </select>
                <select value={paymentMethod} onChange={(event) => {
                  setPaymentMethod(event.target.value as typeof paymentMethod);
                  setPaymentReference('');
                  setPaymentCheckoutUrl('');
                  setPaymentConfirmed(false);
                }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                </select>
              </div>
              {paymentMethod === 'gcash' && (
                <div className="space-y-2 rounded-xl bg-[#edf5ef] p-3 text-sm">
                  {!paymentReference ? (
                    <button type="button" onClick={() => void startGatewayPayment()} disabled={isStartingPayment || lines.length === 0} className="w-full rounded-lg bg-[var(--oppa-green)] px-3 py-2 font-semibold text-white disabled:opacity-50">
                      {isStartingPayment ? 'Starting secure payment...' : `Start GCash payment · ₱${total.toFixed(2)}`}
                    </button>
                  ) : (
                    <>
                      <p>Payment reference: <strong>{paymentReference}</strong></p>
                      {paymentCheckoutUrl && <a href={paymentCheckoutUrl} target="_blank" rel="noreferrer" className="block rounded-lg border border-[var(--oppa-green)] bg-white px-3 py-2 text-center font-semibold text-[var(--oppa-green)] hover:bg-green-50">Open GCash checkout</a>}
                      <button type="button" onClick={() => void verifyGatewayPayment()} className={`w-full rounded-lg px-3 py-2 font-semibold ${paymentConfirmed ? 'bg-green-100 text-green-800' : 'border border-gray-300 bg-white'}`}>
                        {paymentConfirmed ? 'Payment confirmed' : 'Check gateway payment status'}
                      </button>
                      {!paymentConfirmed && <button type="button" onClick={() => { setPaymentReference(''); setPaymentCheckoutUrl(''); }} className="w-full text-xs text-gray-500 underline">Start a different payment</button>}
                    </>
                  )}
                </div>
              )}
              <select value={discountType} onChange={(event) => {
                setDiscountType(event.target.value as typeof discountType);
                setPaymentReference('');
                setPaymentCheckoutUrl('');
                setPaymentConfirmed(false);
              }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <option value="">No discount</option>
                <option value="PWD">PWD (20%)</option>
                <option value="Senior Citizen">Senior Citizen (20%)</option>
              </select>
              {discountType && <input value={discountIdNumber} onChange={(event) => setDiscountIdNumber(event.target.value)} placeholder={`${discountType} ID number`} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />}
              {paymentMethod === 'cash' && (
                <label className="block text-sm">
                  Cash received
                  <input type="number" min="0" step="0.01" value={cashTendered} onChange={(event) => setCashTendered(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
                </label>
              )}
              <div className="flex justify-between text-sm"><span>Subtotal</span><span>₱{subtotal.toFixed(2)}</span></div>
              {discountType && <div className="flex justify-between text-sm text-green-700"><span>{discountType} discount</span><span>-₱{discountAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between border-t pt-3 font-semibold"><span>Total</span><span>₱{total.toFixed(2)}</span></div>
              {paymentMethod === 'cash' && <div className="flex justify-between text-sm"><span>Change</span><span>₱{changeDue.toFixed(2)}</span></div>}
              <button
                type="button"
                onClick={() => void submitOrder()}
                disabled={isSubmitting || isLoading || lines.length === 0}
                className="w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white hover:bg-[var(--oppa-green-dark)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Processing...' : 'Complete POS order'}
              </button>
              {completedOrder && <p className="text-center text-xs text-gray-500">Receipt: {completedOrder.order_number}</p>}
            </div>
          </aside>
        </div>
      </div>

      {configuringProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={() => setConfiguringProduct(null)}>
          <section role="dialog" aria-modal="true" aria-label={`${configuringProduct.name} options`} onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-semibold">{configuringProduct.name}</h2><p className="mt-1 text-sm text-gray-500">Base price ₱{Number(configuringProduct.price).toFixed(2)}</p></div>
              <button onClick={() => setConfiguringProduct(null)} aria-label="Close options" className="rounded-lg px-3 py-1 text-gray-500 hover:bg-gray-100">Close</button>
            </div>
            {['fruity-soda-milk', 'fresh-lemonade'].includes(configuringProduct.category.toLowerCase()) && (
              <fieldset className="mb-5">
                <legend className="mb-2 text-sm font-semibold">Drink size</legend>
                <div className="grid grid-cols-3 gap-2">{(['Small', 'Medium', 'Large'] as const).map((size) => {
                  const adjustment = size === 'Small' ? -10 : size === 'Large' ? 20 : 0;
                  return <button key={size} type="button" onClick={() => setSelectedSize(size)} className={`rounded-xl border px-3 py-3 text-sm ${selectedSize === size ? 'border-[var(--oppa-green)] bg-[#edf5ef] font-semibold text-[var(--oppa-green)]' : 'border-gray-200'}`}>{size}<span className="mt-1 block text-xs">{adjustment > 0 ? `+₱${adjustment}` : adjustment < 0 ? `-₱${Math.abs(adjustment)}` : 'Standard'}</span></button>;
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
                    <span className="flex-1 text-sm">{addon.name}</span><span className="text-sm font-medium">+₱{Number(addon.price).toFixed(2)}</span>
                  </label>;
                })}</div>
              </fieldset>
            ))}
            <label className="mb-5 block text-sm font-semibold">Special instructions<textarea value={specialInstructions} onChange={(event) => setSpecialInstructions(event.target.value)} maxLength={500} rows={2} className="mt-2 w-full rounded-xl border border-gray-200 p-3 font-normal" placeholder="Optional request for the kitchen" /></label>
            {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <button type="button" disabled={isLoadingAddons} onClick={addConfiguredProduct} className="w-full rounded-xl bg-[var(--oppa-green)] px-4 py-3 font-semibold text-white disabled:opacity-50">Add to order · ₱{(Math.max(0, Number(configuringProduct.price) + (selectedSize === 'Small' ? -10 : selectedSize === 'Large' ? 20 : 0)) + selectedAddons.reduce((sum, addon) => sum + Number(addon.price), 0)).toFixed(2)}</button>
          </section>
        </div>
      )}
    </main>
  );
};

export default FranchisePOSPage;

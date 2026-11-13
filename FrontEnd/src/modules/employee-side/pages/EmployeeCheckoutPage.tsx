import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiArrowLeft, FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../../../contexts/CartContext';
import { useToast } from '../../customer-side/components/ToastProvider';
import NavbarEmployee from '../components/navigation/NavbarEmployee';
import CheckoutForm from '../components/checkout/CheckoutForm';
import CheckoutSummary from '../components/checkout/CheckoutSummary';
import POSReceiptModal from '../components/pos/POSReceiptModal';
import GCashPaymentModal from '../../customer-side/components/checkout/GCashPaymentModal';
import type { PaymentResult } from '../../customer-side/components/checkout/paymentTypes';
import { addOnsiteOrder, type AdminOrder } from '../../../services/adminOrderService';
import { calculateSubtotal } from '../../../services/cartService';
import { validateVoucherAsync } from '../../../services/voucherService';
import type { Promo } from '../../../services/promoService';
import { getThirdPartyPlatformLabel, type OrderSource } from '../../../constants/thirdPartyPlatforms';

const EmployeeCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();

  const [diningOption, setDiningOption] = useState<'dine_in' | 'takeout'>('takeout');
  const [orderSource, setOrderSource] = useState<OrderSource>('walk_in');
  const [externalOrderRef, setExternalOrderRef] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'PWD' | 'Senior Citizen' | null>(null);
  const [discountIdNumber, setDiscountIdNumber] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const submitLockRef = useRef(false);
  const [completedOrder, setCompletedOrder] = useState<AdminOrder | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // GCash Integration Matching Customer Side
  const [showGCashModal, setShowGCashModal] = useState(false);

  // Promo code & voucher management
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [appliedPromo, setAppliedPromo] = useState<Promo | null>(null);
  const [isPromoValidating, setIsPromoValidating] = useState(false);
  const [promoError, setPromoError] = useState('');

  useEffect(() => {
    const ref = searchParams.get('payment_reference');
    const status = searchParams.get('payment_status');
    if (ref && status === 'confirmed') {
      setPaymentReference(ref);
      setPaymentMethod('gcash');
      showToast(`GCash payment ${ref} confirmed! Click Place Order to finalize.`, 'success');
    }
  }, [searchParams, showToast]);

  const subtotal = calculateSubtotal(cartItems);
  const discountRate = discountType ? 0.20 : 0;
  const vatExemptBase = Math.round(subtotal / 1.12);
  const discountAmount = discountType ? Math.round(vatExemptBase * discountRate) : 0;
  const netTotal = Math.max(0, (discountType ? vatExemptBase - discountAmount : subtotal) - promoDiscount);
  const vat = discountType ? 0 : Math.round((subtotal - promoDiscount) * 12 / 112 * 100) / 100;
  const finalTotal = netTotal;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoError('Please enter a promo code');
      return;
    }

    setIsPromoValidating(true);
    setPromoError('');

    try {
      const result = await validateVoucherAsync(promoCode, cartItems.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        selected_size: item.selectedSize,
        selected_addons: (item.selectedAddons || []).map((addon) => ({ id: addon.id, quantity: addon.quantity || 1 })),
      })), 'cashier');
      if (result.isValid) {
        setAppliedPromo(null);
        setPromoDiscount(result.discount);
        setPromoError('');
        showToast(`Promo ${promoCode.toUpperCase()} applied successfully!`, 'success');
      } else {
        setPromoError(result.error || 'Invalid promo code');
      }
    } catch {
      setPromoError('Failed to validate promo code.');
    } finally {
      setIsPromoValidating(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDiscount(0);
    setPromoCode('');
    setPromoError('');
  };

  const handleOrderSourceChange = (source: OrderSource) => {
    setOrderSource(source);
    setExternalOrderRef('');
    setDiningOption('takeout');
    setPaymentMethod('cash');
    setPaymentReference('');
    setCashTendered(0);
    setDiscountType(null);
    setDiscountIdNumber('');
    handleRemovePromo();
  };

  const executeOrderPlacement = async (confirmedReference?: string) => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setIsPlacingOrder(true);
    const activeRef = (confirmedReference || paymentReference).trim();

    try {
      const order = await addOnsiteOrder({
        customerName: customerName.trim() || 'Walk-in Customer',
        phone: customerPhone.trim() || undefined,
        items: cartItems,
        diningOption,
        thirdPartyPlatform: orderSource === 'walk_in' ? undefined : orderSource,
        externalOrderRef: orderSource === 'walk_in' ? undefined : externalOrderRef,
        notes: notes.trim() || undefined,
        paymentMethod,
        paymentReference: activeRef || undefined,
        discountType,
        discountRate,
        discountAmount,
        discountIdNumber: discountType ? discountIdNumber.trim() : undefined,
        promoId: appliedPromo?.id,
        promoCode: appliedPromo?.code || (promoDiscount > 0 ? promoCode : undefined),
        promoDiscount: promoDiscount > 0 ? promoDiscount : undefined,
        cashTendered: paymentMethod === 'cash' ? cashTendered : undefined,
        changeDue: paymentMethod === 'cash' ? Math.max(0, cashTendered - finalTotal) : undefined,
        subtotal,
        total: finalTotal,
        vat,
      });

      setCompletedOrder(order);
      setShowReceiptModal(true);
      clearCart();
      showToast('Onsite order completed successfully!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to process onsite order.', 'error');
    } finally {
      submitLockRef.current = false;
      setIsPlacingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      showToast('No items in the order.', 'error');
      return;
    }

    if (orderSource !== 'walk_in' && !/^[A-Z0-9-]{3,30}$/.test(externalOrderRef)) {
      const platformLabel = getThirdPartyPlatformLabel(orderSource) || 'platform';
      showToast(`Enter a valid ${platformLabel} order number (3–30 letters, numbers, or hyphens).`, 'error');
      return;
    }

    if (orderSource === 'walk_in' && paymentMethod === 'cash' && cashTendered < finalTotal) {
      showToast('Cash tendered is less than total amount due.', 'error');
      return;
    }

    if (orderSource === 'walk_in' && discountType && !discountIdNumber.trim()) {
      showToast(`Please enter the customer's ${discountType} ID number.`, 'error');
      return;
    }

    if (orderSource === 'walk_in' && paymentMethod === 'gcash' && !paymentReference) {
      setShowGCashModal(true);
      return;
    }

    await executeOrderPlacement();
  };

  const handleGCashPaymentComplete = (result: PaymentResult) => {
    if (result.success) {
      setPaymentReference(result.referenceNumber);
      setShowGCashModal(false);
      showToast('GCash payment confirmed!', 'success');
      void executeOrderPlacement(result.referenceNumber);
    } else {
      showToast(result.message || 'GCash payment was not completed.', 'error');
      setShowGCashModal(false);
    }
  };

  if (cartItems.length === 0 && !completedOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
        <NavbarEmployee />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="bg-white rounded-3xl shadow-xl p-12 text-center max-w-md border border-gray-100">
            <FiShoppingCart className="text-7xl text-gray-300 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Register is Empty</h2>
            <p className="text-gray-500 mb-6">Select food items from the menu to start customer checkout</p>
            <button
              onClick={() => navigate('/employee')}
              className="px-8 py-3.5 bg-[var(--oppa-green)] text-white rounded-xl font-bold hover:bg-[var(--oppa-green-dark)] transition-colors shadow-lg"
            >
              Open Register Menu →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarEmployee />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b border-[#e76f51]/20">
          <button
            onClick={() => navigate('/employee')}
            className="flex items-center gap-2 text-gray-500 hover:text-[#2d6a4f] transition-colors group"
          >
            <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
            <span className="text-sm font-medium">Back to Register Menu</span>
          </button>
          <span className="text-gray-300 text-xl">|</span>
          <h1 className="text-xl font-bold text-[#2d6a4f]">POS Register Checkout (Onsite)</h1>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void handlePlaceOrder(); }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <CheckoutForm
              orderSource={orderSource}
              setOrderSource={handleOrderSourceChange}
              externalOrderRef={externalOrderRef}
              setExternalOrderRef={setExternalOrderRef}
              diningOption={diningOption}
              setDiningOption={setDiningOption}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              notes={notes}
              setNotes={setNotes}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              paymentReference={paymentReference}
              setPaymentReference={setPaymentReference}
              cashTendered={cashTendered}
              setCashTendered={setCashTendered}
              totalDue={finalTotal}
              discountType={discountType}
              setDiscountType={setDiscountType}
              discountIdNumber={discountIdNumber}
              setDiscountIdNumber={setDiscountIdNumber}
              onOpenGCashModal={() => setShowGCashModal(true)}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              promoDiscount={promoDiscount}
              promoTitle={appliedPromo?.title}
              onApplyPromo={handleApplyPromo}
              onRemovePromo={handleRemovePromo}
              isPromoValidating={isPromoValidating}
              promoError={promoError}
            />
          </div>

          <div className="lg:col-span-1">
            <CheckoutSummary
              cartItems={cartItems}
              onPlaceOrder={handlePlaceOrder}
              discountRate={discountRate}
              discountAmount={discountAmount}
              promoDiscount={promoDiscount}
              promoCode={promoCode}
              isPlacingOrder={isPlacingOrder}
              orderSource={orderSource}
              externalOrderRef={externalOrderRef}
              isOrderSourceValid={orderSource === 'walk_in' || /^[A-Z0-9-]{3,30}$/.test(externalOrderRef)}
            />
          </div>
        </form>
      </div>

      <GCashPaymentModal
        isOpen={showGCashModal}
        onClose={() => setShowGCashModal(false)}
        amount={finalTotal}
        items={cartItems}
        deliveryType="onsite"
        discountRate={discountRate}
        promoCode={promoDiscount > 0 ? promoCode : null}
        cashierMode
        discountType={discountType}
        discountIdNumber={discountType ? discountIdNumber : undefined}
        onPaymentComplete={handleGCashPaymentComplete}
        onPaymentCreated={(ref) => setPaymentReference(ref)}
      />

      {showReceiptModal && completedOrder && (
        <POSReceiptModal
          order={completedOrder}
          onClose={() => {
            setShowReceiptModal(false);
            navigate('/employee/orders');
          }}
          onNewOrder={() => {
            setShowReceiptModal(false);
            navigate('/employee');
          }}
        />
      )}
    </div>
  );
};

export default EmployeeCheckoutPage;

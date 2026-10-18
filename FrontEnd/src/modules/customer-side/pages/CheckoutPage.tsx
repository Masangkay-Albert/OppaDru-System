import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../../../contexts/CartContext';
import { useOrder } from '../../../contexts/OrderContext';
import { useToast } from '../components/ToastProvider';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import CheckoutForm from '../components/checkout/CheckoutForm';
import CheckoutSummary from '../components/checkout/CheckoutSummary';
import GCashPaymentModal from '../components/checkout/GCashPaymentModal';
import CreditCardPaymentModal from '../components/checkout/CreditCardPaymentModal';
import ScheduleModal from '../components/checkout/ScheduleModal';
import { useCheckoutForm } from '../../../hooks/useCheckoutForm';
import { geocodeAddress, type Coordinates } from '../../../services/geocodingService';
import { cleanAddress } from '../../../utils/locationUtils';
import { useCartCalculations } from '../../../hooks/useCartCalculations';
import { useSettings } from '../../../contexts/SettingsContext';
import { getAvailableDates, generateTimeSlots } from '../../../services/checkoutService';
import type { PaymentResult } from '../components/checkout/paymentTypes';
import { resolveBranch, type BranchResolution } from '../../../services/branchRoutingService';
import '../../../styles/checkout-page.css';

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { placeOrder } = useOrder();
  const { showToast } = useToast();
  const { getActiveDiscount } = useSettings();
  const activeDiscount = getActiveDiscount();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [showGCashModal, setShowGCashModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [gcashReference, setGCashReference] = useState<string | undefined>();
  const [scheduleDisplay, setScheduleDisplay] = useState('Select date & time');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<'PWD' | 'Senior Citizen' | null>(activeDiscount.type === 'PWD' ? 'PWD' : activeDiscount.type === 'Senior' ? 'Senior Citizen' : null);
  const [discountProof, setDiscountProof] = useState<File | null>(null);
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<Coordinates | null>(null);
  const [branchResolution, setBranchResolution] = useState<BranchResolution | null>(null);
  const [branchError, setBranchError] = useState('');
  const selectedBranchName = branchResolution?.branch.name || 'Select a delivery address';
  const orderRequestRef = useRef<Promise<void> | null>(null);
  const selectedAddressCoordinatesRef = useRef<Coordinates | null>(null);

  const hasValidCoordinates = (coordinates: Coordinates | null): coordinates is Coordinates => (
    Boolean(coordinates)
    && Number.isFinite(coordinates.lat)
    && Number.isFinite(coordinates.lng)
    && !(coordinates.lat === 0 && coordinates.lng === 0)
  );

  const isSpecificAddress = (value: string): boolean => {
    const meaningfulParts = value
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part && !['philippines', 'calabarzon', 'region iv-a'].includes(part));
    return meaningfulParts.length >= 2;
  };

  useEffect(() => {
    if (!activeDiscount.type) {
      setDiscountType(null);
      setDiscountProof(null);
      return;
    }

    setDiscountType(activeDiscount.type === 'PWD' ? 'PWD' : 'Senior Citizen');
  }, [activeDiscount.type]);

  const {
    address,
    updateAddress,
    tempPerson,
    updatePerson,
    deliveryType,
    setDeliveryType,
    paymentMethod,
    setPaymentMethod,
    voucherDiscount,
  } = useCheckoutForm();

  useEffect(() => {
    if (!address.street.trim()) {
      selectedAddressCoordinatesRef.current = null;
      setDeliveryCoordinates(null);
      setBranchResolution(null);
      setBranchError('');
      return;
    }

    // Invalidate the previous address immediately. This prevents a branch,
    // delivery fee, or ETA for the old address from being shown while the new
    // address is still being geocoded.
    setDeliveryCoordinates(null);
    setBranchResolution(null);
    setBranchError('');

    // Saved/pinned addresses already have authoritative coordinates. Do not
    // replace them with a broad province-only text geocode.
    if (selectedAddressCoordinatesRef.current) {
      setDeliveryCoordinates(selectedAddressCoordinatesRef.current);
      selectedAddressCoordinatesRef.current = null;
      return;
    }

    if (!isSpecificAddress(address.street)) {
      setBranchError('Please pin your exact delivery location. A city or province alone is not enough for branch assignment.');
      return;
    }

    const timer = window.setTimeout(async () => {
      const coords = await geocodeAddress(cleanAddress(address.street));
      if (hasValidCoordinates(coords)) {
        setDeliveryCoordinates(coords);
      } else {
        setDeliveryCoordinates(null);
        setBranchError('We could not locate this address. Please pin your exact delivery location.');
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [address.street]);

  useEffect(() => {
    if (!deliveryCoordinates || cartItems.length === 0) {
      setBranchResolution(null);
      setBranchError('');
      return;
    }
    let active = true;
    const controller = new AbortController();
    setBranchResolution(null);
    setBranchError('');
    const timer = window.setTimeout(() => {
      resolveBranch({
        coordinates: deliveryCoordinates,
        items: cartItems.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
          selected_addons: (item.selectedAddons || []).map((addon) => ({ id: addon.id })),
        })),
        delivery_type: deliveryType,
        voucher_discount: voucherDiscount,
        discount_rate: activeDiscount.discountRate,
        fulfillment_type: 'delivery',
      }, controller.signal).then((result) => {
        if (!active) return;
        setBranchResolution(result);
        setBranchError(result.unavailable_items.length ? `Unavailable at this branch: ${result.unavailable_items.join(', ')}` : '');
      }).catch((error: unknown) => {
        if (!active) return;
        setBranchResolution(null);
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setBranchError(error instanceof Error ? error.message : 'Sorry, we do not deliver to this address yet.');
      });
    }, 250);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [deliveryCoordinates, cartItems, deliveryType, voucherDiscount, activeDiscount.discountRate]);

  // Delivery fee calculated server-side; frontend shows estimate only
  const { total } = useCartCalculations({
    cartItems,
    deliveryType,
    voucherDiscount,
    discount: activeDiscount.discountRate,
    deliveryCoordinates: deliveryCoordinates ?? undefined,
    originCoordinates: branchResolution ? { lat: branchResolution.branch.latitude, lng: branchResolution.branch.longitude } : undefined,
  });
  const buildFullDeliveryAddress = () => {
    const parts: string[] = [];

    if (address.block.trim()) {
      parts.push(`Block ${address.block.trim()}`);
    }
    if (address.lot.trim()) {
      parts.push(`Lot ${address.lot.trim()}`);
    }
    if (address.street.trim()) {
      parts.push(address.street.trim());
    }
    return parts.join(', ');
  };

  const buildScheduledAt = (date: Date | null, time: string | null): string | null => {
    if (!date || !time) return null;

    const timeMatch = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) return null;

    const [, hourText, minuteText, period] = timeMatch;
    let hour = Number(hourText);
    const minute = Number(minuteText);

    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;

    const scheduledDate = new Date(date);
    scheduledDate.setHours(hour, minute, 0, 0);
    return scheduledDate.toISOString();
  };

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const placeOrderDirect = async (paymentReference?: string) => {
    if (orderRequestRef.current) return;

    const request = (async () => {
    setIsPlacingOrder(true);

    try {
      if (!branchResolution || branchError || !deliveryCoordinates) {
        showToast(branchError || 'Please select a delivery address we can serve.', 'error');
        return;
      }
      const coords = deliveryCoordinates;

      const fullDeliveryAddress = buildFullDeliveryAddress();

      const scheduledAt = deliveryType === 'scheduled'
        ? buildScheduledAt(selectedDate, selectedTime)
        : null;
      if (deliveryType === 'scheduled' && !scheduledAt) {
        showToast('Please select a valid delivery date and time.', 'error');
        setShowScheduleModal(true);
        return;
      }
      const scheduledDate = deliveryType === 'scheduled' && selectedDate ? formatLocalDate(selectedDate) : null;
      const scheduledTime = deliveryType === 'scheduled' ? selectedTime : null;
      const scheduleDisplayValue = deliveryType === 'scheduled' ? scheduleDisplay : null;
      const scheduleWindowValue = deliveryType === 'scheduled' ? selectedTime : null;

      if (discountType && !discountProof) {
        showToast('Please upload your valid ID or proof for the discount request.', 'error');
        return;
      }

      const success = await placeOrder(
        cartItems,
        0,
        fullDeliveryAddress,
        paymentMethod,
        tempPerson.phone,
        coords,
        paymentReference || gcashReference,
        deliveryType,
        voucherDiscount,
        activeDiscount.discountRate,
        scheduledAt,
        scheduledDate,
        scheduledTime,
        scheduleDisplayValue,
        scheduleWindowValue,
        discountType,
        discountProof,
        branchResolution.branch.id
      );

      if (success) {
        setOrderCompleted(true);
        clearCart();
        showToast('Order placed successfully!', 'success');
        navigate('/customer/orders', { replace: true });
      } else {
        showToast('Failed to place order. Please try again.', 'error');
      }

    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to place order. Please try again.', 'error');
    } finally {
      setIsPlacingOrder(false);
    }
    })();

    orderRequestRef.current = request;
    try {
      await request;
    } finally {
      orderRequestRef.current = null;
    }
  };

  const handlePaymentComplete = (result: PaymentResult) => {
    if (result.success) {
      showToast('Payment successful!', 'success');
      void placeOrderDirect(result.referenceNumber);
    } else {
      showToast(result.message || 'Payment failed. Please try again.', 'error');
      setShowGCashModal(false);
      setShowCardModal(false);
    }
  };

  const handleScheduleConfirm = () => {
    if (selectedDate && selectedTime) {
      const dateStr = selectedDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      setDeliveryType('scheduled');
      setScheduleDisplay(`${dateStr} at ${selectedTime}`);
      showToast('Schedule set successfully!', 'success');
    }
  };

  const handlePlaceOrder = () => {
    if (isPlacingOrder) return;

    if (!address.street) {
      showToast('Please select a delivery address', 'error');
      return;
    }

    if (!branchResolution || branchError) {
      showToast(branchError || 'Please select a delivery address we can serve.', 'error');
      return;
    }

    if (!tempPerson.fullName) {
      showToast('Please enter your full name', 'error');
      return;
    }

    if (!tempPerson.phone) {
      showToast('Please enter your phone number', 'error');
      return;
    }

    if (deliveryType === 'scheduled' && (!selectedDate || !selectedTime)) {
      showToast('Please select a delivery date and time for your scheduled order.', 'error');
      setShowScheduleModal(true);
      return;
    }

    if (paymentMethod === 'cash_on_delivery') {
      placeOrderDirect();
      return;
    }

    if (paymentMethod === 'gcash') {
      setShowGCashModal(true);
      return;
    }

    if (paymentMethod === 'credit_card') {
      setShowCardModal(true);
      return;
    }
  };

  if (cartItems.length === 0 && !orderCompleted) {
    return (
      <div className="checkout-page min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
        <NavbarCustomer />
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <p className="rounded-xl border border-[var(--oppa-border)] bg-white px-4 py-3 text-sm text-[var(--oppa-text-muted)]">
            Ordering from: <span className="font-semibold text-[var(--oppa-green)]">{selectedBranchName || 'Loading branch...'}</span>
          </p>
        </div>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md">
            <FiShoppingCart className="text-7xl text-gray-300 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Add some delicious Korean fried chicken to your order!</p>
            <button
              onClick={() => navigate('/customer')}
              className="px-8 py-3 bg-[#e76f51] text-white rounded-xl font-semibold hover:bg-[#d45b3d] transition-colors"
            >
              Browse Menu →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />

      <div className="checkout-page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="checkout-page-header flex items-center gap-3 mb-6 pb-3 border-b border-[#e76f51]/20">
          <button
            onClick={() => navigate('/customer')}
            className="checkout-back-button flex items-center gap-2 text-gray-500 hover:text-[#2d6a4f] transition-colors group"
          >
            <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
            <span className="text-sm font-medium">Back to Menu</span>
          </button>
          <span className="text-gray-300 text-xl">|</span>
          <h1 className="checkout-page-title text-xl font-bold text-[#2d6a4f]">Review and place your order</h1>
        </div>

        <div className="checkout-layout grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="checkout-form-column lg:col-span-2">
            <CheckoutForm
              address={address}
              updateAddress={updateAddress}
              onAddressCoordinatesChange={(coordinates) => {
                selectedAddressCoordinatesRef.current = coordinates;
                setDeliveryCoordinates(coordinates);
              }}
              tempPerson={tempPerson}
              updatePerson={updatePerson}
              deliveryType={deliveryType}
              setDeliveryType={setDeliveryType}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              scheduleDisplay={scheduleDisplay}
              onScheduleClick={() => setShowScheduleModal(true)}
              discountType={discountType}
              discountProof={discountProof}
              onDiscountProofChange={setDiscountProof}
            />
          </div>

          <div className="checkout-summary-column lg:col-span-1">
            <CheckoutSummary
              cartItems={cartItems}
              deliveryType={deliveryType}
              onPlaceOrder={handlePlaceOrder}
              onVoucherApply={() => {}}
              voucherDiscount={voucherDiscount}
            deliveryCoordinates={deliveryCoordinates || undefined}
            branchCoordinates={branchResolution ? { lat: branchResolution.branch.latitude, lng: branchResolution.branch.longitude } : undefined}
            branchName={selectedBranchName}
            branchNotice={branchResolution?.notice || branchError}
            isPlacingOrder={isPlacingOrder}
            canPlaceOrder={Boolean(branchResolution && !branchError)}
            />
          </div>
        </div>
      </div>

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false);
          setSelectedDate(null);
          setSelectedTime(null);
        }}
        availableDates={getAvailableDates()}
        timeSlots={generateTimeSlots()}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        onSelectDate={setSelectedDate}
        onSelectTime={setSelectedTime}
        onConfirm={() => {
          handleScheduleConfirm();
          setShowScheduleModal(false);
        }}
      />

      <GCashPaymentModal
        isOpen={showGCashModal}
        onClose={() => setShowGCashModal(false)}
        amount={total}
        items={cartItems}
        deliveryType={deliveryType}
        voucherDiscount={voucherDiscount}
        discountRate={activeDiscount.discountRate}
        deliveryCoordinates={deliveryCoordinates || undefined}
        franchiseId={branchResolution?.branch.id || null}
        onPaymentComplete={handlePaymentComplete}
        onPaymentCreated={setGCashReference}
      />

      <CreditCardPaymentModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        amount={total}
        items={cartItems}
        deliveryType={deliveryType}
        voucherDiscount={voucherDiscount}
        discountRate={activeDiscount.discountRate}
        deliveryCoordinates={deliveryCoordinates || undefined}
        franchiseId={branchResolution?.branch.id || null}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
};

export default CheckoutPage;

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShoppingCart } from 'react-icons/fi';
import LocationPicker from '../components/common/LocationPicker';
import { useCart } from '../../../contexts/CartContext';
import { useOrder } from '../../../contexts/OrderContext';
import { useStoreHours } from '../../../contexts/StoreHoursContext';
import { useToast } from '../components/ToastProvider';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import CheckoutForm from '../components/checkout/CheckoutForm';
import CheckoutSummary from '../components/checkout/CheckoutSummary';
import GCashPaymentModal from '../components/checkout/GCashPaymentModal';
import CreditCardPaymentModal from '../components/checkout/CreditCardPaymentModal';
import ScheduleModal from '../components/checkout/ScheduleModal';
import { useCheckoutForm } from '../../../hooks/useCheckoutForm';
import type { Coordinates } from '../../../services/geocodingService';
import { useCartCalculations } from '../../../hooks/useCartCalculations';
import { useSettings } from '../../../contexts/SettingsContext';
import { getAvailableDates, generateTimeSlots } from '../../../services/checkoutService';
import { productService } from '../../../services/productService';
import type { DeliveryInstructions } from '../../../services/orderService';
import { getCheckoutBranchId } from '../../../services/branchCartStorage';
import type { PaymentResult } from '../components/checkout/paymentTypes';
import { BranchResolutionError, resolveBranch, type BranchResolution, type BranchResolutionDetails } from '../../../services/branchRoutingService';
import { OrderServiceError } from '../../../services/orderService';
import { getActiveBranches, setSelectedBranchId } from '../../../services/franchiseBranchService';
import type { FranchiseBranch } from '../../../services/franchiseBranchService';
import '../../../styles/checkout-page.css';

interface CheckoutDeliveryError extends BranchResolutionDetails {
  code: string;
  message: string;
}

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, clearCart, activeBranchId, setActiveBranchId, validateCartAgainstMenu, useCutlery } = useCart();
  const { placeOrder } = useOrder();
  const { status: storeHours } = useStoreHours();
  const { showToast } = useToast();
  const { getActiveDiscount } = useSettings();
  const activeDiscount = getActiveDiscount();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderCompleted, setOrderCompleted] = useState(false);
  const [showGCashModal, setShowGCashModal] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDeliveryLocationPicker, setShowDeliveryLocationPicker] = useState(false);
  const [gcashReference, setGCashReference] = useState<string | undefined>();
  const [scheduleDisplay, setScheduleDisplay] = useState('Select date & time');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const discountType = activeDiscount.type === 'PWD' ? 'PWD' : activeDiscount.type === 'Senior' ? 'Senior Citizen' : null;
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<Coordinates | null>(null);
  const [additionalStreet, setAdditionalStreet] = useState('');
  const [deliveryInstructions, setDeliveryInstructions] = useState<DeliveryInstructions>({});
  const [branchResolution, setBranchResolution] = useState<BranchResolution | null>(null);
  const [branchError, setBranchError] = useState<CheckoutDeliveryError | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);
  const [activeBranches, setActiveBranches] = useState<FranchiseBranch[]>([]);
  const [validatedMenuBranchId, setValidatedMenuBranchId] = useState<string | null>(null);
  const [menuValidationFailure, setMenuValidationFailure] = useState<{ branchId: string; message: string } | null>(null);
  const menuValidationReady = Boolean(activeBranchId && validatedMenuBranchId === activeBranchId);
  const menuValidationError = !activeBranchId
    ? 'Select a branch before checkout.'
    : menuValidationFailure?.branchId === activeBranchId
      ? menuValidationFailure.message
      : '';
  const [addressSelectionVersion, setAddressSelectionVersion] = useState(0);
  const cartBranchName = activeBranches.find((branch) => branch.id === activeBranchId)?.name || 'your selected branch';
  const selectedBranchName = activeBranches.find((branch) => branch.id === activeBranchId)?.name || 'Loading branch...';
  const orderRequestRef = useRef<Promise<void> | null>(null);
  const selectedAddressCoordinatesRef = useRef<Coordinates | null>(null);
  const cartBranchIds = [...new Set(cartItems.map((item) => item.franchise_id).filter((id): id is string => Boolean(id)))];
  const hasMixedCartBranches = cartBranchIds.length > 1;
  const orderingClosed = storeHours?.state === 'last_order_passed';

  const requireStoreOpen = () => {
    if (storeHours?.state === 'open') return true;
    showToast(storeHours?.order_closed_message || 'Store availability is temporarily unavailable.', 'error');
    return false;
  };

  useEffect(() => {
    void getActiveBranches().then(setActiveBranches).catch((error: unknown) => {
      showToast(error instanceof Error ? error.message : 'Unable to load branch details.', 'error');
    });
  }, [showToast]);

  useEffect(() => {
    if (!activeBranchId || cartItems.length === 0) return;

    let active = true;
    const branchId = activeBranchId;
    void productService.getAvailableProducts(activeBranchId)
      .then((products) => {
        if (!active) return;
        validateCartAgainstMenu(products);
        setMenuValidationFailure(null);
        setValidatedMenuBranchId(branchId);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMenuValidationFailure({
          branchId,
          message: error instanceof Error ? error.message : 'Unable to verify this branch menu.',
        });
        setValidatedMenuBranchId(null);
      });

    return () => { active = false; };
  }, [activeBranchId, cartItems.length, validateCartAgainstMenu]);

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
    setVoucherDiscount,
  } = useCheckoutForm();
  const [appliedPromo, setAppliedPromo] = useState<{ code: string } | null>(null);

  const buildFullDeliveryAddress = () => {
    const parts: string[] = [];
    if (address.block.trim()) parts.push(`Block ${address.block.trim()}`);
    if (address.lot.trim()) parts.push(`Lot ${address.lot.trim()}`);
    if (additionalStreet.trim()) parts.push(additionalStreet.trim());
    if (address.street.trim()) parts.push(address.street.trim());
    return parts.join(', ');
  };

  const scrollToAddressList = () => {
    document.getElementById('checkout-address-list')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const retryBranchResolution = () => {
    selectedAddressCoordinatesRef.current = deliveryCoordinates;
    setBranchError(null);
    setAddressSelectionVersion((version) => version + 1);
  };

  const switchToServingBranch = (branchId: string, branchName: string) => {
    const confirmed = window.confirm(
      `Switch to ${branchName} menu? Your current cart stays saved under ${cartBranchName}.`,
    );
    if (!confirmed) return;
    setSelectedBranchId(branchId);
    setActiveBranchId(branchId);
    showToast(`Switched to ${branchName}. Your ${cartBranchName} cart is saved.`, 'success');
    navigate('/customer');
  };
  const fullDeliveryAddress = buildFullDeliveryAddress();

  useEffect(() => {
    if (!fullDeliveryAddress.trim() || cartItems.length === 0) {
      selectedAddressCoordinatesRef.current = null;
      setDeliveryCoordinates(null);
      setBranchResolution(null);
      setBranchError(null);
      setBranchLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    if (hasMixedCartBranches) {
      setBranchResolution(null);
      setBranchError({
        code: 'CART_BRANCH_MISMATCH',
        message: 'Your cart has items from different branches. Remove items that do not belong to the same branch.',
      });
      setBranchLoading(false);
      return () => { active = false; };
    }
    const pinnedCoordinates = selectedAddressCoordinatesRef.current;
    selectedAddressCoordinatesRef.current = null;
    setDeliveryCoordinates(null);
    setBranchResolution(null);
    setBranchError(null);
    setBranchLoading(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        const request = {
          address: fullDeliveryAddress,
          ...(pinnedCoordinates ? { coordinates: pinnedCoordinates } : {}),
          items: cartItems.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
            selected_addons: (item.selectedAddons || []).map((addon) => ({ id: addon.id })),
          })),
          delivery_type: deliveryType,
          voucher_discount: voucherDiscount,
          discount_rate: activeDiscount.discountRate,
          fulfillment_type: 'delivery' as const,
        };

        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const result = await resolveBranch(request, controller.signal);
            if (!active) return;
            setBranchResolution(result);
            setDeliveryCoordinates(result.customer_coordinates);
            setBranchError(activeBranchId && result.branch.id !== activeBranchId
              ? {
                  code: 'BRANCH_MISMATCH',
                  message: `Your cart has items from ${cartBranchName}, but this address is served by ${result.branch.name}. Items from different branches can't be ordered together.`,
                  cartBranch: { id: activeBranchId, name: cartBranchName },
                  servingBranch: { id: result.branch.id, name: result.branch.name },
                }
              : result.unavailable_items.length
                ? { code: 'UNAVAILABLE_ITEMS', message: `Unavailable at this branch: ${result.unavailable_items.join(', ')}` }
                : null);
            setBranchLoading(false);
            return;
          } catch (error: unknown) {
            if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
            const retryable = !(error instanceof BranchResolutionError)
              || (error.status !== undefined && error.status >= 500);
            if (retryable && attempt < 2) {
              setBranchError({ code: 'CHECKING', message: 'Checking delivery availability…' });
              await new Promise<void>((resolve) => window.setTimeout(resolve, 600 * (attempt + 1)));
              if (!active) return;
              continue;
            }
            setBranchResolution(null);
            setDeliveryCoordinates(null);
            setBranchLoading(false);
            const errorCode = error instanceof BranchResolutionError ? error.code : undefined;
            const isUnlocatableAddress = errorCode === 'ADDRESS_NOT_FOUND' || errorCode === 'ADDRESS_TOO_BROAD';
            setBranchError(error instanceof BranchResolutionError
              ? {
                  code: error.code || 'DELIVERY_CHECK_FAILED',
                  message: isUnlocatableAddress
                    ? error.message
                    : 'We couldn’t check delivery availability. Please try again.',
                  ...error.details,
                }
              : {
                  code: 'DELIVERY_CHECK_FAILED',
                  message: 'We couldn’t check delivery availability. Please try again.',
                });
            return;
          }
        }
      })();
    }, 350);

    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [
    fullDeliveryAddress,
    addressSelectionVersion,
    cartItems,
    hasMixedCartBranches,
    deliveryType,
    voucherDiscount,
    activeDiscount.discountRate,
    activeBranchId,
    cartBranchName,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Delivery fee calculated server-side; frontend shows estimate only
  const { total } = useCartCalculations({
    cartItems,
    deliveryType,
    voucherDiscount,
    discount: activeDiscount.discountRate,
    deliveryCoordinates: deliveryCoordinates ?? undefined,
    originCoordinates: branchResolution ? { lat: branchResolution.branch.latitude, lng: branchResolution.branch.longitude } : undefined,
  });
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
    if (!requireStoreOpen()) return;
    if (orderRequestRef.current) return;

    const request = (async () => {
    setIsPlacingOrder(true);

    try {
      if (!menuValidationReady || menuValidationError) {
        showToast(menuValidationError || 'Please wait while we verify branch menu prices.', 'error');
        return;
      }
      if (cartItems.some((item) => item.cartIssue)) {
        showToast('Resolve unavailable items or price changes before checkout.', 'error');
        return;
      }
      const checkoutBranchId = getCheckoutBranchId(activeBranchId, branchResolution?.branch.id || null);
      if (!checkoutBranchId) {
        showToast(branchError?.message || 'Select the branch that serves your address to check out this branch cart.', 'error');
        return;
      }
      if (!branchResolution || branchError || !deliveryCoordinates) {
        showToast(branchError?.message || 'Please select a delivery address we can serve.', 'error');
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

      const placedOrderId = await placeOrder(
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
        null,
        checkoutBranchId,
        appliedPromo?.code || null,
        deliveryInstructions,
        useCutlery,
      );

      if (placedOrderId) {
        setOrderCompleted(true);
        clearCart();
        showToast('Order placed successfully!', 'success');
        navigate(`/orders/${encodeURIComponent(placedOrderId)}/track`, { replace: true });
      } else {
        showToast('Failed to place order. Please try again.', 'error');
      }

    } catch (error) {
      if (error instanceof OrderServiceError && ['OUT_OF_RANGE', 'BRANCH_MISMATCH', 'CART_BRANCH_MISMATCH'].includes(error.code || '')) {
        setBranchError({
          code: error.code || 'DELIVERY_CHECK_FAILED',
          message: error.message,
          title: error.title,
          nearestBranch: error.nearestBranch,
          cartBranch: error.cartBranch,
          servingBranch: error.servingBranch,
          distanceKm: error.distanceKm,
        });
      }
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
    if (!requireStoreOpen()) return;
    if (isPlacingOrder) return;

    if (!address.street) {
      showToast('Please select a delivery address', 'error');
      return;
    }

    if (!branchResolution || branchError) {
      showToast(branchError?.message || 'Please select a delivery address we can serve.', 'error');
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
              cartItems={cartItems}
              activeBranchId={activeBranchId}
              address={address}
              updateAddress={updateAddress}
              onAddressCoordinatesChange={(coordinates) => {
                selectedAddressCoordinatesRef.current = coordinates;
                setDeliveryCoordinates(coordinates);
                setAddressSelectionVersion((version) => version + 1);
              }}
              onStreetDetailChange={setAdditionalStreet}
              onDeliveryInstructionsChange={setDeliveryInstructions}
              tempPerson={tempPerson}
              updatePerson={updatePerson}
              deliveryType={deliveryType}
              setDeliveryType={setDeliveryType}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              scheduleDisplay={scheduleDisplay}
              onScheduleClick={() => setShowScheduleModal(true)}
            />
          </div>

          <div className="checkout-summary-column lg:col-span-1">
            <CheckoutSummary
              cartItems={cartItems}
              deliveryType={deliveryType}
              onPlaceOrder={handlePlaceOrder}
              onVoucherApply={(discount, promo) => {
                setVoucherDiscount(discount);
                setAppliedPromo(promo ? { code: promo.code } : null);
              }}
              voucherDiscount={voucherDiscount}
              branchId={branchResolution?.branch.id || activeBranchId}
            deliveryCoordinates={deliveryCoordinates || undefined}
            branchCoordinates={branchResolution ? { lat: branchResolution.branch.latitude, lng: branchResolution.branch.longitude } : undefined}
            branchName={branchResolution?.branch.name || branchError?.nearestBranch?.name}
            branchDistanceKm={branchResolution?.distance_km}
            deliveryError={branchError}
            isCheckingDelivery={branchLoading}
            cartBranchName={cartBranchName}
            hasMixedCartBranches={hasMixedCartBranches}
            cartValidationNotice={menuValidationError || (!menuValidationReady ? 'Verifying current menu availability and prices…' : undefined)}
            onPickLocation={() => setShowDeliveryLocationPicker(true)}
            onChooseAddress={scrollToAddressList}
            onRetryDeliveryCheck={retryBranchResolution}
            onSwitchBranch={switchToServingBranch}
            onBlockedOrderClick={scrollToAddressList}
            canPickLocation={Boolean(address.street.trim()) || Boolean(branchError)}
            isPlacingOrder={isPlacingOrder}
            canPlaceOrder={Boolean(storeHours?.state === 'open' && menuValidationReady && !menuValidationError && !cartItems.some((item) => item.cartIssue) && branchResolution && deliveryCoordinates && !branchError && !hasMixedCartBranches && branchResolution.branch.id === activeBranchId)}
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

      {showDeliveryLocationPicker && <LocationPicker
        initialAddress={address.street}
        onClose={() => setShowDeliveryLocationPicker(false)}
        onSelectLocation={(location) => {
          const coordinates = { lat: location.lat, lng: location.lng };
          selectedAddressCoordinatesRef.current = coordinates;
          updateAddress('street', location.address);
          setDeliveryCoordinates(coordinates);
          setBranchError(null);
          setAddressSelectionVersion((version) => version + 1);
          setShowDeliveryLocationPicker(false);
        }}
      />}

      <GCashPaymentModal
        isOpen={showGCashModal && !orderingClosed}
        onClose={() => setShowGCashModal(false)}
        amount={total}
        items={cartItems}
        deliveryType={deliveryType}
        promoCode={appliedPromo?.code || null}
        discountRate={activeDiscount.discountRate}
        deliveryCoordinates={deliveryCoordinates || undefined}
        franchiseId={activeBranchId || null}
        onPaymentComplete={handlePaymentComplete}
        onPaymentCreated={setGCashReference}
      />

      <CreditCardPaymentModal
        isOpen={showCardModal && !orderingClosed}
        onClose={() => setShowCardModal(false)}
        amount={total}
        items={cartItems}
        deliveryType={deliveryType}
        promoCode={appliedPromo?.code || null}
        discountRate={activeDiscount.discountRate}
        deliveryCoordinates={deliveryCoordinates || undefined}
        franchiseId={activeBranchId || null}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
};

export default CheckoutPage;

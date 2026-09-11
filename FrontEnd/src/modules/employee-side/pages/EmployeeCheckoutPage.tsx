import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../../../contexts/CartContext';
import { useToast } from '../../customer-side/components/ToastProvider';
import NavbarEmployee from '../components/navigation/NavbarEmployee';
import CheckoutForm from '../components/checkout/CheckoutForm';
import CheckoutSummary from '../components/checkout/CheckoutSummary';
import POSReceiptModal from '../components/pos/POSReceiptModal';
import { addOnsiteOrder, type AdminOrder } from '../../../services/adminOrderService';
import { calculateSubtotal } from '../../../services/cartService';

const EmployeeCheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { showToast } = useToast();

  const [diningOption, setDiningOption] = useState<'dine_in' | 'takeout'>('takeout');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'PWD' | 'Senior Citizen' | null>(null);
  const [discountIdNumber, setDiscountIdNumber] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<AdminOrder | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  const subtotal = calculateSubtotal(cartItems);
  const discountRate = discountType ? 0.20 : 0;
  const discountAmount = subtotal * discountRate;
  const netTotal = Math.max(0, subtotal - discountAmount);
  const vat = Math.round(netTotal * 0.12 * 100) / 100;
  const finalTotal = netTotal;

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      showToast('No items in the order.', 'error');
      return;
    }

    if (paymentMethod === 'cash' && cashTendered > 0 && cashTendered < finalTotal) {
      showToast('Cash tendered is less than total amount due.', 'error');
      return;
    }

    if (discountType && !discountIdNumber.trim()) {
      showToast(`Please enter the customer's ${discountType} ID number.`, 'error');
      return;
    }

    setIsPlacingOrder(true);

    try {
      const order = await addOnsiteOrder({
        customerName: customerName.trim() || 'Walk-in Customer',
        phone: customerPhone.trim() || undefined,
        items: cartItems,
        diningOption,
        notes: notes.trim() || undefined,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        discountType,
        discountRate,
        discountAmount,
        discountIdNumber: discountType ? discountIdNumber.trim() : undefined,
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
    } catch {
      showToast('Failed to process onsite order. Please try again.', 'error');
    } finally {
      setIsPlacingOrder(false);
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <CheckoutForm
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
            />
          </div>

          <div className="lg:col-span-1">
            <CheckoutSummary
              cartItems={cartItems}
              onPlaceOrder={handlePlaceOrder}
              discountRate={discountRate}
              discountAmount={discountAmount}
              isPlacingOrder={isPlacingOrder}
            />
          </div>
        </div>
      </div>

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

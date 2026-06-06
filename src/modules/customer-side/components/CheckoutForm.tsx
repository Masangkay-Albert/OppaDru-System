// src/modules/customer-side/components/CheckoutForm.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/Authcontext';
import type { CartItem } from '../../../types/product.types';
import type { Address, TempPerson } from '../pages/CheckoutPage';
import LocationPicker from './LocationPicker';

interface Props {
  address: Address;
  setAddress: (addr: Address) => void;
  cartItems: CartItem[];
  tempPerson: TempPerson;
  setTempPerson: (person: TempPerson) => void;
  deliveryType: 'standard' | 'priority';
  setDeliveryType: (type: 'standard' | 'priority') => void;
  paymentMethod: string;
  setPaymentMethod: (method: string) => void;
  appliedVoucher: any;
  setAppliedVoucher: (v: any) => void;
}

const CheckoutForm: React.FC<Props> = ({ 
  address, setAddress, cartItems, tempPerson, setTempPerson,
  deliveryType, setDeliveryType, paymentMethod, setPaymentMethod,
  appliedVoucher, setAppliedVoucher 
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isEditingPerson, setIsEditingPerson] = useState(false);
  const [editPerson, setEditPerson] = useState({ fullName: '', phone: '' });
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [deliveryOption, setDeliveryOption] = useState<'standard' | 'priority' | 'scheduled'>('standard');

  const calculateItemTotal = (item: CartItem) => {
    const addonsTotal = item.selectedAddons?.reduce((sum, a) => sum + a.price, 0) || 0;
    return (item.price + addonsTotal) * item.quantity;
  };

  const updateAddress = (field: keyof Address, value: string) => {
    setAddress({ ...address, [field]: value });
  };

  const handleLocationSelect = (location: { lat: number; lng: number; address: string; name: string }) => {
    if (location.name && location.name !== 'Delivery Location') {
      updateAddress('street', location.name);
    }
    setShowLocationPicker(false);
  };

  const startEditPerson = () => {
    setEditPerson({
      fullName: tempPerson.fullName || user?.fullName || '',
      phone: tempPerson.phone || ''
    });
    setIsEditingPerson(true);
  };

  const saveEditPerson = () => {
    setTempPerson({ 
      ...tempPerson, 
      fullName: editPerson.fullName, 
      phone: editPerson.phone 
    });
    setIsEditingPerson(false);
  };

  const cancelEditPerson = () => {
    setIsEditingPerson(false);
  };

  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    dates.push({ date: new Date(today), label: 'Today' });
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    dates.push({ date: tomorrow, label: 'Tomorrow' });
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 2);
    dates.push({ date: nextDay, label: nextDay.toLocaleDateString('en-US', { weekday: 'short' }) });
    return dates;
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 12; hour <= 22; hour++) {
      for (let minute of [0, 30]) {
        if (hour === 22 && minute === 30) continue;
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : hour;
        slots.push(`${displayHour}:${minute.toString().padStart(2, '0')} ${period}`);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const availableDates = getAvailableDates();

  const handleConfirmSchedule = () => {
    if (selectedDate && selectedTime) {
      setDeliveryOption('scheduled');
      setDeliveryType('standard');
      setShowSchedule(false);
    }
  };

  const getScheduleDisplay = () => {
    if (selectedDate && selectedTime) {
      const dateStr = selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `${dateStr} at ${selectedTime}`;
    }
    return 'Select date & time';
  };

  if (cartItems.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">🛒</div>
        <p className="text-gray-500 font-medium">Your cart is empty</p>
        <button onClick={() => navigate('/customer')} className="mt-4 px-6 py-2 bg-[#e76f51] text-white rounded-full font-medium hover:bg-[#f4a261] transition">
          Continue shopping →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personal Details - Editable (Name and Phone only) */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Personal details</h2>
          </div>
          {!isEditingPerson && (
            <button onClick={startEditPerson} className="text-[#e76f51] text-sm font-medium hover:underline flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        {isEditingPerson ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Full Name</label>
              <input 
                type="text" 
                value={editPerson.fullName} 
                onChange={(e) => setEditPerson({...editPerson, fullName: e.target.value})} 
                placeholder="Full Name" 
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#e76f51] focus:border-transparent" 
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Email Address</label>
              <input 
                type="email" 
                value={tempPerson.email || user?.email || ''} 
                disabled 
                className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed" 
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Phone Number</label>
              <input 
                type="tel" 
                value={editPerson.phone} 
                onChange={(e) => setEditPerson({...editPerson, phone: e.target.value})} 
                placeholder="Phone Number" 
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#e76f51] focus:border-transparent" 
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={saveEditPerson} className="px-4 py-2 bg-[#2d6a4f] text-white rounded-xl text-sm font-medium hover:bg-[#1b4d3e]">Save</button>
              <button onClick={cancelEditPerson} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 py-1 border-b border-gray-100">
              <span className="text-sm text-gray-500 w-24">Full Name</span>
              <span className="text-sm font-medium text-gray-800">{tempPerson.fullName || user?.fullName}</span>
            </div>
            <div className="flex items-center gap-2 py-1 border-b border-gray-100">
              <span className="text-sm text-gray-500 w-24">Email</span>
              <span className="text-sm font-medium text-gray-800">{tempPerson.email || user?.email}</span>
            </div>
            {tempPerson.phone && (
              <div className="flex items-center gap-2 py-1">
                <span className="text-sm text-gray-500 w-24">Phone</span>
                <span className="text-sm font-medium text-gray-800">{tempPerson.phone}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delivery Address */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Delivery Address</h2>
          </div>
          <button onClick={() => setShowLocationPicker(true)} className="text-[#e76f51] text-sm font-medium hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        </div>

        {address.street ? (
          <div className="mb-4 p-3 bg-[#d8f3dc] rounded-xl">
            <p className="text-gray-800 font-medium">{address.street}</p>
          </div>
        ) : (
          <p className="text-gray-400 text-sm mb-4">No address selected. Click Edit to add your delivery address.</p>
        )}

        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Additional details (optional)
          </p>
          <div className="grid grid-cols-1 gap-3">
            <input type="text" value={address.floor || ''} onChange={(e) => updateAddress('floor', e.target.value)} placeholder="Floor / Unit" className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#e76f51]" />
            <input type="text" value={address.note || ''} onChange={(e) => updateAddress('note', e.target.value)} placeholder="Note to rider" className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#e76f51]" />
          </div>
        </div>
      </div>

      {/* Delivery Options */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Delivery options</h2>
        </div>
        <div className="space-y-3">
          <label className="flex justify-between items-center p-4 border rounded-xl cursor-pointer hover:border-[#e76f51] transition">
            <div className="flex items-center gap-3">
              <input type="radio" name="delivery" checked={deliveryOption === 'standard'} onChange={() => { setDeliveryOption('standard'); setDeliveryType('standard'); }} className="accent-[#2d6a4f] w-4 h-4" />
              <div>
                <span className="font-medium text-gray-800">Standard</span>
                <p className="text-xs text-gray-400">35-50 mins</p>
              </div>
            </div>
            <span className="text-gray-500"></span>
          </label>
          <label className="flex justify-between items-center p-4 border rounded-xl cursor-pointer hover:border-[#e76f51] transition">
            <div className="flex items-center gap-3">
              <input type="radio" name="delivery" checked={deliveryOption === 'priority'} onChange={() => { setDeliveryOption('priority'); setDeliveryType('priority'); }} className="accent-[#2d6a4f] w-4 h-4" />
              <div>
                <span className="font-medium text-gray-800">Priority</span>
                <p className="text-xs text-gray-400">30-45 mins</p>
              </div>
            </div>
            <span className="font-medium text-[#e76f51]">₱99</span>
          </label>
          <label className="flex justify-between items-center p-4 border rounded-xl cursor-pointer hover:border-[#e76f51] transition">
            <div className="flex items-center gap-3">
              <input type="radio" name="delivery" checked={deliveryOption === 'scheduled'} onChange={() => setShowSchedule(true)} className="accent-[#2d6a4f] w-4 h-4" />
              <div>
                <span className="font-medium text-gray-800">Scheduled</span>
                <p className="text-xs text-gray-400">{getScheduleDisplay()}</p>
              </div>
            </div>
            <span className="text-gray-500"></span>
          </label>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Payment</h2>
        </div>
        <div className="space-y-2">
          {[
            { id: 'cash_on_delivery', name: 'Cash On Delivery', icon: '💰' },
            { id: 'gcash', name: 'GCash', icon: '📱' },
            { id: 'credit_card', name: 'Credit or Debit Card', icon: '💳' }
          ].map((m) => (
            <label key={m.id} className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer hover:border-[#e76f51] transition">
              <input type="radio" name="payment" checked={paymentMethod === m.id} onChange={() => setPaymentMethod(m.id)} className="accent-[#2d6a4f] w-4 h-4" />
              <span className="text-xl">{m.icon}</span>
              <span className="text-sm text-gray-700">{m.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Schedule Modal */}
      {showSchedule && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold text-lg">Select a date and time</h2>
              <button onClick={() => setShowSchedule(false)} className="text-2xl text-gray-400">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">Select date</p>
                <div className="flex gap-2">
                  {availableDates.map((d, i) => (
                    <button key={i} onClick={() => setSelectedDate(d.date)} className={`flex-1 py-3 rounded-xl border text-center transition ${selectedDate?.toDateString() === d.date.toDateString() ? 'border-[#e76f51] bg-[#fff3e0] text-[#e76f51]' : 'border-gray-200'}`}>
                      <p className="font-medium text-sm">{d.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              {selectedDate && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Select time</p>
                  <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {timeSlots.map((slot, idx) => (
                      <button key={idx} onClick={() => setSelectedTime(slot)} className={`py-2 px-3 rounded-lg border text-sm transition ${selectedTime === slot ? 'border-[#e76f51] bg-[#fff3e0] text-[#e76f51]' : 'border-gray-200'}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-3">
              <button onClick={() => setShowSchedule(false)} className="flex-1 py-2 border border-gray-300 rounded-xl text-gray-700">Cancel</button>
              <button onClick={handleConfirmSchedule} disabled={!selectedDate || !selectedTime} className={`flex-1 py-2 rounded-xl font-medium ${selectedDate && selectedTime ? 'bg-[#2d6a4f] text-white' : 'bg-gray-200 text-gray-400'}`}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPicker onSelectLocation={handleLocationSelect} onClose={() => setShowLocationPicker(false)} />
      )}
    </div>
  );
};

export default CheckoutForm;
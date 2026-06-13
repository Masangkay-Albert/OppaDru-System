import React from 'react';
import { ORDER_STATUS, STATUS_MESSAGES } from '../../../../utils/constants';
import type { Order } from '../../../../contexts/OrderContext';

interface OrderDetailsCardsProps {
  currentOrder: Order;
  formatDate: (date: Date) => string;
}

const OrderDetailsCards: React.FC<OrderDetailsCardsProps> = ({ currentOrder, formatDate }) => {
  const statusInfo = STATUS_MESSAGES[currentOrder.status];

  return (
    <div className="lg:col-span-1">
      {/* Order Status Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5 mb-4 border border-[#e76f51]/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Order Status</h3>
          <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
            currentOrder.status === ORDER_STATUS.DELIVERED ? 'bg-[#d8f3dc] text-[#2d6a4f]'
            : currentOrder.status === ORDER_STATUS.ON_THE_WAY ? 'bg-[#fff3e0] text-[#e76f51]'
            : 'bg-[#fef3c7] text-[#ca8a04]'
          }`}>
            {statusInfo.message}
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-800">₱{Math.round(currentOrder.total)}</p>
        <p className="text-sm text-gray-500 mt-1">{currentOrder.items.length} item(s)</p>
      </div>

      {/* Delivery Address Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5 mb-4 border border-[#e76f51]/20">
        <h3 className="font-semibold text-gray-800 mb-3">Delivery Address</h3>
        <div className="flex gap-3">
          <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-700">{currentOrder.deliveryAddress}</p>
            {currentOrder.eta > 0 && currentOrder.status !== ORDER_STATUS.DELIVERED && (
              <p className="text-xs text-[#e76f51] mt-1">ETA: {currentOrder.eta} minutes</p>
            )}
          </div>
        </div>
      </div>

      {/* Order Items Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5 mb-4 border border-[#e76f51]/20">
        <h3 className="font-semibold text-gray-800 mb-3">Order Items</h3>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {currentOrder.items.map((item, idx) => {
            const addonsTotal = item.selectedAddons?.reduce((s, a) => s + a.price, 0) || 0;
            const itemTotal = (item.price + addonsTotal) * item.quantity;
            return (
              <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                <span className="text-gray-600">{item.quantity}x {item.name}</span>
                <span className="text-gray-800 font-medium">₱{Math.round(itemTotal)}</span>
              </div>
            );
          })}
        </div>
        <div className="border-t border-[#e76f51]/20 pt-3 mt-2">
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span className="text-[#2d6a4f]">₱{Math.round(currentOrder.total)}</span>
          </div>
        </div>
      </div>

      {/* Order Info Card */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5 border border-[#e76f51]/20">
        <h3 className="font-semibold text-gray-800 mb-3">Order Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Order ID</span><span className="text-gray-700 font-mono text-xs">{currentOrder.id}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Placed on</span><span className="text-gray-700">{formatDate(currentOrder.createdAt)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Delivery Fee</span><span className="text-gray-700">₱49</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Service Fee</span><span className="text-gray-700">₱29</span></div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsCards;
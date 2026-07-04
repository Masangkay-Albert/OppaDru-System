// src/modules/customer-side/pages/OrderTrackingPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useOrder } from '../../../contexts/OrderContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { ORDER_STATUS, STATUS_COLORS } from '../../../utils/constants';
import { OPPA_DRU_STORE_COORDS } from '../../../services/geocodingService';
import type { Order } from '../../../contexts/OrderContext';

import RouteLayer from '../components/tracking/RouteLayer';
import DriverMarker from '../components/tracking/DriverMarker';
import MapLegend from '../components/tracking/MapLegend';
import ProgressBar from '../components/tracking/ProgressBar';
import OrderDetailsCards from '../components/tracking/OrderDetailsCards';
import { storeIcon, destinationIcon } from '../components/tracking/MapIcons';

interface TrackingLocationState {
  orderId?: string;
}

const OrderTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentOrder, getOrderById, updateOrderStatus, clearOrder } = useOrder();

  const locationState = location.state as TrackingLocationState | null;
  const requestedOrderId = locationState?.orderId;

  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleRouteLoaded = useCallback((points: [number, number][]) => {
    setRoutePoints(points);
    if (points.length > 0 && !isSimulating && order?.status !== ORDER_STATUS.DELIVERED) {
      setIsSimulating(true);
    }
  }, [isSimulating, order]);

  useEffect(() => {
    let resolvedOrder: Order | null = null;

    if (requestedOrderId) {
      resolvedOrder = getOrderById(requestedOrderId) || null;
    }

    if (!resolvedOrder) {
      resolvedOrder = currentOrder;
    }

    if (!resolvedOrder) {
      navigate('/customer');
      setIsLoading(false);
      return;
    }

    setOrder(resolvedOrder);
    setIsLoading(false);

    if (resolvedOrder.status === ORDER_STATUS.DELIVERED) {
      setIsSimulating(false);
      setSimulatedProgress(100);
    }

  }, [requestedOrderId, currentOrder, getOrderById, navigate]);

  useEffect(() => {
    if (!order || order.status === ORDER_STATUS.DELIVERED || !isSimulating) return;

    const interval = setInterval(() => {
      setSimulatedProgress(prev => {
        const newProgress = prev + 1.2;
        if (newProgress >= 95) {
          setIsSimulating(false);
          return 95;
        }
        return newProgress;
      });
    }, 700);

    return () => clearInterval(interval);
  }, [order, isSimulating]);

  const handleDeliver = useCallback(() => {
    if (order && order.status !== ORDER_STATUS.DELIVERED && simulatedProgress >= 95) {
      updateOrderStatus(order.id, ORDER_STATUS.DELIVERED);
      setOrder(prev => (prev ? { ...prev, status: ORDER_STATUS.DELIVERED } : prev));
      setSimulatedProgress(100);
    }
  }, [order, simulatedProgress, updateOrderStatus]);

  useEffect(() => {
    if (simulatedProgress >= 95 && order && order.status !== ORDER_STATUS.DELIVERED && !isSimulating) {
      const timer = setTimeout(() => {
        handleDeliver();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [simulatedProgress, order, isSimulating, handleDeliver]);

  const getProgress = () => {
    if (order?.status === ORDER_STATUS.DELIVERED) return 100;
    return simulatedProgress;
  };

  const formatDate = (date: string | Date) => {
    if (!date) return 'N/A';
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return 'N/A';
      return dateObj.toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'N/A';
    }
  };

  const handleOrderComplete = () => {
    clearOrder();
    navigate('/customer/orders');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#2d6a4f] mx-auto" />
          <p className="mt-4 text-gray-600">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Order Found</h2>
          <p className="text-gray-500 mb-4">You don't have any active orders.</p>
          <button
            onClick={() => navigate('/customer')}
            className="px-6 py-2 bg-[#2d6a4f] text-white rounded-xl hover:bg-[#1b4332] transition-colors"
          >
            Browse Menu
          </button>
        </div>
      </div>
    );
  }

  const progress = getProgress();
  const statusColor = STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-700';
  const isDelivered = order.status === ORDER_STATUS.DELIVERED;

  const mapCenter = order.deliveryAddressCoords ? [
    (OPPA_DRU_STORE_COORDS.lat + order.deliveryAddressCoords.lat) / 2,
    (OPPA_DRU_STORE_COORDS.lng + order.deliveryAddressCoords.lng) / 2
  ] : [OPPA_DRU_STORE_COORDS.lat, OPPA_DRU_STORE_COORDS.lng];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/customer/orders')}
              className="flex items-center gap-2 text-gray-600 hover:text-[#2d6a4f] transition-colors group"
            >
              <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium hover:underline">Back to My Orders</span>
            </button>
            <span className="text-gray-300">|</span>
            <h1 className="text-xl font-bold text-[#2d6a4f]">Track Your Order</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${statusColor}`}>
              {isDelivered ? 'Delivered' : order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || 'Pending'}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <ProgressBar status={isDelivered ? ORDER_STATUS.DELIVERED : order.status} progress={progress} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden isolate">
              <div className="h-[400px] w-full relative z-0">
                <MapContainer 
                  center={mapCenter as [number, number]}
                  zoom={13} 
                  style={{ height: '100%', width: '100%' }} 
                  zoomControl={true}
                >
                  <TileLayer 
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' 
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                  />
                  
                  <RouteLayer 
                    start={OPPA_DRU_STORE_COORDS} 
                    end={order.deliveryAddressCoords || OPPA_DRU_STORE_COORDS} 
                    progress={progress} 
                    onRouteLoaded={handleRouteLoaded} 
                  />
                  
                  <DriverMarker 
                    routePoints={routePoints} 
                    progress={progress}
                  />
                  
                  <Marker 
                    position={[OPPA_DRU_STORE_COORDS.lat, OPPA_DRU_STORE_COORDS.lng]} 
                    icon={storeIcon}
                  >
                    <Popup>
                      <div className="text-center">
                        <p className="font-semibold text-[#2d6a4f]">Oppa Dru</p>
                        <p className="text-xs text-gray-500">Store Location</p>
                      </div>
                    </Popup>
                  </Marker>
                  
                  {order.deliveryAddressCoords && (
                    <Marker 
                      position={[order.deliveryAddressCoords.lat, order.deliveryAddressCoords.lng]} 
                      icon={destinationIcon}
                    >
                      <Popup>
                        <div className="text-center">
                          <p className="font-semibold text-[#2d6a4f]">Delivery Address</p>
                          <p className="text-xs text-gray-500 truncate max-w-[200px]">
                            {order.deliveryAddress || order.address}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
              
              <MapLegend />
            </div>
          </div>

          <div className="lg:col-span-1">
            <OrderDetailsCards 
              currentOrder={{
                ...order,
                status: isDelivered ? ORDER_STATUS.DELIVERED : order.status
              }} 
              formatDate={formatDate} 
            />
            
            {!isDelivered && progress >= 95 && (
              <button 
                onClick={handleDeliver} 
                className="w-full mt-4 py-3 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition shadow-md animate-pulse"
              >
                Confirm Delivery ✓
              </button>
            )}

            {isDelivered && (
              <button 
                onClick={handleOrderComplete} 
                className="w-full mt-4 py-3 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition shadow-md"
              >
                Back to My Orders
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
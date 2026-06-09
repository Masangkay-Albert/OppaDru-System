// src/modules/customer-side/pages/OrderTrackingPage.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useOrder } from '../../../contexts/OrderContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { STATUS_MESSAGES, ORDER_STATUS } from '../../../utils/constants';
import { OPPA_DRU_STORE_COORDS } from '../../../services/geocodingService';
import oppaDeliveryIcon from '../../../assets/oppa-dru-delivery.png';
import oppaLogo from '../../../assets/oppadrulogo.jpg';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const driverIcon = new L.Icon({
  iconUrl: oppaDeliveryIcon,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const storeIcon = new L.Icon({
  iconUrl: oppaLogo,
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const OrderTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrder, clearOrder } = useOrder();
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [traveledPoints, setTraveledPoints] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!currentOrder) {
      navigate('/customer');
    }
  }, [currentOrder, navigate]);

  useEffect(() => {
    if (currentOrder && currentOrder.startPosition && currentOrder.deliveryAddressCoords) {
      const start: [number, number] = [currentOrder.startPosition.lat, currentOrder.startPosition.lng];
      const end: [number, number] = [currentOrder.deliveryAddressCoords.lat, currentOrder.deliveryAddressCoords.lng];
      
      const points: [number, number][] = [start];
      const steps = 30;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        points.push([
          start[0] + (end[0] - start[0]) * t,
          start[1] + (end[1] - start[1]) * t
        ]);
      }
      setRoutePoints(points);
    }
  }, [currentOrder]);

  useEffect(() => {
    if (currentOrder && routePoints.length > 0) {
      const progress = currentOrder.currentRouteIndex / 100;
      const traveledCount = Math.floor(progress * routePoints.length);
      const count = Math.max(1, Math.min(traveledCount + 1, routePoints.length));
      setTraveledPoints(routePoints.slice(0, count));
    }
  }, [currentOrder, routePoints]);

  if (!currentOrder) {
    return null;
  }

  const statusInfo = STATUS_MESSAGES[currentOrder.status];
  const progressPercentage = currentOrder.status === ORDER_STATUS.DELIVERED ? 100 : currentOrder.currentRouteIndex;

  const mapCenter: [number, number] = [
    (OPPA_DRU_STORE_COORDS.lat + currentOrder.deliveryAddressCoords.lat) / 2,
    (OPPA_DRU_STORE_COORDS.lng + currentOrder.deliveryAddressCoords.lng) / 2
  ];

  const getZoomLevel = () => {
    const distance = Math.abs(OPPA_DRU_STORE_COORDS.lat - currentOrder.deliveryAddressCoords.lat);
    if (distance > 0.3) return 11;
    if (distance > 0.1) return 12;
    return 13;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-PH', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button 
            onClick={() => navigate('/customer')} 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-[#2d6a4f] transition mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm">Back to Menu</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[#2d6a4f]">Track Your Order</h1>
            <p className="text-sm text-gray-600 mt-1">Real-time delivery tracking</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Map */}
          <div className="lg:col-span-2">
            {/* Progress Bar */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-4 mb-4 border border-[#e76f51]/20">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span className={currentOrder.status === ORDER_STATUS.PREPARING ? 'text-[#2d6a4f] font-medium' : ''}>Order placed</span>
                <span className={currentOrder.status === ORDER_STATUS.ON_THE_WAY ? 'text-[#2d6a4f] font-medium' : ''}>Preparing</span>
                <span className={currentOrder.status === ORDER_STATUS.ARRIVING_SOON ? 'text-[#2d6a4f] font-medium' : ''}>On the way</span>
                <span className={currentOrder.status === ORDER_STATUS.DELIVERED ? 'text-[#2d6a4f] font-medium' : ''}>Delivered</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#2d6a4f] transition-all duration-500 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>

            {/* Map */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md overflow-hidden border border-[#e76f51]/20">
              <div className="h-[450px] w-full">
                <MapContainer 
                  center={mapCenter} 
                  zoom={getZoomLevel()} 
                  style={{ height: '100%', width: '100%' }} 
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {routePoints.length > 0 && (
                    <Polyline 
                      positions={routePoints} 
                      color="#e76f51" 
                      weight={3} 
                      opacity={0.4} 
                      dashArray="8, 8" 
                    />
                  )}
                  
                  {traveledPoints.length > 1 && (
                    <Polyline 
                      positions={traveledPoints} 
                      color="#2d6a4f" 
                      weight={4} 
                      opacity={0.9} 
                    />
                  )}
                  
                  <Marker 
                    position={[OPPA_DRU_STORE_COORDS.lat, OPPA_DRU_STORE_COORDS.lng]} 
                    icon={storeIcon}
                  >
                    <Popup>
                      <div className="text-center py-1">
                        <p className="font-semibold text-gray-800">Oppa Dru</p>
                        <p className="text-xs text-gray-500">Store Location</p>
                      </div>
                    </Popup>
                  </Marker>
                  
                  <Marker 
                    position={[currentOrder.deliveryAddressCoords.lat, currentOrder.deliveryAddressCoords.lng]} 
                    icon={destinationIcon}
                  >
                    <Popup>
                      <div className="text-center py-1">
                        <p className="font-semibold text-gray-800">Delivery Address</p>
                        <p className="text-xs text-gray-500 truncate max-w-[200px]">{currentOrder.deliveryAddress}</p>
                      </div>
                    </Popup>
                  </Marker>
                  
                  {currentOrder.status !== ORDER_STATUS.DELIVERED && (
                    <Marker 
                      position={[currentOrder.driverPosition.lat, currentOrder.driverPosition.lng]} 
                      icon={driverIcon}
                    >
                      <Popup>
                        <div className="text-center py-1">
                          <p className="font-semibold text-gray-800">Delivery Driver</p>
                          <p className="text-xs text-[#e76f51] mt-1">ETA: ~{currentOrder.eta} min</p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
              
              <div className="p-3 bg-[#fdf4e6] border-t border-[#e76f51]/20">
                <div className="flex items-center justify-center gap-5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-[#2d6a4f]"></div>
                    <span className="text-gray-600">Route taken</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-0.5 bg-[#e76f51] border-t border-dashed border-[#e76f51]"></div>
                    <span className="text-gray-600">Remaining</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-white border-2 border-[#e76f51] rounded-full"></div>
                    <span className="text-gray-600">Store</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-600">Destination</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Order Details */}
          <div className="lg:col-span-1">
            {/* Order Status Card */}
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-5 mb-4 border border-[#e76f51]/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Order Status</h3>
                <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                  currentOrder.status === ORDER_STATUS.DELIVERED 
                    ? 'bg-[#d8f3dc] text-[#2d6a4f]'
                    : currentOrder.status === ORDER_STATUS.ON_THE_WAY
                    ? 'bg-[#fff3e0] text-[#e76f51]'
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
                  const itemTotal = (item.price + (item.selectedAddons?.reduce((s, a) => s + a.price, 0) || 0)) * item.quantity;
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
                <div className="flex justify-between">
                  <span className="text-gray-500">Order ID</span>
                  <span className="text-gray-700 font-mono text-xs">{currentOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Placed on</span>
                  <span className="text-gray-700">{formatDate(currentOrder.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Delivery Fee</span>
                  <span className="text-gray-700">₱49</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Service Fee</span>
                  <span className="text-gray-700">₱29</span>
                </div>
              </div>
            </div>

            {/* Complete Button */}
            {currentOrder.status === ORDER_STATUS.DELIVERED && (
              <button 
                onClick={() => { clearOrder(); navigate('/customer'); }} 
                className="w-full mt-4 py-3 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition shadow-md"
              >
                Order Complete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
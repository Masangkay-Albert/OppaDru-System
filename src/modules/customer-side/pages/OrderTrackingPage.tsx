// src/modules/customer-side/pages/OrderTrackingPage.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useOrder } from '../../../contexts/OrderContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { ORDER_STATUS } from '../../../utils/constants';
import { OPPA_DRU_STORE_COORDS } from '../../../services/geocodingService';

import RouteLayer from '../components/tracking/RouteLayer';        
import DriverMarker from '../components/tracking/DriverMarker';    
import MapLegend from '../components/tracking/MapLegend';          
import ProgressBar from '../components/tracking/ProgressBar';     
import OrderDetailsCards from '../components/tracking/OrderDetailsCards'; 
import { storeIcon, destinationIcon } from '../components/tracking/MapIcons'; 

const OrderTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentOrder, clearOrder } = useOrder();
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);

  useEffect(() => {
    if (!currentOrder) navigate('/customer');
  }, [currentOrder, navigate]);

  if (!currentOrder) return null;

  const progress = currentOrder.status === ORDER_STATUS.DELIVERED ? 100 : currentOrder.currentRouteIndex;
  const mapCenter: [number, number] = [
    (OPPA_DRU_STORE_COORDS.lat + currentOrder.deliveryAddressCoords.lat) / 2,
    (OPPA_DRU_STORE_COORDS.lng + currentOrder.deliveryAddressCoords.lng) / 2
  ];

  const formatDate = (date: Date) => date.toLocaleDateString('en-PH', { 
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
  });

  const handleRouteLoaded = useCallback((points: [number, number][]) => setRoutePoints(points), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button onClick={() => navigate('/customer')} className="inline-flex items-center gap-2 text-gray-600 hover:text-[#2d6a4f] transition mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm">Back to Menu</span>
          </button>
          <h1 className="text-2xl font-bold text-[#2d6a4f]">Track Your Order</h1>
          <p className="text-sm text-gray-600 mt-1">Real-time delivery tracking</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Map */}
          <div className="lg:col-span-2">
            <ProgressBar status={currentOrder.status} progress={progress} />

            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md overflow-hidden border border-[#e76f51]/20">
              <div className="h-[450px] w-full relative">
                <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={true}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  
                  <RouteLayer start={OPPA_DRU_STORE_COORDS} end={currentOrder.deliveryAddressCoords} progress={progress} onRouteLoaded={handleRouteLoaded} />
                  <DriverMarker routePoints={routePoints} progress={progress} />
                  
                  <Marker position={[OPPA_DRU_STORE_COORDS.lat, OPPA_DRU_STORE_COORDS.lng]} icon={storeIcon}>
                    <Popup><div className="text-center"><p className="font-semibold">Oppa Dru</p><p className="text-xs">Store Location</p></div></Popup>
                  </Marker>
                  
                  <Marker position={[currentOrder.deliveryAddressCoords.lat, currentOrder.deliveryAddressCoords.lng]} icon={destinationIcon}>
                    <Popup><div className="text-center"><p className="font-semibold">Delivery Address</p><p className="text-xs truncate max-w-[200px]">{currentOrder.deliveryAddress}</p></div></Popup>
                  </Marker>
                </MapContainer>
              </div>
              
              <MapLegend />

              {currentOrder.status === ORDER_STATUS.ON_THE_WAY && (
                <div className="mt-3 bg-[#e76f51]/10 rounded-lg p-2 text-center">
                  <p className="text-xs text-[#e76f51]">🚗 Driver is following the route. ETA: ~{currentOrder.eta} minutes</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Order Details */}
          <OrderDetailsCards currentOrder={currentOrder} formatDate={formatDate} />

          {/* Complete Order Button */}
          {currentOrder.status === ORDER_STATUS.DELIVERED && (
            <button onClick={() => { clearOrder(); navigate('/customer'); }} className="lg:col-start-2 mt-4 py-3 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition shadow-md">
              Order Complete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderTrackingPage;
// src/modules/customer-side/components/common/LocationPicker.tsx
import React, { useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FiX, FiMapPin, FiInfo, FiNavigation, FiCheck } from 'react-icons/fi';
import { reverseGeocode } from '../../../../services/geocodingService';
import AddressSearchDropdown from './AddressSearchDropdown';
import type { LocationResult } from '../../../../hooks/useLocationSearch';
import '../../../../styles/animations.css';

const PHILIPPINES_CENTER = { lat: 12.8797, lng: 121.774 };
const PHILIPPINES_BOUNDS: [[number, number], [number, number]] = [[4.2, 116.5], [21.5, 127.5]];

interface LocationPickerProps {
  onSelectLocation: (location: {
    lat: number;
    lng: number;
    address: string;
    name: string;
  }) => void;
  onClose: () => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
}

// Fix for default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationPicker: React.FC<LocationPickerProps> = ({
  onSelectLocation,
  onClose,
  initialLat = PHILIPPINES_CENTER.lat,
  initialLng = PHILIPPINES_CENTER.lng,
  initialAddress = ''
}) => {
  const mapRef = useRef<any>(null);
  const hasValidInitialPosition = Number.isFinite(initialLat) && Number.isFinite(initialLng)
    && !(initialLat === 0 && initialLng === 0);
  const [position, setPosition] = useState(hasValidInitialPosition
    ? { lat: initialLat, lng: initialLng }
    : PHILIPPINES_CENTER);
  const [selectedAddress, setSelectedAddress] = useState<string>(initialAddress);
  const [selectedName, setSelectedName] = useState<string>('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [hasConfirmedPosition, setHasConfirmedPosition] = useState(hasValidInitialPosition);

  useEffect(() => {
    if (initialAddress) {
      setSelectedAddress(initialAddress);
      setSelectedName(initialAddress.split(',')[0]?.trim() || initialAddress);
    }
  }, [initialAddress]);

  const handleMapClick = async (lat: number, lng: number) => {
    setPosition({ lat, lng });
    setHasConfirmedPosition(true);
    const address = await reverseGeocode(lat, lng);
    if (address) {
      setSelectedAddress(address);
      setSelectedName(address.split(',')[0]?.trim() || address);
    }
  };

  const handleSearchSelect = (location: LocationResult) => {
    setPosition({ lat: location.lat, lng: location.lng });
    setHasConfirmedPosition(!location.isBroad);
    setSelectedAddress(location.address);
    setSelectedName(location.name);
    setIsSearchFocused(false);
    if (mapRef.current) {
      mapRef.current.setView([location.lat, location.lng], location.isBroad ? 8 : 16, { animate: false });
    }
  };

  const handleConfirm = () => {
    if (selectedAddress && hasConfirmedPosition) {
      onSelectLocation({
        lat: position.lat,
        lng: position.lng,
        address: selectedAddress,
        name: selectedName || selectedAddress
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white flex-shrink-0">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FiMapPin size={20} />
            Select Your Location
          </h2>
          <button 
            onClick={onClose} 
            className="text-2xl hover:rotate-90 transition-transform duration-300 hover:text-gray-200 p-1"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Info Banner */}
        <div className="p-4 bg-[#d8f3dc]/30 border-b border-[#2d6a4f]/10 flex-shrink-0">
          <p className="text-sm text-[#2d6a4f] flex items-center gap-2">
            <FiInfo size={16} />
            Providing your location enables more accurate search and delivery across the Philippines.
          </p>
        </div>

        {/* Search Section - Fixed height with relative positioning */}
        <div className="p-4 border-b border-gray-200 flex-shrink-0 relative z-10">
          <AddressSearchDropdown
            onSelect={handleSearchSelect}
            placeholder="Search any city, subdivision, or landmark in the Philippines..."
            className="w-full"
            initialValue={initialAddress}
            onFocusChange={setIsSearchFocused}
          />
        </div>

        {/* Selected Location Preview */}
        {selectedAddress && (
          <div className="p-4 border-b border-gray-200 bg-[#fdf6ed] flex-shrink-0">
            <p className="text-sm text-gray-500">Selected location:</p>
            <p className="font-medium text-gray-800">{selectedName}</p>
            <p className="text-xs text-gray-500 truncate">{selectedAddress}</p>
            {!hasConfirmedPosition && (
              <p className="mt-2 text-xs font-medium text-amber-700">
                This result is only a province or region. Click the map or move the pin to set your exact delivery location.
              </p>
            )}
          </div>
        )}

        {/* Map Section - With proper z-index and pointer events */}
        <div className="relative flex-1 min-h-[300px]">
          <div className={`absolute inset-0 ${isSearchFocused ? 'pointer-events-none' : 'pointer-events-auto'}`}>
            <MapContainer 
              center={position} 
              zoom={hasValidInitialPosition ? 15 : 6}
              minZoom={5}
              maxBounds={PHILIPPINES_BOUNDS}
              maxBoundsViscosity={0.85}
              style={{ height: '100%', width: '100%' }} 
              ref={mapRef}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker 
                position={[position.lat, position.lng]} 
                draggable={true} 
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const pos = marker.getLatLng();
                    setPosition({ lat: pos.lat, lng: pos.lng });
                    setHasConfirmedPosition(true);
                    reverseGeocode(pos.lat, pos.lng).then((addr) => {
                      if (addr) {
                        setSelectedAddress(addr);
                        setSelectedName(addr.split(',')[0]?.trim() || addr);
                      }
                    });
                  }
                }} 
              />
              <MapClickHandler onMapClick={handleMapClick} />
            </MapContainer>
          </div>
          
          {/* Map Hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-gray-500 bg-white/90 px-4 py-2 rounded-full shadow-md flex items-center gap-2 z-10">
            <FiNavigation size={14} />
            Drag marker or click map to adjust location
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-gray-200 flex gap-3 bg-gray-50 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedAddress || !hasConfirmedPosition}
            className="flex-1 py-2.5 bg-[#2d6a4f] text-white rounded-xl hover:bg-[#1b4d3e] transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            <FiCheck size={18} />
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

const MapClickHandler: React.FC<{ onMapClick: (lat: number, lng: number) => void }> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

export default LocationPicker;

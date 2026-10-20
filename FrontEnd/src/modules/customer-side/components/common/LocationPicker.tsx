// src/modules/customer-side/components/common/LocationPicker.tsx
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
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
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationPicker: React.FC<LocationPickerProps> = ({
  onSelectLocation,
  onClose,
  initialLat,
  initialLng,
  initialAddress = ''
}) => {
  const mapRef = useRef<LeafletMap | null>(null);
  const hasValidInitialPosition = Number.isFinite(initialLat) && Number.isFinite(initialLng)
    && initialLat! >= PHILIPPINES_BOUNDS[0][0] && initialLat! <= PHILIPPINES_BOUNDS[1][0]
    && initialLng! >= PHILIPPINES_BOUNDS[0][1] && initialLng! <= PHILIPPINES_BOUNDS[1][1];
  const [position, setPosition] = useState(hasValidInitialPosition
    ? { lat: initialLat!, lng: initialLng! }
    : PHILIPPINES_CENTER);
  const [selectedAddress, setSelectedAddress] = useState<string>(initialAddress);
  const [selectedName, setSelectedName] = useState<string>(initialAddress.split(',')[0]?.trim() || '');
  const [hasConfirmedPosition, setHasConfirmedPosition] = useState(hasValidInitialPosition);
  const [searchQuery, setSearchQuery] = useState('');
  const reverseGeocodeRequestRef = useRef(0);

  useEffect(() => {
    const body = document.body;
    const previousOverflow = body.style.overflow;
    const previousOverscrollBehavior = body.style.overscrollBehavior;
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';

    return () => {
      body.style.overflow = previousOverflow;
      body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  const handleMapClick = async (lat: number, lng: number) => {
    const requestId = ++reverseGeocodeRequestRef.current;
    setPosition({ lat, lng });
    setHasConfirmedPosition(true);
    const address = await reverseGeocode(lat, lng);
    if (requestId !== reverseGeocodeRequestRef.current) return;
    const fallbackAddress = searchQuery.trim() || `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    const resolvedAddress = address || fallbackAddress;
    setSelectedAddress(resolvedAddress);
    setSelectedName(resolvedAddress.split(',')[0]?.trim() || resolvedAddress);
  };

  const handleSearchSelect = (location: LocationResult) => {
    reverseGeocodeRequestRef.current++;
    setPosition({ lat: location.lat, lng: location.lng });
    setHasConfirmedPosition(!location.isBroad);
    setSelectedAddress(location.address);
    setSelectedName(location.name);
    setSearchQuery(location.address);
    if (mapRef.current) {
      mapRef.current.setView([location.lat, location.lng], location.isBroad ? 8 : 16, { animate: false });
    }
  };

  const handleSearchQueryChange = (query: string) => {
    reverseGeocodeRequestRef.current++;
    setSearchQuery(query);
    if (query.trim() === selectedAddress.trim()) return;
    setSelectedAddress('');
    setSelectedName('');
    setHasConfirmedPosition(false);
  };

  const handleMarkerDragEnd = async (lat: number, lng: number) => {
    const requestId = ++reverseGeocodeRequestRef.current;
    setPosition({ lat, lng });
    setHasConfirmedPosition(true);
    const address = await reverseGeocode(lat, lng);
    if (requestId !== reverseGeocodeRequestRef.current) return;
    const resolvedAddress = address || searchQuery.trim() || `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    setSelectedAddress(resolvedAddress);
    setSelectedName(resolvedAddress.split(',')[0]?.trim() || resolvedAddress);
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
    <div className="fixed inset-0 bg-black/50 z-[1000] flex items-end justify-center pt-16 sm:items-center sm:p-4 animate-fadeIn">
      <div className="bg-white rounded-t-2xl rounded-b-none sm:rounded-2xl max-w-2xl w-full max-h-[calc(100dvh-4rem)] sm:max-h-[90dvh] overflow-hidden flex flex-col shadow-2xl">
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

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
          {/* Info Banner */}
          <div className="p-4 bg-[#d8f3dc]/30 border-b border-[#2d6a4f]/10 flex-shrink-0">
            <p className="text-sm text-[#2d6a4f] flex items-start gap-2">
              <FiInfo size={16} className="mt-0.5 shrink-0" />
              <span>Providing your location enables more accurate search and delivery across the Philippines.</span>
            </p>
          </div>

          {/* Search Section */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0 relative z-10">
            <AddressSearchDropdown
              onSelect={handleSearchSelect}
              placeholder="Search any city, subdivision, or landmark in the Philippines..."
              className="w-full"
              initialValue={initialAddress}
              onQueryChange={handleSearchQueryChange}
            />
          </div>

          {/* Selected Location Preview */}
          {selectedAddress && (
            <div className="p-4 border-b border-gray-200 bg-[#fdf6ed] flex-shrink-0">
              <p className="text-sm text-gray-500">Selected location:</p>
              <p className="font-medium text-gray-800 break-words">{selectedName}</p>
              <p className="text-xs text-gray-500 break-words">{selectedAddress}</p>
              {!hasConfirmedPosition && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  This result is only a province or region. Click the map or move the pin to set your exact delivery location.
                </p>
              )}
            </div>
          )}

          {/* Map Section */}
          <div className="relative h-[200px] w-full shrink-0 sm:h-[260px] md:h-[300px]">
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
                    void handleMarkerDragEnd(pos.lat, pos.lng);
                  }
                }}
              />
              <MapClickHandler onMapClick={handleMapClick} />
              <MapSizeInvalidator />
            </MapContainer>

            {/* Map Hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-1rem)] text-xs text-gray-500 bg-white/90 px-3 sm:px-4 py-2 rounded-full shadow-md flex items-center justify-center gap-2 text-center z-10">
              <FiNavigation size={14} className="shrink-0" />
              <span>Drag marker or click map to adjust location</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 z-20 grid grid-cols-2 gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-200 bg-gray-50 flex-shrink-0 sm:flex">
          <button
            onClick={onClose}
            className="h-12 min-h-11 whitespace-nowrap py-2.5 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition font-medium sm:flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedAddress || !hasConfirmedPosition}
            className="h-12 min-h-11 whitespace-nowrap py-2.5 bg-[#2d6a4f] text-white rounded-xl hover:bg-[#1b4d3e] transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 sm:flex-1"
          >
            <FiCheck size={18} />
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

const MapSizeInvalidator: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const invalidateSize = () => {
      window.requestAnimationFrame(() => map.invalidateSize({ pan: false }));
    };
    const initialResize = window.setTimeout(invalidateSize, 100);
    const observer = new ResizeObserver(invalidateSize);
    observer.observe(map.getContainer());

    return () => {
      window.clearTimeout(initialResize);
      observer.disconnect();
    };
  }, [map]);

  return null;
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

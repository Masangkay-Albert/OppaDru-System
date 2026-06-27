import React, { useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress, reverseGeocode } from '../../../../services/geocodingService';
import '../../../../styles/animations.css';

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
}

const LocationPicker: React.FC<LocationPickerProps> = ({
  onSelectLocation,
  onClose,
  initialLat = 14.329,
  initialLng = 120.936
}) => {
  const mapRef = useRef<any>(null);
  const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [selectedName, setSelectedName] = useState<string>('');

  const handleMapClick = async (lat: number, lng: number) => {
    setPosition({ lat, lng });
    const address = await reverseGeocode(lat, lng);
    if (address) {
      setSelectedAddress(address);
      setSelectedName(address.split(',')[0]?.trim() || address);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const result = await geocodeAddress(searchQuery);
    if (result) {
      setPosition(result);
      setSelectedAddress(searchQuery);
      setSelectedName(searchQuery.split(',')[0]?.trim() || searchQuery);
      if (mapRef.current) {
        mapRef.current.flyTo([result.lat, result.lng], 16);
      }
    }
    setIsSearching(false);
  };

  const handleConfirm = () => {
    if (selectedAddress) {
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
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white">
          <h2 className="text-lg font-semibold">Select Your Location</h2>
          <button onClick={onClose} className="text-2xl hover:rotate-90 transition-transform duration-300">
            ✕
          </button>
        </div>

        <div className="p-4 bg-[#d8f3dc]/30 border-b border-[#2d6a4f]/10">
          <p className="text-sm text-[#2d6a4f]">📍 Providing your location enables more accurate search and delivery.</p>
        </div>

        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for your location..."
              className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-[#2d6a4f] focus:outline-none transition"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-[#2d6a4f] text-white rounded-xl hover:bg-[#1b4d3e] transition disabled:opacity-50"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {selectedAddress && (
          <div className="p-4 border-b border-gray-200 bg-[#fdf6ed]">
            <p className="text-sm text-gray-500">Selected location:</p>
            <p className="font-medium text-gray-800">{selectedName}</p>
            <p className="text-xs text-gray-500">{selectedAddress}</p>
          </div>
        )}

        <div className="h-64 relative">
          <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }} ref={mapRef}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={[position.lat, position.lng]} draggable={true} eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const pos = marker.getLatLng();
                setPosition({ lat: pos.lat, lng: pos.lng });
                reverseGeocode(pos.lat, pos.lng).then((addr) => {
                  if (addr) {
                    setSelectedAddress(addr);
                    setSelectedName(addr.split(',')[0]?.trim() || addr);
                  }
                });
              }
            }} />
            <MapClickHandler onMapClick={handleMapClick} />
          </MapContainer>
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-500 bg-white/80 px-3 py-1 rounded-full">
            🖱️ Drag marker or click map to adjust
          </p>
        </div>

        <div className="p-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedAddress}
            className="flex-1 py-2 bg-[#2d6a4f] text-white rounded-xl hover:bg-[#1b4d3e] transition disabled:opacity-50"
          >
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
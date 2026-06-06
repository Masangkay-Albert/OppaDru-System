// src/modules/customer-side/components/LocationPicker.tsx
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom animated marker icon
const animatedIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="marker-pin"></div><div class="marker-pulse"></div>`,
  iconSize: [30, 30],
  popupAnchor: [0, -15]
});

interface LocationPickerProps {
  onSelectLocation: (location: { lat: number; lng: number; address: string; name: string }) => void;
  onClose: () => void;
  initialLat?: number;
  initialLng?: number;
}

// Get address from coordinates
const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OppaDruFoodDelivery/1.0'
        }
      }
    );
    const data = await response.json();
    if (data && data.display_name) {
      return data.display_name;
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

// Search locations
const searchLocation = async (query: string): Promise<Array<{ name: string; address: string; lat: number; lng: number }>> => {
  if (!query.trim()) return [];
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OppaDruFoodDelivery/1.0'
        }
      }
    );
    const data = await response.json();
    return data.map((item: any) => ({
      name: item.display_name.split(',')[0],
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    }));
  } catch {
    return [];
  }
};

// Animated marker component with CSS animation
const AnimatedMarker = ({ position, onPositionChange }: { 
  position: [number, number]; 
  onPositionChange: (lat: number, lng: number) => void;
}) => {
  const markerRef = useRef<any>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.on('dragend', async () => {
        const latlng = markerRef.current.getLatLng();
        onPositionChange(latlng.lat, latlng.lng);
      });
    }
  }, []);

  // Trigger animation when position changes
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [position]);

  return (
    <>
      <Marker 
        position={position} 
        draggable={true} 
        ref={markerRef}
        icon={animatedIcon}
      />
      {isAnimating && (
        <div className="absolute w-full h-full pointer-events-none z-[1000]">
          <div className="animate-ping-once absolute w-8 h-8 bg-green-500 rounded-full opacity-75" 
               style={{ 
                 left: '50%', 
                 top: '50%', 
                 transform: 'translate(-50%, -50%)',
                 animation: 'ping 0.5s ease-out'
               }} />
        </div>
      )}
    </>
  );
};

// Map click handler with fly animation
const MapClickHandler = ({ onMapClick, mapRef }: { 
  onMapClick: (lat: number, lng: number) => void;
  mapRef: React.MutableRefObject<any>;
}) => {
  const map = useMapEvents({
    click: (e) => {
      // Add ripple effect on click
      const ripple = document.createElement('div');
      ripple.className = 'map-ripple';
      ripple.style.left = e.containerPoint.x + 'px';
      ripple.style.top = e.containerPoint.y + 'px';
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
      
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });

  return null;
};

const LocationPicker: React.FC<LocationPickerProps> = ({ 
  onSelectLocation, 
  onClose,
  initialLat = 14.622,
  initialLng = 121.022
}) => {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);
  const [mapCenter, setMapCenter] = useState<[number, number]>([initialLat, initialLng]);
  const [isFlying, setIsFlying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ name: string; address: string; lat: number; lng: number }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentAddress, setCurrentAddress] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [selectedAddress, setSelectedAddress] = useState('');
  const debounceTimer = useRef<number | null>(null);
  const mapRef = useRef<any>(null);

  // Get initial address
  useEffect(() => {
    const init = async () => {
      const addr = await getAddressFromCoords(position[0], position[1]);
      setCurrentAddress(addr);
      setSelectedName(addr.split(',')[0]);
      setSelectedAddress(addr);
    };
    init();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    if (searchQuery.length > 2) {
      debounceTimer.current = window.setTimeout(async () => {
        setIsSearching(true);
        const results = await searchLocation(searchQuery);
        setSearchResults(results);
        setIsSearching(false);
      }, 500);
    } else {
      setSearchResults([]);
    }
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [searchQuery]);

  const handlePositionChange = async (lat: number, lng: number) => {
    const newPos: [number, number] = [lat, lng];
    setPosition(newPos);
    setMapCenter(newPos);
    const addr = await getAddressFromCoords(lat, lng);
    setCurrentAddress(addr);
    setSelectedName(addr.split(',')[0]);
    setSelectedAddress(addr);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSelectSearchResult = async (result: { name: string; address: string; lat: number; lng: number }) => {
    // Animate map fly to new location
    setIsFlying(true);
    if (mapRef.current) {
      mapRef.current.flyTo([result.lat, result.lng], 16, {
        duration: 0.8,
        easeLinearity: 0.5
      });
    }
    
    setTimeout(() => {
      setPosition([result.lat, result.lng]);
      setMapCenter([result.lat, result.lng]);
      setIsFlying(false);
    }, 800);
    
    setSearchQuery(result.name);
    setSelectedName(result.name);
    setSelectedAddress(result.address);
    setCurrentAddress(result.address);
    setSearchResults([]);
  };

  const handleConfirmLocation = () => {
    let finalName = '';
    let finalAddress = '';
    
    if (searchQuery && searchQuery.trim() !== '' && searchResults.length === 0) {
      finalName = searchQuery;
      finalAddress = searchQuery;
    } else if (selectedName && selectedName !== '') {
      finalName = selectedName;
      finalAddress = selectedAddress;
    } else if (currentAddress) {
      finalName = currentAddress.split(',')[0];
      finalAddress = currentAddress;
    } else {
      finalName = `${position[0].toFixed(4)}, ${position[1].toFixed(4)}`;
      finalAddress = `${position[0].toFixed(4)}, ${position[1].toFixed(4)}`;
    }
    
    onSelectLocation({
      lat: position[0],
      lng: position[1],
      name: finalName,
      address: finalAddress
    });
    onClose();
  };

  const displayName = () => {
    if (searchQuery && searchResults.length === 0) return searchQuery;
    if (selectedName) return selectedName;
    if (currentAddress) return currentAddress.split(',')[0];
    return 'Drag the map or search';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      {/* Add animation styles */}
      <style>{`
        @keyframes ping {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0.8; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
        
        @keyframes ripple {
          0% { transform: scale(0); opacity: 0.6; }
          100% { transform: scale(4); opacity: 0; }
        }
        
        .map-ripple {
          position: absolute;
          width: 20px;
          height: 20px;
          background: rgba(34, 197, 94, 0.5);
          border-radius: 50%;
          pointer-events: none;
          animation: ripple 0.5s ease-out;
          z-index: 1000;
          transform: translate(-50%, -50%);
        }
        
        .marker-pin {
          width: 24px;
          height: 24px;
          background: #2d6a4f;
          border: 3px solid #e76f51;
          border-radius: 50% 50% 50% 0;
          position: relative;
          transform: rotate(-45deg);
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }
        
        .marker-pin::after {
          content: '';
          width: 10px;
          height: 10px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        
        .marker-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: rgba(46, 125, 50, 0.4);
          border-radius: 50%;
          animation: pulse 1.5s ease-out infinite;
          pointer-events: none;
        }
        
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>

      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-slideDown">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e]">
          <h2 className="text-lg font-semibold text-white">What's your exact location?</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white text-2xl transition">✕</button>
        </div>

        {/* Description */}
        <div className="p-4 border-b border-gray-200 bg-[#fdf4e6]">
          <p className="text-sm text-gray-600">
            📍 Providing your location enables more accurate search and delivery.
          </p>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for your location..."
              className="w-full px-4 py-3 pl-10 border-2 border-gray-200 rounded-xl focus:border-[#2d6a4f] focus:outline-none transition-all"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-[#2d6a4f] border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          
          {/* Search Results with animation */}
          {searchResults.length > 0 && (
            <div className="absolute left-4 right-4 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-60 overflow-y-auto animate-slideDown">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(result)}
                  className="w-full text-left p-3 hover:bg-[#d8f3dc] transition-colors border-b border-gray-100 last:border-0"
                >
                  <p className="text-sm font-medium text-gray-800">{result.name}</p>
                  <p className="text-xs text-gray-500">{result.address}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected Location Display with animation */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-sm text-gray-500">📍 Selected location:</p>
          <p className="text-sm font-medium text-[#2d6a4f] transition-all duration-300">
            {displayName()}
            {isFlying && <span className="inline-block ml-2 text-xs text-gray-400 animate-pulse">📍 Moving...</span>}
          </p>
        </div>

        {/* Map */}
        <div className="flex-1 overflow-y-auto">
          <div className="h-80 w-full relative">
            <MapContainer
              center={mapCenter}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <AnimatedMarker position={position} onPositionChange={handlePositionChange} />
              <MapClickHandler onMapClick={handlePositionChange} mapRef={mapRef} />
            </MapContainer>
          </div>
          <p className="text-xs text-center text-gray-400 py-2 flex items-center justify-center gap-1">
            <span>🖱️</span> Drag the marker or click on the map to adjust location
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex gap-3 bg-gray-50">
          <button 
            onClick={onClose} 
            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirmLocation} 
            className="flex-1 py-2 bg-[#2d6a4f] text-white rounded-xl font-medium hover:bg-[#1b4d3e] transition transform hover:scale-[1.02]"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
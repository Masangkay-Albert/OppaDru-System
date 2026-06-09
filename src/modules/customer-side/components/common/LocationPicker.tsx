// src/modules/customer-side/components/common/LocationPicker.tsx
import React, { useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../../../styles/animations.css'; 
import { useLocationSearch, searchLocationAPI } from '../../../../hooks/useLocationSearch';
import { useMapLocation } from '../../../../hooks/useMapLocation';
import { getAddressFromCoords, getAddressName } from '../../../../services/geocodingService';
import { AnimatedMarker } from './AnimatedMarker';
import { MapClickHandler } from './MapClickHandler';
import type { LocationResult } from '../../../../hooks/useLocationSearch';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
});

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

// Clean address function - preserves province (Cavite)
const cleanAddress = (address: string): string => {
  if (!address) return address;
  
  let cleaned = address;
  
  // Remove "Philippines" only
  cleaned = cleaned.replace(/,\s*Philippines\s*,?/gi, '');
  
  // Remove "Calabarzon" (region) but keep Cavite
  cleaned = cleaned.replace(/,\s*Calabarzon\s*,?/gi, '');
  
  // Remove postal code (4-5 digits) but keep if part of address
  cleaned = cleaned.replace(/\b\d{4,5}\b(?!\s*$)/g, '');
  
  // Clean up extra commas and spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/,\s*$/, '');
  
  // Ensure Cavite is present if Dasmariñas is there
  if (cleaned.toLowerCase().includes('dasmariñas') && !cleaned.toLowerCase().includes('cavite')) {
    cleaned = `${cleaned}, Cavite`;
  }
  
  return cleaned;
};

// Get short name for display
const getShortName = (fullAddress: string): string => {
  const parts = fullAddress.split(',');
  if (parts.length > 0) {
    let name = parts[0].trim();
    name = name.replace(/\b\d{4,5}\b/g, '').trim();
    return name;
  }
  return fullAddress;
};

const LocationPicker: React.FC<LocationPickerProps> = ({
  onSelectLocation,
  onClose,
  initialLat = 14.329,
  initialLng = 120.936
}) => {
  const mapRef = useRef<any>(null);
  
  const {
    position,
    currentAddress,
    currentName,
    resolvedPositionKey,
    selectedSearchResult,
    updatePosition,
    selectSearchResult,
    clearSelectedSearch
  } = useMapLocation(initialLat, initialLng);

  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    selectLocation,
    clearSearch
  } = useLocationSearch();

  const handleSelectSearchResult = (result: LocationResult) => {
    selectSearchResult(result);
    selectLocation(result);
    
    if (mapRef.current) {
      mapRef.current.flyTo([result.lat, result.lng], 16, {
        duration: 0.8,
        easeLinearity: 0.5
      });
    }
  };

  const handleConfirmLocation = async () => {
    const typedAddress = searchQuery.trim();

    if (typedAddress) {
      let locationResult = selectedSearchResult;

      if (!locationResult || locationResult.address !== typedAddress) {
        const results = await searchLocationAPI(typedAddress);
        locationResult = results[0] || null;
      }

      const rawAddress = locationResult?.address || typedAddress;
      const cleanAddressStr = cleanAddress(rawAddress);
      const shortName = getShortName(rawAddress);

      onSelectLocation({
        lat: locationResult?.lat ?? position[0],
        lng: locationResult?.lng ?? position[1],
        name: shortName,
        address: cleanAddressStr
      });

      onClose();
      return;
    }

    const currentPositionKey = `${position[0].toFixed(6)},${position[1].toFixed(6)}`;
    let pinAddress = null;

    if (currentAddress && resolvedPositionKey === currentPositionKey) {
      pinAddress = {
        name: currentName || getAddressName(currentAddress),
        address: currentAddress
      };
    } else {
      pinAddress = await getAddressFromCoords(position[0], position[1]);
    }

    if (!pinAddress) {
      window.alert('Hindi mahanap ang address ng pin location. I-drag ulit ang pin or mag-search ng address.');
      return;
    }

    const cleanAddressStr = cleanAddress(pinAddress.address);
    const shortName = getShortName(pinAddress.address);

    onSelectLocation({
      lat: position[0],
      lng: position[1],
      name: shortName,
      address: cleanAddressStr
    });

    onClose();
  };

  const getDisplayName = () => {
    const typedAddress = searchQuery.trim();
    if (typedAddress) return typedAddress;
    if (currentName) return getShortName(currentName);
    if (currentAddress) return getShortName(currentAddress);
    return 'Drag the pin or search your address';
  };

  const getFullAddress = () => {
    const typedAddress = searchQuery.trim();
    if (typedAddress && selectedSearchResult?.address !== typedAddress) {
      return selectedSearchResult?.address ? cleanAddress(selectedSearchResult.address) : '';
    }
    if (currentAddress && currentAddress !== currentName) return cleanAddress(currentAddress);
    return '';
  };

  return (
    <div className="location-picker-overlay">
      <div className="location-picker-modal">
        <div className="location-picker-header">
          <h2>What's your exact location?</h2>
          <button onClick={onClose} className="location-picker-close">✕</button>
        </div>

        <div className="location-picker-info">
          <p>📍 Providing your location enables more accurate search and delivery.</p>
        </div>

        <div className="location-picker-search">
          <div className="location-picker-input-wrapper">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedSearchResult) clearSelectedSearch();
              }}
              placeholder="Search for your location..."
              className="location-picker-input"
            />
            <svg className="location-picker-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {searchResults.length > 0 && (
            <div className="location-picker-results animate-slideDown">
              {searchResults.map((result, idx) => (
                <button
                  key={`${result.lat}-${result.lng}-${idx}`}
                  onClick={() => handleSelectSearchResult(result)}
                  className="location-picker-result-item"
                >
                  <p className="location-picker-result-name">{getShortName(result.address)}</p>
                  <p className="location-picker-result-address">{cleanAddress(result.address)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="location-picker-selected">
          <p className="location-picker-selected-label">📍 Selected location:</p>
          <div>
            <p className="location-picker-selected-name">{getDisplayName()}</p>
            {getFullAddress() && getFullAddress() !== getDisplayName() && (
              <p className="location-picker-selected-address">{getFullAddress()}</p>
            )}
          </div>
        </div>

        <div className="location-picker-map-container">
          <div className="location-picker-map">
            <MapContainer center={position} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={true} ref={mapRef}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <AnimatedMarker position={position} onPositionChange={updatePosition} />
              <MapClickHandler onMapClick={updatePosition} />
            </MapContainer>
          </div>
          <p className="location-picker-map-note">
            <span>🖱️</span> Drag the marker or click on the map to adjust location
          </p>
        </div>

        <div className="location-picker-actions">
          <button
            onClick={() => {
              clearSearch();
              clearSelectedSearch();
              onClose();
            }}
            className="location-picker-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmLocation}
            className="location-picker-confirm"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPicker;
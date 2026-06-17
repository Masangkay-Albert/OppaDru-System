// src/modules/customer-side/components/common/LocationPicker.tsx
import React, { useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../../../styles/animations.css';
import { useLocationSearch } from '../../../../hooks/useLocationSearch';
import { useMapLocation } from '../../../../hooks/useMapLocation';
import { useConfirmLocation } from '../../../../hooks/useConfirmLocation';
import { AnimatedMarker } from './AnimatedMarker';
import { MapClickHandler } from './MapClickHandler';
import type { LocationResult } from '../../../../hooks/useLocationSearch';
import { cleanAddress, getShortName } from '../../../../utils/locationUtils';

// Fix Leaflet default icons
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
    // resolvedPositionKey is reserved for future use
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

  const confirmLocation = useConfirmLocation({
    searchQuery,
    selectedSearchResult,
    position: position,
    onSelectLocation,
    onClose
  });

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
            onClick={confirmLocation}
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
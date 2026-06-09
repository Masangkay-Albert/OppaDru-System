// src/modules/customer-side/components/common/MapClickHandler.tsx
import { useMapEvents } from 'react-leaflet';

interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
}

export const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      // Add ripple effect
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
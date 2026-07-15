// src/modules/customer-side/components/common/AnimatedMarker.tsx
import { Marker } from 'react-leaflet';
import L from 'leaflet';

const animatedIcon = L.divIcon({
  className: 'custom-div-icon',
  html: `<div class="marker-pin"></div><div class="marker-pulse"></div>`,
  iconSize: [30, 30],
  popupAnchor: [0, -15]
});

interface AnimatedMarkerProps {
  position: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
}

export const AnimatedMarker: React.FC<AnimatedMarkerProps> = ({
  position,
  onPositionChange
}) => {
  return (
    <Marker
      position={position}
      draggable={true}
      icon={animatedIcon}
      eventHandlers={{
        dragend: (event) => {
          const marker = event.target;
          const latlng = marker.getLatLng();
          onPositionChange(latlng.lat, latlng.lng);
        }
      }}
    />
  );
};
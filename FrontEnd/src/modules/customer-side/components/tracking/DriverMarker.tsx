// src/modules/customer-side/components/tracking/DriverMarker.tsx
import React, { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { getPositionAlongRoute, type Coordinates } from '../../../../services/geocodingService';
import { driverIcon } from './MapIcons';
import { OPPA_DRU_STORE_COORDS } from '../../../../services/geocodingService';

interface DriverMarkerProps {
  routePoints: [number, number][];
  progress: number;
  driverPosition?: { lat: number; lng: number };
}

const DriverMarker: React.FC<DriverMarkerProps> = ({ routePoints, progress, driverPosition }) => {
  const [driverPos, setDriverPos] = useState<Coordinates>({ 
    lat: OPPA_DRU_STORE_COORDS.lat, 
    lng: OPPA_DRU_STORE_COORDS.lng 
  });

  useEffect(() => {
    const smoothProgress = Math.min(progress, 99);
    
    if (driverPosition) {
      setDriverPos(driverPosition);
      return;
    }

    if (routePoints.length > 0 && smoothProgress > 0) {
      const pos = getPositionAlongRoute(routePoints, smoothProgress);
      if (pos) {
        setDriverPos(pos);
      }
    }
  }, [routePoints, progress, driverPosition]);

  if (progress >= 100 || routePoints.length === 0) {
    return null;
  }

  return (
    <Marker position={[driverPos.lat, driverPos.lng]} icon={driverIcon}>
      <Popup>
        <div className="text-center py-1">
          <p className="font-semibold text-gray-800">Delivery Driver</p>
          <p className="text-xs text-[#e76f51] mt-1">
            {progress >= 95 ? 'Almost there!' : 'On the way to you!'}
          </p>
        </div>
      </Popup>
    </Marker>
  );
};

export default DriverMarker;
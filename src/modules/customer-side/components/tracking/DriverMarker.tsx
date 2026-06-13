import React, { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { getPositionAlongRoute, type Coordinates } from '../../../../services/geocodingService';
import { driverIcon } from '././MapIcons';

interface DriverMarkerProps {
  routePoints: [number, number][];
  progress: number;
}

const DriverMarker: React.FC<DriverMarkerProps> = ({ routePoints, progress }) => {
  const [driverPos, setDriverPos] = useState<Coordinates>({ lat: 0, lng: 0 });

  useEffect(() => {
    if (routePoints.length) {
      setDriverPos(getPositionAlongRoute(routePoints, progress));
    }
  }, [routePoints, progress]);

  if (!routePoints.length || progress >= 100) return null;

  return (
    <Marker position={[driverPos.lat, driverPos.lng]} icon={driverIcon}>
      <Popup>
        <div className="text-center py-1">
          <p className="font-semibold text-gray-800">Delivery Driver</p>
          <p className="text-xs text-[#e76f51] mt-1">On the way</p>
        </div>
      </Popup>
    </Marker>
  );
};

export default DriverMarker;
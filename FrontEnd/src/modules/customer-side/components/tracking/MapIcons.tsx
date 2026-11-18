// src/modules/customer-side/components/tracking/MapIcons.tsx
import L from 'leaflet';
import oppaDeliveryIcon from '../../../../assets/oppa-dru-delivery.png';
import oppaLogo from '../../../../assets/oppadrulogo.jpg';
import './MapIcons.css';

// Fix Leaflet icon issue
Reflect.deleteProperty(L.Icon.Default.prototype, '_getIconUrl');
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export const driverIcon = new L.Icon({
  iconUrl: oppaDeliveryIcon,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -26],
  className: 'tracking-driver-marker',
});

export const storeIcon = new L.Icon({
  iconUrl: oppaLogo,
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

export const destinationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30],
});
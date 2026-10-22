import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../../contexts/Authcontext';
import { useOrder, type Order } from '../../../contexts/OrderContext';
import { OrderServiceError, orderService } from '../../../services/orderService';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { ORDER_STATUS, STATUS_COLORS } from '../../../utils/constants';
import { getOrderCreatedAtMs, normalizeOrderStatus } from '../../../utils/orderManagement';
import RouteLayer from '../components/tracking/RouteLayer';
import DriverMarker from '../components/tracking/DriverMarker';
import MapLegend from '../components/tracking/MapLegend';
import ProgressBar from '../components/tracking/ProgressBar';
import OrderDetailsCards from '../components/tracking/OrderDetailsCards';
import { storeIcon, destinationIcon } from '../components/tracking/MapIcons';

interface TrackingLocationState { orderId?: string }
const FINAL_STATUSES = new Set(['delivered', 'cancelled', 'completed', 'failed']);
const isFinalStatus = (status: string) => FINAL_STATUSES.has(normalizeOrderStatus(status));

const OrderTrackingPageContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeOrderId } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { orders, currentOrder, refreshOrderById } = useOrder();
  const locationState = location.state as TrackingLocationState | null;
  const cachedOrder = useMemo(() => {
    const requestedId = routeOrderId || locationState?.orderId;
    if (requestedId) return orders.find((candidate) => candidate.id === requestedId) || (currentOrder?.id === requestedId ? currentOrder : null);
    return currentOrder || [...orders].filter((candidate) => !isFinalStatus(candidate.status)).sort((a, b) => getOrderCreatedAtMs(b) - getOrderCreatedAtMs(a))[0] || null;
  }, [routeOrderId, locationState?.orderId, orders, currentOrder]);
  const orderId = routeOrderId || locationState?.orderId || cachedOrder?.id || '';
  const order = cachedOrder?.id === orderId ? cachedOrder : null;

  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [cancelError, setCancelError] = useState('');
  const [tick, setTick] = useState(Date.now());
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [simulatedProgress, setSimulatedProgress] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderId || !user?.id) {
      setIsFirstFetch(false);
      return;
    }
    let stopped = false;
    let timeout: number | undefined;
    let failures = 0;
    const poll = async () => {
      if (stopped) return;
      try {
        const latest = await refreshOrderById(orderId);
        if (stopped) return;
        failures = 0;
        setConnectionError(false);
        setNotFound(false);
        setIsFirstFetch(false);
        if (isFinalStatus(latest.status)) return;
        timeout = window.setTimeout(poll, 6000);
      } catch (error) {
        if (stopped) return;
        setIsFirstFetch(false);
        if (error instanceof OrderServiceError && (error.status === 404 || error.status === 403)) {
          setNotFound(true);
          setConnectionError(false);
          return;
        }
        setConnectionError(true);
        failures += 1;
        timeout = window.setTimeout(poll, Math.min(30000, 1000 * (2 ** Math.min(failures, 5))));
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [orderId, user?.id, refreshOrderById, retryVersion]);

  const branchCoordinates = order?.branchCoords;
  const destinationCoordinates = order?.deliveryAddressCoords;
  const hasTrackingCoordinates = Boolean(branchCoordinates && destinationCoordinates);
  const mapCenter = branchCoordinates && destinationCoordinates
    ? [(branchCoordinates.lat + destinationCoordinates.lat) / 2, (branchCoordinates.lng + destinationCoordinates.lng) / 2] as [number, number]
    : [14.2, 121.0] as [number, number];
  const status = normalizeOrderStatus(order?.status);
  const onTheWayEntries = order?.statusHistory?.filter((entry) => normalizeOrderStatus(entry.status) === 'on_the_way') || [];
  const onTheWayEntry = onTheWayEntries[onTheWayEntries.length - 1];
  const isDelivered = status === 'delivered' || status === 'completed';
  const routeProgress = isDelivered ? 100 : simulatedProgress;
  const statusColor = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 text-gray-700';
  const createdAt = order ? getOrderCreatedAtMs(order) : 0;
  const cancelSeconds = status === ORDER_STATUS.PENDING && createdAt > 0
    ? Math.max(0, 20 - ((tick - createdAt) / 1000))
    : 0;
  const canCancel = status === ORDER_STATUS.PENDING && cancelSeconds > 0;

  const getBarProgress = () => {
    switch (status) {
      case 'pending': return 20;
      case 'confirmed':
      case 'preparing': return 40;
      case 'prepared':
      case 'ready': return 60;
      case 'on_the_way': return 60 + simulatedProgress * 0.35;
      case 'arriving':
      case 'arrived': return 95;
      case 'delivered':
      case 'completed': return 100;
      default: return 20;
    }
  };

  const handleRouteLoaded = useCallback((points: [number, number][]) => {
    setRoutePoints(points);
  }, []);

  useEffect(() => {
    if (status !== 'on_the_way' || routePoints.length === 0) return;
    if (onTheWayEntry?.createdAt) {
      const startedAt = new Date(onTheWayEntry.createdAt).getTime();
      if (Number.isFinite(startedAt)) setSimulatedProgress(Math.min(95, Math.max(0, ((Date.now() - startedAt) / 1000) * (1.2 / 0.7))));
    }
    const timer = window.setInterval(() => setSimulatedProgress((previous) => Math.min(95, previous + 1.2)), 700);
    return () => window.clearInterval(timer);
  }, [status, routePoints.length, onTheWayEntry?.createdAt]);

  const handleCancelOrder = async () => {
    if (!order || !canCancel) return;
    setCancelError('');
    try {
      await orderService.updateOrderStatus(order.id, ORDER_STATUS.CANCELLED);
      await refreshOrderById(order.id);
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : 'Unable to cancel this order.');
    }
  };

  if (!orderId && !authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
        <NavbarCustomer />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-800">No order to track</h2>
          <p className="mt-2 text-gray-600">Choose an order from My Orders to open its tracking page.</p>
          <button onClick={() => navigate('/customer/orders')} className="mt-5 rounded-xl bg-[#2d6a4f] px-5 py-2 text-white">Go to My Orders</button>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
        <NavbarCustomer />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-800">Order not found</h2>
          <p className="mt-2 text-gray-600">This order is not available in your account.</p>
          <button onClick={() => navigate('/customer/orders')} className="mt-5 rounded-xl bg-[#2d6a4f] px-5 py-2 text-white">Back to My Orders</button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
        <NavbarCustomer />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          {isFirstFetch ? <div className="mx-auto size-12 animate-spin rounded-full border-4 border-[#2d6a4f] border-t-transparent" /> : null}
          <h2 className="mt-4 text-xl font-bold text-gray-800">{isFirstFetch ? 'Loading your order…' : "We couldn't load your order right now."}</h2>
          {!isFirstFetch && <button onClick={() => setRetryVersion((value) => value + 1)} className="mt-4 rounded-xl bg-[#2d6a4f] px-5 py-2 text-white">Retry</button>}
          <p className="mt-3 text-sm text-gray-600">Your order will stay available here while we reconnect.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {connectionError && (
          <div role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Reconnecting… Your saved tracking details are still shown.
            <button className="ml-2 font-semibold underline" onClick={() => setRetryVersion((value) => value + 1)}>Retry now</button>
          </div>
        )}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/customer/orders')} className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#2d6a4f]">← <span>Back to My Orders</span></button>
            <span className="text-gray-300">|</span>
            <h1 className="font-serif text-xl font-bold text-[#2d6a4f]">Track Your Order</h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusColor}`}>
            {status ? status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Pending'}
          </span>
        </div>

        {status === ORDER_STATUS.PENDING && (
          <div className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <span>{canCancel ? `You have ${Math.ceil(cancelSeconds)} seconds to cancel your order.` : 'Order can no longer be cancelled.'}</span>
            {canCancel && <button onClick={handleCancelOrder} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600">Cancel Order</button>}
          </div>
        )}
        {cancelError && <p role="alert" className="mb-3 text-sm text-red-700">{cancelError}</p>}
        <div className="mb-6"><ProgressBar status={status || ORDER_STATUS.PENDING} progress={getBarProgress()} /></div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl bg-white shadow-lg">
              <div className="relative z-0 h-[400px] w-full">
                {!hasTrackingCoordinates && <div className="flex h-full items-center justify-center bg-[#f8fbf8] px-6 text-center text-sm text-gray-600">Store or delivery coordinates are not available for this order.</div>}
                {hasTrackingCoordinates && <MapContainer key={`${order.id}-${branchCoordinates!.lat}-${branchCoordinates!.lng}-${destinationCoordinates!.lat}-${destinationCoordinates!.lng}`} center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <RouteLayer start={branchCoordinates!} end={destinationCoordinates!} progress={routeProgress} onRouteLoaded={handleRouteLoaded} />
                  <DriverMarker routePoints={routePoints} progress={routeProgress} />
                  <Marker position={[branchCoordinates!.lat, branchCoordinates!.lng]} icon={storeIcon}><Popup><strong>{order.branchName || 'Assigned branch'}</strong><br /><span className="text-xs text-gray-500">Store location</span></Popup></Marker>
                  <Marker position={[destinationCoordinates!.lat, destinationCoordinates!.lng]} icon={destinationIcon}><Popup><strong>Delivery Address</strong><br /><span className="text-xs text-gray-500">{order.deliveryAddress || order.address}</span></Popup></Marker>
                </MapContainer>}
              </div>
              <MapLegend />
            </div>
          </div>
          <div>
            <OrderDetailsCards currentOrder={{
              ...order,
              eta: status === 'on_the_way' ? Math.max(0, Math.ceil(35 * (1 - simulatedProgress / 100))) : order.eta,
            }} formatDate={(value) => {
              const date = new Date(value);
              return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
            }} />
            {isDelivered && <button onClick={() => navigate('/customer/orders')} className="mt-4 w-full rounded-xl bg-[#2d6a4f] py-3 font-semibold text-white shadow-md">Back to My Orders</button>}
          </div>
        </div>

      </main>
    </div>
  );
};

class TrackingPageErrorBoundary extends React.Component<{
  cachedOrder: Order | null;
  children: React.ReactNode;
}, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const cachedOrder = this.props.cachedOrder;
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
        <NavbarCustomer />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-gray-800">We couldn't load your order right now.</h2>
          {cachedOrder && <p className="mt-2 text-sm text-gray-600">Cached order {cachedOrder.orderNumber || cachedOrder.id} · {cachedOrder.status.replaceAll('_', ' ')}</p>}
          <button onClick={() => this.setState({ hasError: false })} className="mt-4 rounded-xl bg-[#2d6a4f] px-5 py-2 text-white">Retry</button>
        </div>
      </div>
    );
  }
}

const OrderTrackingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { orders, currentOrder } = useOrder();
  const cachedOrder = id
    ? orders.find((candidate) => candidate.id === id) || (currentOrder?.id === id ? currentOrder : null)
    : currentOrder;
  return <TrackingPageErrorBoundary cachedOrder={cachedOrder}><OrderTrackingPageContent /></TrackingPageErrorBoundary>;
};

export default OrderTrackingPage;

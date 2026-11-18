import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../../../contexts/Authcontext';
import { useOrder, type Order } from '../../../contexts/OrderContext';
import { OrderServiceError, orderService } from '../../../services/orderService';
import { useToast } from '../components/ToastProvider';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { ORDER_STATUS } from '../../../utils/constants';
import {
  getOrderCreatedAtMs,
  getOrderCancellationRemainingSeconds,
  normalizeOrderStatus,
  ORDER_CANCELLATION_WINDOW_SECONDS,
} from '../../../utils/orderManagement';
import RouteLayer from '../components/tracking/RouteLayer';
import DriverMarker from '../components/tracking/DriverMarker';
import MapLegend from '../components/tracking/MapLegend';
import ProgressBar from '../components/tracking/ProgressBar';
import OrderDetailsCards from '../components/tracking/OrderDetailsCards';
import ReportOrderProblem from '../components/tracking/ReportOrderProblem';
import { storeIcon, destinationIcon } from '../components/tracking/MapIcons';

interface TrackingLocationState { orderId?: string }
const FINAL_STATUSES = new Set(['delivered', 'cancelled', 'completed', 'failed']);
const isFinalStatus = (status: string) => FINAL_STATUSES.has(normalizeOrderStatus(status));

const MapScrollZoomOnInteraction: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const enableScrollZoom = () => map.scrollWheelZoom.enable();
    const disableScrollZoom = () => map.scrollWheelZoom.disable();
    const handleFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
      disableScrollZoom();
    };

    map.scrollWheelZoom.disable();
    container.tabIndex = container.tabIndex < 0 ? 0 : container.tabIndex;
    container.addEventListener('focusin', enableScrollZoom);
    container.addEventListener('focusout', handleFocusOut);
    container.addEventListener('pointerdown', enableScrollZoom);
    container.addEventListener('pointerleave', disableScrollZoom);
    return () => {
      container.removeEventListener('focusin', enableScrollZoom);
      container.removeEventListener('focusout', handleFocusOut);
      container.removeEventListener('pointerdown', enableScrollZoom);
      container.removeEventListener('pointerleave', disableScrollZoom);
      disableScrollZoom();
    };
  }, [map]);

  return null;
};

const TrackingSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-4" aria-label="Loading order tracking">
    <div className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-card">
      <div className="flex items-center gap-4">
        <div className="size-10 rounded-full bg-[var(--oppa-green-soft)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-36 rounded bg-[var(--oppa-green-soft)]" />
          <div className="h-6 w-52 max-w-full rounded bg-[var(--oppa-green-soft)]" />
        </div>
        <div className="h-8 w-24 rounded-full bg-[var(--oppa-green-soft)]" />
      </div>
    </div>
    <div className="rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-card">
      <div className="h-28 rounded-xl bg-[var(--oppa-green-soft)] md:h-20" />
    </div>
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.63fr)_minmax(0,1fr)]">
      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <div className="order-2 h-[320px] rounded-2xl bg-[var(--oppa-green-soft)] lg:order-none lg:h-[440px]" />
        <div className="order-4 h-32 rounded-2xl bg-[var(--oppa-green-soft)] lg:order-none" />
        <div className="order-5 h-28 rounded-2xl bg-[var(--oppa-green-soft)] lg:order-none" />
      </div>
      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <div className="order-1 h-24 rounded-2xl bg-[var(--oppa-green-soft)] lg:order-none" />
        <div className="order-3 h-80 rounded-2xl bg-[var(--oppa-green-soft)] lg:order-none" />
        <div className="order-6 h-24 rounded-2xl bg-[var(--oppa-green-soft)] lg:order-none" />
        <div className="order-7 h-36 rounded-2xl bg-[var(--oppa-green-soft)] lg:order-none" />
        <div className="order-8 h-12 rounded-xl bg-[var(--oppa-green-soft)] lg:order-none" />
      </div>
    </div>
  </div>
);

const getStatusBadgeClass = (status: string): string => {
  if (['delivered', 'completed'].includes(status)) return 'bg-[var(--promo-success-bg)] text-[var(--promo-success-text)]';
  if (['cancelled', 'failed'].includes(status)) return 'bg-[var(--promo-danger-bg)] text-[var(--promo-danger-text)]';
  if (['preparing', 'prepared', 'ready', 'on_the_way', 'arriving', 'arrived'].includes(status)) {
    return 'bg-[var(--promo-warning-bg)] text-[var(--promo-warning-text)]';
  }
  return 'bg-[var(--oppa-green-soft)] text-[var(--oppa-available-text)]';
};

const OrderTrackingPageContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeOrderId } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { orders, currentOrder, refreshOrderById } = useOrder();
  const { showToast, confirmDialog, dismissDialog } = useToast();
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
  const [, setTick] = useState(0);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [mapErrorKey, setMapErrorKey] = useState<string | null>(null);
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const [dismissedDeliveredNoticeId, setDismissedDeliveredNoticeId] = useState<string | null>(null);
  const [isConfirmingCancellation, setIsConfirmingCancellation] = useState(false);
  const [isProceedingOrder, setIsProceedingOrder] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderId || !user?.id) {
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
        if (isFinalStatus(latest.status) && normalizeOrderStatus(latest.status) !== 'delivered') return;
        timeout = window.setTimeout(poll, normalizeOrderStatus(latest.status) === 'delivered' ? 20000 : 6000);
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
  const isCancelled = status === 'cancelled' || status === 'failed';
  const hasAssignedDriver = Boolean(order?.driver || order?.driverId || order?.driver_id);
  const canShowRoute = hasTrackingCoordinates && hasAssignedDriver && !isCancelled;
  const mapInstanceKey = `${order?.id || ''}-${branchCoordinates?.lat || ''}-${branchCoordinates?.lng || ''}-${destinationCoordinates?.lat || ''}-${destinationCoordinates?.lng || ''}`;
  const mapTilesError = mapErrorKey === mapInstanceKey;
  const showDeliveredNotice = Boolean(order && isDelivered && dismissedDeliveredNoticeId !== order.id);
  const deliveredDriverName = order?.driver?.name?.trim() || 'Driver details unavailable';
  const routeProgress = isDelivered ? 100 : simulatedProgress;
  const statusColor = getStatusBadgeClass(status);
  const cancelSeconds = order ? getOrderCancellationRemainingSeconds(order) : 0;
  const isInitialOrderLoading = isFirstFetch && (authLoading || Boolean(orderId && user?.id));
  const canCancel = status === ORDER_STATUS.PENDING && cancelSeconds > 0;

  useEffect(() => {
    if (!isConfirmingCancellation || status === ORDER_STATUS.PENDING) return;

    const timer = window.setTimeout(() => {
      dismissDialog();
      setIsConfirmingCancellation(false);
      showToast('This order has already started and can no longer be cancelled.', 'warning');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isConfirmingCancellation, status, dismissDialog, showToast]);

  const getBarProgress = () => {
    switch (status) {
      case 'pending': return 0;
      case 'confirmed':
      case 'preparing': return 25;
      case 'prepared':
      case 'ready': return 50;
      case 'on_the_way': return 75 + simulatedProgress * 0.25;
      case 'arriving':
      case 'arrived': return 95;
      case 'delivered':
      case 'completed': return 100;
      default: return 0;
    }
  };

  const handleRouteLoaded = useCallback((points: [number, number][]) => {
    setRoutePoints(points);
  }, []);

  useEffect(() => {
    if (status !== 'on_the_way' || routePoints.length === 0) return;
    let progressTimeout: number | undefined;
    if (onTheWayEntry?.createdAt) {
      const startedAt = new Date(onTheWayEntry.createdAt).getTime();
      if (Number.isFinite(startedAt)) {
        progressTimeout = window.setTimeout(
          () => setSimulatedProgress(Math.min(95, Math.max(0, ((Date.now() - startedAt) / 1000) * (1.2 / 0.7)))),
          0,
        );
      }
    }
    const timer = window.setInterval(() => setSimulatedProgress((previous) => Math.min(95, previous + 1.2)), 700);
    return () => {
      if (progressTimeout !== undefined) window.clearTimeout(progressTimeout);
      window.clearInterval(timer);
    };
  }, [status, routePoints.length, onTheWayEntry?.createdAt]);

  const handleCancelOrder = async () => {
    if (!order || !canCancel || isProceedingOrder) {
      showToast('Cancellation period has ended.', 'warning');
      return;
    }

    setIsConfirmingCancellation(true);
    const expiryTimer = window.setTimeout(() => {
      dismissDialog();
      setIsConfirmingCancellation(false);
      showToast('Cancellation period has ended.', 'warning');
    }, cancelSeconds * 1000);
    setCancelError('');
    try {
      const confirmed = await confirmDialog({
        title: 'Cancel this order?',
        message: 'This will cancel your order and notify the branch.',
        cancelLabel: 'Keep Order',
        confirmLabel: 'Yes, Cancel',
        danger: true,
      });
      if (!confirmed) return;
      if (getOrderCancellationRemainingSeconds(order) <= 0) {
        showToast('Cancellation period has ended.', 'warning');
        return;
      }

      await orderService.updateOrderStatus(order.id, ORDER_STATUS.CANCELLED);
      showToast('Order cancelled successfully.', 'success');
      try {
        await refreshOrderById(order.id);
      } catch (refreshError) {
        const detail = refreshError instanceof Error ? ` ${refreshError.message}` : '';
        const message = `Your order was cancelled, but its latest status could not be refreshed.${detail}`;
        setCancelError(message);
        showToast(message, 'error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to cancel this order.';
      setCancelError(message);
      showToast(message, 'error');
    } finally {
      window.clearTimeout(expiryTimer);
      setIsConfirmingCancellation(false);
    }
  };

  const handleProceedOrder = async () => {
    if (!order || status !== ORDER_STATUS.PENDING || cancelSeconds <= 0 || isConfirmingCancellation || isProceedingOrder) {
      return;
    }

    setIsProceedingOrder(true);
    setCancelError('');
    try {
      await orderService.proceedOrder(order.id);
      showToast('Cancellation window skipped. The branch will update your order status.', 'success');
      try {
        await refreshOrderById(order.id);
      } catch (refreshError) {
        const detail = refreshError instanceof Error ? ` ${refreshError.message}` : '';
        const message = `The cancellation window was skipped, but the latest order status could not be refreshed.${detail}`;
        setCancelError(message);
        showToast(message, 'error');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to proceed with this order.';
      setCancelError(message);
      showToast(message, 'error');
    } finally {
      setIsProceedingOrder(false);
    }
  };

  if (!orderId && !authLoading) {
    return (
      <div className="min-h-screen bg-[var(--oppa-cream)]">
        <NavbarCustomer />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="font-serif text-2xl font-semibold text-[var(--oppa-text)]">No order to track</h1>
          <p className="mt-2 text-[var(--oppa-text-muted)]">Choose an order from My Orders to open its tracking page.</p>
          <button onClick={() => navigate('/customer/orders')} className="mt-5 min-h-11 rounded-xl bg-[var(--oppa-green)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2">Go to My Orders</button>
        </main>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[var(--oppa-cream)]">
        <NavbarCustomer />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="font-serif text-2xl font-semibold text-[var(--oppa-text)]">Order not found</h1>
          <p className="mt-2 text-[var(--oppa-text-muted)]">This order is not available in your account.</p>
          <button onClick={() => navigate('/customer/orders')} className="mt-5 min-h-11 rounded-xl bg-[var(--oppa-green)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2">Back to My Orders</button>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[var(--oppa-cream)]">
        <NavbarCustomer />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {isInitialOrderLoading
            ? <TrackingSkeleton />
            : (
              <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-6 text-center shadow-card">
                <h1 className="font-serif text-xl font-semibold text-[var(--oppa-text)]">We couldn&apos;t load your order</h1>
                <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">Your order details are temporarily unavailable. Please try again.</p>
                <button type="button" onClick={() => setRetryVersion((value) => value + 1)} className="mt-4 min-h-11 rounded-xl bg-[var(--oppa-green)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2">Retry</button>
              </section>
            )}
        </main>
      </div>
    );
  }

  const trackingOrder = {
    ...order,
    eta: status === 'on_the_way' ? Math.max(0, Math.ceil(35 * (1 - simulatedProgress / 100))) : order.eta,
  };
  const formatTrackingDate = (value: Date | string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'N/A'
      : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
  };

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)]">
      <NavbarCustomer />
      <main className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
        <section className="mb-4 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-card sm:p-5" aria-labelledby="tracking-page-title">
          {connectionError && (
            <div role="status" className="mb-4 rounded-xl border border-[var(--promo-warning-border)] bg-[var(--promo-warning-bg)] px-3 py-2 text-sm text-[var(--promo-warning-text)]">
              Reconnecting… Your saved tracking details are still shown.
              <button className="ml-2 rounded font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600" onClick={() => setRetryVersion((value) => value + 1)}>Retry now</button>
            </div>
          )}
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                aria-label="Return to My Orders"
                onClick={() => navigate('/customer/orders')}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--oppa-border)] text-lg text-[var(--oppa-text-muted)] transition hover:border-[var(--oppa-green)] hover:text-[var(--oppa-green)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
              >
                ←
              </button>
              <div className="min-w-0">
                <p className="max-w-[65vw] break-words text-xs font-semibold uppercase tracking-[0.12em] text-[var(--oppa-text-muted)] sm:max-w-lg">
                  ORDER {order.orderNumber || `#${order.id}`}
                </p>
                <h1 id="tracking-page-title" className="mt-1 font-serif text-xl font-semibold text-[var(--oppa-text)] sm:text-2xl">Track your order</h1>
                {order.replacementOfOrderId && (
                  <span className="mt-2 inline-flex max-w-full break-words rounded-full bg-[var(--oppa-green-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--oppa-green-dark)]">
                    REPLACEMENT · Original {order.originalOrderNumber || order.replacementOfOrderId}
                  </span>
                )}
              </div>
            </div>
            <span className={`mt-1 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold sm:text-sm ${statusColor}`}>
              {status ? status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Pending'}
            </span>
          </div>

          {status === ORDER_STATUS.PENDING && (
            <div className="mt-4 flex flex-col gap-2 border-t border-[var(--oppa-border)] pt-3 text-sm text-[var(--oppa-text-muted)] sm:flex-row sm:items-center sm:justify-between">
              <span>{canCancel ? `Cancel within ${Math.ceil(cancelSeconds)} seconds.` : 'Cancellation period has ended.'}</span>
              {canCancel && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-label="Proceed with order and skip the cancellation window"
                    disabled={isConfirmingCancellation || isProceedingOrder}
                    onClick={() => void handleProceedOrder()}
                    className="min-h-10 rounded-lg bg-[var(--oppa-green)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isProceedingOrder ? 'Proceeding…' : 'Proceed'}
                  </button>
                  <button
                    type="button"
                    disabled={isConfirmingCancellation || isProceedingOrder}
                    onClick={() => void handleCancelOrder()}
                    className="min-h-10 rounded-lg border border-[var(--promo-danger-border)] bg-[var(--oppa-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--promo-danger-text)] transition hover:bg-[var(--promo-danger-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel Order ({Math.ceil(cancelSeconds)}s)
                  </button>
                </div>
              )}
              {canCancel && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--promo-danger-bg)] sm:max-w-40" aria-hidden="true">
                  <div className="h-full rounded-full bg-[var(--oppa-danger)] transition-[width] duration-300" style={{ width: `${Math.min(100, (cancelSeconds / ORDER_CANCELLATION_WINDOW_SECONDS) * 100)}%` }} />
                </div>
              )}
            </div>
          )}
          {cancelError && <p role="alert" className="mt-3 text-sm text-[var(--promo-danger-text)]">{cancelError}</p>}
        </section>

        <section className="mb-5 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-4 shadow-card sm:p-5">
          <ProgressBar status={status || ORDER_STATUS.PENDING} progress={getBarProgress()} />
        </section>

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.63fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div className="contents lg:flex lg:flex-col lg:gap-4">
            <section className="order-2 overflow-hidden rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] shadow-card lg:order-none" aria-labelledby="tracking-map-title">
              <div className="border-b border-[var(--oppa-border)] px-4 py-3">
                <h2 id="tracking-map-title" className="font-serif text-lg font-semibold text-[var(--oppa-text)]">Delivery map</h2>
              </div>
              <div className="relative z-0 h-[280px] w-full bg-[var(--oppa-surface-raised)] sm:h-[320px] lg:h-[400px]">
                {!hasTrackingCoordinates && (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--oppa-text-muted)]">
                    Store or delivery coordinates are not available for this order.
                  </div>
                )}
                {hasTrackingCoordinates && (
                  <MapContainer
                    key={mapInstanceKey}
                    center={mapCenter}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl
                    scrollWheelZoom={false}
                    aria-label="Order delivery map"
                    className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      eventHandlers={{ tileerror: () => setMapErrorKey(mapInstanceKey) }}
                    />
                    <MapScrollZoomOnInteraction />
                    {canShowRoute && <RouteLayer start={branchCoordinates!} end={destinationCoordinates!} progress={routeProgress} onRouteLoaded={handleRouteLoaded} />}
                    {canShowRoute && <DriverMarker routePoints={routePoints} progress={routeProgress} startPosition={branchCoordinates} />}
                    <Marker position={[branchCoordinates!.lat, branchCoordinates!.lng]} icon={storeIcon}>
                      <Popup><strong>{order.branchName || 'Assigned branch'}</strong><br /><span className="text-xs text-[var(--oppa-text-muted)]">Store location</span></Popup>
                    </Marker>
                    <Marker position={[destinationCoordinates!.lat, destinationCoordinates!.lng]} icon={destinationIcon}>
                      <Popup><strong>Delivery Address</strong><br /><span className="text-xs text-[var(--oppa-text-muted)]">{order.deliveryAddress || order.address}</span></Popup>
                    </Marker>
                    {!canShowRoute && (
                      <div className="pointer-events-none absolute left-2 right-2 top-2 z-[1000] rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)]/95 px-3 py-2 text-xs text-[var(--oppa-text-muted)] shadow-sm sm:right-auto">
                        {isCancelled ? 'Live tracking is unavailable for this order.' : 'The route will appear once a driver is assigned.'}
                      </div>
                    )}
                    {mapTilesError && (
                      <div role="status" className="pointer-events-none absolute bottom-2 left-2 right-2 z-[1000] rounded-xl border border-amber-300 bg-[var(--oppa-surface)]/95 px-3 py-2 text-xs text-[var(--oppa-text)] shadow-sm">
                        Map tiles could not be loaded. The order locations and details are still available.
                      </div>
                    )}
                  </MapContainer>
                )}
              </div>
              <MapLegend isDelivered={isDelivered} showRoute={canShowRoute} showDriver={hasAssignedDriver} />
            </section>
            <div className="order-4 lg:order-none">
              <OrderDetailsCards currentOrder={trackingOrder} formatDate={formatTrackingDate} sections={['address']} />
            </div>
            <div className="order-5 lg:order-none">
              <OrderDetailsCards currentOrder={trackingOrder} formatDate={formatTrackingDate} sections={['information']} />
            </div>
          </div>

          <aside className="contents lg:sticky lg:top-24 lg:flex lg:max-h-[calc(100vh-7rem)] lg:flex-col lg:gap-4 lg:overflow-y-auto">
            {hasAssignedDriver && (
              <div className="order-1 lg:order-none">
                <OrderDetailsCards currentOrder={trackingOrder} formatDate={formatTrackingDate} sections={['driver']} />
              </div>
            )}
            <div className="order-3 lg:order-none">
              <OrderDetailsCards currentOrder={trackingOrder} formatDate={formatTrackingDate} sections={['items']} />
            </div>
            <div className="order-6 lg:order-none">
              <OrderDetailsCards currentOrder={trackingOrder} formatDate={formatTrackingDate} sections={['branch']} />
            </div>
            <div className="order-7 lg:order-none">
              <ReportOrderProblem
                orderId={order.id}
                items={order.replacementItems || []}
                policy={order.replacementPolicy}
                onSubmitted={async () => { await refreshOrderById(order.id); }}
              />
            </div>
            <button
              type="button"
              onClick={() => navigate('/customer/orders')}
              className="order-8 min-h-12 w-full rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 lg:order-none"
            >
              Back to My Orders
            </button>
          </aside>
        </div>
      </main>
      {showDeliveredNotice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#15271d]/55 p-4 backdrop-blur-sm">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delivered-notice-title"
            aria-describedby="delivered-notice-message"
            className="w-full max-w-md rounded-3xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-6 shadow-2xl sm:p-7"
          >
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-[var(--promo-success-bg)] text-2xl text-[var(--promo-success-text)]" aria-hidden="true">✓</div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--promo-success-text)]">Delivery complete</p>
            <h2 id="delivered-notice-title" className="mt-1 font-serif text-2xl font-bold text-[var(--oppa-text)]">Your order has been delivered</h2>
            <p id="delivered-notice-message" className="mt-2 text-sm leading-6 text-[var(--oppa-text-muted)]">Thank you for ordering with Oppa Dru. Here are the details of the driver who handled your delivery.</p>
            <div className="mt-5 rounded-2xl border border-[var(--promo-success-border)] bg-[var(--promo-success-bg)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--oppa-text-muted)]">Delivered by</p>
              <p className="mt-1 text-base font-bold text-[var(--oppa-text)]">{deliveredDriverName}</p>
            </div>
            <button type="button" autoFocus onClick={() => setDismissedDeliveredNoticeId(order.id)} className="mt-5 min-h-12 w-full rounded-xl bg-[#2d6a4f] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1c3d2e]">Got it</button>
          </section>
        </div>
      )}
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
      <div className="min-h-screen bg-[var(--oppa-cream)]">
        <NavbarCustomer />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="font-serif text-xl font-semibold text-[var(--oppa-text)]">We couldn&apos;t load your order right now.</h1>
          {cachedOrder && <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">Cached order {cachedOrder.orderNumber || cachedOrder.id} · {cachedOrder.status.replaceAll('_', ' ')}</p>}
          <button onClick={() => this.setState({ hasError: false })} className="mt-4 min-h-11 rounded-xl bg-[var(--oppa-green)] px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]">Retry</button>
        </main>
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

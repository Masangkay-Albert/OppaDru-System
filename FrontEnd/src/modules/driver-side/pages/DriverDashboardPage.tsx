import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, MapPin, CheckCircle, Phone, Clock, Eye, X, ArrowDownUp, ImagePlus, Flame, ClipboardList, ChevronDown } from 'lucide-react';
import DriverLayout from '../components/DriverLayout';
import RouteLayer from '../../customer-side/components/tracking/RouteLayer';
import { destinationIcon, storeIcon } from '../../customer-side/components/tracking/MapIcons';
import { OrderDateTime, StatusBadge, UserChip } from '../../shared/components/DashboardPrimitives';

import { sortOrders } from '../../../utils/dashboardOrders';
import { API_URL } from '../../../services/apiConfig';
import { OPPA_DRU_STORE_COORDS } from '../../../services/geocodingService';


const chipBase = 'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition whitespace-nowrap motion-reduce:transition-none';
const chipPrimary = `${chipBase} bg-[var(--oppa-green)] text-white shadow-sm hover:bg-[#245f37] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 cursor-pointer`;
const chipSuccess = `${chipBase} bg-[var(--oppa-green)] text-white shadow-sm hover:bg-[#245f37] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 cursor-pointer`;
const chipDisabled = 'inline-flex h-8 items-center gap-1 rounded-lg bg-gray-100 px-2 text-[11px] font-medium text-gray-500 whitespace-nowrap cursor-default';

type TabView = 'available' | 'active' | 'history';
type SortOrder = 'desc' | 'asc';

export interface DriverOrder {
  id: string;
  order_number?: string;
  driver_id?: string | null;
  customerName: string;
  status: string;
  items?: any[];
  scheduleDisplay?: string;
  deliveryType?: string;
  created_at: string;
  deliveryAddress?: string;
  address?: string;
  phone?: string;
  deliveryCoordinates?: { lat: number; lng: number } | null;
  deliveryProofImageUrl?: string | null;
  deliveryProofUploadedAt?: string | null;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

const DriverDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>('available');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [driverName, setDriverName] = useState<string>("Driver");
  const [driverId, setDriverId] = useState<string>("");
  
  const [selectedOrder, setSelectedOrder] = useState<DriverOrder | null>(null);
  const getDisplayOrderNumber = (order: DriverOrder) => order.order_number || order.id;
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const ordersFetchInFlightRef = useRef(false);

  
  useEffect(() => {
    const authData = localStorage.getItem("driver_auth");
    const token = localStorage.getItem("driver_token");

    if (!token || !authData) {
      navigate('/delivery/login', { replace: true });
      return; 
    }

    try {
      const driver = JSON.parse(authData);
      if (driver && driver.name) {
        setDriverName(driver.name);
      }
      if (driver && driver.id) {
        setDriverId(driver.id);
      }
    } catch (error) {
      console.error("Failed to parse driver data", error);
      navigate('/delivery/login', { replace: true }); 
    }
  }, [navigate]);


  const fetchOrders = async (showLoading = true) => {
    if (ordersFetchInFlightRef.current) return;
    ordersFetchInFlightRef.current = true;
    const requestedTab = activeTab;
    if (showLoading) setLoading(true);
    try {
      const token = localStorage.getItem("driver_token");
      const response = await fetch(`${API_URL}/driver/orders?tab=${requestedTab}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch orders');
      
      const data = await response.json();
      if (requestedTab === activeTab) {
        setOrders((current) => JSON.stringify(current) === JSON.stringify(data) ? current : data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      ordersFetchInFlightRef.current = false;
      if (showLoading && requestedTab === activeTab) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
    const interval = window.setInterval(() => {
      void fetchOrders(false);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [activeTab]);

  
  const updateOrderStatus = async (orderId: string, newStatus: string, nextTab: TabView) => {
    try {
      const token = localStorage.getItem("driver_token");
      const response = await fetch(`${API_URL}/driver/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const validationMessages = result?.errors
          ? Object.values(result.errors).flat().join(' ')
          : '';
        throw new Error(validationMessages || result?.message || `Could not update status (HTTP ${response.status}).`);
      }

      setSelectedOrder((current) => current && current.id === orderId ? { ...current, status: newStatus } : current);
      setActiveTab(nextTab);
      if (activeTab === nextTab) fetchOrders(); 
    } catch (error) {
      console.error("Error updating status:", error);
      alert(error instanceof Error ? error.message : "Failed to update order status. Please try again.");
    }
  };

  const uploadDeliveryProof = async () => {
    if (!selectedOrder || !proofFile) return;

    setProofUploading(true);
    try {
      const token = localStorage.getItem('driver_token');
      const formData = new FormData();
      formData.append('proof_image', proofFile);

      const response = await fetch(`${API_URL}/driver/orders/${selectedOrder.id}/delivery-proof`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const validationMessages = result?.errors
          ? Object.values(result.errors).flat().join(' ')
          : '';
        throw new Error(validationMessages || result?.message || 'Could not upload delivery proof.');
      }

      const proofUpdates = {
        deliveryProofImageUrl: result.delivery_proof_image_url,
        deliveryProofUploadedAt: result.delivery_proof_uploaded_at,
      };
      setSelectedOrder((current) => current ? { ...current, ...proofUpdates } : current);
      setOrders((current) => current.map((order) =>
        order.id === selectedOrder.id ? { ...order, ...proofUpdates } : order
      ));
      setProofFile(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to upload delivery proof. Please try again.');
    } finally {
      setProofUploading(false);
    }
  };

  // Filter and sort the orders safely
  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'history' || activeTab === 'active') {
      if (order.driver_id && driverId && order.driver_id !== driverId) {
        return false;
      }
    }
    return true;
  });

  const sortedOrders = sortOrders(filteredOrders, sortOrder);

  return (
    <DriverLayout>
      <div className="mb-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-[var(--oppa-text)] sm:text-4xl">
            Delivery Dashboard
          </h1>
          <UserChip name={driverName} />
          <p className="mt-1 basis-full text-sm text-[var(--oppa-text-muted)]">
            Manage available orders and track your active deliveries.
          </p>
        </div>
      </div>

      {/* Tabs and Sort Controls */}
      <div className="relative z-20 mb-4 flex min-h-10 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="inline-flex min-h-10 flex-wrap gap-1 rounded-2xl border border-[var(--oppa-border)] bg-white/70 p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('available')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 ${
              activeTab === 'available'
                ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                : 'bg-transparent text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)]'
            }`}
          >
            Available Orders
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 ${
              activeTab === 'active'
                ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                : 'bg-transparent text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)]'
            }`}
          >
            My Active Deliveries
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2 ${
              activeTab === 'history'
                ? 'bg-[var(--oppa-green)] text-white shadow-sm'
                : 'bg-transparent text-[var(--oppa-text-muted)] hover:bg-[var(--oppa-green-soft)]'
            }`}
          >
            History
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="flex h-10 w-max items-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-white px-3 text-sm text-[var(--oppa-text-muted)] shadow-sm ring-1 ring-black/[0.02]">
          <ArrowDownUp size={16} className="text-[var(--oppa-green)]" />
          <span className="font-medium">Sort by:</span>
          <span className="relative inline-flex items-center">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            className="relative z-20 w-auto cursor-pointer appearance-none bg-transparent py-1 pr-4 font-semibold text-[var(--oppa-text)] outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
          >
            <option value="desc">Latest First</option>
            <option value="asc">Oldest First</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-1 text-[var(--oppa-text-muted)]" />
          </span>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading orders...</div>
      ) : sortedOrders.length === 0 ? (
        <div className="rounded-2xl border border-[var(--oppa-border)] bg-white p-10 text-center text-sm text-[var(--oppa-text-muted)] shadow-sm">
          <ClipboardList className="mx-auto mb-3 text-[var(--oppa-green)]/60" size={30} />
          <p className="font-medium text-[var(--oppa-text)]">
          {activeTab === 'available' 
            ? 'No delivery orders available right now.' 
            : activeTab === 'active' 
            ? 'You have no active deliveries.' 
            : 'You have not completed any deliveries yet.'}
          </p>
          <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">Check back here as new delivery updates come in.</p>
        </div>
      ) : (
        <>
          {/* Mobile / tablet: tidy stacked cards */}
          <div className="space-y-2 md:hidden">
            {sortedOrders.map((order) => (
              <div key={order.id} className={`relative overflow-hidden rounded-2xl border border-[var(--oppa-border)] p-3 shadow-sm transition-shadow motion-reduce:transition-none hover:shadow-md ${order.deliveryType === 'priority' ? 'border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-white' : 'bg-white'}`}>
                {order.deliveryType === 'priority' && (
                  <div className="mb-3 flex w-fit items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold tracking-wider text-orange-800">
                    <Flame size={12} /> PRIORITY
                  </div>
                )}
                
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <StatusBadge status={order.status} />
                    <p className="mt-2 font-mono text-[13px] tabular-nums text-gray-700">{getDisplayOrderNumber(order)}</p>
                    <p className="truncate font-medium text-[var(--oppa-text)]">{order.customerName || 'Customer'}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedOrder(order)}
                    aria-label="Details"
                    title="Details"
                    className="flex-shrink-0 rounded-lg border border-[var(--oppa-border)] bg-white p-2 text-gray-600 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)]"
                  >
                    <Eye size={16} />
                  </button>
                </div>

                <div className="mt-2 space-y-1.5">
                  <div className="flex items-start gap-2 text-xs text-[var(--oppa-text-muted)]">
                    <MapPin size={14} className="mt-0.5 flex-shrink-0 text-[#e76f51]" />
                    <span className="line-clamp-2" title={order.deliveryAddress || order.address}>{order.deliveryAddress || order.address}</span>
                  </div>

                  {order.phone && (
                    <div className="flex items-center gap-2 text-xs text-[var(--oppa-text-muted)]">
                      <Phone size={14} className="flex-shrink-0" />
                      <span>{order.phone}</span>
                    </div>
                  )}

                  {order.scheduleDisplay && order.scheduleDisplay !== 'Select date & time' && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 font-medium">
                      <Clock size={14} className="flex-shrink-0" />
                      <span>Scheduled: {order.scheduleDisplay}</span>
                    </div>
                  )}
                  
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-[var(--oppa-border)] pt-2">
                  {activeTab === 'available' ? (
                    // Driver changes status to "on_the_way" when they accept it
                    <button onClick={() => updateOrderStatus(order.id, 'on_the_way', 'active')} className={chipPrimary + " w-full justify-center"}>
                      <Truck size={14} /> Accept Order
                    </button>
                  ) : activeTab === 'active' ? (
                    <button onClick={() => setSelectedOrder(order)} className={chipSuccess + " w-full justify-center"}>
                      <CheckCircle size={14} /> View Details
                    </button>
                  ) : (
                    <span className={chipDisabled + " w-full justify-center"}>
                      <CheckCircle size={14} /> Delivered
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: full data table */}
          <div className="relative z-0 hidden w-full overflow-visible rounded-2xl border border-[var(--oppa-border)] bg-white shadow-sm md:block">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[16%] md:max-lg:w-[23%] lg:max-xl:w-[20%]" />
                <col className="w-[14%] md:max-lg:w-[16%] lg:max-xl:w-[14%]" />
                <col className="w-[14%] md:max-lg:w-[21%] lg:max-xl:w-[18%]" />
                <col className="hidden w-[26%] lg:table-column lg:max-xl:w-[34%]" />
                <col className="w-[10%] md:max-lg:w-[16%] lg:max-xl:w-[10%]" />
                <col className="w-[20%] md:max-lg:w-[25%] lg:max-xl:w-[18%]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--oppa-border)] bg-[#eaf3eb] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--oppa-text-muted)]">
                  <th className="min-w-0 whitespace-nowrap px-3 py-2.5 pl-4">Order Details</th>
                  <th className="min-w-0 whitespace-nowrap px-3 py-2.5">Date Ordered</th>
                  <th className="min-w-0 px-3 py-2.5">Customer Info</th>
                  <th className="hidden min-w-0 px-3 py-2.5 lg:table-cell">Delivery Address</th>
                  <th className="min-w-0 whitespace-nowrap px-3 py-2.5">Status</th>
                  <th className="min-w-0 whitespace-nowrap px-3 py-2.5 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => (
                  <tr key={order.id} className={`border-b border-[var(--oppa-border)]/60 transition-colors duration-150 motion-reduce:transition-none last:border-0 hover:bg-emerald-50/70 ${order.deliveryType === 'priority' ? 'bg-gradient-to-r from-orange-50 to-white shadow-[inset_4px_0_0_0_#f97316] hover:from-orange-100' : ''}`}>
                    <td className="min-w-0 whitespace-nowrap px-3 py-2.5 pl-4 align-middle">
                      <p className="truncate font-mono text-[12px] tabular-nums text-gray-700" title={getDisplayOrderNumber(order)}>{getDisplayOrderNumber(order)}</p>
                      {order.deliveryType === 'priority' && (
                        <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-800"><Flame size={11} /> PRIORITY</span>
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-2.5 align-middle text-gray-500">
                      <OrderDateTime date={order.created_at} />
                    </td>
                    <td className="min-w-0 px-3 py-2.5 align-middle">
                      <p className="font-medium text-[var(--oppa-text)]">{order.customerName || 'Customer'}</p>
                      {order.phone && <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[var(--oppa-text-muted)]"><Phone size={12} />{order.phone}</p>}
                      <p className="mt-1 hidden truncate text-xs text-[var(--oppa-text-muted)] md:max-lg:block" title={order.deliveryAddress || order.address}>
                        <MapPin size={12} className="mr-1 inline shrink-0 text-[var(--oppa-green)]" />
                        {order.deliveryAddress || order.address}
                      </p>
                    </td>
                    <td className="hidden min-w-0 px-3 py-2.5 align-middle lg:table-cell">
                      <p className="flex min-w-0 items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[var(--oppa-text-muted)]" title={order.deliveryAddress || order.address}>
                        <MapPin size={14} className="shrink-0 text-[var(--oppa-green)]" />
                        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{order.deliveryAddress || order.address}</span>
                      </p>
                      {order.scheduleDisplay && order.scheduleDisplay !== 'Select date & time' && (
                        <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                          <Clock size={12} /> {order.scheduleDisplay}
                        </p>
                      )}
                    </td>
                    <td className="min-w-0 px-3 py-2.5 align-middle">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="min-w-0 whitespace-nowrap px-3 py-2.5 pr-4 align-middle">
                      <div className="flex flex-nowrap items-center justify-end gap-2">
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          title="Details"
                          aria-label="Details"
                          className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-[var(--oppa-border)] bg-white px-2.5 text-[12px] font-semibold whitespace-nowrap text-[var(--oppa-text)] transition hover:bg-[var(--oppa-cream)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--oppa-green)] focus-visible:ring-offset-2"
                        >
                          <Eye size={14} /><span className="hidden xl:inline">Details</span>
                        </button>
                        
                        {activeTab === 'available' ? (
                          <button onClick={() => updateOrderStatus(order.id, 'on_the_way', 'active')} className={`${chipPrimary} h-8 shrink-0 px-2.5 text-[12px] whitespace-nowrap justify-center`}>
                            <Truck size={14} /> Accept
                          </button>
                        ) : activeTab === 'active' ? (
                          <button onClick={() => setSelectedOrder(order)} className={`${chipSuccess} h-8 shrink-0 px-2.5 text-[12px] whitespace-nowrap justify-center`}>
                            <CheckCircle size={14} /> View Details
                          </button>
                        ) : (
                          <span className={`${chipDisabled} h-8 shrink-0 px-2 text-[11px] whitespace-nowrap justify-center`}>
                            <CheckCircle size={14} /> Delivered
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Driver Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-start justify-between mb-4 border-b pb-4">
              <div>
                <h2 className="text-xl font-bold">Delivery Details</h2>
                <p className="text-sm text-gray-500 font-mono">{getDisplayOrderNumber(selectedOrder)}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="rounded-full p-2 hover:bg-gray-100 transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-5">
              {/* Customer & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                  {selectedOrder.phone && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                      <Phone size={14} />
                      <a href={`tel:${selectedOrder.phone}`} className="hover:text-[var(--oppa-green)] transition">
                        {selectedOrder.phone}
                      </a>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date Ordered</p>
                  <p className="font-medium text-sm">{formatDate(selectedOrder.created_at)}</p>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <MapPin size={14} /> Address
                </p>
                <p className="text-sm text-orange-950 font-medium">
                  {selectedOrder.deliveryAddress || selectedOrder.address || 'No address provided'}
                </p>
              </div>

              {selectedOrder.deliveryCoordinates ? (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <MapContainer
                    key={selectedOrder.id}
                    center={[selectedOrder.deliveryCoordinates.lat, selectedOrder.deliveryCoordinates.lng]}
                    zoom={14}
                    scrollWheelZoom={false}
                    style={{ height: 280, width: '100%' }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <RouteLayer
                      start={OPPA_DRU_STORE_COORDS}
                      end={selectedOrder.deliveryCoordinates}
                      progress={0}
                    />
                    <Marker position={[OPPA_DRU_STORE_COORDS.lat, OPPA_DRU_STORE_COORDS.lng]} icon={storeIcon}>
                      <Popup>Oppa Dru store</Popup>
                    </Marker>
                    <Marker
                      position={[selectedOrder.deliveryCoordinates.lat, selectedOrder.deliveryCoordinates.lng]}
                      icon={destinationIcon}
                    >
                      <Popup>Customer delivery address</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  This order has no saved map pin. Use the delivery address above.
                </p>
              )}
              
             
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2 font-medium border-b pb-2">Order Items ({selectedOrder.items.length})</p>
                  <ul className="space-y-1">
                    {selectedOrder.items.map((item: any, idx: number) => (
                      <li key={idx} className="flex justify-between text-sm">
                        <span>
                          <span className="text-[var(--oppa-green)] font-bold mr-1">{item.quantity}x</span>
                          {item.name || item.product_name || item.title || 'Item'} 
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedOrder.status === 'on_the_way' ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => void updateOrderStatus(selectedOrder.id, 'delivered', 'history')}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                  >
                    <CheckCircle size={17} />
                    Delivered
                  </button>
                  <p className="text-center text-xs text-[var(--oppa-text-muted)]">
                    This updates the order to Delivered for the customer and admin immediately.
                  </p>
                </div>
              ) : null}

              {(selectedOrder.status === 'on_the_way' || selectedOrder.status === 'delivered') && (
                <div className="space-y-3 border-t border-[var(--oppa-border)] pt-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--oppa-text)]">Delivery Proof</p>
                    <p className="mt-1 text-xs text-[var(--oppa-text-muted)]">Send a delivery photo for the admin to view in Orders.</p>
                  </div>
                  {selectedOrder.deliveryProofImageUrl && (
                    <a href={selectedOrder.deliveryProofImageUrl} target="_blank" rel="noreferrer" className="block w-fit">
                      <img src={selectedOrder.deliveryProofImageUrl} alt="Uploaded delivery proof" className="h-28 w-40 rounded-lg border border-[var(--oppa-border)] object-cover" />
                    </a>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
                      className="min-w-0 flex-1 text-xs text-[var(--oppa-text-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--oppa-green-soft)] file:px-3 file:py-2 file:text-xs file:font-medium file:text-[var(--oppa-green)]"
                    />
                    <button
                      type="button"
                      onClick={() => void uploadDeliveryProof()}
                      disabled={!proofFile || proofUploading}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--oppa-green)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ImagePlus size={16} />
                      {proofUploading ? 'Sending...' : selectedOrder.deliveryProofImageUrl ? 'Replace Photo' : 'Send Photo'}
                    </button>
                  </div>
                  {proofFile && <p className="text-xs text-[var(--oppa-text-muted)]">Selected: {proofFile.name}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DriverLayout>
  );
};

export default DriverDashboardPage;
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiArrowLeft, FiSearch, FiX, FiChevronDown, FiCalendar, FiClock, 
  FiHash, FiChevronRight, FiPackage, FiShoppingBag, FiCheckCircle 
} from 'react-icons/fi';
import { FaClipboardList, FaCheck, FaStore } from 'react-icons/fa';
import { useOrder } from '../../../contexts/OrderContext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import { ORDER_STATUS } from '../../../utils/constants';
import { formatCurrency } from '../../../utils/formatters';
import { STATUS_DISPLAY, STATUS_OPTIONS, getStatusColor, formatOrderDate, formatOrderTime, getScheduledOrderDetails } from '../../../utils/orderUtils';

const MyOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { orders } = useOrder();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(ORDER_STATUS.PENDING);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const dateA = a.timestamp || '';
      const dateB = b.timestamp || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return sortedOrders.filter(order => {
      const scheduleDetails = getScheduledOrderDetails(order);
      const effectiveStatus = scheduleDetails.isScheduled ? ORDER_STATUS.SCHEDULED : order.status;
      const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            order.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFilter = effectiveStatus === filterStatus;
      return matchesSearch && matchesFilter;
    });
  }, [sortedOrders, searchTerm, filterStatus]);

  const stats = useMemo(() => {
    const total = orders.length;
    const delivered = orders.filter(o => o.status === ORDER_STATUS.DELIVERED).length;
    const scheduled = orders.filter(o => getScheduledOrderDetails(o).isScheduled && o.status !== ORDER_STATUS.DELIVERED).length;
    return { total, delivered, active: total - delivered, scheduled };
  }, [orders]);

  const currentStatus = STATUS_OPTIONS.find(opt => opt.value === filterStatus) ?? STATUS_OPTIONS[0];

  const handleTrackOrder = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/tracking', { state: { orderId } });
  };

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrderIds(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/customer')}
              className="flex items-center gap-2 text-gray-500 hover:text-[#2d6a4f] transition-colors group"
            >
              <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
              <span className="text-sm font-medium">Back to Menu</span>
            </button>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-2">
              <FaClipboardList className="text-xl text-[#2d6a4f]" />
              <h1 className="text-xl font-bold text-[#2d6a4f]">My Orders</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-2 shadow-sm border border-gray-100 text-sm">
            <span className="flex items-center gap-1.5">
              <FiShoppingBag size={15} className="text-gray-400" /> 
              Total: <strong className="text-[#2d6a4f]">{stats.total}</strong>
            </span>
            <span className="w-px h-5 bg-gray-200" />
            <span className="flex items-center gap-1.5">
              <FiClock className="text-amber-400" /> 
              Active: <strong className="text-amber-600">{stats.active}</strong>
            </span>
            <span className="w-px h-5 bg-gray-200" />
            <span className="flex items-center gap-1.5">
              <FiCheckCircle className="text-emerald-400" /> 
              Delivered: <strong className="text-emerald-600">{stats.delivered}</strong>
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl focus:border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20 bg-white text-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FiX size={17} />
              </button>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:border-gray-300 transition-colors min-w-[140px] justify-between"
            >
              <span>{currentStatus?.label || 'Pending'}</span>
              <FiChevronDown className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-10 min-w-[140px]">
                {STATUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setFilterStatus(option.value); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                      filterStatus === option.value ? 'bg-gray-50 font-medium' : ''
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Orders List */}
        <div className="mt-5 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <FiPackage className="text-4xl text-[#2d6a4f]/30 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-gray-800 mb-1">
                {orders.length === 0 ? 'No orders yet' : 'No matching orders'}
              </h2>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
                {orders.length === 0 
                  ? "You haven't placed any orders yet."
                  : "Try adjusting your search or filter."
                }
              </p>
              {orders.length === 0 && (
                <button 
                  onClick={() => navigate('/customer')} 
                  className="px-6 py-2.5 bg-[#2d6a4f] text-white rounded-lg font-medium hover:bg-[#1b4332] transition-colors shadow-md shadow-[#2d6a4f]/20 flex items-center gap-2 mx-auto text-sm"
                >
                  <FaStore size={15} /> Browse Menu
                </button>
              )}
            </div>
          ) : (
            filteredOrders.map((order) => {
              const scheduleDetails = getScheduledOrderDetails(order);
              const effectiveStatus = scheduleDetails.isScheduled ? ORDER_STATUS.SCHEDULED : order.status;
              const isScheduledOrder = scheduleDetails.isScheduled && order.status !== ORDER_STATUS.DELIVERED;
              const displayStatus = isScheduledOrder ? STATUS_DISPLAY[ORDER_STATUS.SCHEDULED] : (STATUS_DISPLAY[order.status] ?? STATUS_DISPLAY[ORDER_STATUS.PENDING]);
              const isActive = order.status !== ORDER_STATUS.DELIVERED;
              const statusColor = getStatusColor(isScheduledOrder ? ORDER_STATUS.SCHEDULED : effectiveStatus);

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300"
                >
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${statusColor} border`}>
                          {displayStatus.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 text-sm">
                              Order #{order.id.slice(-8).toUpperCase()}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${displayStatus.badgeClass} border flex items-center gap-1`}>
                              {displayStatus.icon}
                              {displayStatus.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <FiCalendar size={12} /> {formatOrderDate(order.timestamp || '')}
                            </span>
                            <span className="hidden xs:inline">•</span>
                            <span className="flex items-center gap-1">
                              <FiClock size={12} /> {formatOrderTime(order.timestamp || '')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0 ml-auto sm:ml-0">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Total</p>
                          <p className="text-base font-bold text-[#2d6a4f]">{formatCurrency(order.total)}</p>
                        </div>
                        {isActive ? (
                          <div className="w-8 h-8 rounded-full bg-[#2d6a4f]/10 flex items-center justify-center text-[#2d6a4f] flex-shrink-0">
                            <FiChevronRight size={18} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 flex-shrink-0">
                            <FaCheck size={15} />
                          </div>
                        )}
                      </div>
                    </div>

                    {isScheduledOrder && (
                      <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50/50 p-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                          <span aria-hidden="true">🗓</span>
                          <span>Scheduled Order</span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 mb-1">Scheduled for</p>
                            <p className="font-semibold text-gray-800">{scheduleDetails.scheduledDate || 'Date not available'}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 mb-1">Delivery time</p>
                            <p className="font-semibold text-gray-800">{scheduleDetails.scheduledTime || 'Time not available'}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between flex-wrap gap-2 border-t border-orange-100 pt-2 text-xs text-orange-700">
                          <span className="font-medium">Status: Scheduled</span>
                          <span className="text-gray-500">Waiting for scheduled time</span>
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    <div className="flex flex-wrap gap-1.5 pt-3 border-t border-gray-100 mt-3">
                      {order.items.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-lg text-xs text-gray-700 border border-gray-100">
                          <span className="font-semibold text-[#2d6a4f]">{item.quantity}x</span>
                          <span className="truncate max-w-[100px]">{item.name}</span>
                        </span>
                      ))}
                      {order.items.length > 3 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs text-gray-400 bg-gray-50 border border-gray-100">
                          +{order.items.length - 3} more
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-gray-100 mt-2.5">
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <FiHash size={12} /> {order.id.slice(0, 12)}...
                        </span>
                        <span className="hidden xs:inline">•</span>
                        <span className="capitalize">
                          {order.paymentMethod?.replace('_', ' ') || 'Cash'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleOrderDetails(order.id)}
                          className="text-xs font-medium text-[#2d6a4f] hover:underline flex items-center gap-1"
                        >
                          {expandedOrderIds[order.id] ? 'Hide Details' : 'View Details'}
                        </button>
                        {isActive ? (
                          <button 
                            onClick={(e) => handleTrackOrder(order.id, e)} 
                            className="text-xs font-medium text-[#2d6a4f] hover:underline flex items-center gap-1"
                          >
                            Track Order <FiChevronRight size={14} />
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                            <FaCheck size={12} /> Completed
                          </span>
                        )}
                      </div>
                    </div>

                    {expandedOrderIds[order.id] && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <div className="space-y-3">
                          {order.items.map((item, itemIndex) => {
                            const addonsTotal = (item.selectedAddons || []).reduce((sum, addon) => sum + Number(addon.price || 0) * (addon.quantity || 1), 0);
                            const itemSubtotal = (Number(item.price || 0) + addonsTotal) * Number(item.quantity || 1);

                            return (
                              <div key={`${order.id}-${itemIndex}`} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                                <div className="flex justify-between gap-4 text-sm">
                                  <div>
                                    <p className="font-medium text-gray-800">{item.quantity}x {item.name}</p>
                                    {item.selectedAddons && item.selectedAddons.length > 0 && (
                                      <div className="mt-2 text-xs text-gray-500 space-y-1">
                                        {item.selectedAddons.map((addon, addonIndex) => (
                                          <div key={`${item.id}-${addonIndex}`} className="flex justify-between gap-3">
                                            <span>+ {addon.name} {addon.quantity && addon.quantity > 1 ? `x${addon.quantity}` : ''}</span>
                                            <span>{formatCurrency((Number(addon.price || 0)) * (addon.quantity || 1))}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className="font-medium text-gray-700">{formatCurrency(itemSubtotal)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
                          {(() => {
                            const productSubtotal = order.items.reduce((sum, item) => {
                              const addonTotal = (item.selectedAddons || []).reduce((addonSum, addon) => addonSum + Number(addon.price || 0) * (addon.quantity || 1), 0);
                              return sum + ((Number(item.price || 0) + addonTotal) * Number(item.quantity || 1));
                            }, 0);
                            
                            const deliveryFee = order.deliveryFee ?? 0;
                            const serviceFee = order.serviceFee ?? 0;
                            let priorityFee = order.priorityFee ?? 0;
                            let vat = Number(order.vat ?? 0);
                            
                            // If priority fee is missing but delivery type is priority, set it to 99
                            if (priorityFee === 0 && order.deliveryType === 'priority') {
                              priorityFee = 99;
                            }
                            
                            // If VAT is 0 or missing, recalculate from total
                            if (vat === 0 && order.total > 0) {
                              const beforeVat = productSubtotal + deliveryFee + serviceFee + priorityFee;
                              vat = Math.round((order.total - beforeVat) * 100) / 100;
                              if (vat < 0) vat = 0;
                            }
                            
                            return (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Product subtotal</span>
                                  <span>{formatCurrency(productSubtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Delivery fee</span>
                                  <span>{deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Service fee</span>
                                  <span>{formatCurrency(serviceFee)}</span>
                                </div>
                                {(order.deliveryType === 'priority' || priorityFee > 0) && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Priority fee</span>
                                    <span>{formatCurrency(priorityFee)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-gray-500">VAT</span>
                                  <span>{formatCurrency(vat)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-base text-[#2d6a4f] pt-2 border-t border-gray-100">
                                  <span>Order total</span>
                                  <span>{formatCurrency(order.total)}</span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MyOrdersPage;
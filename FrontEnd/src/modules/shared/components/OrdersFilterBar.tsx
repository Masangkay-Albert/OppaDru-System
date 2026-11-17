import React from 'react';
import { CalendarDays, Globe2, ShoppingBag, Store, X } from 'lucide-react';
import SearchInput from '../../../components/ui/SearchInput';
import Select, { type SelectOption } from '../../../components/ui/Select';

type OrderChannel = 'all' | 'online' | 'onsite' | 'foodpanda' | 'grabfood';

interface OrdersFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  channel: OrderChannel;
  onChannelChange: (value: OrderChannel) => void;
  date: string;
  onDateChange: (value: string) => void;
  onClear?: () => void;
  dateMin?: string;
  dateMax?: string;
  status?: string;
  statusOptions?: SelectOption<string>[];
  onStatusChange?: (value: string) => void;
  statusCount?: number;
}

const formatSelectedDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
};

const OrdersFilterBar: React.FC<OrdersFilterBarProps> = ({
  search,
  onSearchChange,
  channel,
  onChannelChange,
  date,
  onDateChange,
  onClear,
  dateMin,
  dateMax,
  status,
  statusOptions,
  onStatusChange,
  statusCount,
}) => (
  <div className="admin-orders-filterbar">
    <div className="admin-orders-search">
      <SearchInput
        aria-label="Search orders by ID, customer, email, or platform order number"
        value={search}
        onChange={onSearchChange}
        placeholder="Search order ID, customer, email, or platform number..."
        wrapperClassName="min-w-0 flex-1"
      />
    </div>
    {statusOptions && onStatusChange && (
      <Select
        aria-label="Filter by status"
        value={status || 'all'}
        onChange={onStatusChange}
        options={statusOptions}
        renderValue={(option) => `Status: ${option?.label ?? 'All'} (${statusCount ?? 0})`}
        className="admin-orders-status-filter"
      />
    )}
    <Select
      aria-label="Filter by channel"
      value={channel}
      onChange={onChannelChange}
      options={[
        { value: 'all', label: 'All channels' },
        { value: 'online', label: 'Online', icon: <Globe2 size={15} aria-hidden="true" className="text-[var(--oppa-text-muted)]" /> },
        { value: 'onsite', label: 'Onsite', icon: <Store size={15} aria-hidden="true" className="text-[var(--oppa-text-muted)]" /> },
        { value: 'foodpanda', label: 'Foodpanda', icon: <ShoppingBag size={15} aria-hidden="true" className="text-[var(--oppa-text-muted)]" /> },
        { value: 'grabfood', label: 'GrabFood', icon: <ShoppingBag size={15} aria-hidden="true" className="text-[var(--oppa-text-muted)]" /> },
      ]}
      className="admin-orders-channel-filter"
    />
    <label className={`admin-orders-date-filter ${date ? 'has-date' : ''}`}>
      <CalendarDays size={16} aria-hidden="true" />
      <span className={`admin-orders-date-value ${date ? 'is-selected' : ''}`}>
        {date
          ? formatSelectedDate(date)
          : 'Select date'}
      </span>
      <input
        aria-label="Filter by exact date"
        type="date"
        value={date}
        min={dateMin}
        max={dateMax}
        onChange={(event) => onDateChange(event.target.value)}
      />
      {date && <button type="button" aria-label="Clear selected date" title="Clear date" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDateChange(''); }}><X size={15} aria-hidden="true" /></button>}
    </label>
    {onClear && (
      <button type="button" onClick={onClear} className="admin-orders-clear-filters">
        Clear filters
      </button>
    )}
  </div>
);

export default OrdersFilterBar;

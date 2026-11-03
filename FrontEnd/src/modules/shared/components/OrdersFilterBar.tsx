import React from 'react';
import { CalendarDays } from 'lucide-react';
import SearchInput from '../../../components/ui/SearchInput';
import Select from '../../../components/ui/Select';

type OrderChannel = 'all' | 'online' | 'onsite';

interface OrdersFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  channel: OrderChannel;
  onChannelChange: (value: OrderChannel) => void;
  date: string;
  onDateChange: (value: string) => void;
  onClear?: () => void;
  dateMax?: string;
}

const OrdersFilterBar: React.FC<OrdersFilterBarProps> = ({
  search,
  onSearchChange,
  channel,
  onChannelChange,
  date,
  onDateChange,
  onClear,
  dateMax,
}) => (
  <div className="admin-orders-filterbar">
    <div className="admin-orders-search">
      <SearchInput
        aria-label="Search orders by ID, customer, or email"
        value={search}
        onChange={onSearchChange}
        placeholder="Search order ID, customer, email..."
        wrapperClassName="min-w-0 flex-1"
      />
    </div>
    <Select
      aria-label="Filter by channel"
      value={channel}
      onChange={onChannelChange}
      options={[
        { value: 'all', label: 'All channels' },
        { value: 'online', label: 'Online' },
        { value: 'onsite', label: 'Onsite' },
      ]}
      className="admin-orders-channel-filter"
    />
    <label className="admin-orders-date-filter">
      <CalendarDays size={16} aria-hidden="true" />
      <input
        aria-label="Filter by exact date"
        type="date"
        value={date}
        max={dateMax}
        onChange={(event) => onDateChange(event.target.value)}
      />
    </label>
    {onClear && (
      <button type="button" onClick={onClear} className="admin-orders-clear-filters">
        Clear filters
      </button>
    )}
  </div>
);

export default OrdersFilterBar;

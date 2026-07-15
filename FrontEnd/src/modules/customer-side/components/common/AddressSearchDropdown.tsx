// src/modules/customer-side/components/common/AddressSearchDropdown.tsx
import React, { useRef, useEffect, useState } from 'react';
import { 
  FiMapPin, 
  FiX, 
  FiLoader, 
  FiSearch, 
  FiHome, 
  FiMap,
  FiCheckCircle,
  FiAlertCircle
} from 'react-icons/fi';
import { 
  IoBusinessOutline,
  IoHomeOutline 
} from 'react-icons/io5';
import { useLocationSearch } from '../../../../hooks/useLocationSearch';
import type { LocationResult } from '../../../../hooks/useLocationSearch';

interface AddressSearchDropdownProps {
  onSelect: (location: LocationResult) => void;
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  initialValue?: string;
  onFocusChange?: (isFocused: boolean) => void;
}

const AddressSearchDropdown: React.FC<AddressSearchDropdownProps> = ({
  onSelect,
  placeholder = 'Search for any location in the Philippines...',
  className = '',
  value = '',
  onChange,
  initialValue = '',
  onFocusChange
}) => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    selectedLocation,
    selectLocation,
    error
  } = useLocationSearch();

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(initialValue || value);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && value !== inputValue) {
      setInputValue(value);
      setSearchQuery(value);
    }
  }, [value, setSearchQuery, inputValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (onFocusChange) onFocusChange(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onFocusChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    setSearchQuery(val);
    setIsOpen(val.length > 1);
    if (onChange) onChange(val);
  };

  const handleSelect = (location: LocationResult) => {
    selectLocation(location);
    setInputValue(location.address);
    setIsOpen(false);
    if (onFocusChange) onFocusChange(false);
    onSelect(location);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleFocus = () => {
    if (onFocusChange) onFocusChange(true);
    if (searchQuery.length > 1 && searchResults.length > 0) {
      setIsOpen(true);
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));
    return parts.map((part: string, i: number) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <span key={i} className="bg-yellow-200 font-semibold">{part}</span> : 
        part
    );
  };

  const getLocationIcon = (type?: string) => {
    switch(type) {
      case 'city':
        return <IoBusinessOutline className="text-[#2d6a4f]" size={18} />;
      case 'town':
        return <IoHomeOutline className="text-[#2d6a4f]" size={18} />;
      case 'village':
        return <FiHome className="text-[#2d6a4f]" size={18} />;
      case 'suburb':
        return <FiMap className="text-[#2d6a4f]" size={18} />;
      default:
        return <FiMapPin className="text-[#2d6a4f]" size={18} />;
    }
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <FiSearch size={18} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:border-[#2d6a4f] focus:outline-none transition text-gray-800"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isSearching && (
            <FiLoader className="animate-spin text-[#2d6a4f]" size={20} />
          )}
          {inputValue && !isSearching && (
            <button
              onClick={() => {
                setInputValue('');
                setSearchQuery('');
                setIsOpen(false);
                if (onChange) onChange('');
              }}
              className="text-gray-400 hover:text-gray-600 transition p-1"
              type="button"
            >
              <FiX size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown with higher z-index */}
      {isOpen && searchResults.length > 0 && (
        <div className="absolute z-[999] w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-60 overflow-auto">
          <div className="sticky top-0 p-3 border-b border-gray-100 bg-gradient-to-r from-[#f0fdf4] to-white z-10">
            <p className="text-xs text-gray-500 flex items-center justify-between">
              <span>Found {searchResults.length} location{searchResults.length > 1 ? 's' : ''}</span>
              <span className="text-[#2d6a4f] flex items-center gap-1">
                <FiMapPin size={12} />
                Philippines
              </span>
            </p>
          </div>
          {searchResults.map((result: LocationResult, index: number) => (
            <button
              key={`${result.lat}-${result.lng}-${index}`}
              onClick={() => handleSelect(result)}
              className="w-full px-4 py-3 text-left hover:bg-[#f0fdf4] transition-colors border-b border-gray-50 last:border-0 group"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {getLocationIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 group-hover:text-[#2d6a4f] transition">
                    {highlightMatch(result.name, searchQuery)}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {result.address}
                  </p>
                </div>
                {result.type && (
                  <span className="mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap">
                    {result.type}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="absolute z-[999] w-full mt-2 bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-start gap-2">
            <FiAlertCircle className="text-red-500 mt-0.5" size={18} />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      )}

      {selectedLocation && (
        <div className="mt-3 p-3 bg-[#f0fdf4] rounded-xl border border-[#2d6a4f]/20">
          <div className="flex items-start gap-2">
            <FiCheckCircle className="text-[#2d6a4f] mt-0.5" size={18} />
            <div className="flex-1">
              <p className="font-medium text-gray-800">{selectedLocation.name}</p>
              <p className="text-sm text-gray-500">{selectedLocation.address}</p>
            </div>
            <button
              onClick={() => {
                selectLocation(null);
                setInputValue('');
                setSearchQuery('');
                if (onChange) onChange('');
              }}
              className="text-gray-400 hover:text-gray-600 text-sm font-medium"
            >
              Change
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressSearchDropdown;
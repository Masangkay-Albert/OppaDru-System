// src/modules/customer-side/components/checkout/ScheduleModal.tsx
import React from 'react';
import { formatDate } from '../../../../utils/formatters';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDates: Array<{ date: Date; label: string }>;
  timeSlots: string[];
  selectedDate: Date | null;
  selectedTime: string | null;
  onSelectDate: (date: Date) => void;
  onSelectTime: (time: string) => void;
  onConfirm: () => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  availableDates,
  timeSlots,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="font-semibold text-lg">Select a date and time</h2>
          <button onClick={onClose} className="text-2xl text-gray-400">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-2">Select date</p>
            <div className="flex gap-2">
              {availableDates.map((d, i) => (
                <button 
                  key={i} 
                  onClick={() => onSelectDate(d.date)} 
                  className={`flex-1 py-3 rounded-xl border text-center transition ${
                    selectedDate?.toDateString() === d.date.toDateString() 
                      ? 'border-[#e76f51] bg-[#fff3e0] text-[#e76f51]' 
                      : 'border-gray-200'
                  }`}
                >
                  <p className="font-medium text-sm">{d.label}</p>
                  <p className="text-xs text-gray-400">{formatDate(d.date)}</p>
                </button>
              ))}
            </div>
          </div>
          
          {selectedDate && (
            <div>
              <p className="text-sm text-gray-500 mb-2">Select time</p>
              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {timeSlots.map((slot, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => onSelectTime(slot)} 
                    className={`py-2 px-3 rounded-lg border text-sm transition ${
                      selectedTime === slot 
                        ? 'border-[#e76f51] bg-[#fff3e0] text-[#e76f51]' 
                        : 'border-gray-200'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 border rounded-xl text-gray-700">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={!selectedDate || !selectedTime} 
            className={`flex-1 py-2 rounded-xl font-medium ${
              selectedDate && selectedTime ? 'bg-[#2d6a4f] text-white' : 'bg-gray-200 text-gray-400'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
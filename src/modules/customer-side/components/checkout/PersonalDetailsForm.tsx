import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../../contexts/Authcontext';
import type { TempPerson } from '../../../../hooks/useCheckoutForm';

interface PersonalDetailsFormProps {
  tempPerson: TempPerson;
  onUpdatePerson: (field: keyof TempPerson, value: string) => void;
}

const PersonalDetailsForm: React.FC<PersonalDetailsFormProps> = ({ tempPerson, onUpdatePerson }) => {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editPerson, setEditPerson] = useState({ fullName: '', phone: '' });

  useEffect(() => {
    if (user) {
      const savedPhone = localStorage.getItem(`phone_${user.id}`) || '';
      if (savedPhone && !tempPerson.phone) {
        onUpdatePerson('phone', savedPhone);
      }
    }
  }, [user]);

  const startEdit = () => {
    setEditPerson({ fullName: tempPerson.fullName, phone: tempPerson.phone });
    setIsEditing(true);
  };

  const saveEdit = () => {
    onUpdatePerson('fullName', editPerson.fullName);
    onUpdatePerson('phone', editPerson.phone);
    if (user) {
      localStorage.setItem(`phone_${user.id}`, editPerson.phone);
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#d8f3dc] rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-[#2d6a4f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-800">Personal details</h2>
        </div>
        {!isEditing && (
          <button onClick={startEdit} className="text-[#e76f51] text-sm font-medium hover:underline">
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <input 
            type="text" 
            value={editPerson.fullName} 
            onChange={(e) => setEditPerson({...editPerson, fullName: e.target.value})} 
            placeholder="Full Name" 
            className="w-full px-4 py-2 border rounded-xl focus:border-[#2d6a4f] focus:outline-none"
            required
          />
          <input 
            type="email" 
            value={tempPerson.email || user?.email || ''} 
            disabled 
            className="w-full px-4 py-2 border rounded-xl bg-gray-50 text-gray-500"
          />
          <input 
            type="tel" 
            value={editPerson.phone} 
            onChange={(e) => setEditPerson({...editPerson, phone: e.target.value})} 
            placeholder="Phone Number" 
            className="w-full px-4 py-2 border rounded-xl focus:border-[#2d6a4f] focus:outline-none"
            required
          />
          <div className="flex gap-3">
            <button 
              onClick={saveEdit} 
              className="px-4 py-2 bg-[#2d6a4f] text-white rounded-xl hover:bg-[#1b4332] transition-colors"
            >
              Save
            </button>
            <button 
              onClick={() => setIsEditing(false)} 
              className="px-4 py-2 border rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 py-1">
            <span className="text-sm text-gray-500 w-24">Full Name</span>
            <span className="text-sm font-medium">{tempPerson.fullName || user?.fullName || 'Not set'}</span>
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="text-sm text-gray-500 w-24">Email</span>
            <span className="text-sm font-medium">{tempPerson.email || user?.email || 'Not set'}</span>
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="text-sm text-gray-500 w-24">Phone</span>
            <span className="text-sm font-medium">{tempPerson.phone || 'Not set'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalDetailsForm;
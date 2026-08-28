import React, { useEffect } from 'react';
import { useAuth } from '../../../../contexts/Authcontext';
import type { TempPerson } from '../../../../hooks/useCheckoutForm';

interface PersonalDetailsFormProps {
  tempPerson: TempPerson;
  onUpdatePerson: (field: keyof TempPerson, value: string) => void;
}

const PersonalDetailsForm: React.FC<PersonalDetailsFormProps> = ({ tempPerson, onUpdatePerson }) => {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const savedPhone = localStorage.getItem(`phone_${user.id}`) || '';
      if (savedPhone && !tempPerson.phone) {
        onUpdatePerson('phone', savedPhone);
      }
    }
  }, [user]);

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
      </div>

      <div className="space-y-2">
          <div className="flex items-center gap-2 py-1">
            <span className="text-sm text-gray-500 w-24">Full Name</span>
            <span className="text-sm font-medium">{tempPerson.fullName || user?.full_name || 'Not set'}</span>
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="text-sm text-gray-500 w-24">Phone</span>
            <span className="text-sm font-medium">{tempPerson.phone || 'Not set'}</span>
          </div>
      </div>
    </div>
  );
};

export default PersonalDetailsForm;
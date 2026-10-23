import React, { useState, useEffect } from 'react';
import { FiUser, FiMail, FiShield, FiCheckCircle } from 'react-icons/fi';

const ProfileSection: React.FC = () => {
  const [employee, setEmployee] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('employee_auth');
      if (raw) {
        setEmployee(JSON.parse(raw));
      }
    } catch {
      setEmployee(null);
    }
  }, []);

  const fullName = employee?.fullName || employee?.full_name || 'Cashier Staff';
  const email = employee?.email || 'cashier@oppadru.com';
  const position = employee?.position || 'Cashier';
  const employeeId = employee?.id || 'EMP-POS';

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-1">Staff Profile</h2>
      <p className="text-sm text-gray-500 mb-6">View your active employee credentials and portal assignment</p>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
            Full Name
          </label>
          <div className="relative">
            <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              readOnly
              value={fullName}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 cursor-default"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
            Staff Email
          </label>
          <div className="relative">
            <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="email"
              readOnly
              value={email}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 cursor-default"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Assigned Role
            </label>
            <div className="relative">
              <FiShield className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                readOnly
                value={position.toUpperCase()}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-[var(--oppa-green)] cursor-default"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
              Employee ID
            </label>
            <div className="relative">
              <FiCheckCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-500" size={18} />
              <input
                type="text"
                readOnly
                value={String(employeeId)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 cursor-default"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSection;

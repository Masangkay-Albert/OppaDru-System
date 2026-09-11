import React, { useState } from 'react';
import { FiLock, FiShield } from 'react-icons/fi';

const SecuritySection: React.FC = () => {
  const [employee] = useState(() => {
    try {
      const raw = localStorage.getItem('employee_auth');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-1">Security & Access</h2>
      <p className="text-sm text-gray-500 mb-6">Staff portal account access and password security policies</p>

      <div className="space-y-4">
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 flex items-start gap-3">
          <FiShield className="text-blue-600 text-lg mt-0.5 shrink-0" />
          <div className="text-xs text-blue-900 leading-relaxed space-y-1">
            <p className="font-bold text-sm text-blue-950">Active Portal Session</p>
            <p>
              You are signed in with employee access credentials for role: <strong>{employee?.position || 'Staff'}</strong>.
            </p>
            <p>
              Employee passwords and PIN resets are administered through the store manager or Admin Employees control panel.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <FiLock className="text-gray-500" />
            <span>Best Practices for POS Register Security</span>
          </div>
          <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-5">
            <li>Never share your employee email or password with other staff members.</li>
            <li>Always sign out of the register session before leaving the counter unattended.</li>
            <li>Verify all cash bills received and tender exact change calculated by the system.</li>
            <li>Report any transaction discrepancies immediately to the shift supervisor.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SecuritySection;

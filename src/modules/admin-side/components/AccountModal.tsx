// src/modules/admin-side/components/AccountModal.tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { StoredAccount } from '../../../services/adminAuthService';

interface AccountModalProps {
  account: StoredAccount;
  onClose: () => void;
  onResetPassword: (id: string, newPassword: string) => void;
}

const AccountModal: React.FC<AccountModalProps> = ({ account, onClose, onResetPassword }) => {
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleReset = () => {
    if (newPassword.trim().length < 4) {
      setMessage('Password must be at least 4 characters.');
      return;
    }
    onResetPassword(account.id, newPassword.trim());
    setMessage('Password reset successfully.');
    setNewPassword('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>

        <h2 className="text-lg font-bold text-gray-900 mb-4">Account Details</h2>

        <div className="space-y-2 text-sm mb-5">
          <p><span className="text-gray-500">Full Name:</span> <span className="font-medium">{account.fullName}</span></p>
          <p><span className="text-gray-500">Email:</span> <span className="font-medium">{account.email}</span></p>
          <p><span className="text-gray-500">Role:</span> <span className="font-medium capitalize">{account.role}</span></p>
          {account.position && (
            <p><span className="text-gray-500">Position:</span> <span className="font-medium">{account.position}</span></p>
          )}
          {account.contactNumber && (
            <p><span className="text-gray-500">Contact:</span> <span className="font-medium">{account.contactNumber}</span></p>
          )}
          {account.address && (
            <p><span className="text-gray-500">Address:</span> <span className="font-medium">{account.address}</span></p>
          )}
          {account.dateRegistered && (
            <p><span className="text-gray-500">Registered:</span> <span className="font-medium">{new Date(account.dateRegistered).toLocaleDateString()}</span></p>
          )}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm text-gray-600 mb-1">Reset Password</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-700"
            />
            <button
              onClick={handleReset}
              className="bg-lime-700 hover:bg-lime-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Reset
            </button>
          </div>
          {message && <p className="text-xs text-gray-500 mt-2">{message}</p>}
        </div>
      </div>
    </div>
  );
};

export default AccountModal;

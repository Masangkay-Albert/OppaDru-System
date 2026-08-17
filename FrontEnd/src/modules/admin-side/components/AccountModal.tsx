// src/modules/admin-side/components/AccountModal.tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';

// 1. Define a flexible interface here instead of importing StoredAccount
export interface ModalAccount {
  id: string;
  fullName?: string; // For employees
  full_name?: string; // For users
  email: string;
  role?: string;
  position?: string;
  contactNumber?: string;
  phone?: string;
  address?: string;
  created_at?: string; // Laravel uses created_at instead of dateRegistered
}

interface AccountModalProps {
  account: ModalAccount;
  onClose: () => void;
  onResetPassword: (id: string, newPassword: string) => void;
}

const AccountModal: React.FC<AccountModalProps> = ({ account, onClose, onResetPassword }) => {
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');

  const handleReset = () => {
    if (newPassword.trim().length < 6) { // Updated to 6 to match Laravel validation
      setMessage('Password must be at least 6 characters.');
      return;
    }
    onResetPassword(account.id, newPassword.trim());
    setMessage('Password reset successfully.');
    setNewPassword('');
  };

  // Helper to safely get the name whether it's an Employee (fullName) or User (full_name)
  const displayName = account.fullName || account.full_name || 'N/A';
  // Helper to safely get contact info
  const displayContact = account.contactNumber || account.phone;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-[var(--oppa-text-muted)] hover:text-[var(--oppa-text)]">
          <X size={20} />
        </button>

        <h2 className="mb-4 font-serif text-lg font-bold text-[var(--oppa-text)]">Account Details</h2>

        <div className="mb-5 space-y-2 text-sm">
          <p><span className="text-[var(--oppa-text-muted)]">Full Name:</span> <span className="font-medium text-[var(--oppa-text)]">{displayName}</span></p>
          <p><span className="text-[var(--oppa-text-muted)]">Email:</span> <span className="font-medium text-[var(--oppa-text)]">{account.email}</span></p>
          
          {account.role && (
            <p><span className="text-[var(--oppa-text-muted)]">Role:</span> <span className="font-medium capitalize text-[var(--oppa-text)]">{account.role}</span></p>
          )}
          
          {account.position && (
            <p><span className="text-[var(--oppa-text-muted)]">Position:</span> <span className="font-medium capitalize text-[var(--oppa-text)]">{account.position}</span></p>
          )}
          
          {displayContact && (
            <p><span className="text-[var(--oppa-text-muted)]">Contact:</span> <span className="font-medium text-[var(--oppa-text)]">{displayContact}</span></p>
          )}
          
          {account.address && (
            <p><span className="text-[var(--oppa-text-muted)]">Address:</span> <span className="font-medium text-[var(--oppa-text)]">{account.address}</span></p>
          )}
          
          {account.created_at && (
            <p><span className="text-[var(--oppa-text-muted)]">Registered:</span> <span className="font-medium text-[var(--oppa-text)]">{new Date(account.created_at).toLocaleDateString()}</span></p>
          )}
        </div>

        <div className="border-t border-[var(--oppa-border)] pt-4">
          <label className="mb-1 block text-sm text-[var(--oppa-text-muted)]">Reset Password</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="flex-1 rounded-lg border border-[var(--oppa-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]"
            />
            <button
              onClick={handleReset}
              className="bg-oppa-gradient rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Reset
            </button>
          </div>
          {message && <p className="mt-2 text-xs text-[var(--oppa-text-muted)]">{message}</p>}
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
import React, { useState, useEffect } from 'react';
import { FiUser, FiCalendar, FiSave, FiCheckCircle, FiUpload } from 'react-icons/fi';
import { useSettings } from '../../../../contexts/SettingsContext';
import { useAuth } from '../../../../contexts/Authcontext';

const getAuthToken = () => localStorage.getItem('auth_token');
const getToday = () => {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${today.getFullYear()}-${month}-${day}`;
};

const DiscountSection: React.FC = () => {
  const { discountInfo, updateDiscountInfo, getActiveDiscount } = useSettings();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    isPWD: false,
    isSenior: false,
    idNumber: '',
    fullName: '',
    expiryDate: '',
    proofImage: null as File | null,
    proofPreview: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeDiscount = getActiveDiscount();

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      isPWD: discountInfo.isPWD || false,
      isSenior: discountInfo.isSenior || false,
      idNumber: discountInfo.idNumber || '',
      fullName: discountInfo.fullName || '',
      expiryDate: discountInfo.expiryDate || '',
    }));
  }, [discountInfo]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    if (!formData.isPWD && !formData.isSenior) {
      setMessage({ type: 'error', text: 'Please select either PWD or Senior Citizen' });
      setIsSaving(false);
      return;
    }

    if (!formData.idNumber.trim()) {
      setMessage({ type: 'error', text: 'Please enter your ID number' });
      setIsSaving(false);
      return;
    }

    if (!/^(?=.*\d)[A-Za-z0-9][A-Za-z0-9 -]{5,19}$/.test(formData.idNumber.trim())) {
      setMessage({ type: 'error', text: 'Enter a valid PWD or Senior Citizen ID number (6-20 characters with at least one number).' });
      setIsSaving(false);
      return;
    }

    if (formData.expiryDate && formData.expiryDate < getToday()) {
      setMessage({ type: 'error', text: 'Expiry date cannot be yesterday or an earlier date.' });
      setIsSaving(false);
      return;
    }

    if (!formData.proofImage) {
      setMessage({ type: 'error', text: 'Please upload a valid proof image before submitting your discount request.' });
      setIsSaving(false);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setMessage({ type: 'error', text: 'Your session is expired. Please log in again.' });
      setIsSaving(false);
      return;
    }

    if (!user?.full_name?.trim()) {
      setMessage({ type: 'error', text: 'Your account name is unavailable. Please log in again.' });
      setIsSaving(false);
      return;
    }

    try {
      const form = new FormData();
      form.append('discount_type', formData.isPWD ? 'PWD' : 'Senior Citizen');
      form.append('full_name', user.full_name.trim());
      form.append('id_number', formData.idNumber.trim());
      if (formData.expiryDate) form.append('expiry_date', formData.expiryDate);
      form.append('proof_image', formData.proofImage);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api'}/discount/applications`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = result?.errors ? Object.values(result.errors).flat().join(' ') : (result?.message || 'Failed to submit discount application');
        throw new Error(errorMessage);
      }

      updateDiscountInfo({
        isPWD: false,
        isSenior: false,
        idNumber: formData.idNumber,
        fullName: user?.full_name || '',
        expiryDate: formData.expiryDate,
        rejectionReason: '',
        status: 'pending',
      });

      setMessage({ type: 'success', text: 'Discount request submitted successfully! It is now pending admin verification.' });
      setIsEditing(false);
      setFormData((prev) => ({ ...prev, proofImage: null, proofPreview: '' }));
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to save discount information' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Are you sure you want to remove your discount request?')) return;

    const token = getAuthToken();
    if (!token) {
      setMessage({ type: 'error', text: 'Your session is expired. Please log in again.' });
      return;
    }

    setIsRemoving(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://oppadru-system-1.onrender.com/api'}/discount/applications/me`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || 'Failed to remove discount request');

      updateDiscountInfo({
        isPWD: false,
        isSenior: false,
        idNumber: '',
        fullName: user?.full_name || '',
        expiryDate: '',
        rejectionReason: '',
        status: 'not_requested',
      });
      setMessage({ type: 'success', text: 'Discount request removed successfully!' });
      setIsEditing(false);
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Failed to remove discount request' });
    } finally {
      setIsRemoving(false);
    }
  };

  const hasActiveDiscount = discountInfo.status === 'approved' && (discountInfo.isPWD || discountInfo.isSenior);
  const isPendingReview = discountInfo.status === 'pending';
  const isRejected = discountInfo.status === 'rejected';

  return (
    <div className="settings-section settings-discount">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Discount Application</h2>
          <p className="text-sm text-gray-500">Apply for PWD or Senior Citizen discount</p>
        </div>
        {hasActiveDiscount && !isEditing && (
          <span className="px-3 py-1 bg-[#d8f3dc] text-[#2d6a4f] rounded-full text-sm font-semibold flex items-center gap-1">
            <FiCheckCircle size={16} />
            Active: {activeDiscount.type} ({(activeDiscount.discountRate * 100)}% off)
          </span>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {isPendingReview && !isEditing ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FiCheckCircle className="text-amber-600" size={20} />
              <div>
                <p className="text-sm text-amber-700">Pending review</p>
                <p className="font-medium text-gray-800">Your discount request is currently under admin review.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiUser className="text-amber-600" size={20} />
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium text-gray-800">{discountInfo.fullName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiCalendar className="text-amber-600" size={20} />
              <div>
                <p className="text-sm text-gray-500">ID Number</p>
                <p className="font-medium text-gray-800">{discountInfo.idNumber}</p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-3 pt-6 border-t border-amber-200">
            <button
              onClick={handleRemove}
              disabled={isRemoving}
              className="px-6 py-2.5 border-2 border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition"
            >
              {isRemoving ? 'Removing...' : 'Remove Request'}
            </button>
          </div>
        </div>
      ) : isRejected && !isEditing ? (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <p className="text-sm font-medium text-red-700">Your discount request was rejected.</p>
          {discountInfo.rejectionReason && (
            <p className="mt-2 text-sm text-red-800"><span className="font-semibold">Reason:</span> {discountInfo.rejectionReason}</p>
          )}
          <p className="mt-2 text-sm text-gray-700">You have already submitted a discount request for this account.</p>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setIsEditing(true);
            }}
            className="mt-4 rounded-xl bg-[#2d6a4f] px-6 py-2.5 font-semibold text-white transition hover:bg-[#1b4d3e]"
          >
            Submit Again
          </button>
        </div>
      ) : hasActiveDiscount && !isEditing ? (
        <div className="bg-[#d8f3dc]/20 border-2 border-[#2d6a4f] rounded-xl p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FiUser className="text-[#2d6a4f]" size={20} />
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium text-gray-800">{discountInfo.fullName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiCalendar className="text-[#2d6a4f]" size={20} />
              <div>
                <p className="text-sm text-gray-500">ID Number</p>
                <p className="font-medium text-gray-800">{discountInfo.idNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiCheckCircle className="text-[#2d6a4f]" size={20} />
              <div>
                <p className="text-sm text-gray-500">Discount Type</p>
                <p className="font-medium text-gray-800">
                  {discountInfo.isPWD ? 'PWD' : 'Senior Citizen'} ({(activeDiscount.discountRate * 100)}% discount)
                </p>
              </div>
            </div>
            {discountInfo.expiryDate && (
              <div className="flex items-center gap-3">
                <FiCalendar className="text-[#2d6a4f]" size={20} />
                <div>
                  <p className="text-sm text-gray-500">Expiry Date</p>
                  <p className="font-medium text-gray-800">{discountInfo.expiryDate}</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-6 pt-6 border-t border-[#2d6a4f]/20">
            <button
              onClick={handleRemove}
              disabled={isRemoving}
              className="flex-1 px-6 py-2.5 border-2 border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition disabled:opacity-50"
            >
              {isRemoving ? 'Removing...' : 'Remove Discount'}
            </button>
          </div>
        </div>
      ) : (
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div 
              className={`discount-option p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.isPWD ? 'border-[#2d6a4f] bg-[#d8f3dc]/20' : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => setFormData({ ...formData, isPWD: !formData.isPWD, isSenior: false })}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">PWD</span>
                <input
                  type="checkbox"
                  checked={formData.isPWD}
                  onChange={(e) => setFormData({ ...formData, isPWD: e.target.checked, isSenior: false })}
                  className="w-5 h-5 accent-[#2d6a4f]"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">20% discount on total bill</p>
            </div>
            <div 
              className={`discount-option p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.isSenior ? 'border-[#2d6a4f] bg-[#d8f3dc]/20' : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => setFormData({ ...formData, isSenior: !formData.isSenior, isPWD: false })}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700">Senior Citizen</span>
                <input
                  type="checkbox"
                  checked={formData.isSenior}
                  onChange={(e) => setFormData({ ...formData, isSenior: e.target.checked, isPWD: false })}
                  className="w-5 h-5 accent-[#2d6a4f]"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">20% discount on total bill</p>
            </div>
          </div>

          <div className="discount-account-name rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-2.5">
            <p className="text-xs font-medium text-gray-500">Account name</p>
            <p className="text-sm font-medium text-gray-800">{user?.full_name || 'Loading account name...'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={formData.idNumber}
                onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
                placeholder="Enter a valid PWD or Senior ID number"
                minLength={6}
                maxLength={20}
                pattern="(?=.*\d)[A-Za-z0-9][A-Za-z0-9 -]{5,19}"
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#2d6a4f] focus:outline-none transition text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (optional)</label>
            <input
              type="date"
              value={formData.expiryDate}
              onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
              min={getToday()}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-[#2d6a4f] focus:outline-none transition text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proof Image</label>
            <div className="discount-upload-zone rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-5 text-center transition hover:border-[#2d6a4f] hover:bg-[#d8f3dc]/10">
                <FiUpload className="text-[#2d6a4f]" size={20} />
                <span className="text-sm font-medium text-gray-700">Upload valid ID or discount proof</span>
                <span className="text-xs text-gray-400">PNG, JPG, JPEG, GIF, WEBP up to 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) return;
                    setFormData((prev) => ({
                      ...prev,
                      proofImage: file,
                      proofPreview: URL.createObjectURL(file),
                    }));
                  }}
                />
              </label>
              {formData.proofPreview && (
                <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <img src={formData.proofPreview} alt="Proof preview" className="h-36 w-full object-cover" />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            {isEditing && (
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setMessage(null);
                }}
                className="px-6 py-2.5 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FiSave size={16} />
              {isSaving ? 'Saving...' : isEditing ? 'Update Discount' : 'Apply Discount'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default DiscountSection;

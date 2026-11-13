import React, { useState, useEffect } from 'react';
import { FiUser, FiMail, FiPhone, FiSave } from 'react-icons/fi';
import { useAuth } from '../../../../contexts/Authcontext';
import { LimitedInput } from '../../../../components/ui/LimitedInput';
import { INPUT_LIMITS, normalizePhilippinePhone } from '../../../../constants/inputLimits';

const ProfileSection: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    const fullName = formData.fullName.trim();
    const nameUnchanged = fullName === (user?.full_name || '').trim();
    const phoneUnchanged = formData.phone === (user?.phone || '');
    const phone = phoneUnchanged ? formData.phone : normalizePhilippinePhone(formData.phone);
    if (!nameUnchanged && (fullName.length < INPUT_LIMITS.personName.min || fullName.length > INPUT_LIMITS.personName.max)) {
      setMessage({ type: 'error', text: `Full name must be ${INPUT_LIMITS.personName.min}-${INPUT_LIMITS.personName.max} characters.` });
      return;
    }
    if (!phoneUnchanged && phone && !/^09\d{9}$/.test(phone)) {
      setMessage({ type: 'error', text: 'Enter a valid Philippine mobile number.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      await updateProfile({
        full_name: fullName,
        phone,
      });

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-section settings-profile">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Profile Settings</h2>
      <p className="text-sm text-gray-500 mb-6">Update your personal information</p>

      {message && (
        <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); void handleSave(); }}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <LimitedInput
                type="text"
                required
                minLength={INPUT_LIMITS.personName.min}
                maxLength={INPUT_LIMITS.personName.max}
                inputFilter="personName"
                showCounter
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                disabled={!isEditing}
                className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-xl text-sm transition-all ${isEditing ? 'border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20' : 'border-gray-200 bg-gray-50 cursor-not-allowed'}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-xl text-sm transition-all ${isEditing ? 'border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20' : 'border-gray-200 bg-gray-50 cursor-not-allowed'}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="relative">
              <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <LimitedInput
                type="tel"
                pattern="(\\+?63|0)?9\\d{9}"
                title="Philippine mobile number (e.g. 09123456789)"
                maxLength={13}
                inputFilter="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isEditing}
                placeholder="+63 912 345 6789"
                className={`w-full pl-10 pr-4 py-2.5 border-2 rounded-xl text-sm transition-all ${isEditing ? 'border-[#2d6a4f] focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]/20' : 'border-gray-200 bg-gray-50 cursor-not-allowed'}`}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="px-6 py-2.5 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition"
            >
              Edit Profile
            </button>
          ) : (
            <>
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
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition flex items-center gap-2 disabled:opacity-50"
              >
                <FiSave size={16} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
};

export default ProfileSection;

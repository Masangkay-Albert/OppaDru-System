import React, { useState, useEffect } from 'react';
import { FiUser, FiMail, FiPhone, FiSave } from 'react-icons/fi';
import { useAuth } from '../../../../contexts/Authcontext';

const ProfileSection: React.FC = () => {
  const { user } = useAuth();
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
        fullName: user.fullName || '',
        email: user.email || '',
        phone: localStorage.getItem(`phone_${user.id}`) || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      if (user?.id) {
        localStorage.setItem(`phone_${user.id}`, formData.phone);
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch {
      setMessage({ type: 'error', text: 'Failed to update profile. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Profile Settings</h2>
      <p className="text-sm text-gray-500 mb-6">Update your personal information</p>

      {message && (
        <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
          <div className="relative">
            <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
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
            <input
              type="tel"
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
            onClick={() => setIsEditing(true)}
            className="px-6 py-2.5 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition"
          >
            Edit Profile
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                setIsEditing(false);
                setMessage(null);
              }}
              className="px-6 py-2.5 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-[#2d6a4f] text-white rounded-xl font-semibold hover:bg-[#1b4d3e] transition flex items-center gap-2 disabled:opacity-50"
            >
              <FiSave size={16} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileSection;
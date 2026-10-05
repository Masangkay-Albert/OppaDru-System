import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '../../../contexts/Authcontext';
import NavbarCustomer from '../components/navigation/NavbarCustomer';
import SettingsSidebar from '../components/settings/SettingsSidebar';
import ProfileSection from '../components/settings/ProfileSection';
import SecuritySection from '../components/settings/SecuritySection';
import DiscountSection from '../components/settings/DiscountSection';
import '../../../styles/secondary-pages.css';

type SettingsTab = 'profile' | 'security' | 'discount';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSection />;
      case 'security':
        return <SecuritySection />;
      case 'discount':
        return <DiscountSection />;
      default:
        return <ProfileSection />;
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="secondary-page secondary-settings min-h-screen bg-gradient-to-br from-[#fdf4e6] via-[#fff3e0] to-[#d8f3dc]">
      <NavbarCustomer />

      <div className="secondary-page-container settings-page-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="secondary-page-header settings-page-header flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/customer')}
            className="back-menu-button flex items-center gap-2 text-gray-500 hover:text-[#2d6a4f] transition-colors group"
          >
            <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" size={18} />
            <span className="text-sm font-medium">Back to Menu</span>
          </button>
          <span className="text-gray-300 text-xl">|</span>
          <h1 className="secondary-page-title text-xl font-bold text-[#2d6a4f] font-serif">Settings</h1>
        </div>

        <div className="settings-layout flex flex-col lg:flex-row gap-6">
          <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout} />

          <div className="settings-content-column flex-1">
            <div className="settings-content-panel bg-white rounded-2xl shadow-lg border border-gray-100 p-6 sm:p-8">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
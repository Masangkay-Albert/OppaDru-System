import React from 'react';
import { FiUser, FiShield, FiTag, FiLogOut } from 'react-icons/fi';

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  onLogout: () => void;
}

const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeTab, onTabChange, onLogout }) => {
  const menuItems = [
    { id: 'profile', icon: FiUser, label: 'Profile' },
    { id: 'discount', icon: FiTag, label: 'Discount' },
    { id: 'security', icon: FiShield, label: 'Security' },
  ];

  return (
    <div className="settings-sidebar w-full lg:w-64 flex-shrink-0">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sticky top-24">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#d8f3dc] text-[#2d6a4f]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-[#2d6a4f]' : 'text-gray-400'} />
                {item.label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-6 bg-[#e76f51] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
          >
            <FiLogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsSidebar;
// src/modules/customer-side/components/NotificationToast.tsx
import React, { useEffect } from 'react';

interface NotificationToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ message, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] animate-slideInRight">
      <div className="bg-green-700 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
        <span className="text-xl">❤️</span>
        <div>
          <p className="font-semibold">New Favorite Added!</p>
          <p className="text-sm opacity-90">{message} has been added to your favorites</p>
        </div>
        <button onClick={onClose} className="ml-3 text-white/80 hover:text-white text-xl">✕</button>
      </div>
    </div>
  );
};

export default NotificationToast;
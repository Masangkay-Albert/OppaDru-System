import React, { useEffect } from 'react';

interface ProductNotificationProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

const ProductNotification: React.FC<ProductNotificationProps> = ({ message, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-20 right-4 z-[100] animate-slideInRight">
      <div className="bg-gradient-to-r from-[#2d6a4f] to-[#1b4d3e] text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
        <span className="text-2xl">⭐</span>
        <div>
          <p className="font-semibold">Quick Favorite Updated!</p>
          <p className="text-sm opacity-90">{message} added to favorites</p>
        </div>
        <button 
          onClick={onClose} 
          className="ml-3 text-white/80 hover:text-white text-xl"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default ProductNotification;


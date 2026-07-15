// src/modules/admin-side/components/ProtectedAdminRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';

const ProtectedAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { admin, isLoading } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading...
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;

// src/modules/admin-side/components/ProtectedAdminRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';

const ProtectedAdminRoute: React.FC<{ children: React.ReactNode; systemAdministratorOnly?: boolean }> = ({ children, systemAdministratorOnly = false }) => {
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

  if (systemAdministratorOnly && admin.role !== 'system_administrator') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;

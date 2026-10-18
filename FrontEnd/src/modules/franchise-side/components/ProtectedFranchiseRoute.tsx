import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';
import FranchiseLayout from './FranchiseLayout';

const ProtectedFranchiseRoute: React.FC<{ children: React.ReactNode; requirePos?: boolean; allowedRoles?: string[] }> = ({ children, requirePos = false, allowedRoles }) => {
  const { franchiseUser, isLoading } = useFranchiseAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading franchise portal...
      </div>
    );
  }

  if (!franchiseUser) {
    return <Navigate to="/franchise/login" replace />;
  }

  if (requirePos && !franchiseUser.can_process_pos) {
    return <Navigate to="/franchise/dashboard" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.some((role) => String(franchiseUser.role || 'owner').toLowerCase().includes(role))) {
    return <Navigate to="/franchise/dashboard" replace />;
  }

  return <FranchiseLayout>{children}</FranchiseLayout>;
};

export default ProtectedFranchiseRoute;

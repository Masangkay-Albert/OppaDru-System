import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFranchiseAuth } from '../../../contexts/FranchiseAuthContext';

const ProtectedFranchiseRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  return <>{children}</>;
};

export default ProtectedFranchiseRoute;

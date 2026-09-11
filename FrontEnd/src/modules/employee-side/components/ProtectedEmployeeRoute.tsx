import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedEmployeeRouteProps {
  children: React.ReactNode;
}

const ProtectedEmployeeRoute: React.FC<ProtectedEmployeeRouteProps> = ({ children }) => {
  const token = localStorage.getItem('employee_token');
  const authData = localStorage.getItem('employee_auth');

  if (!token || !authData) {
    return <Navigate to="/employee/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedEmployeeRoute;

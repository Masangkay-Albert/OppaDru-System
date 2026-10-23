import React from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedEmployeeRouteProps {
  children: React.ReactNode;
  portal?: 'main-cashier' | 'branch-cashier' | 'kitchen';
}

const ProtectedEmployeeRoute: React.FC<ProtectedEmployeeRouteProps> = ({ children, portal = 'main-cashier' }) => {
  const token = sessionStorage.getItem('employee_token');
  const authData = sessionStorage.getItem('employee_auth');

  if (!token || !authData) {
    return <Navigate to="/employee/login" replace />;
  }

  let employee: { position?: string; franchise_id?: string | null } | null;
  try {
    employee = JSON.parse(authData) as { position?: string; franchise_id?: string | null };
  } catch {
    sessionStorage.removeItem('employee_auth');
    sessionStorage.removeItem('employee_token');
    return <Navigate to="/employee/login" replace />;
  }

  if (!employee) {
    sessionStorage.removeItem('employee_auth');
    sessionStorage.removeItem('employee_token');
    return <Navigate to="/employee/login" replace />;
  }

  const position = employee.position?.toLowerCase().trim();
  const isBranchCashier = position === 'cashier' && Boolean(employee.franchise_id);
  const isMainCashier = position === 'cashier' && !employee.franchise_id;
  const isKitchenStaff = position === 'kitchen staff';
  const allowed = portal === 'branch-cashier' ? isBranchCashier
    : portal === 'kitchen' ? isKitchenStaff
      : isMainCashier;

  if (!allowed) {
    const destination = isBranchCashier ? '/cashier/pos' : isKitchenStaff ? '/kitchen/dashboard' : '/employee/login';
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
};

export default ProtectedEmployeeRoute;

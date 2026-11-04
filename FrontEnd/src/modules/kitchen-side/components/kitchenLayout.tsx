import React from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeAuth } from '../../../services/employeeAuth'; 
import { EmployeeDashboardLayout } from '../../shared/components/EmployeeDashboardUI';

const KitchenLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const employee = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('employee_auth') || 'null') as {
      franchise_id?: string | null;
      fullName?: string;
      name?: string;
      franchise?: { id?: string; name?: string } | null;
      } | null;
    } catch {
      return null;
    }
  })();
  const branchName = employee?.franchise?.name || 'Main system';
  const branchId = employee?.franchise?.id || employee?.franchise_id || null;

  const handleLogout = () => {
    employeeAuth.logout();
    navigate('/staff/login', { replace: true });
  };

  return (
    <EmployeeDashboardLayout
      role="kitchen"
      branchName={branchName}
      branchId={branchId}
      userName={employee?.fullName || employee?.name}
      onSignOut={handleLogout}
    >
      {children}
    </EmployeeDashboardLayout>
  );
};

export default KitchenLayout;
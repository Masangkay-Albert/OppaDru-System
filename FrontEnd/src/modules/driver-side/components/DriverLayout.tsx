// src/modules/driver-side/components/DriverLayout.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAuth, getDriverBranchDisplay, type DriverAuthData } from '../../../services/driverAuth';
import { EmployeeDashboardLayout } from '../../shared/components/EmployeeDashboardUI';

interface DriverLayoutProps {
  children: React.ReactNode;
}

const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const driver = (() => {
    try {
      return JSON.parse(localStorage.getItem('driver_auth') || 'null') as DriverAuthData | null;
    } catch {
      return null;
    }
  })();
  const { name: branchName, id: branchId } = getDriverBranchDisplay(driver);

  useEffect(() => {
    document.title = `${branchName} | Driver Dashboard | Oppa Dru`;
  }, [branchName]);

  const handleLogout = () => {
    void driverAuth.logout();
    navigate('/'); 
  };

  return (
    <EmployeeDashboardLayout role="driver" branchName={branchName} branchId={branchId} onSignOut={handleLogout}>
      {children}
    </EmployeeDashboardLayout>
  );
};

export default DriverLayout;
// src/modules/driver-side/components/DriverLayout.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { driverAuth } from '../../../services/driverAuth';
import { EmployeeDashboardLayout } from '../../shared/components/EmployeeDashboardUI';

interface DriverLayoutProps {
  children: React.ReactNode;
}

const DriverLayout: React.FC<DriverLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  let branchName = 'Main system';
  let branchId: string | null = null;
  try {
    const driver = JSON.parse(localStorage.getItem('driver_auth') || 'null') as {
      franchise_id?: string | null;
      franchise?: { id?: string; name?: string } | null;
    } | null;
    branchName = driver?.franchise?.name || 'Main system';
    branchId = driver?.franchise?.id || driver?.franchise_id || null;
  } catch {
    branchName = 'Main system';
  }

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
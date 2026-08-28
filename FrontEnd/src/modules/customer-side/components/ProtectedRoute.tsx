import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../../contexts/Authcontext";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return user?.email_verified_at ? <>{children}</> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
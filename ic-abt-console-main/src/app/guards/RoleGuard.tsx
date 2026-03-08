import React from "react";
import { Navigate } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { useRole } from "../../context/RoleContext";
import { UserRole } from "../../types/roles";

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export const NotAuthorisedPage: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
    <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
      <ShieldOff className="h-8 w-8 text-red-600" />
    </div>
    <h1 className="text-2xl font-bold text-neutral-900 mb-2">Access Restricted</h1>
    <p className="text-neutral-500 max-w-md">
      You do not have permission to view this page. Contact your administrator to request access.
    </p>
  </div>
);

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { role } = useRole();
  if (!allowedRoles.includes(role)) {
    return <Navigate to="/not-authorised" replace />;
  }
  return <>{children}</>;
};

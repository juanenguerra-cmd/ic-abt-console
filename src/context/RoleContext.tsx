import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { UserRole } from "../types/roles";
import { ROLE_PERMISSIONS } from "../constants/permissions";
import { IDB_ROLE_KEY } from "../constants/storageKeys";
import { idbGet, idbSet } from "../storage/idb";

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  can: (permission: string) => boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

const VALID_ROLES: UserRole[] = ['Viewer', 'Nurse', 'ICLead', 'Admin'];
const DEFAULT_ROLE: UserRole = 'Admin';

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(DEFAULT_ROLE);

  useEffect(() => {
    idbGet<UserRole>(IDB_ROLE_KEY)
      .then((stored) => {
        if (stored && VALID_ROLES.includes(stored)) {
          setRoleState(stored);
        }
      })
      .catch(() => {});
  }, []);

  const setRole = useCallback((newRole: UserRole) => {
    setRoleState(newRole);
    idbSet(IDB_ROLE_KEY, newRole).catch((err) =>
      console.error("Failed to persist role:", err)
    );
  }, []);

  const can = useCallback(
    (permission: string): boolean => {
      const perms = ROLE_PERMISSIONS[role];
      if ((perms as readonly string[]).includes('*')) return true;
      return (perms as readonly string[]).includes(permission);
    },
    [role]
  );

  return (
    <RoleContext.Provider value={{ role, setRole, can }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return context;
}

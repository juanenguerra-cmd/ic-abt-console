import React, { createContext, useContext, ReactNode } from 'react';
import { UserRole } from '../types';
import { PERMISSIONS } from '../constants/permissions';
import { useDatabase, useFacilityData } from '../app/providers';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  can: (permission: string) => boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();

  const role: UserRole = store.currentRole ?? 'Nurse';

  const setRole = (newRole: UserRole) => {
    updateDB((draft) => {
      draft.data.facilityData[activeFacilityId].currentRole = newRole;
    });
  };

  const can = (permission: string): boolean => {
    const perms = PERMISSIONS[role];
    return perms.some(p => p === '*') || perms.some(p => p === permission);
  };

  return (
    <RoleContext.Provider value={{ role, setRole, can }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextType {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

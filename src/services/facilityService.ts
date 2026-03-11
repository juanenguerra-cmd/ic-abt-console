import { UnifiedDB } from "../domain/models";

export const facilityService = {
  getFacilities: (db: UnifiedDB | null) => {
    return Object.values(db?.data?.facilities?.byId || {}) as any[];
  },
  getActiveFacility: (db: UnifiedDB | null, activeFacilityId: string | null) => {
    if (!activeFacilityId) return null;
    return db?.data?.facilities?.byId?.[activeFacilityId] || null;
  },
  getQuarantineCount: (store: any) => {
    return (Object.values(store?.quarantine || {}) as any[]).filter((q: any) => !q.resolvedToMrn).length;
  },
  resolveActiveFacilityId: (db: UnifiedDB | null): string => {
    if (!db) return "fac-default";
  
    const configured = db?.data?.facilities?.activeFacilityId;
    if (configured) return configured;
  
    const existingFacilityIds = Object.keys(db?.data?.facilityData || {});
    if (existingFacilityIds.length > 0) return existingFacilityIds[0];
  
    return "fac-default";
  }
};

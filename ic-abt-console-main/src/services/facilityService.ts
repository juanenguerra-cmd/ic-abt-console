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
  }
};

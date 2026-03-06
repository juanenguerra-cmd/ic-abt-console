import { useMemo } from 'react';
import { useFacilityData } from '../app/providers';
import { getResidentAlerts, DetectionResult } from '../services/detectionRules';

/**
 * Hook to get real-time clinical alerts for a specific resident.
 * These alerts are computed on the fly from the store state, ensuring
 * they are always up-to-date even if the background detection hasn't run.
 */
export function useResidentAlerts(residentId: string): DetectionResult[] {
  const { store } = useFacilityData();
  
  // Re-compute alerts when the store changes.
  // We use a stable 'now' for the computation to avoid unnecessary re-renders,
  // but it's updated frequently enough for the rules (e.g., 4h or 14d).
  const now = useMemo(() => new Date(), [store]);

  return useMemo(() => {
    if (!residentId || !store) return [];
    return getResidentAlerts(residentId, store, now);
  }, [residentId, store, now]);
}

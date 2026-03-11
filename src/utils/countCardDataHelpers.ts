import { ABTCourse, Resident, VaxEvent } from '../domain/models';

export const normalizeStatus = (status?: string | null): string => (status ?? '').trim().toLowerCase();

export const isActiveAbtStatus = (status?: string | null): boolean => normalizeStatus(status) === 'active';

export const isVaxDueStatus = (status?: string | null): boolean => {
  const normalized = normalizeStatus(status);
  return normalized === 'due' || normalized === 'overdue';
};

export const isActiveCensusResident = (resident: Resident): boolean => {
  if (!resident) return false;
  if (resident.isHistorical || resident.backOfficeOnly) return false;
  const status = normalizeStatus(resident.status);
  return status === 'active';
};

/**
 * Returns true if the resident is a historical or back-office-only resident
 * (i.e., not part of the active census).
 */
export const isHistoricalOrBackOffice = (resident: Resident): boolean =>
  !!(resident?.isHistorical || resident?.backOfficeOnly);

/**
 * Returns only active census residents, excluding isHistorical and backOfficeOnly.
 * Delegates to `isActiveCensusResident` which enforces status, isHistorical, and backOfficeOnly checks.
 * Apply this before computing any derived metrics or aggregates for the board.
 */
export const filterActiveResidents = (residents: Resident[]): Resident[] =>
  residents.filter(isActiveCensusResident);

export const getActiveABT = (abts: ABTCourse[], residentMrn?: string): ABTCourse[] => {
  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  
  return (abts || []).filter(abt => {
    if (!abt || !isActiveAbtStatus(abt.status)) return false;
    
    // Filter out if endDate is in the past
    if (abt.endDate && abt.endDate < todayStr) return false;
    
    // Filter out if startDate is in the future
    if (abt.startDate && abt.startDate > todayStr) return false;

    if (!residentMrn) return true;
    return abt.residentRef && abt.residentRef.kind === 'mrn' && abt.residentRef.id === residentMrn;
  });
};

export const getVaxDue = (vaxEvents: VaxEvent[], residentMrn?: string): VaxEvent[] =>
  (vaxEvents || []).filter(vax => {
    if (!vax || !isVaxDueStatus(vax.status)) return false;
    if (!residentMrn) return true;
    return vax.residentRef && vax.residentRef.kind === 'mrn' && vax.residentRef.id === residentMrn;
  });

export const getAbtDays = (startDate?: string, endDate?: string): { current: number; total: number | null } | null => {
  if (!startDate) return null;
  
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;

  // Reset time to midnight to avoid timezone offsets affecting day diff
  start.setHours(0, 0, 0, 0);
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const diffTime = now.getTime() - start.getTime();
  let current = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (current < 1) current = 1;
  
  let total: number | null = null;
  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      // Normalize to midnight before any date arithmetic
      end.setHours(0, 0, 0, 0);
      // endDate is the stop boundary (exclusive), not an additional full treatment day.
      // The last actual treatment day is endDate - 1.
      const lastTreatmentDay = new Date(end);
      lastTreatmentDay.setDate(lastTreatmentDay.getDate() - 1);
      lastTreatmentDay.setHours(0, 0, 0, 0);
      const totalDiff = lastTreatmentDay.getTime() - start.getTime();
      total = Math.max(1, Math.floor(totalDiff / (1000 * 60 * 60 * 24)) + 1);
    }
  }

  // Clamp current day so it never exceeds total
  if (total !== null && current > total) current = total;
  
  return { current, total };
};

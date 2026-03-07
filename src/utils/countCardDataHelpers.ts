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
  const current = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  let total: number | null = null;
  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      end.setHours(0, 0, 0, 0);
      const totalDiff = end.getTime() - start.getTime();
      total = Math.floor(totalDiff / (1000 * 60 * 60 * 24)) + 1;
    }
  }
  
  return { current: current > 0 ? current : 1, total: total && total > 0 ? total : null };
};

import { ABTCourse, Resident, VaxEvent } from '../domain/models';

export const normalizeStatus = (status?: string | null): string => (status ?? '').trim().toLowerCase();

export const isActiveAbtStatus = (status?: string | null): boolean => normalizeStatus(status) === 'active';

export const isVaxDueStatus = (status?: string | null): boolean => {
  const normalized = normalizeStatus(status);
  return normalized === 'due' || normalized === 'overdue';
};

export const isActiveCensusResident = (resident: Resident): boolean => {
  if (!resident) return false;
  return !resident.isHistorical && !resident.backOfficeOnly;
};

export const getActiveABT = (abts: ABTCourse[], residentMrn?: string): ABTCourse[] =>
  (abts || []).filter(abt => {
    if (!abt || !isActiveAbtStatus(abt.status)) return false;
    if (!residentMrn) return true;
    return abt.residentRef && abt.residentRef.kind === 'mrn' && abt.residentRef.id === residentMrn;
  });

export const getVaxDue = (vaxEvents: VaxEvent[], residentMrn?: string): VaxEvent[] =>
  (vaxEvents || []).filter(vax => {
    if (!vax || !isVaxDueStatus(vax.status)) return false;
    if (!residentMrn) return true;
    return vax.residentRef && vax.residentRef.kind === 'mrn' && vax.residentRef.id === residentMrn;
  });

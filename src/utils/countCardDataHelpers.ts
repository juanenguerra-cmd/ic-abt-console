import { ABTCourse, Resident, VaxEvent } from '../domain/models';

export const normalizeStatus = (status?: string | null): string => (status ?? '').trim().toLowerCase();

export const isActiveAbtStatus = (status?: string | null): boolean => normalizeStatus(status) === 'active';

export const isVaxDueStatus = (status?: string | null): boolean => {
  const normalized = normalizeStatus(status);
  return normalized === 'due' || normalized === 'overdue';
};

export const isActiveCensusResident = (resident: Resident): boolean => {
  const unit = (resident.currentUnit ?? '').trim().toLowerCase();
  return !resident.isHistorical && !resident.backOfficeOnly && unit !== '' && unit !== 'unassigned';
};

export const getActiveABT = (abts: ABTCourse[], residentMrn?: string): ABTCourse[] =>
  abts.filter(abt => {
    if (!isActiveAbtStatus(abt.status)) return false;
    if (!residentMrn) return true;
    return abt.residentRef.kind === 'mrn' && abt.residentRef.id === residentMrn;
  });

export const getVaxDue = (vaxEvents: VaxEvent[], residentMrn?: string): VaxEvent[] =>
  vaxEvents.filter(vax => {
    if (!isVaxDueStatus(vax.status)) return false;
    if (!residentMrn) return true;
    return vax.residentRef.kind === 'mrn' && vax.residentRef.id === residentMrn;
  });

import { Resident, VaxEvent } from '../domain/models';

export type VaxGap = {
  residentMrn: string;
  residentName: string;
  unit?: string;
  room?: string;
  missingVaccines: Array<'Influenza' | 'Covid-19' | 'Pneumococcal'>;
};

const isQualifyingStatus = (status?: string) => status === 'given' || status === 'documented-historical';

const getEventDate = (event: VaxEvent): Date | null => {
  const raw = event.dateGiven ?? event.administeredDate ?? event.offerDate;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function computeVaxGaps(
  residents: Record<string, Resident>,
  vaxEvents: Record<string, VaxEvent>
): VaxGap[] {
  const now = new Date();
  const fluSeasonStartYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const fluSeasonStart = new Date(fluSeasonStartYear, 7, 1);
  const covidCutoff = new Date(now);
  covidCutoff.setFullYear(covidCutoff.getFullYear() - 1);

  return Object.values(residents)
    .filter((resident) => resident.status === 'Active' && !resident.isHistorical)
    .map((resident) => {
      const residentVax = Object.values(vaxEvents).filter(
        (event) => event.residentRef.kind === 'mrn' && event.residentRef.id === resident.mrn && isQualifyingStatus(event.status)
      );

      const hasRecentFlu = residentVax.some((event) => {
        if (!/influenza/i.test(event.vaccine)) return false;
        const eventDate = getEventDate(event);
        return eventDate ? eventDate >= fluSeasonStart : false;
      });

      const hasRecentCovid = residentVax.some((event) => {
        if (!/(covid|sars)/i.test(event.vaccine)) return false;
        const eventDate = getEventDate(event);
        return eventDate ? eventDate >= covidCutoff : false;
      });

      const hasPneumococcal = residentVax.some((event) => /pneum/i.test(event.vaccine));

      const missingVaccines: VaxGap['missingVaccines'] = [];
      if (!hasRecentFlu) missingVaccines.push('Influenza');
      if (!hasRecentCovid) missingVaccines.push('Covid-19');
      if (!hasPneumococcal) missingVaccines.push('Pneumococcal');

      if (missingVaccines.length === 0) return null;

      return {
        residentMrn: resident.mrn,
        residentName: resident.displayName,
        unit: resident.currentUnit,
        room: resident.currentRoom,
        missingVaccines,
      };
    })
    .filter((gap): gap is NonNullable<typeof gap> => Boolean(gap));
}

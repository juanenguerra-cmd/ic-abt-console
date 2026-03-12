import { FacilityStore, ABTCourse, IPEvent, VaxEvent } from '../../../domain/models';
import { ResidentCoursePDFConfig } from '../../../types/reportTypes';

const isInDateRange = (dateStr: string | undefined, range: { startDate: string; endDate: string }): boolean => {
  if (!dateStr) return false;
  return dateStr >= range.startDate && dateStr <= range.endDate;
};

export const getResidentCourseData = (
  store: FacilityStore,
  residentId: string,
  config: ResidentCoursePDFConfig
) => {
  const resident = store.residents[residentId];
  if (!resident) return null;

  const range = config.dateRange;

  const filterAbt = (course: ABTCourse): boolean => {
    if (course.residentRef.kind !== 'mrn' || course.residentRef.id !== residentId) return false;
    if (range) return isInDateRange(course.startDate, range);
    return true;
  };

  const filterIp = (event: IPEvent): boolean => {
    if (event.residentRef.kind !== 'mrn' || event.residentRef.id !== residentId) return false;
    if (range) return isInDateRange(event.onsetDate, range);
    return true;
  };

  const filterVax = (event: VaxEvent): boolean => {
    if (event.residentRef.kind !== 'mrn' || event.residentRef.id !== residentId) return false;
    if (range) return isInDateRange(event.dateGiven ?? event.administeredDate, range);
    return true;
  };

  const abtCourses = Object.values(store.abts)
    .filter(filterAbt)
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));

  const ipEvents = Object.values(store.infections)
    .filter(filterIp)
    .sort((a, b) => (a.onsetDate ?? a.createdAt).localeCompare(b.onsetDate ?? b.createdAt));

  const vaccinations = Object.values(store.vaxEvents)
    .filter(filterVax)
    .sort((a, b) => {
      const aDate = a.dateGiven ?? a.administeredDate ?? '';
      const bDate = b.dateGiven ?? b.administeredDate ?? '';
      return aDate.localeCompare(bDate);
    });

  return { resident, abtCourses, ipEvents, vaccinations };
};

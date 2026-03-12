import { ABTCourse } from '../../../domain/models';
import { StewardshipMetrics } from '../../../types/reportTypes';
import { daysBetween } from './formatters';
import { todayLocalDateInputValue } from '../../../lib/dateUtils';

const BROAD_SPECTRUM_CLASSES = ['carbapenem', 'cephalosporin (4th gen)', 'extended-spectrum cephalosporin'];

const isBroadSpectrum = (course: ABTCourse): boolean => {
  if (course.isBroadSpectrum) return true;
  if (!course.medicationClass) return false;
  const cls = course.medicationClass.toLowerCase();
  return BROAD_SPECTRUM_CLASSES.some(c => cls.includes(c));
};

export const calculateStewardshipMetrics = (
  abtCourses: ABTCourse[],
  admissionDate: string,
  endDate: string = todayLocalDateInputValue()
): StewardshipMetrics => {
  const residentDays = Math.max(1, daysBetween(admissionDate, endDate));

  const totalAntibioticCourses = abtCourses.length;
  const coursesCompleted = abtCourses.filter(c => c.status === 'completed').length;
  const coursesDiscontinued = abtCourses.filter(c => c.status === 'discontinued').length;

  // Days of Therapy
  const daysOfTherapy = abtCourses.reduce((sum, course) => {
    if (!course.startDate) return sum;
    return sum + daysBetween(course.startDate, course.endDate);
  }, 0);

  const dotPer1000ResidentDays = (daysOfTherapy / residentDays) * 1000;

  // Length of Therapy (completed + discontinued episodes)
  const lengthOfTherapy = coursesCompleted + coursesDiscontinued;
  const lotPer1000ResidentDays = (lengthOfTherapy / residentDays) * 1000;

  // Broad-spectrum days
  const broadSpectrumDays = abtCourses
    .filter(isBroadSpectrum)
    .reduce((sum, course) => {
      if (!course.startDate) return sum;
      return sum + daysBetween(course.startDate, course.endDate);
    }, 0);
  const broadSpectrumPercentage = daysOfTherapy > 0 ? (broadSpectrumDays / daysOfTherapy) * 100 : 0;

  // Culture collection rate
  const treatedCourses = abtCourses.filter(c => c.status !== 'active' || c.startDate);
  const culturesCollected = treatedCourses.filter(c => c.cultureCollected === true).length;
  const cultureCollectionRate = treatedCourses.length > 0 ? (culturesCollected / treatedCourses.length) * 100 : 0;

  // De-escalation rate (courses with a de-escalation intervention)
  const deEscalatedCount = abtCourses.filter(c =>
    c.interventions?.some(i => i.type === 'De-escalation' || i.type === 'IV-to-PO')
  ).length;
  const deEscalationRate = treatedCourses.length > 0 ? (deEscalatedCount / treatedCourses.length) * 100 : 0;

  // Stewardship review rate (courses with a timeout review date or any logged intervention)
  const reviewedCount = abtCourses.filter(c => c.timeoutReviewDate || (c.interventions && c.interventions.length > 0)).length;
  const stewardshipReviewRate = abtCourses.length > 0 ? (reviewedCount / abtCourses.length) * 100 : 0;

  return {
    totalAntibioticCourses,
    coursesCompleted,
    coursesDiscontinued,
    coursesAvoided: 0,
    daysOfTherapy,
    residentDays,
    dotPer1000ResidentDays: Math.round(dotPer1000ResidentDays * 10) / 10,
    lengthOfTherapy,
    lotPer1000ResidentDays: Math.round(lotPer1000ResidentDays * 10) / 10,
    broadSpectrumDays,
    broadSpectrumPercentage: Math.round(broadSpectrumPercentage * 10) / 10,
    cultureCollectionRate: Math.round(cultureCollectionRate),
    deEscalationRate: Math.round(deEscalationRate),
    stewardshipReviewRate: Math.round(stewardshipReviewRate),
    cdiffInfections: 0,
    adverseDrugEvents: 0,
  };
};

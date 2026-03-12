import { Resident, ABTCourse, IPEvent, VaxEvent } from '../../../domain/models';
import { formatDate, daysBetween } from './formatters';
import { getPrecautionLabel, getInfectionSourceLabel } from '../../../utils/ipEventFormatters';

export const generateClinicalNarrative = (
  resident: Resident,
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[],
  _vaccinations: VaxEvent[]
): string[] => {
  const lines: string[] = [];
  const name = resident.displayName;
  const dob = resident.dob ? formatDate(resident.dob) : 'Unknown DOB';
  const sex = resident.sex || 'Unknown';
  const unit = resident.currentUnit || 'Unassigned';
  const room = resident.currentRoom || 'N/A';
  const admitDate = resident.admissionDate ? formatDate(resident.admissionDate) : 'Unknown';

  lines.push(
    `${name} | MRN: ${resident.mrn} | DOB: ${dob} | Sex: ${sex}`,
    `Unit/Room: ${unit} / ${room} | Admission Date: ${admitDate}`,
    ''
  );

  if (resident.primaryDiagnosis) {
    lines.push(`Primary Diagnosis: ${resident.primaryDiagnosis}`, '');
  }

  if (resident.allergies && resident.allergies.length > 0) {
    lines.push(`Allergies: ${resident.allergies.join(', ')}`, '');
  }

  // Infection events summary
  if (ipEvents.length > 0) {
    lines.push('INFECTION / PRECAUTION EVENTS:');
    ipEvents.forEach((ip, i) => {
      const precaution = getPrecautionLabel(ip);
      const source = getInfectionSourceLabel(ip);
      const onset = ip.onsetDate ? formatDate(ip.onsetDate) : 'Unknown onset';
      const resolved = ip.resolvedAt ? ` — Resolved ${formatDate(ip.resolvedAt)}` : '';
      lines.push(
        `  ${i + 1}. ${precaution} | Source: ${source} | Onset: ${onset}${resolved} | Status: ${ip.status}`
      );
      if (ip.organism) {
        lines.push(`     Organism: ${ip.organism}`);
      }
      if (ip.notes) {
        lines.push(`     Notes: ${ip.notes}`);
      }
    });
    lines.push('');
  }

  // Antibiotic courses summary
  if (abtCourses.length > 0) {
    lines.push('ANTIBIOTIC THERAPY COURSE:');
    abtCourses.forEach((course, i) => {
      const med = course.medication;
      const dose = [course.dose, course.doseUnit, course.route, course.frequency].filter(Boolean).join(' ');
      const start = course.startDate ? formatDate(course.startDate) : 'Unknown start';
      const end = course.endDate ? formatDate(course.endDate) : 'Ongoing';
      const days = course.startDate ? daysBetween(course.startDate, course.endDate) : 0;
      lines.push(
        `  ${i + 1}. ${med}${dose ? ' — ' + dose : ''} | ${start} – ${end} (${days} days) | Status: ${course.status}`
      );
      if (course.indication) {
        lines.push(`     Indication: ${course.indication}`);
      }
      if (course.infectionSource) {
        lines.push(`     Source: ${course.infectionSource}`);
      }
      if (course.organismIdentified) {
        lines.push(`     Organism: ${course.organismIdentified}`);
      }

      const interventions = course.interventions;
      if (interventions && interventions.length > 0) {
        interventions.forEach(iv => {
          lines.push(`     Stewardship [${iv.type}] ${formatDate(iv.date)}: ${iv.note}`);
        });
      }
    });
    lines.push('');
  }

  // Stewardship summary
  const reviewed = abtCourses.filter(c => c.timeoutReviewDate || (c.interventions && c.interventions.length > 0));
  if (reviewed.length > 0) {
    lines.push(
      `ANTIBIOTIC STEWARDSHIP: ${reviewed.length} of ${abtCourses.length} course(s) had prospective audit and feedback reviews.`,
      ''
    );
  }

  // Current status
  const activeCourses = abtCourses.filter(c => c.status === 'active');
  if (activeCourses.length > 0) {
    lines.push(
      `CURRENT STATUS: Resident is currently on active antibiotic therapy: ${activeCourses.map(c => c.medication).join(', ')}.`
    );
  } else {
    lines.push(
      'CURRENT STATUS: No active antibiotic therapy at this time. Resident is clinically stable.'
    );
  }

  return lines;
};

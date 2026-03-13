import { Resident, ABTCourse, IPEvent, VaxEvent } from '../../../domain/models';
import { formatDate, daysBetween } from './formatters';
import { getPrecautionLabel, getInfectionSourceLabel } from '../../../utils/ipEventFormatters';
import { sanitizeReportText } from '../../../utils/reportSanitizer';

export const generateClinicalNarrative = (
  resident: Resident,
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[],
  _vaccinations: VaxEvent[]
): string[] => {
  const lines: string[] = [];
  const unit = resident.location?.unit ?? resident.currentUnit ?? 'Unassigned';
  const room = resident.location?.room ?? resident.currentRoom ?? 'N/A';
  const admitDate = resident.admissionDate ? formatDate(resident.admissionDate) : null;
  const facilityRef = 'the facility';

  // Opening — SNF/LTC style
  if (admitDate) {
    lines.push(`Resident admitted to ${facilityRef} on ${admitDate}.`);
  } else {
    lines.push(`Resident admitted to ${facilityRef}.`);
  }
  lines.push(`Current Unit/Room: ${unit} / ${room}`, '');

  if (resident.primaryDiagnosis) {
    lines.push(`Primary Diagnosis: ${sanitizeReportText(resident.primaryDiagnosis)}`, '');
  }

  if (resident.allergies && resident.allergies.length > 0) {
    lines.push(`Allergies: ${resident.allergies.join(', ')}`, '');
  }

  // Infection events summary
  if (ipEvents.length > 0) {
    const activeIp = ipEvents.filter(ip => ip.status === 'active');
    const resolvedIp = ipEvents.filter(ip => ip.status !== 'active');

    if (activeIp.length > 0) {
      lines.push('ACTIVE INFECTION / PRECAUTION EVENTS:');
      activeIp.forEach((ip, i) => {
        const precaution = getPrecautionLabel(ip);
        const source = getInfectionSourceLabel(ip);
        const onset = ip.onsetDate ? formatDate(ip.onsetDate) : 'Unknown onset';
        lines.push(
          `  ${i + 1}. ${precaution} | Source: ${source} | Onset: ${onset} | Status: Active`
        );
        if (ip.organism) lines.push(`     Organism: ${sanitizeReportText(ip.organism)}`);
        if (ip.notes) lines.push(`     Notes: ${sanitizeReportText(ip.notes)}`);
      });
      lines.push('');
    }

    if (resolvedIp.length > 0) {
      lines.push('HISTORICAL / RESOLVED INFECTION EVENTS:');
      resolvedIp.forEach((ip, i) => {
        const precaution = getPrecautionLabel(ip);
        const source = getInfectionSourceLabel(ip);
        const onset = ip.onsetDate ? formatDate(ip.onsetDate) : 'Unknown onset';
        const resolved = ip.resolvedAt ? ` — Resolved ${formatDate(ip.resolvedAt)}` : '';
        lines.push(
          `  ${i + 1}. ${precaution} | Source: ${source} | Onset: ${onset}${resolved}`
        );
        if (ip.organism) lines.push(`     Organism: ${sanitizeReportText(ip.organism)}`);
      });
      lines.push('');
    }
  }

  // Antibiotic courses — active first, then historical
  const activeCourses = abtCourses.filter(c => c.status === 'active');
  const completedCourses = abtCourses.filter(c => c.status !== 'active');

  if (activeCourses.length > 0) {
    lines.push('CURRENT ACTIVE ANTIBIOTIC THERAPY:');
    activeCourses.forEach((course, i) => {
      const med = sanitizeReportText(course.medication);
      const dose = [course.dose, course.doseUnit, course.route, course.frequency].filter(Boolean).join(' ');
      const start = course.startDate ? formatDate(course.startDate) : 'Unknown start';
      lines.push(
        `  ${i + 1}. ${med}${dose ? ' — ' + dose : ''} | Started: ${start} | Status: Active`
      );
      if (course.indication) lines.push(`     Indication: ${sanitizeReportText(course.indication)}`);
      if (course.infectionSource) lines.push(`     Source: ${sanitizeReportText(course.infectionSource)}`);
      if (course.organismIdentified) lines.push(`     Organism: ${sanitizeReportText(course.organismIdentified)}`);
      const interventions = course.interventions;
      if (interventions && interventions.length > 0) {
        interventions.forEach(iv => {
          lines.push(`     Stewardship [${iv.type}] ${formatDate(iv.date)}: ${sanitizeReportText(iv.note)}`);
        });
      }
    });
    lines.push('');
  }

  if (completedCourses.length > 0) {
    lines.push('PRIOR ANTIBIOTIC COURSES:');
    completedCourses.forEach((course, i) => {
      const med = sanitizeReportText(course.medication);
      const dose = [course.dose, course.doseUnit, course.route, course.frequency].filter(Boolean).join(' ');
      const start = course.startDate ? formatDate(course.startDate) : 'Unknown start';
      const end = course.endDate ? formatDate(course.endDate) : '—';
      const days = course.startDate ? daysBetween(course.startDate, course.endDate) : 0;
      lines.push(
        `  ${i + 1}. ${med}${dose ? ' — ' + dose : ''} | ${start} – ${end} (${days} days) | Status: ${course.status}`
      );
      if (course.indication) lines.push(`     Indication: ${sanitizeReportText(course.indication)}`);
      if (course.infectionSource) lines.push(`     Source: ${sanitizeReportText(course.infectionSource)}`);
      if (course.organismIdentified) lines.push(`     Organism: ${sanitizeReportText(course.organismIdentified)}`);
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

  // Current status summary
  if (activeCourses.length > 0) {
    lines.push(
      `CURRENT STATUS: Resident is currently on active antibiotic therapy: ${activeCourses.map(c => sanitizeReportText(c.medication)).join(', ')}.`
    );
  } else {
    lines.push(
      'CURRENT STATUS: No active antibiotic therapy at this time. Resident is clinically stable per documented data.'
    );
  }

  return lines;
};

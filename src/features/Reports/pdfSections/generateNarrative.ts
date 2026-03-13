import { Resident, ABTCourse, IPEvent, VaxEvent } from '../../../domain/models';
import { formatDate, daysBetween } from './formatters';
import { getPrecautionLabel, getInfectionSourceLabel } from '../../../utils/ipEventFormatters';
import { sanitizeNoteText } from './sanitizeNoteText';

export const generateClinicalNarrative = (
  resident: Resident,
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[],
  _vaccinations: VaxEvent[],
  facilityName?: string
): string[] => {
  const lines: string[] = [];

  const resolvedFacilityName = facilityName?.trim() || 'the facility';
  const admitDate = resident.admissionDate ? formatDate(resident.admissionDate) : null;
  const activeCourses = abtCourses.filter(c => c.status === 'active');
  const completedCourses = abtCourses.filter(c => c.status === 'completed' || c.status === 'discontinued');
  const activeIpEvents = ipEvents.filter(ip => ip.status === 'active');
  const activePrecautions = activeIpEvents.filter(ip => ip.isolationType || ip.ebp || ip.protocolType);

  // 1. Opening SNF/LTC course summary paragraph
  const openingParts: string[] = [];
  openingParts.push(
    admitDate
      ? `Resident admitted to ${resolvedFacilityName} on ${admitDate}.`
      : `Resident is currently admitted to ${resolvedFacilityName}.`
  );

  const cleanDiagnosis = resident.primaryDiagnosis
    ? sanitizeNoteText(resident.primaryDiagnosis)
    : null;
  if (cleanDiagnosis) {
    openingParts.push(`Primary diagnosis: ${cleanDiagnosis}.`);
  }

  if (resident.allergies && resident.allergies.length > 0) {
    const cleanAllergies = resident.allergies
      .map(a => sanitizeNoteText(a))
      .filter((a): a is string => a !== null);
    if (cleanAllergies.length > 0) {
      openingParts.push(`Documented allergies: ${cleanAllergies.join(', ')}.`);
    }
  }

  lines.push(openingParts.join(' '), '');

  // 2. Infection / Prevention summary
  if (ipEvents.length > 0) {
    const seenIds = new Set<string>();
    const summaryParts: string[] = [];

    ipEvents.forEach(ip => {
      // Use stable id if available; fall back to onset+precaution composite key
      const key = ip.id ?? `${ip.onsetDate ?? ''}|${getPrecautionLabel(ip)}`;
      if (seenIds.has(key)) return;
      seenIds.add(key);

      const precaution = getPrecautionLabel(ip);
      const source = getInfectionSourceLabel(ip);
      const onset = ip.onsetDate ? formatDate(ip.onsetDate) : null;
      const resolved = ip.resolvedAt ? `resolved ${formatDate(ip.resolvedAt)}` : null;
      const organism = ip.organism ? `organism: ${ip.organism}` : null;

      const detail = [
        `${precaution}${source && source !== '—' ? ` (${source})` : ''}`,
        onset ? `onset ${onset}` : null,
        resolved,
        organism,
      ].filter(Boolean).join(', ');

      summaryParts.push(detail);
    });

    if (summaryParts.length > 0) {
      lines.push(`Infection prevention management: ${summaryParts.join('; ')}.`, '');
    }
  }

  // 3. Antibiotic treatment course progression (chronological, grouped by indication)
  if (abtCourses.length > 0) {
    if (completedCourses.length > 0) {
      const grouped = new Map<string, string[]>();
      completedCourses.forEach(c => {
        const key = c.indication || c.infectionSource || 'General';
        if (!grouped.has(key)) grouped.set(key, []);
        const dose = [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ');
        const start = c.startDate ? formatDate(c.startDate) : '?';
        const end = c.endDate ? formatDate(c.endDate) : '?';
        const days = c.startDate ? daysBetween(c.startDate, c.endDate) : 0;
        grouped.get(key)!.push(
          `${c.medication}${dose ? ' (' + dose + ')' : ''} ${start}–${end} (${days}d)`
        );
      });

      const priorParts: string[] = [];
      grouped.forEach((meds, indication) => {
        priorParts.push(`${indication}: ${meds.join(', ')}`);
      });

      lines.push(`Prior/completed antibiotic courses: ${priorParts.join('; ')}.`, '');
    }

    // 4. Current active treatment
    if (activeCourses.length > 0) {
      const activeDescriptions = activeCourses.map(c => {
        const dose = [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ');
        const start = c.startDate ? formatDate(c.startDate) : null;
        return `${c.medication}${dose ? ' ' + dose : ''}${start ? ' initiated ' + start : ''}${c.indication ? ' for ' + c.indication : ''}`;
      });
      lines.push(`Current active treatment: ${activeDescriptions.join('; ')}.`, '');
    } else {
      lines.push('No active antibiotic therapy at time of report.', '');
    }
  }

  // Current precautions in place
  if (activePrecautions.length > 0) {
    const precautionLabels = activePrecautions.map(ip => getPrecautionLabel(ip));
    lines.push(`Active precautions currently in place: ${precautionLabels.join(', ')}.`, '');
  }

  // 5. Stewardship mention (only when meaningful)
  const reviewed = abtCourses.filter(c => c.timeoutReviewDate || (c.interventions && c.interventions.length > 0));
  if (reviewed.length > 0) {
    lines.push(
      `Antibiotic stewardship: ${reviewed.length} of ${abtCourses.length} course(s) had documented prospective audit and/or feedback review.`,
      ''
    );

    // List any specific interventions
    const allInterventions: string[] = [];
    reviewed.forEach(c => {
      if (c.interventions) {
        c.interventions.forEach(iv => {
          const note = sanitizeNoteText(iv.note);
          allInterventions.push(
            `${iv.type} (${c.medication}, ${formatDate(iv.date)})${note ? ': ' + note : ''}`
          );
        });
      }
    });
    if (allInterventions.length > 0) {
      lines.push(`Interventions: ${allInterventions.join('; ')}.`);
    }
  }

  return lines;
};

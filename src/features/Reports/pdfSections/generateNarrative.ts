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

  // ── 1. Opening + course overview ─────────────────────────────────────────
  const openingSentence = admitDate
    ? `Resident admitted to ${resolvedFacilityName} on ${admitDate}.`
    : `Resident is currently admitted to ${resolvedFacilityName}.`;

  // Derive main clinical issues for the course-overview phrase from IP events,
  // falling back to ABT indications when no IP events are documented.
  const mainIssues: string[] = [];
  const seenIssues = new Set<string>();
  ipEvents.forEach(ip => {
    const issue = ip.infectionCategory || ip.organism || ip.sourceOfInfection;
    if (issue && !seenIssues.has(issue)) {
      seenIssues.add(issue);
      mainIssues.push(issue);
    }
  });
  if (mainIssues.length === 0) {
    abtCourses.forEach(c => {
      const ind = c.indication || c.infectionSource;
      if (ind && !seenIssues.has(ind)) {
        seenIssues.add(ind);
        mainIssues.push(ind);
      }
    });
  }

  let courseOverview = '';
  if (mainIssues.length > 0) {
    const issueText =
      mainIssues.length === 1
        ? mainIssues[0]
        : mainIssues.slice(0, -1).join(', ') + ' and ' + mainIssues[mainIssues.length - 1];
    courseOverview = ` Course has been notable for ${issueText}.`;
  } else if (abtCourses.length === 0 && ipEvents.length === 0) {
    courseOverview = ' No infectious events or antibiotic courses are currently documented for this stay.';
  }

  lines.push(openingSentence + courseOverview, '');

  // ── 2. Infection / Prevention summary ────────────────────────────────────
  if (ipEvents.length > 0) {
    const seenIds = new Set<string>();
    const resolvedEvents: IPEvent[] = [];
    const ongoingEvents: IPEvent[] = [];

    ipEvents.forEach(ip => {
      const key = ip.id ?? `${ip.onsetDate ?? ''}|${getPrecautionLabel(ip)}`;
      if (seenIds.has(key)) return;
      seenIds.add(key);
      if (ip.status === 'active') {
        ongoingEvents.push(ip);
      } else {
        resolvedEvents.push(ip);
      }
    });

    const describeEvent = (ip: IPEvent, includeResolved: boolean): string => {
      const precaution = getPrecautionLabel(ip);
      const source = getInfectionSourceLabel(ip);
      const onset = ip.onsetDate ? `onset ${formatDate(ip.onsetDate)}` : null;
      const resolvedAt = includeResolved && ip.resolvedAt ? `resolved ${formatDate(ip.resolvedAt)}` : null;
      const organism = ip.organism && !(source ?? '').includes(ip.organism) ? ip.organism : null;

      const sourcePart = source && source !== '—' && source !== 'N/A' ? ` (${source})` : '';
      const details = [onset, organism, resolvedAt].filter(Boolean).join(', ');
      return `${precaution}${sourcePart}${details ? ', ' + details : ''}`;
    };

    const ipSentences: string[] = [];

    if (resolvedEvents.length > 0) {
      const descriptions = resolvedEvents.map(ip => describeEvent(ip, true));
      if (descriptions.length === 1) {
        ipSentences.push(`Infection prevention management included ${descriptions[0]}.`);
      } else {
        ipSentences.push(`Infection prevention management included: ${descriptions.join('; ')}.`);
      }
    }

    if (ongoingEvents.length > 0) {
      const descriptions = ongoingEvents.map(ip => describeEvent(ip, false));
      if (descriptions.length === 1) {
        ipSentences.push(`${descriptions[0]} remains active at the time of this report.`);
      } else {
        ipSentences.push(`The following precautions remain active at the time of this report: ${descriptions.join('; ')}.`);
      }
    }

    if (ipSentences.length > 0) {
      lines.push(ipSentences.join(' '), '');
    }
  }

  // ── 3. Antibiotic therapy ─────────────────────────────────────────────────
  if (abtCourses.length > 0) {
    const abtSentences: string[] = [];

    if (completedCourses.length > 0) {
      const grouped = new Map<string, string[]>();
      completedCourses.forEach(c => {
        const key = c.indication || c.infectionSource || '';
        if (!grouped.has(key)) grouped.set(key, []);
        const dose = [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ');
        const start = c.startDate ? formatDate(c.startDate) : '?';
        const end = c.endDate ? formatDate(c.endDate) : '?';
        const days = c.startDate ? daysBetween(c.startDate, c.endDate) : 0;
        grouped.get(key)!.push(
          `${c.medication}${dose ? ' (' + dose + ')' : ''} (${start}–${end}, ${days}d)`
        );
      });

      const priorParts: string[] = [];
      grouped.forEach((meds, indication) => {
        priorParts.push(indication ? `${indication}: ${meds.join(', ')}` : meds.join(', '));
      });

      abtSentences.push(
        priorParts.length === 1
          ? `Prior antibiotic therapy included ${priorParts[0]}.`
          : `Prior antibiotic therapy included: ${priorParts.join('; ')}.`
      );
    }

    if (activeCourses.length > 0) {
      const earliestStart = activeCourses
        .map(c => c.startDate)
        .filter(Boolean)
        .sort()[0];
      const startPhrase = earliestStart ? `, initiated ${formatDate(earliestStart)},` : '';

      const activeGrouped = new Map<string, string[]>();
      activeCourses.forEach(c => {
        const key = c.indication || c.infectionSource || '';
        if (!activeGrouped.has(key)) activeGrouped.set(key, []);
        const dose = [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ');
        activeGrouped.get(key)!.push(`${c.medication}${dose ? ' ' + dose : ''}`);
      });

      const activeParts: string[] = [];
      activeGrouped.forEach((meds, indication) => {
        const medsText =
          meds.length === 1
            ? meds[0]
            : meds.slice(0, -1).join(', ') + ' and ' + meds[meds.length - 1];
        activeParts.push(indication ? `${medsText} for ${indication}` : medsText);
      });

      abtSentences.push(
        activeParts.length === 1
          ? `Current active treatment${startPhrase} includes ${activeParts[0]}.`
          : `Current active treatment${startPhrase} includes: ${activeParts.join('; ')}.`
      );
    } else {
      abtSentences.push('No active antibiotic therapy is ongoing at the time of this report.');
    }

    lines.push(abtSentences.join(' '), '');
  }

  // ── 4. Closing status sentence ────────────────────────────────────────────
  if (activeCourses.length > 0 || activePrecautions.length > 0) {
    const statusParts: string[] = [];

    if (activeCourses.length > 0) {
      const meds = activeCourses.map(c => c.medication);
      const medNames =
        meds.length === 1
          ? meds[0]
          : meds.slice(0, -1).join(', ') + ' and ' + meds[meds.length - 1];
      statusParts.push(`remains on ${medNames}`);
    }

    if (activePrecautions.length > 0) {
      const labels = activePrecautions.map(ip => getPrecautionLabel(ip));
      const labelsText =
        labels.length === 1
          ? labels[0]
          : labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1];
      statusParts.push(`with ${labelsText} precautions in place`);
    }

    lines.push(`At the time of this report, the resident ${statusParts.join(', ')}.`, '');
  }

  // ── 5. Stewardship (only when meaningful) ────────────────────────────────
  const reviewed = abtCourses.filter(
    c => c.timeoutReviewDate || (c.interventions && c.interventions.length > 0)
  );
  if (reviewed.length > 0) {
    const stewardshipSentences: string[] = [
      `Antibiotic stewardship review was documented for ${reviewed.length} of ${abtCourses.length} course(s).`,
    ];

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
      stewardshipSentences.push(`Interventions included: ${allInterventions.join('; ')}.`);
    }

    lines.push(stewardshipSentences.join(' '));
  }

  return lines;
};

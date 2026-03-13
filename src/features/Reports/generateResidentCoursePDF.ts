import { Resident, ABTCourse, IPEvent, VaxEvent } from '../../domain/models';
import { ResidentCoursePDFConfig, StewardshipMetrics } from '../../types/reportTypes';
import { exportPdfDocument, PdfSpec, PdfSection, DEFAULT_FACILITY } from '../../pdf/exportPdf';
import { calculateStewardshipMetrics } from './pdfSections/calculateMetrics';
import { generateClinicalNarrative } from './pdfSections/generateNarrative';
import { formatDate } from './pdfSections/formatters';
import { getPrecautionLabel, getInfectionSourceLabel } from '../../utils/ipEventFormatters';
import { todayLocalDateInputValue } from '../../lib/dateUtils';
import { sanitizeNoteText } from './pdfSections/sanitizeNoteText';

interface ResidentCourseData {
  resident: Resident;
  abtCourses: ABTCourse[];
  ipEvents: IPEvent[];
  vaccinations: VaxEvent[];
}

const dash = '—';

const isPlaceholderValue = (value: string | undefined | null): boolean => {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  return v === '' || v === 'unknown' || v === 'n/a' || v === 'none' || v === '—' || v === '-';
};

const isMdroEvent = (ip: IPEvent): boolean =>
  ip.indications?.some(ind => ind.category === 'MDRO') ?? false;

const buildResidentInfoSection = (resident: Resident): PdfSection => {
  const lines: string[] = [
    `Name: ${resident.displayName}`,
    `MRN: ${resident.mrn}`,
    `DOB: ${resident.dob ? formatDate(resident.dob) : dash}`,
    `Sex: ${resident.sex || dash}`,
    `Unit / Room: ${resident.currentUnit || 'Unassigned'} / ${resident.currentRoom || dash}`,
    `Admission Date: ${resident.admissionDate ? formatDate(resident.admissionDate) : dash}`,
    `Primary Diagnosis: ${resident.primaryDiagnosis || 'None recorded'}`,
    `Attending MD: ${resident.attendingMD || 'None recorded'}`,
    `Allergies: ${resident.allergies && resident.allergies.length > 0 ? resident.allergies.join(', ') : 'NKDA'}`,
  ];

  if (resident.cognitiveStatus) {
    lines.push(`Cognitive Status: ${resident.cognitiveStatus}`);
  }

  lines.push(`Status: ${resident.status || 'Active'}`);

  return { type: 'text', title: 'Resident Demographics & Information', lines };
};

const buildCurrentStatusSnapshot = (
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[]
): PdfSection | null => {
  const activeCourses = abtCourses.filter(c => c.status === 'active');
  const activeIp = ipEvents.filter(ip => ip.status === 'active');
  const activePrecautions = activeIp.filter(ip => ip.isolationType || ip.ebp || ip.protocolType);
  const mdroEvents = activeIp.filter(isMdroEvent);

  const lines: string[] = [];

  if (activeCourses.length > 0) {
    lines.push(`Active Antibiotics: ${activeCourses.map(c => {
      const dose = [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ');
      return `${c.medication}${dose ? ' ' + dose : ''}`;
    }).join('; ')}`);
  } else {
    lines.push('Active Antibiotics: None');
  }

  if (activePrecautions.length > 0) {
    lines.push(`Current Precautions: ${activePrecautions.map(ip => getPrecautionLabel(ip)).join(', ')}`);
  }

  const activeInfections = activeIp.filter(ip => {
    const src = getInfectionSourceLabel(ip);
    return !isPlaceholderValue(src);
  });
  if (activeInfections.length > 0) {
    lines.push(`Active Infection/Issue: ${activeInfections.map(ip => getInfectionSourceLabel(ip)).join(', ')}`);
  }

  if (mdroEvents.length > 0) {
    const mdroTypes = mdroEvents.map(ip => {
      const mdroInd = ip.indications?.find(ind => ind.category === 'MDRO');
      return mdroInd
        ? (mdroInd.mdroType === 'Other' ? (mdroInd.mdroOtherText || 'MDRO') : (mdroInd.mdroType || 'MDRO'))
        : ip.organism || 'MDRO';
    });
    lines.push(`MDRO Status: ${mdroTypes.join(', ')} — Active`);
  }

  if (lines.length === 0) return null;

  return { type: 'text', title: 'Current Clinical Status Snapshot', lines };
};

const buildAntibioticTimelineSection = (abtCourses: ABTCourse[]): PdfSection => ({
  type: 'table',
  title: 'Antibiotic Therapy Timeline',
  columns: ['Medication', 'Dose/Route/Freq', 'Start Date', 'End Date', 'Status', 'Indication', 'Organism'],
  rows: abtCourses.length > 0
    ? abtCourses.map(c => [
        c.medication,
        [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ') || dash,
        c.startDate ? formatDate(c.startDate) : dash,
        c.endDate ? formatDate(c.endDate) : 'Ongoing',
        c.status,
        sanitizeNoteText(c.indication) ?? dash,
        sanitizeNoteText(c.organismIdentified) ?? dash,
      ])
    : [['No antibiotic courses recorded', '', '', '', '', '', '']],
});

const buildInfectionEventsSection = (ipEvents: IPEvent[]): PdfSection => ({
  type: 'table',
  title: 'Infection Prevention Events Log',
  columns: ['Onset Date', 'Precaution / Type', 'Source / Indication', 'Organism', 'Status', 'Clinical Note'],
  rows: ipEvents.length > 0
    ? ipEvents.map(ip => {
        const note = sanitizeNoteText(ip.notes) ?? dash;
        return [
          ip.onsetDate ? formatDate(ip.onsetDate) : dash,
          getPrecautionLabel(ip),
          getInfectionSourceLabel(ip),
          sanitizeNoteText(ip.organism) ?? dash,
          ip.status,
          note,
        ];
      })
    : [['No infection events recorded', '', '', '', '', '']],
});

const buildIsolationSection = (ipEvents: IPEvent[]): PdfSection => {
  const isolationEvents = ipEvents.filter(ip => ip.ebp || ip.isolationType || ip.protocolType);
  return {
    type: 'table',
    title: 'Isolation / EBP Precautions History',
    columns: ['Onset Date', 'Precaution Type', 'Indication / Source', 'Organism', 'Resolved Date', 'Status'],
    rows: isolationEvents.length > 0
      ? isolationEvents.map(ip => [
          ip.onsetDate ? formatDate(ip.onsetDate) : dash,
          getPrecautionLabel(ip),
          getInfectionSourceLabel(ip),
          sanitizeNoteText(ip.organism) ?? dash,
          ip.resolvedAt ? formatDate(ip.resolvedAt) : 'Active',
          ip.status,
        ])
      : [['No isolation precautions recorded', '', '', '', '', '']],
  };
};


const buildVaccinationSection = (vaccinations: VaxEvent[]): PdfSection => ({
  type: 'table',
  title: 'Vaccination History',
  columns: ['Vaccine', 'Date Given', 'Dose', 'Status', 'Lot #', 'Administered By', 'Clinical Note'],
  rows: vaccinations.length > 0
    ? vaccinations.map(v => {
        const note = sanitizeNoteText(v.notes) ?? dash;
        return [
          v.vaccine,
          formatDate(v.dateGiven ?? v.administeredDate),
          isPlaceholderValue(v.dose) ? dash : v.dose,
          v.status,
          isPlaceholderValue(v.lotNumber) ? dash : v.lotNumber,
          isPlaceholderValue(v.administeredBy) ? dash : v.administeredBy,
          note,
        ];
      })
    : [['No vaccination records', '', '', '', '', '', '']],
});

const buildStewardshipAnalyticsSection = (metrics: StewardshipMetrics): PdfSection => ({
  type: 'text',
  title: 'Antibiotic Stewardship Analytics',
  lines: [
    `Total Antibiotic Courses: ${metrics.totalAntibioticCourses}  (Completed: ${metrics.coursesCompleted}  |  Discontinued: ${metrics.coursesDiscontinued})`,
    `Days of Therapy (DOT): ${metrics.daysOfTherapy}  |  DOT per 1,000 Resident-Days: ${metrics.dotPer1000ResidentDays}`,
    `Length of Therapy (LOT): ${metrics.lengthOfTherapy}  |  LOT per 1,000 Resident-Days: ${metrics.lotPer1000ResidentDays}`,
    `Broad-Spectrum Days: ${metrics.broadSpectrumDays} (${metrics.broadSpectrumPercentage}% of DOT)`,
    `Culture Collection Rate: ${metrics.cultureCollectionRate}%  |  De-escalation Rate: ${metrics.deEscalationRate}%  |  Stewardship Review Rate: ${metrics.stewardshipReviewRate}%`,
    `Resident Days in Period: ${metrics.residentDays}`,
  ],
});

const buildStewardshipInterventionsSection = (abtCourses: ABTCourse[]): PdfSection => {
  const rows: (string | number | null)[][] = [];
  abtCourses.forEach(course => {
    if (course.interventions && course.interventions.length > 0) {
      course.interventions.forEach(iv => {
        const note = sanitizeNoteText(iv.note) ?? dash;
        rows.push([
          formatDate(iv.date),
          iv.type,
          course.medication,
          note,
          iv.loggedBy || dash,
        ]);
      });
    }
  });

  if (rows.length === 0) {
    return {
      type: 'text',
      title: 'Stewardship Interventions & Outcomes',
      lines: ['No stewardship interventions documented during the report period.'],
    };
  }

  return {
    type: 'table',
    title: 'Stewardship Interventions & Outcomes',
    columns: ['Date', 'Type', 'Medication', 'Details', 'Logged By'],
    rows,
  };
};

const buildMDROSection = (ipEvents: IPEvent[]): PdfSection => {
  const mdroEvents = ipEvents.filter(ip => isMdroEvent(ip) || ip.organism);

  if (mdroEvents.length === 0) {
    return {
      type: 'text',
      title: 'MDRO Status Summary',
      lines: ['No MDRO events documented during the report period.'],
    };
  }

  const rows = mdroEvents.map(ip => {
    const mdroInd = ip.indications?.find(ind => ind.category === 'MDRO');
    const mdroType = mdroInd
      ? (mdroInd.mdroType === 'Other' ? (sanitizeNoteText(mdroInd.mdroOtherText) ?? 'Other') : (mdroInd.mdroType || dash))
      : dash;
    return [
      ip.onsetDate ? formatDate(ip.onsetDate) : dash,
      mdroType,
      sanitizeNoteText(ip.organism) ?? dash,
      ip.resolvedAt ? 'Cleared' : 'Active',
      ip.resolvedAt ? formatDate(ip.resolvedAt) : dash,
      getPrecautionLabel(ip),
    ];
  });

  return {
    type: 'table',
    title: 'MDRO Status Summary',
    columns: ['Detection Date', 'MDRO Type', 'Organism', 'Current Status', 'Cleared Date', 'Precaution Status'],
    rows,
  };
};

const buildPlanOfCareSection = (
  resident: Resident,
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[]
): PdfSection => {
  const lines: string[] = [];
  const activeCourses = abtCourses.filter(c => c.status === 'active');
  const activeIp = ipEvents.filter(ip => ip.status === 'active');
  const activePrecautions = activeIp.filter(ip => ip.isolationType || ip.ebp || ip.protocolType);
  const activeMdro = activeIp.filter(isMdroEvent);

  if (activeCourses.length > 0) {
    const courseList = activeCourses.map(c => {
      const dose = [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ');
      return `${c.medication}${dose ? ' ' + dose : ''}${c.endDate ? ' through ' + formatDate(c.endDate) : ''}`;
    });
    lines.push(`Active treatment to continue: ${courseList.join('; ')}.`);
  } else {
    lines.push('No active antibiotic therapy requiring continuation at time of report.');
  }

  if (activePrecautions.length > 0) {
    lines.push(`Current precautions to maintain: ${activePrecautions.map(ip => getPrecautionLabel(ip)).join(', ')}.`);
  }

  if (activeMdro.length > 0) {
    lines.push('Active MDRO colonization documented. Continue applicable isolation/EBP precautions per policy.');
  }

  lines.push('');
  lines.push('Key monitoring / reassessment focus:');
  if (activeCourses.length > 0) {
    lines.push('  - Monitor response to active antibiotic therapy and reassess per prescriber schedule.');
  }
  if (activePrecautions.length > 0) {
    lines.push('  - Reassess precaution necessity at next clinical review.');
  }
  lines.push('  - Continue standard infection prevention practices per facility policy.');

  lines.push('');
  lines.push(`Report generated: ${new Date().toLocaleString()}`);
  lines.push(`Resident: ${resident.displayName}  |  MRN: ${resident.mrn}`);

  return {
    type: 'text',
    title: 'Plan of Care Continuity',
    lines,
  };
};

const buildActionNeededSection = (
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[]
): PdfSection | null => {
  const flags: string[] = [];

  // ABT-level checks (active courses only)
  abtCourses.filter(c => c.status === 'active').forEach(c => {
    if (!c.indication) {
      flags.push(`Action Needed: ${c.medication} — no clinical indication documented.`);
    }
    if (!c.cultureCollected) {
      flags.push(`Follow-up: ${c.medication} — no culture collection documented.`);
    }
    if (!c.timeoutReviewDate) {
      flags.push(`Follow-up: ${c.medication} — no antibiotic timeout/stewardship review documented.`);
    }
  });

  // IP event checks (active events)
  ipEvents.filter(ip => ip.status === 'active').forEach(ip => {
    if (!ip.isolationType && !ip.ebp) {
      const label = ip.infectionCategory || ip.organism || 'Infection event';
      flags.push(`Action Needed: ${label} — active event has no documented precaution type.`);
    }
  });

  // MDRO with no active precaution
  const hasMdro = ipEvents.some(isMdroEvent);
  const hasActivePrecaution = ipEvents.some(
    ip => ip.status === 'active' && (ip.isolationType || ip.ebp)
  );
  if (hasMdro && !hasActivePrecaution) {
    flags.push('Review Needed: MDRO documented but no active isolation or EBP precaution found.');
  }

  if (flags.length === 0) return null;

  return {
    type: 'text',
    title: 'Action Needed / Compliance Flags',
    lines: [
      'The following items were identified as requiring follow-up or documentation review:',
      '',
      ...flags,
    ],
  };
};

export const generateResidentCoursePDF = (
  data: ResidentCourseData,
  config: ResidentCoursePDFConfig,
  facilityName?: string
): void => {
  const { resident, abtCourses, ipEvents, vaccinations } = data;
  const today = todayLocalDateInputValue();
  const admissionDate = resident.admissionDate ?? today;

  const metrics = calculateStewardshipMetrics(abtCourses, admissionDate, config.dateRange?.endDate ?? today);
  const narrativeLines = generateClinicalNarrative(resident, abtCourses, ipEvents, vaccinations, facilityName);

  const sections: PdfSection[] = [];

  if (config.includeResidentInfo) {
    sections.push(buildResidentInfoSection(resident));
  }

  // Current clinical status snapshot — always inserted after demographics when data exists
  if (config.includeResidentInfo || config.includeClinicalNarrative) {
    const snapshot = buildCurrentStatusSnapshot(abtCourses, ipEvents);
    if (snapshot) sections.push(snapshot);

    // Action Needed / compliance flags — derived display layer, shown when flags exist
    const actionNeeded = buildActionNeededSection(abtCourses, ipEvents);
    if (actionNeeded) sections.push(actionNeeded);
  }

  if (config.includeClinicalNarrative) {
    sections.push({
      type: 'text',
      title: 'SNF/LTC Course / Clinical Narrative',
      lines: narrativeLines,
    });
  }

  if (config.includeAntibioticTimeline) {
    sections.push(buildAntibioticTimelineSection(abtCourses));
  }

  if (config.includeInfectionEvents) {
    sections.push(buildInfectionEventsSection(ipEvents));
  }

  if (config.includeIsolationPrecautions) {
    sections.push(buildIsolationSection(ipEvents));
  }

  if (config.includeVaccinations) {
    sections.push(buildVaccinationSection(vaccinations));
  }

  if (config.includeStewardshipAnalytics) {
    sections.push(buildStewardshipAnalyticsSection(metrics));
  }

  if (config.includeStewardshipInterventions) {
    sections.push(buildStewardshipInterventionsSection(abtCourses));
  }

  if (config.includeMDROStatus) {
    sections.push(buildMDROSection(ipEvents));
  }

  if (config.includeRecommendations) {
    sections.push(buildPlanOfCareSection(resident, abtCourses, ipEvents));
  }

  const dateRangeLabel = config.dateRange
    ? `${formatDate(config.dateRange.startDate)} – ${formatDate(config.dateRange.endDate)}`
    : `All dates through ${formatDate(today)}`;

  const spec: PdfSpec = {
    title: 'Treatment Course Summary Report',
    orientation: 'portrait',
    template: 'PORTRAIT_TEMPLATE_V1',
    facilityName: facilityName ?? DEFAULT_FACILITY,
    filename: `treatment-course-${resident.mrn}-${today}`,
    subtitleLines: [
      `Resident: ${resident.displayName}  |  MRN: ${resident.mrn}`,
      `Admission: ${resident.admissionDate ? formatDate(resident.admissionDate) : dash}  |  Unit: ${resident.currentUnit || dash} / ${resident.currentRoom || dash}`,
      `Report Period: ${dateRangeLabel}`,
      `Generated: ${new Date().toLocaleString()}`,
    ],
    sections,
  };

  exportPdfDocument(spec);
};

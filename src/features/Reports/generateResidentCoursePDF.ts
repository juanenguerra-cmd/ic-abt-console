import { Resident, ABTCourse, IPEvent, VaxEvent } from '../../domain/models';
import { ResidentCoursePDFConfig, StewardshipMetrics } from '../../types/reportTypes';
import { exportPdfDocument, PdfSpec, PdfSection, DEFAULT_FACILITY } from '../../pdf/exportPdf';
import { calculateStewardshipMetrics } from './pdfSections/calculateMetrics';
import { generateClinicalNarrative } from './pdfSections/generateNarrative';
import { formatDate } from './pdfSections/formatters';
import { getPrecautionLabel, getInfectionSourceLabel } from '../../utils/ipEventFormatters';
import { todayLocalDateInputValue } from '../../lib/dateUtils';
import { sanitizeReportCell } from '../../utils/reportSanitizer';

interface ResidentCourseData {
  resident: Resident;
  abtCourses: ABTCourse[];
  ipEvents: IPEvent[];
  vaccinations: VaxEvent[];
}

const buildResidentInfoSection = (resident: Resident): PdfSection => ({
  type: 'text',
  title: 'Resident Demographics & Information',
  lines: [
    `Name: ${resident.displayName}`,
    `MRN: ${resident.mrn}`,
    `DOB: ${resident.dob ? formatDate(resident.dob) : 'Unknown'}`,
    `Sex: ${resident.sex || 'Unknown'}`,
    `Unit / Room: ${resident.currentUnit || 'Unassigned'} / ${resident.currentRoom || 'N/A'}`,
    `Admission Date: ${resident.admissionDate ? formatDate(resident.admissionDate) : 'N/A'}`,
    `Primary Diagnosis: ${resident.primaryDiagnosis || 'None recorded'}`,
    `Attending MD: ${resident.attendingMD || 'None recorded'}`,
    `Allergies: ${resident.allergies && resident.allergies.length > 0 ? resident.allergies.join(', ') : 'NKDA'}`,
    `Cognitive Status: ${resident.cognitiveStatus || 'Not documented'}`,
    `Status: ${resident.status || 'Active'}`,
  ],
});

const buildAntibioticTimelineSection = (abtCourses: ABTCourse[]): PdfSection => {
  const active = abtCourses.filter(c => c.status === 'active');
  const historical = abtCourses.filter(c => c.status !== 'active');

  const makeRow = (c: ABTCourse) => [
    sanitizeReportCell(c.medication),
    [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ') || '—',
    c.startDate ? formatDate(c.startDate) : '—',
    c.endDate ? formatDate(c.endDate) : (c.status === 'active' ? 'Ongoing' : '—'),
    c.status,
    sanitizeReportCell(c.indication),
    sanitizeReportCell(c.organismIdentified),
  ];

  const rows: (string | number | null)[][] = [];

  if (active.length > 0) {
    rows.push(['── Current Active Antibiotic Therapy ──', '', '', '', '', '', '']);
    active.forEach(c => rows.push(makeRow(c)));
  }

  if (historical.length > 0) {
    rows.push(['── Prior / Completed Antibiotic Courses ──', '', '', '', '', '', '']);
    historical.forEach(c => rows.push(makeRow(c)));
  }

  return {
    type: 'table',
    title: 'Antibiotic Therapy Timeline',
    columns: ['Medication', 'Dose/Route/Freq', 'Start Date', 'End Date', 'Status', 'Indication', 'Organism'],
    rows: rows.length > 0 ? rows : [['No antibiotic courses recorded', '', '', '', '', '', '']],
  };
};

const buildInfectionEventsSection = (ipEvents: IPEvent[]): PdfSection => {
  const active = ipEvents.filter(ip => ip.status === 'active');
  const historical = ipEvents.filter(ip => ip.status !== 'active');

  const makeRow = (ip: IPEvent) => [
    ip.onsetDate ? formatDate(ip.onsetDate) : '—',
    getPrecautionLabel(ip),
    getInfectionSourceLabel(ip),
    sanitizeReportCell(ip.organism),
    ip.status,
    sanitizeReportCell(ip.notes),
  ];

  const rows: (string | number | null)[][] = [];

  if (active.length > 0) {
    rows.push(['── Active Infection Events ──', '', '', '', '', '']);
    active.forEach(ip => rows.push(makeRow(ip)));
  }

  if (historical.length > 0) {
    rows.push(['── Historical / Resolved Events ──', '', '', '', '', '']);
    historical.forEach(ip => rows.push(makeRow(ip)));
  }

  return {
    type: 'table',
    title: 'Infection Prevention Events Log',
    columns: ['Onset Date', 'Precaution / Type', 'Source / Indication', 'Organism', 'Status', 'Notes'],
    rows: rows.length > 0 ? rows : [['No infection events recorded', '', '', '', '', '']],
  };
};

const buildIsolationSection = (ipEvents: IPEvent[]): PdfSection => {
  const isolationEvents = ipEvents.filter(ip => ip.ebp || ip.isolationType || ip.protocolType);
  const activeIsolation = isolationEvents.filter(ip => ip.status === 'active');
  const historicalIsolation = isolationEvents.filter(ip => ip.status !== 'active');

  const makeRow = (ip: IPEvent) => [
    ip.onsetDate ? formatDate(ip.onsetDate) : '—',
    getPrecautionLabel(ip),
    getInfectionSourceLabel(ip),
    sanitizeReportCell(ip.organism),
    ip.resolvedAt ? formatDate(ip.resolvedAt) : 'Active',
    ip.status,
  ];

  const rows: (string | number | null)[][] = [];

  if (activeIsolation.length > 0) {
    rows.push(['── Current Active Precautions ──', '', '', '', '', '']);
    activeIsolation.forEach(ip => rows.push(makeRow(ip)));
  }

  if (historicalIsolation.length > 0) {
    rows.push(['── Historical Precautions / Resolved Events ──', '', '', '', '', '']);
    historicalIsolation.forEach(ip => rows.push(makeRow(ip)));
  }

  return {
    type: 'table',
    title: 'Isolation / EBP Precautions History',
    columns: ['Onset Date', 'Precaution Type', 'Indication / Source', 'Organism', 'Resolved Date', 'Status'],
    rows: rows.length > 0 ? rows : [['No isolation precautions recorded', '', '', '', '', '']],
  };
};

const buildVaccinationSection = (vaccinations: VaxEvent[]): PdfSection => ({
  type: 'table',
  title: 'Vaccination History',
  columns: ['Vaccine', 'Date Given', 'Dose', 'Status', 'Lot #', 'Administered By', 'Notes'],
  rows: vaccinations.length > 0
    ? vaccinations.map(v => [
        sanitizeReportCell(v.vaccine),
        formatDate(v.dateGiven ?? v.administeredDate),
        sanitizeReportCell(v.dose),
        v.status,
        sanitizeReportCell(v.lotNumber),
        sanitizeReportCell(v.administeredBy),
        sanitizeReportCell(v.notes),
      ])
    : [['No documented vaccination records during report period', '', '', '', '', '', '']],
});

const buildStewardshipAnalyticsSection = (metrics: StewardshipMetrics): PdfSection => ({
  type: 'text',
  title: 'Antibiotic Stewardship Analytics',
  lines: [
    `Total Antibiotic Courses: ${metrics.totalAntibioticCourses}`,
    `  Completed: ${metrics.coursesCompleted}   Discontinued: ${metrics.coursesDiscontinued}`,
    `Days of Therapy (DOT): ${metrics.daysOfTherapy}`,
    `DOT per 1,000 Resident-Days: ${metrics.dotPer1000ResidentDays}`,
    `Length of Therapy (LOT): ${metrics.lengthOfTherapy}`,
    `LOT per 1,000 Resident-Days: ${metrics.lotPer1000ResidentDays}`,
    `Broad-Spectrum Days: ${metrics.broadSpectrumDays} (${metrics.broadSpectrumPercentage}% of DOT)`,
    `Culture Collection Rate: ${metrics.cultureCollectionRate}%`,
    `De-escalation Rate: ${metrics.deEscalationRate}%`,
    `Stewardship Review Rate: ${metrics.stewardshipReviewRate}%`,
    `Resident Days in Period: ${metrics.residentDays}`,
  ],
});

const buildStewardshipInterventionsSection = (abtCourses: ABTCourse[]): PdfSection => {
  const rows: (string | number | null)[][] = [];
  abtCourses.forEach(course => {
    if (course.interventions && course.interventions.length > 0) {
      course.interventions.forEach(iv => {
        rows.push([
          formatDate(iv.date),
          iv.type,
          sanitizeReportCell(course.medication),
          sanitizeReportCell(iv.note),
          sanitizeReportCell(iv.loggedBy),
        ]);
      });
    }
  });

  return {
    type: 'table',
    title: 'Stewardship Interventions & Outcomes',
    columns: ['Date', 'Type', 'Medication', 'Details', 'Logged By'],
    rows: rows.length > 0 ? rows : [['No stewardship interventions recorded', '', '', '', '']],
  };
};

const buildMDROSection = (ipEvents: IPEvent[]): PdfSection => {
  const mdroEvents = ipEvents.filter(ip =>
    ip.indications?.some(ind => ind.category === 'MDRO') || ip.organism
  );

  const rows = mdroEvents.map(ip => {
    const mdroInd = ip.indications?.find(ind => ind.category === 'MDRO');
    const mdroType = mdroInd
      ? (mdroInd.mdroType === 'Other' ? (mdroInd.mdroOtherText || 'Other') : (mdroInd.mdroType || '—'))
      : '—';
    return [
      ip.onsetDate ? formatDate(ip.onsetDate) : '—',
      mdroType,
      ip.organism || '—',
      ip.resolvedAt ? 'Cleared' : 'Active',
      ip.resolvedAt ? formatDate(ip.resolvedAt) : 'N/A',
      getPrecautionLabel(ip),
    ];
  });

  return {
    type: 'table',
    title: 'MDRO Status Summary',
    columns: ['Detection Date', 'MDRO Type', 'Organism', 'Current Status', 'Cleared Date', 'Precaution Status'],
    rows: rows.length > 0 ? rows : [['No MDRO events recorded', '', '', '', '', '']],
  };
};

const buildPlanOfCareContinuitySection = (
  resident: Resident,
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[]
): PdfSection => {
  const lines: string[] = [];
  const activeCourses = abtCourses.filter(c => c.status === 'active');
  const activeIp = ipEvents.filter(ip => ip.status === 'active');

  // Active treatment to continue
  if (activeCourses.length > 0) {
    lines.push('ACTIVE TREATMENT TO CONTINUE:');
    activeCourses.forEach(c => {
      const dose = [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ');
      lines.push(`  • ${sanitizeReportCell(c.medication)}${dose ? ' — ' + dose : ''} (started ${c.startDate ? formatDate(c.startDate) : 'unknown'})`);
      if (c.indication) lines.push(`    Indication: ${sanitizeReportCell(c.indication)}`);
    });
    lines.push('');
  }

  // Precautions to maintain
  const activeMdro = activeIp.filter(ip =>
    ip.indications?.some(ind => ind.category === 'MDRO')
  );
  if (activeMdro.length > 0) {
    lines.push('MDRO STATUS — PRECAUTIONS REQUIRED:');
    activeMdro.forEach(ip => {
      const organism = ip.organism ? sanitizeReportCell(ip.organism) : 'organism not specified';
      lines.push(`  • MDRO colonization documented (${organism}). Isolation/EBP precautions required.`);
    });
    lines.push('');
  }

  const activeIsolation = activeIp.filter(ip => ip.isolationType || ip.ebp);
  if (activeIsolation.length > 0) {
    lines.push('CURRENT PRECAUTIONS TO MAINTAIN:');
    activeIsolation.forEach(ip => {
      lines.push(`  • ${getPrecautionLabel(ip)}`);
    });
    lines.push('');
  }

  // Monitoring focus
  const activeInfections = activeIp.filter(ip => !ip.isolationType && !ip.ebp);
  if (activeInfections.length > 0) {
    lines.push('MONITORING FOCUS:');
    activeInfections.forEach(ip => {
      lines.push(`  • Active infection event: ${getPrecautionLabel(ip)} (onset ${ip.onsetDate ? formatDate(ip.onsetDate) : 'unknown'})`);
    });
    lines.push('');
  }

  // Reassessment items
  const reassessItems: string[] = [];
  activeCourses.forEach(c => {
    if (!c.timeoutReviewDate) reassessItems.push(`Antibiotic timeout review pending for ${sanitizeReportCell(c.medication)}`);
  });
  if (reassessItems.length > 0) {
    lines.push('REASSESSMENT ITEMS:');
    reassessItems.forEach(item => lines.push(`  • ${item}`));
    lines.push('');
  }

  if (lines.length === 0) {
    lines.push('No active antibiotic therapy or isolation precautions at time of report.');
    lines.push('Continue standard infection prevention practices per facility policy.');
    lines.push('');
  }

  lines.push(`Report generated: ${new Date().toLocaleString()}`);
  lines.push(`Resident: ${resident.displayName} | MRN: ${resident.mrn}`);

  return {
    type: 'text',
    title: 'Plan of Care Continuity',
    lines,
  };
};

const buildCurrentStatusSnapshotSection = (
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[],
  vaccinations: VaxEvent[]
): PdfSection => {
  const lines: string[] = [];

  const activeCourses = abtCourses.filter(c => c.status === 'active');
  const activeIp = ipEvents.filter(ip => ip.status === 'active');
  const activePrecautions = activeIp.filter(ip => ip.isolationType || ip.ebp);
  const activeMdro = activeIp.filter(ip => ip.indications?.some(ind => ind.category === 'MDRO'));
  const activeInfections = activeIp.filter(ip => !ip.isolationType && !ip.ebp);

  // Active antibiotics
  if (activeCourses.length > 0) {
    lines.push(`Active Antibiotic(s): ${activeCourses.map(c => sanitizeReportCell(c.medication)).join(', ')}`);
  } else {
    lines.push('Active Antibiotic(s): None at this time');
  }

  // Current precautions
  if (activePrecautions.length > 0) {
    lines.push(`Current Precautions: ${activePrecautions.map(ip => getPrecautionLabel(ip)).join(', ')}`);
  } else {
    lines.push('Current Precautions: None documented');
  }

  // Active infection issue
  if (activeInfections.length > 0) {
    lines.push(`Active Infection Issue: ${activeInfections.map(ip => `${getPrecautionLabel(ip)} (onset ${ip.onsetDate ? formatDate(ip.onsetDate) : 'unknown'})`).join('; ')}`);
  } else {
    lines.push('Active Infection Issue: None documented');
  }

  // MDRO status
  if (activeMdro.length > 0) {
    const mdroOrganisms = activeMdro.map(ip => sanitizeReportCell(ip.organism)).filter(o => o !== '—').join(', ');
    lines.push(`MDRO Status: Active — ${mdroOrganisms || 'organism not specified'}`);
  } else {
    lines.push('MDRO Status: No active MDRO documented');
  }

  // Vaccination summary (recent)
  if (vaccinations.length > 0) {
    const sorted = [...vaccinations].sort((a, b) => {
      const da = a.dateGiven ?? a.administeredDate ?? '';
      const db = b.dateGiven ?? b.administeredDate ?? '';
      return db.localeCompare(da);
    });
    const recent = sorted.slice(0, 3).map(v => `${sanitizeReportCell(v.vaccine)} (${formatDate(v.dateGiven ?? v.administeredDate)})`).join(', ');
    lines.push(`Recent Vaccination(s): ${recent}`);
  } else {
    lines.push('Recent Vaccination(s): No documented vaccination records');
  }

  return {
    type: 'text',
    title: 'Current Clinical Status Snapshot',
    lines,
  };
};

const buildActionNeededSection = (
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[]
): PdfSection | null => {
  const flags: string[] = [];

  const activeCourses = abtCourses.filter(c => c.status === 'active');
  const activeIp = ipEvents.filter(ip => ip.status === 'active');

  // ABT compliance flags
  activeCourses.forEach(c => {
    const med = sanitizeReportCell(c.medication);
    if (!c.indication) flags.push(`Action Needed: Active antibiotic (${med}) is missing a documented indication.`);
    if (c.cultureCollected === false) flags.push(`Action Needed: Active antibiotic (${med}) has no culture documented.`);
    if (!c.timeoutReviewDate) flags.push(`Action Needed: Active antibiotic (${med}) has no timeout review date documented.`);
  });

  // IP event compliance flags
  activeIp.forEach(ip => {
    const label = getPrecautionLabel(ip);
    if (!ip.isolationType && !ip.ebp && !ip.protocolType) {
      flags.push(`Action Needed: Active infection event (${label}) has no precaution type documented.`);
    }
  });

  // MDRO without precaution
  const activeMdro = activeIp.filter(ip => ip.indications?.some(ind => ind.category === 'MDRO'));
  activeMdro.forEach(ip => {
    if (!ip.isolationType && !ip.ebp) {
      flags.push(`Action Needed: MDRO documented (${sanitizeReportCell(ip.organism)}) without a matching active isolation/EBP precaution.`);
    }
  });

  if (flags.length === 0) return null;

  return {
    type: 'text',
    title: 'Action Needed / Compliance Flags',
    lines: flags,
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
  const narrativeLines = generateClinicalNarrative(resident, abtCourses, ipEvents, vaccinations);

  const sections: PdfSection[] = [];

  if (config.includeResidentInfo) {
    sections.push(buildResidentInfoSection(resident));
  }

  // Current Clinical Status Snapshot always appears near the top when resident info is shown
  sections.push(buildCurrentStatusSnapshotSection(abtCourses, ipEvents, vaccinations));

  // Action Needed flags (only rendered when there are flags)
  const actionNeeded = buildActionNeededSection(abtCourses, ipEvents);
  if (actionNeeded) {
    sections.push(actionNeeded);
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
    sections.push(buildPlanOfCareContinuitySection(resident, abtCourses, ipEvents));
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
      `Resident: ${resident.displayName} | MRN: ${resident.mrn}`,
      `Admission: ${resident.admissionDate ? formatDate(resident.admissionDate) : 'N/A'} | Unit: ${resident.currentUnit || resident.location?.unit || '—'} / ${resident.currentRoom || resident.location?.room || '—'}`,
      `Report Period: ${dateRangeLabel}`,
      `Generated: ${new Date().toLocaleString()}`,
      `Source Data: Resident Profile | Antibiotic Stewardship | Infection Prevention | Vaccination History`,
    ],
    sections,
  };

  exportPdfDocument(spec);
};

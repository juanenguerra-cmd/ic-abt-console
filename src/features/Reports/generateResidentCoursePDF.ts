import { Resident, ABTCourse, IPEvent, VaxEvent } from '../../domain/models';
import { ResidentCoursePDFConfig, StewardshipMetrics } from '../../types/reportTypes';
import { exportPdfDocument, PdfSpec, PdfSection, DEFAULT_FACILITY } from '../../pdf/exportPdf';
import { calculateStewardshipMetrics } from './pdfSections/calculateMetrics';
import { generateClinicalNarrative } from './pdfSections/generateNarrative';
import { formatDate } from './pdfSections/formatters';
import { getPrecautionLabel, getInfectionSourceLabel } from '../../utils/ipEventFormatters';
import { todayLocalDateInputValue } from '../../lib/dateUtils';

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

const buildAntibioticTimelineSection = (abtCourses: ABTCourse[]): PdfSection => ({
  type: 'table',
  title: 'Antibiotic Therapy Timeline',
  columns: ['Medication', 'Dose/Route/Freq', 'Start Date', 'End Date', 'Status', 'Indication', 'Organism'],
  rows: abtCourses.length > 0
    ? abtCourses.map(c => [
        c.medication,
        [c.dose, c.doseUnit, c.route, c.frequency].filter(Boolean).join(' ') || '—',
        c.startDate ? formatDate(c.startDate) : '—',
        c.endDate ? formatDate(c.endDate) : 'Ongoing',
        c.status,
        c.indication || '—',
        c.organismIdentified || '—',
      ])
    : [['No antibiotic courses recorded', '', '', '', '', '', '']],
});

const buildInfectionEventsSection = (ipEvents: IPEvent[]): PdfSection => ({
  type: 'table',
  title: 'Infection Prevention Events Log',
  columns: ['Onset Date', 'Precaution / Type', 'Source / Indication', 'Organism', 'Status', 'Notes'],
  rows: ipEvents.length > 0
    ? ipEvents.map(ip => [
        ip.onsetDate ? formatDate(ip.onsetDate) : '—',
        getPrecautionLabel(ip),
        getInfectionSourceLabel(ip),
        ip.organism || '—',
        ip.status,
        ip.notes || '—',
      ])
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
          ip.onsetDate ? formatDate(ip.onsetDate) : '—',
          getPrecautionLabel(ip),
          getInfectionSourceLabel(ip),
          ip.organism || '—',
          ip.resolvedAt ? formatDate(ip.resolvedAt) : 'Active',
          ip.status,
        ])
      : [['No isolation precautions recorded', '', '', '', '', '']],
  };
};

const buildVaccinationSection = (vaccinations: VaxEvent[]): PdfSection => ({
  type: 'table',
  title: 'Vaccination History',
  columns: ['Vaccine', 'Date Given', 'Dose', 'Status', 'Lot #', 'Administered By', 'Notes'],
  rows: vaccinations.length > 0
    ? vaccinations.map(v => [
        v.vaccine,
        formatDate(v.dateGiven ?? v.administeredDate),
        v.dose || '—',
        v.status,
        v.lotNumber || '—',
        v.administeredBy || '—',
        v.notes || '—',
      ])
    : [['No vaccination records', '', '', '', '', '', '']],
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
          course.medication,
          iv.note,
          iv.loggedBy,
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

const buildRecommendationsSection = (
  resident: Resident,
  abtCourses: ABTCourse[],
  ipEvents: IPEvent[]
): PdfSection => {
  const lines: string[] = [];
  const activeCourses = abtCourses.filter(c => c.status === 'active');
  const activeIp = ipEvents.filter(ip => ip.status === 'active');

  if (activeCourses.length > 0) {
    lines.push(`Active antibiotic therapy: ${activeCourses.map(c => c.medication).join(', ')}`);
    lines.push('  → Ensure continuation of therapy per current orders at receiving facility.');
  }

  const activeMdro = activeIp.filter(ip =>
    ip.indications?.some(ind => ind.category === 'MDRO')
  );
  if (activeMdro.length > 0) {
    lines.push('Active MDRO colonization detected. Isolation/EBP precautions required at receiving facility.');
  }

  const activeIsolation = activeIp.filter(ip => ip.isolationType || ip.ebp);
  if (activeIsolation.length > 0) {
    lines.push(`Isolation precautions in place: ${activeIsolation.map(ip => getPrecautionLabel(ip)).join(', ')}.`);
    lines.push('  → Receiving facility to continue applicable precautions upon admission.');
  }

  if (lines.length === 0) {
    lines.push('No active antibiotic therapy or isolation precautions at time of report.');
    lines.push('Continue standard infection prevention practices per facility policy.');
  }

  lines.push('');
  lines.push(`Report generated: ${new Date().toLocaleString()}`);
  lines.push(`Resident: ${resident.displayName} | MRN: ${resident.mrn}`);

  return {
    type: 'text',
    title: 'Discharge / Transfer Recommendations',
    lines,
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

  if (config.includeClinicalNarrative) {
    sections.push({
      type: 'text',
      title: 'Hospital Course / Clinical Narrative',
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
    sections.push(buildRecommendationsSection(resident, abtCourses, ipEvents));
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
      `Admission: ${resident.admissionDate ? formatDate(resident.admissionDate) : 'N/A'} | Unit: ${resident.currentUnit || '—'} / ${resident.currentRoom || '—'}`,
      `Report Period: ${dateRangeLabel}`,
      `Generated: ${new Date().toLocaleString()}`,
    ],
    sections,
  };

  exportPdfDocument(spec);
};

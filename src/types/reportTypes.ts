// ═══════════════════════════════════════════════════════════════════════════════
// Report types for the Resident Treatment Course PDF Summary feature.
// ═══════════════════════════════════════════════════════════════════════════════

export interface ResidentCoursePDFConfig {
  includeResidentInfo: boolean;
  includeClinicalNarrative: boolean;
  includeAntibioticTimeline: boolean;
  includeInfectionEvents: boolean;
  includeIsolationPrecautions: boolean;
  includeVaccinations: boolean;
  includeStewardshipAnalytics: boolean;
  includeStewardshipInterventions: boolean;
  includeMDROStatus: boolean;
  includeRecommendations: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export interface StewardshipMetrics {
  totalAntibioticCourses: number;
  coursesCompleted: number;
  coursesDiscontinued: number;
  coursesAvoided: number;

  daysOfTherapy: number;
  residentDays: number;
  dotPer1000ResidentDays: number;

  lengthOfTherapy: number;
  lotPer1000ResidentDays: number;

  broadSpectrumDays: number;
  broadSpectrumPercentage: number;

  cultureCollectionRate: number;
  deEscalationRate: number;
  stewardshipReviewRate: number;

  cdiffInfections: number;
  adverseDrugEvents: number;
}

export const AUDIT_CATEGORIES = [
  "HAND_HYGIENE",
  "PPE",
  "ISOLATION",
  "EBP",
  "ENV_CLEANING",
  "ANTIBIOTIC_STEWARDSHIP",
  "VACCINATION",
  "OUTBREAK_PREP",
] as const;

export type InfectionControlAuditCategory = typeof AUDIT_CATEGORIES[number];

export interface InfectionControlAuditTemplateQuestion {
  id: string;
  text: string;
}

export const infectionControlAuditTemplates: Record<InfectionControlAuditCategory, InfectionControlAuditTemplateQuestion[]> = {
  HAND_HYGIENE: [
    { id: "HH-1", text: "Staff perform hand hygiene before resident contact." },
    { id: "HH-2", text: "Alcohol-based hand rub is available at point of care." },
    { id: "HH-3", text: "Hand hygiene observed after glove removal." },
    { id: "HH-4", text: "Sinks and soap supplies are functional and stocked." },
    { id: "HH-5", text: "Hand hygiene signage is visible in care areas." },
  ],
  PPE: [
    { id: "PPE-1", text: "Required PPE is available in resident care areas." },
    { id: "PPE-2", text: "Staff don PPE before entering isolation rooms." },
    { id: "PPE-3", text: "Staff doff PPE correctly to avoid contamination." },
    { id: "PPE-4", text: "Eye protection is used when splash risk is present." },
    { id: "PPE-5", text: "PPE disposal bins are available and not overfilled." },
  ],
  ISOLATION: [
    { id: "ISO-1", text: "Isolation signage is posted at room entrances." },
    { id: "ISO-2", text: "Isolation carts are stocked per required precautions." },
    { id: "ISO-3", text: "Dedicated equipment is used for isolated residents." },
    { id: "ISO-4", text: "Staff follow room entry/exit isolation protocols." },
    { id: "ISO-5", text: "Isolation orders match current clinical indications." },
  ],
  EBP: [
    { id: "EBP-1", text: "Device care bundles are followed for EBP cases." },
    { id: "EBP-2", text: "Sites are assessed daily for signs of infection." },
    { id: "EBP-3", text: "Dressing changes follow facility policy." },
    { id: "EBP-4", text: "EBP documentation is complete in resident records." },
    { id: "EBP-5", text: "Supplies for EBP care are immediately available." },
  ],
  ENV_CLEANING: [
    { id: "ENV-1", text: "High-touch surfaces are cleaned per schedule." },
    { id: "ENV-2", text: "EPA-approved disinfectants are used correctly." },
    { id: "ENV-3", text: "Shared equipment is disinfected between uses." },
    { id: "ENV-4", text: "Terminal cleaning is completed after isolation discharge." },
    { id: "ENV-5", text: "Cleaning logs are completed and reviewed." },
  ],
  ANTIBIOTIC_STEWARDSHIP: [
    { id: "ABX-1", text: "Antibiotic indications are documented clearly." },
    { id: "ABX-2", text: "Culture data are reviewed before continuing therapy." },
    { id: "ABX-3", text: "Stop/review dates are documented for active antibiotics." },
    { id: "ABX-4", text: "Broad-spectrum use is reviewed for de-escalation." },
    { id: "ABX-5", text: "Stewardship recommendations are communicated to providers." },
  ],
  VACCINATION: [
    { id: "VAX-1", text: "Resident vaccination status is up to date in records." },
    { id: "VAX-2", text: "Staff vaccination documentation is current." },
    { id: "VAX-3", text: "Declinations are documented with reason when applicable." },
  ],
  OUTBREAK_PREP: [
    { id: "OB-1", text: "Outbreak response supplies are immediately available." },
    { id: "OB-2", text: "Outbreak communication tree is current and accessible." },
    { id: "OB-3", text: "Cohorting/containment plans are reviewed with unit staff." },
  ],
};


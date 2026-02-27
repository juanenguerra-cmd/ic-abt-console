export type MigrationDatasetType = "IP" | "ABT" | "VAX";

interface MigrationTemplateDefinition {
  filename: string;
  headers: string[];
  exampleRow: string[];
}

const TEMPLATE_DEFINITIONS: Record<MigrationDatasetType, MigrationTemplateDefinition> = {
  IP: {
    filename: "ip_migration_template.csv",
    headers: [
      "id",
      "residentId",
      "mrn",
      "status",
      "infectionCategory",
      "infectionSite",
      "sourceOfInfection",
      "isolationType",
      "ebp",
      "organism",
      "specimenCollectedDate",
      "labResultDate",
      "outbreakId",
      "locationUnit",
      "locationRoom",
      "notes",
      "createdAt",
      "updatedAt",
    ],
    exampleRow: [
      "ip-001",
      "12345",
      "12345",
      "active",
      "Pneumonia",
      "Respiratory Tract",
      "Respiratory",
      "Droplet",
      "false",
      "Influenza A",
      "2026-01-10",
      "2026-01-11",
      "",
      "Unit 1",
      "101A",
      "Imported from legacy system",
      "2026-01-11T12:00:00.000Z",
      "2026-01-11T12:00:00.000Z",
    ],
  },
  ABT: {
    filename: "abt_migration_template.csv",
    headers: [
      "id",
      "residentId",
      "mrn",
      "status",
      "medication",
      "medicationClass",
      "route",
      "frequency",
      "indication",
      "infectionSource",
      "syndromeCategory",
      "startDate",
      "endDate",
      "cultureCollected",
      "cultureCollectionDate",
      "cultureSource",
      "organismIdentified",
      "sensitivitySummary",
      "diagnostics",
      "locationUnit",
      "locationRoom",
      "notes",
      "createdAt",
      "updatedAt",
    ],
    exampleRow: [
      "abt-001",
      "12345",
      "12345",
      "active",
      "Ceftriaxone",
      "Cephalosporins",
      "IV",
      "Daily",
      "Pneumonia",
      "Facility-Acquired",
      "Respiratory",
      "2026-01-10",
      "2026-01-17",
      "true",
      "2026-01-10",
      "Sputum",
      "Klebsiella pneumoniae",
      "Sensitive to ceftriaxone",
      "{\"treatmentType\":\"Targeted\"}",
      "Unit 1",
      "101A",
      "Imported from legacy system",
      "2026-01-10T12:00:00.000Z",
      "2026-01-10T12:00:00.000Z",
    ],
  },
  VAX: {
    filename: "vax_migration_template.csv",
    headers: [
      "id",
      "residentId",
      "mrn",
      "vaccine",
      "status",
      "dateGiven",
      "dueDate",
      "offerDate",
      "declineReason",
      "notes",
      "createdAt",
      "updatedAt",
    ],
    exampleRow: [
      "vax-001",
      "12345",
      "12345",
      "Influenza",
      "given",
      "2025-10-15",
      "",
      "",
      "",
      "Imported from legacy system",
      "2025-10-15T12:00:00.000Z",
      "2025-10-15T12:00:00.000Z",
    ],
  },
};

const escapeCell = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
};

export const getMigrationTemplate = (type: MigrationDatasetType) => {
  const definition = TEMPLATE_DEFINITIONS[type];
  const csv = [definition.headers, definition.exampleRow]
    .map((row) => row.map((value) => escapeCell(value)).join(","))
    .join("\n");
  return {
    filename: definition.filename,
    csv,
  };
};

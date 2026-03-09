export interface VersionEntry {
  version: string;
  date: string;
  changes: string[];
}

export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "1.0.0",
    date: "2026-03-06",
    changes: [
      "Initial release of the ICN Console.",
      "Resident management with MRN support.",
      "Outbreak management and line lists.",
      "Floor map visualization.",
      "Offline-capable database with local storage."
    ]
  }
];

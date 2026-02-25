import { v5 as uuidv5 } from "uuid";
import { Resident, QuarantineResident } from "../domain/models";

// Use a static namespace UUID for generating deterministic Q-IDs based on raw text
const QUARANTINE_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export interface ParsedCensus {
  residents: Resident[];
  quarantine: QuarantineResident[];
}

/**
 * Parses raw census text and extracts residents.
 * 
 * Heuristic:
 * - If a line starts with a token that looks like an MRN (e.g., numeric or alphanumeric starting with a digit),
 *   it is treated as a known Resident.
 * - If the MRN is missing or the line format is unrecognized, the resident is routed to the Quarantine system.
 * - Quarantine records receive a deterministic Q:<uuid> based on the raw text content.
 */
export function parseCensusText(rawText: string): ParsedCensus {
  const lines = rawText.split("\n").map(line => line.trim()).filter(Boolean);
  
  const result: ParsedCensus = {
    residents: [],
    quarantine: []
  };

  const now = new Date().toISOString();

  for (const line of lines) {
    const tokens = line.split(/\s+/);
    const firstToken = tokens[0];
    
    // Simple heuristic for MRN: At least 3 characters, starts with a digit, mostly alphanumeric.
    const isLikelyMRN = /^\d[a-zA-Z0-9]{2,}$/.test(firstToken);

    if (isLikelyMRN) {
      const mrn = firstToken;
      const displayName = tokens.slice(1).join(" ") || "Unknown Name";
      
      result.residents.push({
        mrn,
        displayName,
        status: "Active",
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // Missing MRN -> Route to Quarantine
      // Generate a deterministic UUID based on the raw line content to prevent duplicates
      const deterministicUuid = uuidv5(line, QUARANTINE_NAMESPACE);
      const tempId = `Q:${deterministicUuid}`;

      result.quarantine.push({
        tempId,
        displayName: line.substring(0, 50), // Use up to 50 chars of the line as a display hint
        source: "census_missing_mrn",
        rawHint: line,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return result;
}

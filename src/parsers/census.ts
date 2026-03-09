import { v5 as uuidv5 } from "uuid";
import { Resident, QuarantineResident } from "../domain/models";

// Use a static namespace UUID for generating deterministic Q-IDs based on raw text
const QUARANTINE_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

export interface ParsedCensus {
  residents: Resident[];
  quarantine: QuarantineResident[];
  unitsFound: string[];
}

/**
 * Parses raw census text and extracts residents.
 * 
 * Logic:
 * - Tracks 'currentUnit' state from lines like "Unit: <Name> Bed Certification:"
 * - Skips lines containing "EMPTY"
 * - Parses resident lines: Room, Name, MRN (in parens), DOB, Status, Payor
 * - Routes failed parses (e.g. missing MRN) to Quarantine
 */
export function parseCensusText(rawText: string): ParsedCensus {
  const lines = rawText.split(/\r?\n/).filter(line => line.trim());
  
  const result: ParsedCensus = {
    residents: [],
    quarantine: [],
    unitsFound: []
  };

  const now = new Date().toISOString();
  let currentUnit = "Unassigned";

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // 1. Check for Unit Header
    // RAW: Unit: Unit 2   Bed Certification: All
    const unitMatch = trimmedLine.match(/^Unit:\s*(.+?)\s+Bed Certification:/i);
    if (unitMatch) {
      currentUnit = unitMatch[1].trim();
      if (!result.unitsFound.includes(currentUnit)) {
        result.unitsFound.push(currentUnit);
      }
      continue;
    }

    // 2. Exclusion Rule: Skip if line contains "EMPTY" (case-insensitive)
    if (trimmedLine.toUpperCase().includes("EMPTY")) {
      continue;
    }

    // 3. Parse Resident Line
    // RAW: 250-A	CARRIGAN, PATRICIA (LON202356)	12/15/1929	Active	MLCB1	STD	Medicare A  	Private  	OCCUPIED
    // Regex breakdown:
    // ^(?<room>\S+)           -> Start with Room (non-whitespace)
    // \s+                     -> Separator
    // (?<name>.+?)            -> Name (lazy match until...)
    // \s*\(                   -> Optional space, open paren
    // (?<mrn>[^)]+)           -> MRN (capture inside parens)
    // \)                      -> Close paren
    // \s+                     -> Separator
    // (?<dob>\d{1,2}\/\d{1,2}\/\d{2,4}) -> DOB (MM/DD/YYYY)
    // \s+                     -> Separator
    // (?<status>\w+)          -> Status (Active)
    // \s+                     -> Separator
    // (?:.+?)                 -> Skip middle columns (MLCB1 STD) - lazy match
    // (?<payor>.+?)           -> Payor (lazy match)
    // \s+                     -> Separator
    // (?:Private|Semiprivate|Ward|Suite) -> Room Type (Anchor)
    // \s+                     -> Separator
    // OCCUPIED                -> Bed Status (Anchor)

    // The provided example is complex to regex perfectly due to variable middle columns.
    // Let's try a slightly more robust approach:
    // We know Room, Name(MRN), DOB, Status are the first few "columns".
    // We know "Private/..." and "OCCUPIED" are at the end.
    // Payor is before Room Type.

    // Regex attempt 1 (Strict anchors):
    const resMatch = trimmedLine.match(
      /^(?<room>\S+)\s+(?<name>.+?)\s*\((?<mrn>[^)]+)\)\s+(?<dob>\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?<status>\w+)\s+(?:.+?)\s+(?<payor>.+?)\s+(?:Private|Semiprivate|Ward|Suite|2 Bed|1 Bed)\s+OCCUPIED$/i
    );

    // Fallback Regex (Simpler, just first few columns):
    // If strict match fails, we try to grab at least the identity info.
    const identityMatch = trimmedLine.match(
      /^(?<room>\S+)\s+(?<name>.+?)\s*\((?<mrn>[^)]+)\)\s+(?<dob>\d{1,2}\/\d{1,2}\/\d{2,4})\s+(?<status>\w+)/
    );

    if (resMatch) {
      const { room, name, mrn, dob, status, payor } = resMatch.groups!;
      
      result.residents.push({
        mrn: mrn.trim(),
        displayName: name.trim(),
        dob: dob.trim(),
        status: status.trim() as any, // "Active"
        currentUnit: currentUnit,
        currentRoom: room.trim(),
        payor: payor.trim(),
        createdAt: now,
        updatedAt: now,
      });
    } else if (identityMatch) {
      // Matched identity but maybe not the tail (Payor/RoomType)
      const { room, name, mrn, dob, status } = identityMatch.groups!;
      
      result.residents.push({
        mrn: mrn.trim(),
        displayName: name.trim(),
        dob: dob.trim(),
        status: status.trim() as any,
        currentUnit: currentUnit,
        currentRoom: room.trim(),
        // Payor missing in fallback
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // 4. Quarantine Routing
      // If it looks like a room line (starts with number-letter or number) but failed MRN parse
      // Example: "250-A  Unknown Person ..." (No parens)
      if (/^\d+(?:-[A-Z0-9]+)?\s+/.test(trimmedLine)) {
        const deterministicUuid = uuidv5(trimmedLine, QUARANTINE_NAMESPACE);
        const tempId = `Q:${deterministicUuid}`;
        
        // Try to extract room at least
        const roomMatch = trimmedLine.match(/^(\S+)/);
        const roomSnapshot = roomMatch ? roomMatch[1] : undefined;

        result.quarantine.push({
          tempId,
          displayName: trimmedLine.substring(0, 50),
          source: "census_missing_mrn",
          rawHint: trimmedLine,
          unitSnapshot: currentUnit,
          roomSnapshot: roomSnapshot,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  return result;
}

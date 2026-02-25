import { UnifiedDB, ResidentRef, FacilityStore } from "../domain/models";

const DB_KEY_MAIN = "UNIFIED_DB_MAIN";
const DB_KEY_PREV = "UNIFIED_DB_PREV";
const DB_KEY_TMP = "UNIFIED_DB_TMP";

// Standard localStorage limit is generally around 5MB (5,242,880 characters/bytes)
const MAX_STORAGE_CHARS = 5 * 1024 * 1024;
const WARN_THRESHOLD = 0.60;
const BLOCK_THRESHOLD = 0.85;

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Enforces the Commit Gate Rule:
 * A save MUST be blocked if any record references a resident that is not a known MRN or a valid Quarantine ID.
 */
function validateCommitGate(db: UnifiedDB): void {
  for (const facilityId of Object.keys(db.data.facilityData)) {
    const store = db.data.facilityData[facilityId];
    
    // Gather valid identities
    const validMrns = new Set(Object.keys(store.residents));
    const validQIds = new Set(
      Object.keys(store.quarantine).filter(id => id.startsWith("Q:"))
    );

    const checkRef = (ref: ResidentRef, context: string) => {
      if (ref.kind === "mrn" && !validMrns.has(ref.id)) {
        throw new StorageError(`Commit Gate Failed: Unknown MRN '${ref.id}' referenced in ${context}`);
      }
      if (ref.kind === "quarantine" && !validQIds.has(ref.id)) {
        throw new StorageError(`Commit Gate Failed: Unknown or invalid Q-ID '${ref.id}' referenced in ${context}`);
      }
    };

    // Validate all clinical domains
    Object.values(store.abts).forEach(r => checkRef(r.residentRef, `ABTCourse (${r.id})`));
    Object.values(store.infections).forEach(r => checkRef(r.residentRef, `IPEvent (${r.id})`));
    Object.values(store.vaxEvents).forEach(r => checkRef(r.residentRef, `VaxEvent (${r.id})`));
    Object.values(store.notes).forEach(r => checkRef(r.residentRef, `ResidentNote (${r.id})`));
    Object.values(store.outbreakCases).forEach(r => checkRef(r.residentRef, `OutbreakCase (${r.id})`));
    Object.values(store.outbreakExposures).forEach(r => checkRef(r.residentRef, `OutbreakExposure (${r.id})`));
  }
}

/**
 * Creates an empty, valid UnifiedDB structure.
 */
export function createEmptyDB(): UnifiedDB {
  const now = new Date().toISOString();
  const defaultFacilityId = "fac-default";
  
  const emptyStore: FacilityStore = {
    residents: {},
    quarantine: {},
    abts: {},
    infections: {},
    vaxEvents: {},
    notes: {},
    staff: {},
    staffVaxEvents: {},
    fitTestEvents: {},
    auditSessions: {},
    outbreaks: {},
    outbreakCases: {},
    outbreakExposures: {},
    outbreakDailyStatuses: {},
    exportProfiles: {},
    surveyPackets: {},
  };

  return {
    schemaName: "UNIFIED_DB",
    schemaVersion: "UNIFIED_DB_V2",
    createdAt: now,
    updatedAt: now,
    integrity: {},
    data: {
      facilities: {
        byId: {
          [defaultFacilityId]: {
            id: defaultFacilityId,
            name: "Default Facility",
            units: [],
            createdAt: now,
            updatedAt: now,
          },
        },
        activeFacilityId: defaultFacilityId,
      },
      facilityData: {
        [defaultFacilityId]: emptyStore,
      },
    },
  };
}

/**
 * Loads the database from localStorage, falling back to an empty DB if none exists or schema mismatches.
 */
export function loadDB(): UnifiedDB {
  try {
    const raw = localStorage.getItem(DB_KEY_MAIN);
    if (!raw) return createEmptyDB();
    
    const db = JSON.parse(raw) as UnifiedDB;
    if (db.schemaVersion !== "UNIFIED_DB_V2") {
      console.warn("Schema mismatch, returning empty DB. (Migration needed in production)");
      return createEmptyDB();
    }
    return db;
  } catch (e) {
    console.error("Failed to load DB from localStorage:", e);
    return createEmptyDB();
  }
}

/**
 * Implements the atomic-ish save pipeline:
 * Validate -> Write TMP -> Verify -> Snapshot PREV -> Commit MAIN
 */
export function saveDB(db: UnifiedDB): void {
  // 1. Validate (Commit Gate)
  validateCommitGate(db);

  // Update timestamp
  db.updatedAt = new Date().toISOString();

  const serialized = JSON.stringify(db);
  const size = serialized.length;

  // Storage Size Monitor
  const usageRatio = size / MAX_STORAGE_CHARS;
  if (usageRatio >= BLOCK_THRESHOLD) {
    throw new StorageError(
      `Storage limit exceeded. Database is at ${(usageRatio * 100).toFixed(1)}% capacity (Block threshold is ${BLOCK_THRESHOLD * 100}%). Save aborted.`
    );
  }
  if (usageRatio >= WARN_THRESHOLD) {
    console.warn(`Storage warning: Database is at ${(usageRatio * 100).toFixed(1)}% capacity.`);
  }

  // 2. Write TMP
  try {
    localStorage.setItem(DB_KEY_TMP, serialized);
  } catch (e) {
    throw new StorageError("Failed to write to TMP storage. LocalStorage quota may be exceeded.");
  }

  // 3. Verify
  const verifyStr = localStorage.getItem(DB_KEY_TMP);
  if (verifyStr !== serialized) {
    throw new StorageError("Verification failed: TMP data mismatch after write.");
  }

  // 4. Snapshot PREV
  const currentMain = localStorage.getItem(DB_KEY_MAIN);
  if (currentMain) {
    try {
      localStorage.setItem(DB_KEY_PREV, currentMain);
    } catch (e) {
      console.warn("Failed to snapshot PREV. Proceeding to commit MAIN anyway.", e);
    }
  }

  // 5. Commit MAIN
  db.integrity = {
    lastGoodWriteAt: db.updatedAt,
    lastGoodBytes: size,
  };
  
  // Re-serialize to include the updated integrity block
  const finalSerialized = JSON.stringify(db);
  
  try {
    localStorage.setItem(DB_KEY_MAIN, finalSerialized);
  } catch (e) {
    // If MAIN fails, we still have PREV intact.
    throw new StorageError("Failed to commit to MAIN storage.");
  }

  // Cleanup TMP
  localStorage.removeItem(DB_KEY_TMP);
}

/**
 * Helper to restore from PREV snapshot if MAIN is corrupted.
 */
export function restoreFromPrev(): boolean {
  try {
    const prev = localStorage.getItem(DB_KEY_PREV);
    if (!prev) return false;
    
    localStorage.setItem(DB_KEY_MAIN, prev);
    return true;
  } catch (e) {
    console.error("Failed to restore from PREV:", e);
    return false;
  }
}

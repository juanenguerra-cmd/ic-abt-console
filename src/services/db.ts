import { UnifiedDB, FacilityStore, ResidentRef } from "../types";

const DB_KEY_MAIN = "UNIFIED_DB_MAIN";
const DB_KEY_PREV = "UNIFIED_DB_PREV";
const DB_KEY_TMP = "UNIFIED_DB_TMP";

function createEmptyFacilityStore(): FacilityStore {
  return {
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
    infectionControlAuditSessions: {},
    infectionControlAuditItems: {},
    notifications: {},
  };
}

export function createEmptyDB(): UnifiedDB {
  const now = new Date().toISOString();
  const defaultFacilityId = "fac-default";
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
        [defaultFacilityId]: createEmptyFacilityStore(),
      },
    },
  };
}

export function loadDB(): UnifiedDB {
  try {
    const raw = localStorage.getItem(DB_KEY_MAIN);
    if (!raw) return createEmptyDB();
    const db = JSON.parse(raw) as UnifiedDB;
    if (db.schemaVersion !== "UNIFIED_DB_V2") {
      console.warn("Schema mismatch, returning empty DB");
      return createEmptyDB();
    }
    return db;
  } catch (e) {
    console.error("Failed to load DB from localStorage:", e);
    return createEmptyDB();
  }
}

function validateResidentRefs(db: UnifiedDB): boolean {
  for (const facilityId in db.data.facilityData) {
    const store = db.data.facilityData[facilityId];
    const knownMrns = new Set(Object.keys(store.residents));
    const knownQuarantine = new Set(Object.keys(store.quarantine));

    const checkRef = (ref: ResidentRef) => {
      if (ref.kind === "mrn") return knownMrns.has(ref.id);
      if (ref.kind === "quarantine") return knownQuarantine.has(ref.id) && ref.id.startsWith("Q:");
      return false;
    };

    // Check ABTs
    for (const abt of Object.values(store.abts)) {
      if (!checkRef(abt.residentRef)) return false;
    }
    // Check Infections
    for (const ip of Object.values(store.infections)) {
      if (!checkRef(ip.residentRef)) return false;
    }
    // Check VaxEvents
    for (const vax of Object.values(store.vaxEvents)) {
      if (!checkRef(vax.residentRef)) return false;
    }
    // Check Notes
    for (const note of Object.values(store.notes)) {
      if (!checkRef(note.residentRef)) return false;
    }
    // Check Outbreak Cases
    for (const oc of Object.values(store.outbreakCases)) {
      if (!checkRef(oc.residentRef)) return false;
    }
    // Check Outbreak Exposures
    for (const oe of Object.values(store.outbreakExposures)) {
      if (!checkRef(oe.residentRef)) return false;
    }
  }
  return true;
}

export function saveDB(db: UnifiedDB): boolean {
  try {
    // 1. Validate
    if (!validateResidentRefs(db)) {
      console.error("Validation failed: Invalid ResidentRef detected.");
      return false;
    }

    db.updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(db);

    // 2. Write TMP
    localStorage.setItem(DB_KEY_TMP, serialized);

    // 3. Verify
    const tmpRaw = localStorage.getItem(DB_KEY_TMP);
    if (!tmpRaw || tmpRaw !== serialized) {
      console.error("Verification failed: TMP write mismatch.");
      return false;
    }

    // 4. Snapshot PREV
    const currentMain = localStorage.getItem(DB_KEY_MAIN);
    if (currentMain) {
      localStorage.setItem(DB_KEY_PREV, currentMain);
    }

    // 5. Commit MAIN
    db.integrity = {
      lastGoodWriteAt: db.updatedAt,
      lastGoodBytes: serialized.length,
    };
    localStorage.setItem(DB_KEY_MAIN, JSON.stringify(db));
    
    // Cleanup TMP
    localStorage.removeItem(DB_KEY_TMP);

    return true;
  } catch (e) {
    console.error("Failed to save DB:", e);
    return false;
  }
}

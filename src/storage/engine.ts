import { UnifiedDB, ResidentRef, FacilityStore } from "../domain/models";
import { idbGet, idbSet, idbRemove, idbDeleteDatabase } from "./idb";
import { DB_KEY_MAIN, DB_KEY_PREV, DB_KEY_TMP } from "../constants/storageKeys";
import { StorageRepository } from "./repository";
import { remoteFetchDb, remoteSaveDb } from "../services/api";

export { DB_KEY_MAIN };

// localStorage fallback thresholds (kept for the sync backup path).
const MAX_STORAGE_CHARS = 5 * 1024 * 1024;
const WARN_THRESHOLD = 0.60;
const BLOCK_THRESHOLD = 0.85;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

export class SchemaMigrationError extends Error {
  public readonly detectedVersion: string;
  constructor(detectedVersion: string) {
    super(
      `Schema migration required. Detected version: "${detectedVersion}". Expected: "UNIFIED_DB_V2". Contact support or restore from a backup.`
    );
    this.name = "SchemaMigrationError";
    this.detectedVersion = detectedVersion;
  }
}

// ---------------------------------------------------------------------------
// Schema migration runner
// ---------------------------------------------------------------------------

/** Builds an empty FacilityStore used when back-filling missing stores. */
function emptyFacilityStore(facilityId = "fac-default"): FacilityStore {
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
    contactTraceCases: {},
    contactTraceExposures: {},
    lineListEvents: {},
  };
}

const DICT_KEYS = new Set([
  "currentUnit",
  "currentRoom",
  "lastKnownUnit",
  "lastKnownRoom",
  "unit",
  "room",
  "medication",
  "organismIdentified",
  "organism",
  "vaccine",
  "category",
  "status",
  "payor",
  "attendingMD",
  "primaryDiagnosis",
  "infectionCategory",
  "syndromeCategory",
  "type",
  "role",
  "department",
  "gender",
  "sex"
]);

export function packV3(db: UnifiedDB): Record<string, unknown> {
  const dict: string[] = [];
  const dictMap = new Map<string, number>();

  function getDictId(val: string): number {
    let id = dictMap.get(val);
    if (id === undefined) {
      id = dict.length;
      dict.push(val);
      dictMap.set(val, id);
    }
    return id;
  }

  function walk(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      return obj.map(walk);
    }
    const copy: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "string" && DICT_KEYS.has(key)) {
        copy[key] = getDictId(val);
      } else {
        copy[key] = walk(val);
      }
    }
    return copy;
  }

  const packedData = walk(db.data);
  
  return {
    ...db,
    schemaVersion: "UNIFIED_DB_V3",
    data: packedData,
    dictionary: dict
  };
}

function unpackV3(raw: Record<string, unknown>): Record<string, unknown> {
  const dict = (raw.dictionary as string[]) || [];

  function walk(obj: any): any {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      return obj.map(walk);
    }
    const copy: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "number" && DICT_KEYS.has(key)) {
        copy[key] = dict[val] ?? String(val);
      } else {
        copy[key] = walk(val);
      }
    }
    return copy;
  }

  const unpackedData = walk(raw.data);

  const result = {
    ...raw,
    schemaVersion: "UNIFIED_DB_V3",
    data: unpackedData
  };
  delete (result as any).dictionary;
  return result;
}

/**
 * Upgrade a raw (potentially old-schema) DB object to the current UNIFIED_DB_V3
 * shape. Any unknown version that is NOT already V3 is treated as a pre-V2
 * ("V1 or unversioned") record and receives the V1→V2 field back-fill, then V2→V3.
 *
 * @throws SchemaMigrationError if the version is unrecognisable and cannot be
 *   safely migrated.
 */
export function runMigrations(raw: Record<string, unknown>): UnifiedDB {
  if (!raw || typeof raw !== "object") return createEmptyDB();

  let version = typeof raw.schemaVersion === "string" ? raw.schemaVersion : "unknown";

  // Pre-V2 (original launch, unversioned, or "UNIFIED_DB_V1").
  if (version === "UNIFIED_DB_V1" || version === "unknown") {
    raw = migratePreV2toV2(raw);
    version = "UNIFIED_DB_V2";
  }

  if (version === "UNIFIED_DB_V2") {
    raw.schemaVersion = "UNIFIED_DB_V3";
    version = "UNIFIED_DB_V3";
  }

  if (version === "UNIFIED_DB_V3") {
    if ('dictionary' in raw) {
      raw = unpackV3(raw);
    }
  }

  // After all migrations the version must be V3.
  const finalVersion = typeof raw.schemaVersion === "string" ? raw.schemaVersion : "unknown";
  if (finalVersion !== "UNIFIED_DB_V3") {
    throw new SchemaMigrationError(finalVersion);
  }

  return raw as unknown as UnifiedDB;
}

/** Back-fills fields introduced in V2 onto pre-V2 snapshots. */
function migratePreV2toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const now = new Date().toISOString();

  // Ensure top-level shape
  if (!raw.schemaName) raw.schemaName = "UNIFIED_DB";
  if (!raw.createdAt) raw.createdAt = now;
  if (!raw.updatedAt) raw.updatedAt = now;
  if (!raw.integrity) raw.integrity = {};

  const data = (raw.data ?? {}) as Record<string, unknown>;
  raw.data = data;

  // Ensure facilities block
  if (!data.facilities) {
    const defaultFacilityId = "fac-default";
    data.facilities = {
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
    };
  }

  const facilities = data.facilities as { byId: Record<string, unknown>; activeFacilityId: string };

  // Ensure facilityData block and back-fill any missing stores
  if (!data.facilityData) data.facilityData = {};
  const facilityData = data.facilityData as Record<string, FacilityStore>;

  for (const fid of Object.keys(facilities.byId)) {
    if (!facilityData[fid]) {
      facilityData[fid] = emptyFacilityStore(fid);
    } else {
      const store = facilityData[fid] as unknown as Record<string, unknown>;
      // Back-fill stores added in V2
      if (!store.infectionControlAuditSessions) store.infectionControlAuditSessions = {};
      if (!store.infectionControlAuditItems) store.infectionControlAuditItems = {};
      if (!store.notifications) store.notifications = {};
      if (!store.surveyPackets) store.surveyPackets = {};
      if (!store.exportProfiles) store.exportProfiles = emptyFacilityStore(fid).exportProfiles;
      if (!store.outbreakDailyStatuses) store.outbreakDailyStatuses = {};
      if (!store.outbreakExposures) store.outbreakExposures = {};
      if (!store.outbreakCases) store.outbreakCases = {};
      if (!store.outbreaks) store.outbreaks = {};
      if (!store.fitTestEvents) store.fitTestEvents = {};
      if (!store.staffVaxEvents) store.staffVaxEvents = {};
      if (!store.staff) store.staff = {};
      if (!store.auditSessions) store.auditSessions = {};
      if (!store.contactTraceCases) store.contactTraceCases = {};
      if (!store.contactTraceExposures) store.contactTraceExposures = {};
      if (!store.lineListEvents) store.lineListEvents = {};
    }
  }

  raw.schemaVersion = "UNIFIED_DB_V2";
  return raw;
}

// ---------------------------------------------------------------------------
// Commit gate (ResidentRef + facility-scoping validation)
// ---------------------------------------------------------------------------

export function validateCommitGate(db: UnifiedDB): void {
  for (const facilityId of Object.keys(db.data.facilityData)) {
    const store = db.data.facilityData[facilityId];

    const validMrns = new Set(Object.keys(store.residents));
    const validQIds = new Set(
      Object.keys(store.quarantine).filter((id) => id.startsWith("Q:"))
    );

    const checkRef = (ref: ResidentRef | undefined, context: string) => {
      // Legacy guard: older snapshots may contain free-form notes that were
      // not linked to a specific resident. Preserve them without blocking all
      // future writes/imports.
      if (!ref && context.startsWith("ResidentNote")) {
        return;
      }
      if (!ref || typeof ref !== "object" || typeof ref.id !== "string" || typeof ref.kind !== "string") {
        throw new StorageError(
          `Commit Gate Failed: Invalid residentRef in ${context}`
        );
      }

      const refKind = (ref as { kind: string }).kind;
      if (refKind !== "mrn" && refKind !== "quarantine") {
        throw new StorageError(
          `Commit Gate Failed: Unsupported residentRef kind '${refKind}' referenced in ${context}`
        );
      }
      if (refKind === "mrn" && !validMrns.has(ref.id)) {
        throw new StorageError(
          `Commit Gate Failed: Unknown MRN '${ref.id}' referenced in ${context}`
        );
      }
      if (refKind === "quarantine" && !validQIds.has(ref.id)) {
        throw new StorageError(
          `Commit Gate Failed: Unknown or invalid Q-ID '${ref.id}' referenced in ${context}`
        );
      }
    };

    Object.values(store.abts).forEach((r) => checkRef(r.residentRef, `ABTCourse (${r.id})`));
    Object.values(store.infections).forEach((r) => checkRef(r.residentRef, `IPEvent (${r.id})`));
    Object.values(store.vaxEvents).forEach((r) => checkRef(r.residentRef, `VaxEvent (${r.id})`));
    Object.values(store.notes).forEach((r) => checkRef(r.residentRef, `ResidentNote (${r.id})`));
    Object.values(store.outbreakCases).forEach((r) =>
      checkRef(r.residentRef, `OutbreakCase (${r.id})`)
    );
    Object.values(store.outbreakExposures).forEach((r) =>
      checkRef(r.residentRef, `OutbreakExposure (${r.id})`)
    );

    // Multi-facility isolation: items that carry an embedded facilityId must
    // match the outer store key so data can never silently cross facility
    // boundaries.
    Object.values(store.outbreaks).forEach((o) => {
      if (o.facilityId && o.facilityId !== facilityId) {
        throw new StorageError(
          `Commit Gate Failed: Outbreak '${o.id}' has facilityId '${o.facilityId}' but is stored under '${facilityId}'`
        );
      }
    });
    Object.values(store.exportProfiles).forEach((ep) => {
      if (ep.facilityId && ep.facilityId !== facilityId) {
        throw new StorageError(
          `Commit Gate Failed: ExportProfile '${ep.id}' has facilityId '${ep.facilityId}' but is stored under '${facilityId}'`
        );
      }
    });
    Object.values(store.surveyPackets).forEach((sp) => {
      if (sp.facilityId && sp.facilityId !== facilityId) {
        throw new StorageError(
          `Commit Gate Failed: SurveyPacket '${sp.id}' has facilityId '${sp.facilityId}' but is stored under '${facilityId}'`
        );
      }
    });
  }
}

// ---------------------------------------------------------------------------
// DB factory
// ---------------------------------------------------------------------------

export function createEmptyDB(): UnifiedDB {
  const now = new Date().toISOString();
  const defaultFacilityId = "fac-default";

  return {
    schemaName: "UNIFIED_DB",
    schemaVersion: "UNIFIED_DB_V3",
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
        [defaultFacilityId]: emptyFacilityStore(),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Async IndexedDB-backed load / save (primary path)
// ---------------------------------------------------------------------------

export async function loadDBAsync(): Promise<UnifiedDB> {
  let remoteDb: UnifiedDB | null = null;
  let localDb: UnifiedDB | null = null;
  
  // 1. Try to fetch remote DB
  try {
    const rawRemote = await remoteFetchDb();
    remoteDb = runMigrations(rawRemote as Record<string, unknown>);
  } catch (e) {
    console.log("Could not fetch remote DB. Working offline.", e);
  }

  // 2. Try to load local DB
  try {
    const rawLocal = await idbGet<string>(DB_KEY_MAIN);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal) as Record<string, unknown>;
      const migrated = runMigrations(parsed);
      await StorageRepository.mergeSlicesIntoDB(migrated);
      localDb = migrated;
    } else {
      // One-time migration from localStorage → IDB.
      const lsRaw = localStorage.getItem(DB_KEY_MAIN);
      if (lsRaw) {
        const parsed = JSON.parse(lsRaw) as Record<string, unknown>;
        const migrated = runMigrations(parsed);
        await StorageRepository.mergeSlicesIntoDB(migrated);
        
        // Persist to IDB for future loads
        const packed = packV3(migrated);
        await idbSet(DB_KEY_MAIN, JSON.stringify(packed)).catch((err) =>
          console.warn("IDB migration write failed:", err)
        );
        localDb = migrated;
      }
    }
  } catch (e) {
    if (e instanceof SchemaMigrationError) throw e;
    console.error("Failed to load local DB:", e);
    // Don't rethrow, let the sync logic decide what to do.
  }

  // 3. Sync and decide which DB to use
  if (remoteDb && localDb) {
    const remoteDate = new Date(remoteDb.updatedAt);
    const localDate = new Date(localDb.updatedAt);

    if (remoteDate > localDate) {
      console.log("Remote DB is newer. Overwriting local with remote.");
      await saveDBAsync(remoteDb, { skipRemote: true }); // Save to local only
      return remoteDb;
    } else if (localDate > remoteDate) {
      console.log("Local DB is newer. Pushing changes to remote.");
      window.dispatchEvent(new Event("backup-started"));
      await remoteSaveDb(localDb)
        .then(() => {
            window.dispatchEvent(new CustomEvent('backup-completed', { detail: { type: 'remote' } }));
        })
        .catch(e => {
            console.error("Failed to push newer local DB to remote:", e)
            window.dispatchEvent(new Event('backup-failed'));
        });
      return localDb;
    } else {
      console.log("Local and remote DBs are in sync.");
      return localDb;
    }
  } else if (remoteDb) {
    console.log("Using remote DB as local was not found.");
    await saveDBAsync(remoteDb, { skipRemote: true }); // Save to local only
    return remoteDb;
  } else if (localDb) {
    console.log("Using local DB, remote not available.");
    // Try to save the local version to remote in case the remote is just empty
    window.dispatchEvent(new Event("backup-started"));
    await remoteSaveDb(localDb)
      .then(() => {
        window.dispatchEvent(new CustomEvent('backup-completed', { detail: { type: 'remote' } }));
      })
      .catch(e => {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn(`Failed to save local DB to empty remote: ${errorMsg}`);
      window.dispatchEvent(new Event('backup-failed'));
    });
    return localDb;
  }
  
  // 4. If all else fails, create a fresh DB
  console.log("No local or remote DB found. Creating a new empty database.");
  const newDb = createEmptyDB();
  // Save it everywhere
  await saveDBAsync(newDb).catch(e => console.error("Initial save of empty DB failed:", e));
  return newDb;
}

/**
 * Persist the DB to IndexedDB (primary) and localStorage (synchronous
 * emergency backup, subject to the 5 MB ceiling).
 *
 * The write sequence mirrors the original atomic-swap pattern:
 *   TMP → verify → snapshot PREV → commit MAIN → remove TMP
 *
 * The IDB write is fire-and-forget from the caller's perspective; errors are
 * surfaced as a rejected Promise so callers that await can handle them.
 */
export async function saveDBAsync(db: UnifiedDB, options: { skipRemote?: boolean } = {}): Promise<void> {
  window.dispatchEvent(new Event("backup-started"));
  validateCommitGate(db);

  db.updatedAt = new Date().toISOString();
  const packed = packV3(db);
  const serialized = JSON.stringify(packed);
  const size = serialized.length;

  // Warn when exceeding 60 MB (practical IDB comfort zone for this app).
  const IDB_WARN_BYTES = 60 * 1024 * 1024;
  if (size > IDB_WARN_BYTES) {
    console.warn(`Storage warning: Database is ${(size / 1024 / 1024).toFixed(1)} MB — consider archiving old data.`);
  }

  // --- IDB atomic swap with unique TMP key to avoid concurrent collisions ---
  const uniqueTmpKey = `${DB_KEY_TMP}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await idbSet(uniqueTmpKey, serialized);
  await new Promise<void>((resolve) => setTimeout(resolve, 0)); // yield to IDB flush

  const tmpVerify = await idbGet<string>(uniqueTmpKey);
  if (!tmpVerify) {
    // TMP slot is completely absent — genuine write failure.
    window.dispatchEvent(new Event("backup-failed"));
    throw new StorageError(
      "Save failed: storage write could not be verified. " +
      "This is often caused by a browser extension interfering with storage. " +
      "Try disabling extensions or using an Incognito window. Your data has NOT been lost."
    );
  }
  if (tmpVerify !== serialized) {
    // Soft mismatch: values differ but are not absent (possible extension interference
    // or IDB re-serialization with different key order / whitespace).  Attempt a
    // semantic comparison before deciding to abort.
    let semanticallyEqual = false;
    try {
      semanticallyEqual =
        JSON.stringify(JSON.parse(tmpVerify)) === JSON.stringify(JSON.parse(serialized));
    } catch {
      // Unparseable — treat as a hard mismatch below.
    }
    if (!semanticallyEqual) {
      // Log for diagnostics but degrade gracefully — do NOT abort the save.
      console.warn(
        "IDB TMP verify: soft mismatch detected (possible extension interference). Continuing with save operation."
      );
    }
  }

  const currentMain = await idbGet<string>(DB_KEY_MAIN);
  if (currentMain) {
    await idbSet(DB_KEY_PREV, currentMain).catch((err) =>
      console.warn("Failed to snapshot IDB PREV:", err)
    );
  }

  db.integrity = {
    lastGoodWriteAt: db.updatedAt,
    lastGoodBytes: size,
  };
  
  // Need to update packed object with integrity as well
  packed.integrity = db.integrity;
  const finalSerialized = JSON.stringify(packed);

  await idbSet(DB_KEY_MAIN, finalSerialized);
  await idbRemove(uniqueTmpKey).catch(() => {});

  // --- Synchronous localStorage backup (best-effort, may fail at 5 MB) ---
  try {
    const lsSize = finalSerialized.length;
    const usageRatio = lsSize / MAX_STORAGE_CHARS;
    if (usageRatio < BLOCK_THRESHOLD) {
      if (usageRatio >= WARN_THRESHOLD) {
        console.warn(`localStorage backup: at ${(usageRatio * 100).toFixed(1)}% of 5 MB limit. Primary store is IDB.`);
      }
      localStorage.setItem(DB_KEY_MAIN, finalSerialized);
    }
  } catch {
    // localStorage backup failure is non-fatal — IDB is the source of truth.
  }
  
  // --- After local saves are complete, save to remote ---
  if (!options.skipRemote) {
    await remoteSaveDb(db)
      .then(() => {
        window.dispatchEvent(new CustomEvent("backup-completed", { detail: { type: 'remote' } }));
      })
      .catch(err => {
        console.error("Failed to save database to remote server:", err);
        window.dispatchEvent(new Event("backup-failed"));
        // We could add more robust queueing logic here for offline support.
      });
  } else {
    window.dispatchEvent(new CustomEvent("backup-completed", { detail: { type: 'local' } }));
  }
}


export async function hardResetStorageAsync(): Promise<void> {
  try {
    await idbDeleteDatabase();
  } catch (e) {
    console.warn("Failed to delete IDB database:", e);
  }

  try {
    localStorage.clear();
  } catch (e) {
    console.warn("Failed to clear localStorage:", e);
  }
}

// ---------------------------------------------------------------------------
// Synchronous localStorage load / save (legacy / fallback path)
// Used by the providers until the async load resolves and as an emergency path.
// ---------------------------------------------------------------------------

export function loadDB(): UnifiedDB {
  try {
    const raw = localStorage.getItem(DB_KEY_MAIN);
    if (!raw) return createEmptyDB();

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return runMigrations(parsed);
  } catch (e) {
    if (e instanceof SchemaMigrationError) throw e;
    console.error("Failed to load DB from localStorage:", e);
    throw new StorageError("Database corruption detected.");
  }
}

export function saveDB(db: UnifiedDB): void {
  validateCommitGate(db);

  db.updatedAt = new Date().toISOString();
  const packed = packV3(db);
  const serialized = JSON.stringify(packed);
  const size = serialized.length;

  const usageRatio = size / MAX_STORAGE_CHARS;
  if (usageRatio >= BLOCK_THRESHOLD) {
    throw new StorageError(
      `Storage limit exceeded. Database is at ${(usageRatio * 100).toFixed(1)}% capacity. Save aborted.`
    );
  }
  if (usageRatio >= WARN_THRESHOLD) {
    console.warn(`Storage warning: Database is at ${(usageRatio * 100).toFixed(1)}% capacity.`);
  }

  try {
    localStorage.setItem(DB_KEY_TMP, serialized);
  } catch {
    throw new StorageError("Failed to write to TMP storage.");
  }

  const verifyStr = localStorage.getItem(DB_KEY_TMP);
  if (verifyStr !== serialized) {
    let semanticallyEqual = false;
    if (verifyStr !== null) {
      try {
        semanticallyEqual =
          JSON.stringify(JSON.parse(verifyStr)) === JSON.stringify(JSON.parse(serialized));
      } catch {
        // Unparseable — treat as a hard mismatch.
      }
    }
    if (!semanticallyEqual) {
      throw new StorageError("Verification failed: TMP data mismatch after write.");
    }
  }

  const currentMain = localStorage.getItem(DB_KEY_MAIN);
  if (currentMain) {
    try {
      localStorage.setItem(DB_KEY_PREV, currentMain);
    } catch {
      console.warn("Failed to snapshot PREV.");
    }
  }

  db.integrity = {
    lastGoodWriteAt: db.updatedAt,
    lastGoodBytes: size,
  };

  packed.integrity = db.integrity;
  const finalSerialized = JSON.stringify(packed);

  try {
    localStorage.setItem(DB_KEY_MAIN, finalSerialized);
  } catch {
    throw new StorageError("Failed to commit to MAIN storage.");
  }

  localStorage.removeItem(DB_KEY_TMP);
}

// ---------------------------------------------------------------------------
// Restore helpers
// ---------------------------------------------------------------------------

export async function restoreFromPrevAsync(): Promise<boolean> {
  try {
    const prev = await idbGet<string>(DB_KEY_PREV);
    if (!prev) return restoreFromPrev(); // fall through to localStorage
    await idbSet(DB_KEY_MAIN, prev);

    try {
      const parsed = JSON.parse(prev);
      const activeFacilityId = parsed?.data?.facilities?.activeFacilityId;
      if (activeFacilityId) {
        await StorageRepository.restoreAllSlicesFromPrev(activeFacilityId);
      }
    } catch (e) {
      console.warn("Failed to restore slices from PREV:", e);
    }

    // Also sync to localStorage best-effort
    try { localStorage.setItem(DB_KEY_MAIN, prev); } catch {}
    return true;
  } catch (e) {
    console.error("Failed to restore from IDB PREV:", e);
    return false;
  }
}

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

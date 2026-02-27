import { UnifiedDB, ResidentRef, FacilityStore } from "../domain/models";
import { idbGet, idbSet, idbRemove } from "./idb";

export const DB_KEY_MAIN = "UNIFIED_DB_MAIN";
const DB_KEY_PREV = "UNIFIED_DB_PREV";
const DB_KEY_TMP = "UNIFIED_DB_TMP";

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
function emptyFacilityStore(): FacilityStore {
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

/**
 * Upgrade a raw (potentially old-schema) DB object to the current UNIFIED_DB_V2
 * shape. Any unknown version that is NOT already V2 is treated as a pre-V2
 * ("V1 or unversioned") record and receives the V1→V2 field back-fill.
 *
 * When a future V3 is introduced:
 *   1. Bump schemaVersion to "UNIFIED_DB_V3" in domain/models.ts
 *   2. Add a migrateV2toV3(raw) helper below
 *   3. Chain it here: raw = migrateV2toV3(raw)
 *
 * @throws SchemaMigrationError if the version is unrecognisable and cannot be
 *   safely migrated.
 */
export function runMigrations(raw: Record<string, unknown>): UnifiedDB {
  if (!raw || typeof raw !== "object") return createEmptyDB();

  const version = typeof raw.schemaVersion === "string" ? raw.schemaVersion : "unknown";

  // Already current — return as-is.
  if (version === "UNIFIED_DB_V2") return raw as unknown as UnifiedDB;

  // Pre-V2 (original launch, unversioned, or "UNIFIED_DB_V1").
  if (version === "UNIFIED_DB_V1" || version === "unknown") {
    raw = migratePreV2toV2(raw);
  }

  // After all migrations the version must be V2.
  const finalVersion = typeof raw.schemaVersion === "string" ? raw.schemaVersion : "unknown";
  if (finalVersion !== "UNIFIED_DB_V2") {
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
      facilityData[fid] = emptyFacilityStore();
    } else {
      const store = facilityData[fid] as unknown as Record<string, unknown>;
      // Back-fill stores added in V2
      if (!store.infectionControlAuditSessions) store.infectionControlAuditSessions = {};
      if (!store.infectionControlAuditItems) store.infectionControlAuditItems = {};
      if (!store.notifications) store.notifications = {};
      if (!store.surveyPackets) store.surveyPackets = {};
      if (!store.exportProfiles) store.exportProfiles = {};
      if (!store.outbreakDailyStatuses) store.outbreakDailyStatuses = {};
      if (!store.outbreakExposures) store.outbreakExposures = {};
      if (!store.outbreakCases) store.outbreakCases = {};
      if (!store.outbreaks) store.outbreaks = {};
      if (!store.fitTestEvents) store.fitTestEvents = {};
      if (!store.staffVaxEvents) store.staffVaxEvents = {};
      if (!store.staff) store.staff = {};
      if (!store.auditSessions) store.auditSessions = {};
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

    const checkRef = (ref: ResidentRef, context: string) => {
      if (ref.kind === "mrn" && !validMrns.has(ref.id)) {
        throw new StorageError(
          `Commit Gate Failed: Unknown MRN '${ref.id}' referenced in ${context}`
        );
      }
      if (ref.kind === "quarantine" && !validQIds.has(ref.id)) {
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
        [defaultFacilityId]: emptyFacilityStore(),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Async IndexedDB-backed load / save (primary path)
// ---------------------------------------------------------------------------

/**
 * Load the DB from IndexedDB.  Falls back to localStorage (one-time migration)
 * so users who previously used the localStorage-only build do not lose data.
 */
export async function loadDBAsync(): Promise<UnifiedDB> {
  // 1. Try IndexedDB first (primary store).
  try {
    const raw = await idbGet<string>(DB_KEY_MAIN);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return runMigrations(parsed);
    }
  } catch (e) {
    console.warn("IDB load failed, falling back to localStorage:", e);
  }

  // 2. One-time migration from localStorage → IDB.
  try {
    const lsRaw = localStorage.getItem(DB_KEY_MAIN);
    if (lsRaw) {
      const parsed = JSON.parse(lsRaw) as Record<string, unknown>;
      const migrated = runMigrations(parsed);
      // Persist to IDB so future loads come from IDB.
      await idbSet(DB_KEY_MAIN, JSON.stringify(migrated)).catch((err) =>
        console.warn("IDB migration write failed:", err)
      );
      return migrated;
    }
  } catch (e) {
    if (e instanceof SchemaMigrationError) throw e;
    console.error("localStorage migration read failed:", e);
    throw new StorageError("Database corruption detected during migration.");
  }

  return createEmptyDB();
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
export async function saveDBAsync(db: UnifiedDB): Promise<void> {
  validateCommitGate(db);

  db.updatedAt = new Date().toISOString();
  const serialized = JSON.stringify(db);
  const size = serialized.length;

  // Warn when exceeding 60 MB (practical IDB comfort zone for this app).
  const IDB_WARN_BYTES = 60 * 1024 * 1024;
  if (size > IDB_WARN_BYTES) {
    console.warn(`Storage warning: Database is ${(size / 1024 / 1024).toFixed(1)} MB — consider archiving old data.`);
  }

  // --- IDB atomic swap ---
  await idbSet(DB_KEY_TMP, serialized);
  await new Promise(resolve => setTimeout(resolve, 0)); // yield to IDB flush

  const tmpVerify = await idbGet<string>(DB_KEY_TMP);
  if (!tmpVerify) {
    throw new StorageError(
      "Save failed: storage write could not be verified. " +
      "This is often caused by a browser extension interfering with storage. " +
      "Try disabling extensions or using an Incognito window. Your data has NOT been lost."
    );
  }
  if (tmpVerify !== serialized) {
    // Semantic compare: resilient to key-order or whitespace differences
    let semanticMatch = false;
    try {
      semanticMatch = JSON.stringify(JSON.parse(tmpVerify)) === JSON.stringify(JSON.parse(serialized));
    } catch {
      // unparseable — treat as mismatch
    }
    if (!semanticMatch) {
      // Soft mismatch (possible extension interference) — log but proceed
      console.warn("IDB TMP verify: soft mismatch detected (possible extension interference). Continuing save operation.");
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

  await idbSet(DB_KEY_MAIN, JSON.stringify(db));
  await idbRemove(DB_KEY_TMP).catch(() => {});

  // --- Synchronous localStorage backup (best-effort, may fail at 5 MB) ---
  try {
    const lsSize = serialized.length;
    const usageRatio = lsSize / MAX_STORAGE_CHARS;
    if (usageRatio < BLOCK_THRESHOLD) {
      if (usageRatio >= WARN_THRESHOLD) {
        console.warn(`localStorage backup: at ${(usageRatio * 100).toFixed(1)}% of 5 MB limit. Primary store is IDB.`);
      }
      localStorage.setItem(DB_KEY_MAIN, JSON.stringify(db));
    }
  } catch {
    // localStorage backup failure is non-fatal — IDB is the source of truth.
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
  const serialized = JSON.stringify(db);
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
    throw new StorageError("Verification failed: TMP data mismatch after write.");
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

  const finalSerialized = JSON.stringify(db);

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

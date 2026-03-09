import { UnifiedDB, ResidentRef, FacilityStore } from "../domain/models";
import { idbGet, idbSet, idbRemove, idbDeleteDatabase } from "./idb";
import { DB_KEY_MAIN, DB_KEY_PREV, DB_KEY_TMP } from "../constants/storageKeys";
import { StorageRepository, StorageSlice } from "./repository";
import { remoteFetchDb, remoteSaveDb } from "../services/api";
import {
  getOutboxState,
  markPackedSyncPending,
  markSlicesPending,
  clearPackedSyncPending,
  clearSlicesPending,
} from "./syncOutbox";
import {
  SyncAction,
  appendSyncRun,
  appendConflict,
  getLastSuccessfulSyncAt,
  setLastSuccessfulSyncAt,
} from "./syncLog";

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

/**
 * Load the DB using an online-first strategy (prioritises data freshness).
 *
 * 1. **Remote first** — attempt to fetch the latest DB from the remote server.
 *    If successful the remote data is saved to IDB and returned immediately so
 *    the app always starts with the most up-to-date information.
 * 2. **Local fallback** — if the remote is unreachable (offline or error) the
 *    function falls back to IDB (including a one-time migration from
 *    localStorage).  Background reconciliation is scheduled so the app will
 *    sync once connectivity is restored.
 * 3. **Empty DB** — if neither remote nor local data is available a fresh
 *    empty DB is created.
 *
 * Callers should listen for the `db-reconciled-from-remote` window event to
 * receive updated data when the background reconciliation (offline fallback
 * path) finds a newer remote version after connectivity is restored.
 */
export async function loadDBAsync(): Promise<UnifiedDB> {
  // 1. Try to fetch the latest data from the remote server (online-first).
  let remoteDb: UnifiedDB | null = null;
  try {
    const rawRemote = await remoteFetchDb();
    remoteDb = runMigrations(rawRemote as unknown as Record<string, unknown>);
  } catch (e) {
    if (e instanceof SchemaMigrationError) throw e;
    console.warn("[Startup] Could not reach remote server (offline?). Falling back to local DB.", e);
  }

  if (remoteDb) {
    console.log(`[Startup] Remote DB fetched (updatedAt: ${remoteDb.updatedAt}). Saving to local storage.`);
    try {
      await StorageRepository.mergeSlicesIntoDB(remoteDb);
      await saveDBAsync(remoteDb, { skipRemote: true }); // Persist to IDB only
    } catch (e) {
      console.warn("[Startup] Failed to persist remote DB to local storage. Continuing with remote data in memory.", e);
    }
    return remoteDb;
  }

  // 2. Remote unreachable — fall back to local IDB.
  let localDb: UnifiedDB | null = null;
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

        // Persist to IDB for future loads.
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
    // Don't rethrow — let the empty-DB path handle this.
  }

  if (localDb) {
    console.log(`[Startup] Offline — using local DB (updatedAt: ${localDb.updatedAt}). Background reconciliation scheduled for when connectivity is restored.`);
    // Schedule background reconciliation so any pending outbox items are
    // retried and the app syncs once the remote becomes reachable again.
    // The `db-reconciled-from-remote` event will fire if a newer remote
    // version is found.
    reconcileWithRemoteAsync(localDb, 'startup').catch((e) =>
      console.warn("[Startup] Background remote reconciliation error:", e)
    );
    return localDb;
  }

  // 3. If all else fails, create a fresh DB.
  console.log("[Startup] No local or remote DB found. Creating a new empty database.");
  const newDb = createEmptyDB();
  await saveDBAsync(newDb).catch(e => console.error("[Startup] Initial save of empty DB failed (local or remote):", e));
  return newDb;
}

// ---------------------------------------------------------------------------
// Background remote reconciliation
// ---------------------------------------------------------------------------

/** Result returned by a single reconciliation cycle. */
export interface ReconcileResult {
  action: SyncAction;
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
}

/**
 * Compare the local DB with the remote DB and resolve any discrepancy.
 *
 * - Remote newer  → pull remote, save to IDB, dispatch `db-reconciled-from-remote`.
 * - Local  newer  → push to remote (fire-and-forget, marks outbox on failure).
 * - Equal         → retry any pending outbox items.
 *
 * When both sides have changed since the last successful sync a conflict is
 * detected, logged to IDB, and resolved by remote-wins (last-write-wins
 * based on updatedAt timestamp).
 *
 * This is called automatically from {@link loadDBAsync} and can also be
 * called explicitly after auth state changes, focus events, or online events.
 *
 * @param localDb      The in-memory DB snapshot to compare against.
 * @param triggeredBy  Optional label for the run log ('startup', 'focus', …).
 */
export async function reconcileWithRemoteAsync(
  localDb: UnifiedDB,
  triggeredBy = 'unknown',
): Promise<ReconcileResult> {
  const startedAt = new Date().toISOString();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const result: ReconcileResult = {
    action: 'noop',
    pushedCount: 0,
    pulledCount: 0,
    conflictCount: 0,
  };

  // Always drain the outbox first — these are writes that previously failed
  // and should be flushed before we compare timestamps.
  await retryOutboxAsync(localDb);

  let remoteDb: UnifiedDB | null = null;
  try {
    const rawRemote = await remoteFetchDb();
    remoteDb = runMigrations(rawRemote as unknown as Record<string, unknown>);
  } catch (e) {
    console.log("[Reconcile] Could not reach remote (offline?). Skipping timestamp comparison.", e);
    result.action = 'offline';
    await appendSyncRun({
      id: runId,
      startedAt,
      completedAt: new Date().toISOString(),
      ...result,
      triggeredBy,
    }).catch(() => {});
    return result;
  }

  const remoteDate = new Date(remoteDb.updatedAt);
  const localDate = new Date(localDb.updatedAt);

  if (remoteDate > localDate) {
    // Before pulling, check for a conflict: local has been modified since the
    // last successful sync, meaning both sides changed independently.
    const lastSyncedAt = await getLastSuccessfulSyncAt().catch(() => null);
    const isConflict =
      lastSyncedAt !== null && localDate > new Date(lastSyncedAt);

    if (isConflict) {
      result.conflictCount += 1;
      const now = new Date().toISOString();
      await appendConflict({
        id: `${runId}-c0`,
        detectedAt: now,
        entityType: 'database',
        entityId: 'main',
        localUpdatedAt: localDb.updatedAt,
        remoteUpdatedAt: remoteDb.updatedAt,
        // Remote is newer → remote wins (last-write-wins).
        resolution: 'remote-wins',
        resolvedAt: now,
      }).catch(() => {});
      console.warn(
        `[Reconcile] Conflict detected — both sides changed since last sync (lastSyncedAt: ${lastSyncedAt}). ` +
        `Resolving with remote-wins. Local: ${localDb.updatedAt}, Remote: ${remoteDb.updatedAt}`
      );
      _dispatchSafe('sync-conflict-detected', { conflictCount: result.conflictCount });
    }

    console.log(
      `[Reconcile] Remote is newer (remote: ${remoteDb.updatedAt}, local: ${localDb.updatedAt}). Pulling remote data.`
    );
    // Overlay Firestore slices to capture slice-level writes not yet reflected
    // in the packed remote document.
    await StorageRepository.mergeSlicesIntoDB(remoteDb);
    await saveDBAsync(remoteDb, { skipRemote: true });

    result.action = 'pull';
    result.pulledCount = 1;

    // Notify the running app that it should update its in-memory state.
    _dispatchSafe('db-reconciled-from-remote', remoteDb);

    console.log("[Reconcile] Remote data applied. UI notified via db-reconciled-from-remote event.");
  } else if (localDate > remoteDate) {
    console.log(
      `[Reconcile] Local is newer (local: ${localDb.updatedAt}, remote: ${remoteDb.updatedAt}). Pushing to remote.`
    );
    _dispatchSafe('backup-started', undefined, 'Event');
    try {
      await remoteSaveDb(localDb);
      console.log("[Reconcile] Local DB pushed to remote successfully.");
      _dispatchSafe('backup-completed', { type: 'remote' });
      await clearPackedSyncPending().catch(() => {});
      result.action = 'push';
      result.pushedCount = 1;
    } catch (e) {
      console.error("[Reconcile] Failed to push local DB to remote. Queued in outbox.", e);
      _dispatchSafe('backup-failed', undefined, 'Event');
      await markPackedSyncPending(e).catch(() => {});
      result.action = 'error';
    }
  } else {
    console.log(`[Reconcile] Local and remote are in sync (updatedAt: ${localDb.updatedAt}).`);
  }

  // Persist the log entry.
  const completedAt = new Date().toISOString();
  await appendSyncRun({
    id: runId,
    startedAt,
    completedAt,
    ...result,
    triggeredBy,
  }).catch(() => {});

  // Update the last-successful-sync timestamp for conflict detection.
  if (result.action === 'pull' || result.action === 'push' || result.action === 'noop') {
    await setLastSuccessfulSyncAt(completedAt).catch(() => {});
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Dispatch a DOM event safely (swallowed in test environments). */
function _dispatchSafe(
  type: string,
  detail?: unknown,
  kind: 'CustomEvent' | 'Event' = 'CustomEvent',
): void {
  try {
    const evt =
      kind === 'Event'
        ? new Event(type)
        : new CustomEvent(type, { detail });
    window.dispatchEvent(evt);
  } catch {
    /* test environments may not have window */
  }
}

// ---------------------------------------------------------------------------
// Outbox retry
// ---------------------------------------------------------------------------

/**
 * Attempt to flush any pending outbox items (failed remote writes) against
 * the current database state.
 *
 * Succeeded items are removed from the outbox; failed items are kept with
 * updated metadata so they will be retried on the next trigger.
 *
 * @param currentDb  Optional in-memory DB to use for retries.  When omitted
 *   the function reads the latest DB from IDB.
 */
export async function retryOutboxAsync(currentDb?: UnifiedDB): Promise<void> {
  const state = await getOutboxState();
  const hasPending = state.hasPendingPackedSync || state.pendingSlices.length > 0;
  if (!hasPending) return;

  console.log(
    `[Outbox] Retrying pending items — packed: ${state.hasPendingPackedSync}, slices: [${state.pendingSlices.join(', ')}]`
  );

  // Resolve the DB to use for retries.
  let db = currentDb;
  if (!db) {
    const rawDb = await idbGet<string>(DB_KEY_MAIN);
    if (!rawDb) {
      console.warn('[Outbox] No local DB in IDB, cannot retry outbox.');
      return;
    }
    try {
      db = runMigrations(JSON.parse(rawDb) as Record<string, unknown>);
    } catch (e) {
      console.error('[Outbox] Failed to parse local DB for outbox retry.', e);
      return;
    }
  }

  // --- Retry packed sync ---
  if (state.hasPendingPackedSync) {
    try {
      await remoteSaveDb(db);
      await clearPackedSyncPending();
      console.log('[Outbox] Packed sync succeeded.');
      window.dispatchEvent(new CustomEvent('backup-completed', { detail: { type: 'remote' } }));
    } catch (e) {
      console.warn('[Outbox] Packed sync retry failed — will try again later.', e);
    }
  }

  // --- Retry per-slice sync ---
  if (state.pendingSlices.length > 0) {
    const facilityId = db.data.facilities.activeFacilityId;
    const store = db.data.facilityData[facilityId];
    if (!store) {
      console.warn('[Outbox] No store for active facility, skipping slice retries.');
      return;
    }

    const succeeded: string[] = [];
    for (const sliceName of state.pendingSlices) {
      const slice = sliceName as StorageSlice;
      try {
        await StorageRepository.saveSlice(facilityId, slice, store[slice]);
        succeeded.push(sliceName);
        console.log(`[Outbox] Slice '${sliceName}' retry succeeded.`);
      } catch (e) {
        console.warn(`[Outbox] Slice '${sliceName}' retry failed — will try again later.`, e);
      }
    }

    if (succeeded.length > 0) {
      await clearSlicesPending(succeeded);
    }

    const remaining = state.pendingSlices.filter((s) => !succeeded.includes(s));
    if (remaining.length === 0 && !state.hasPendingPackedSync) {
      window.dispatchEvent(new CustomEvent('backup-completed', { detail: { type: 'remote' } }));
    }
  }
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
      .then(async () => {
        console.log(`[Sync] Remote save successful (updatedAt: ${db.updatedAt}).`);
        window.dispatchEvent(new CustomEvent("backup-completed", { detail: { type: 'remote' } }));
        // Clear any previously queued packed sync so we don't double-push.
        await clearPackedSyncPending().catch(() => {});
      })
      .catch(async (err) => {
        console.error("[Sync] Remote save failed. Local data is safe in IDB. Queued in outbox.", err);
        window.dispatchEvent(new Event("backup-failed"));
        // Queue for retry on the next trigger (online, focus, auth-restored).
        await markPackedSyncPending(err).catch(() => {});
      });
  } else {
    console.log(`[Sync] Local save successful (IDB updated, remote skipped, updatedAt: ${db.updatedAt}).`);
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

import { UnifiedDB, ResidentRef, FacilityStore } from "../domain/models";
import { idbGet, idbSet, idbRemove, idbDeleteDatabase } from "./idb";
import { DB_KEY_MAIN, DB_KEY_PREV, DB_KEY_TMP } from "../constants/storageKeys";
import { StorageRepository, StorageSlice, STORAGE_SLICES } from "./repository";
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
import { getCurrentUser } from "../services/firebase";

export { DB_KEY_MAIN };

export const MAX_STORAGE_CHARS = 5 * 1024 * 1024;
const WARN_THRESHOLD = 0.60;
const BLOCK_THRESHOLD = 0.85;

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
    admissionScreenings: {},
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

export function runMigrations(raw: Record<string, unknown>): UnifiedDB {
  if (!raw || typeof raw !== "object") return createEmptyDB();

  let version = typeof raw.schemaVersion === "string" ? raw.schemaVersion : "unknown";

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

  const finalVersion = typeof raw.schemaVersion === "string" ? raw.schemaVersion : "unknown";
  if (finalVersion !== "UNIFIED_DB_V3") {
    throw new SchemaMigrationError(finalVersion);
  }

  return raw as unknown as UnifiedDB;
}

function migratePreV2toV2(raw: Record<string, unknown>): Record<string, unknown> {
  const now = new Date().toISOString();

  if (!raw.schemaName) raw.schemaName = "UNIFIED_DB";
  if (!raw.createdAt) raw.createdAt = now;
  if (!raw.updatedAt) raw.updatedAt = now;
  if (!raw.integrity) raw.integrity = {};

  const data = (raw.data ?? {}) as Record<string, unknown>;
  raw.data = data;

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

  if (!data.facilityData) data.facilityData = {};
  const facilityData = data.facilityData as Record<string, FacilityStore>;

  for (const fid of Object.keys(facilities.byId)) {
    if (!facilityData[fid]) {
      facilityData[fid] = emptyFacilityStore(fid);
    } else {
      const store = facilityData[fid] as unknown as Record<string, unknown>;
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

export function validateCommitGate(db: UnifiedDB): void {
  for (const facilityId of Object.keys(db.data.facilityData)) {
    const store = db.data.facilityData[facilityId];

    const validMrns = new Set(Object.keys(store.residents));
    const validQIds = new Set(
      Object.keys(store.quarantine).filter((id) => id.startsWith("Q:"))
    );

    const checkRef = (ref: ResidentRef | undefined, context: string) => {
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

export async function loadDBAsync(options: { skipRemoteReconciliation?: boolean } = {}): Promise<UnifiedDB> {
  let localDb: UnifiedDB | null = null;
  try {
    const rawLocal = await idbGet<string>(DB_KEY_MAIN);
    if (rawLocal) {
      const parsed = JSON.parse(rawLocal) as Record<string, unknown>;
      const migrated = runMigrations(parsed);
      localDb = migrated;
    } else {
      const lsRaw = localStorage.getItem(DB_KEY_MAIN);
      if (lsRaw) {
        const parsed = JSON.parse(lsRaw) as Record<string, unknown>;
        const migrated = runMigrations(parsed);

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
  }

  if (!options.skipRemoteReconciliation) {
    let remoteDb: UnifiedDB | null = null;
    try {
      const rawRemote = await remoteFetchDb();
      if (rawRemote) {
        remoteDb = runMigrations(rawRemote as unknown as Record<string, unknown>);
      }
    } catch (e) {
      if (e instanceof SchemaMigrationError) throw e;
      console.error("[Startup] Remote load failed:", e);
      console.warn("[Startup] Falling back to local DB.");
    }

    if (remoteDb) {
      const remoteDate = new Date(remoteDb.updatedAt);
      const localDate = localDb ? new Date(localDb.updatedAt) : new Date(0);

      if (remoteDate > localDate) {
        console.log(`[Startup] Remote DB is newer (remote: ${remoteDb.updatedAt}, local: ${localDb?.updatedAt}). Saving to local storage.`);
        try {
          await saveDBAsync(remoteDb, { skipRemote: true }); // Persist to IDB only
        } catch (e) {
          console.warn("[Startup] Failed to persist remote DB to local storage. Continuing with remote data in memory.", e);
        }
        return remoteDb;
      }
    }
  }

  if (localDb) {
    // Only run background reconciliation when the caller has not explicitly
    // requested to skip it (e.g. right after a restore so the restored data
    // is never overwritten by a remote pull in the same session).
    if (!options.skipRemoteReconciliation) {
      reconcileWithRemoteAsync(localDb, 'startup').catch((e) =>
        console.warn("[Startup] Background remote reconciliation error:", e)
      );
    }
    return localDb;
  }

  const newDb = createEmptyDB();
  await saveDBAsync(newDb).catch(e => console.error("[Startup] Initial save of empty DB failed (local or remote):", e));
  return newDb;
}

export interface ReconcileResult {
  action: SyncAction;
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
}

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

  await retryOutboxAsync(localDb);

  let remoteDb: UnifiedDB | null = null;
  try {
    const rawRemote = await remoteFetchDb();
    if (rawRemote) {
      remoteDb = runMigrations(rawRemote as unknown as Record<string, unknown>);
    }
  } catch (e) {
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

  const remoteDate = remoteDb ? new Date(remoteDb.updatedAt) : new Date(0);
  const localDate = new Date(localDb.updatedAt);

  if (remoteDb && remoteDate > localDate) {
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
        resolution: 'remote-wins',
        resolvedAt: now,
      }).catch(() => {});
      _dispatchSafe('sync-conflict-detected', { conflictCount: result.conflictCount });
    }

    await saveDBAsync(remoteDb, { skipRemote: true });

    result.action = 'pull';
    result.pulledCount = 1;

    _dispatchSafe('db-reconciled-from-remote', remoteDb);
  } else if (localDate > remoteDate) {
    _dispatchSafe('backup-started', undefined, 'Event');
    try {
      await remoteSaveDb(localDb);
      const activeFacilityId = localDb.data.facilities.activeFacilityId;
      const store = localDb.data.facilityData[activeFacilityId];
      if (store) {
        const sliceResult = await StorageRepository.saveSlices(activeFacilityId, store, [...STORAGE_SLICES]);
        if (!sliceResult.allSucceeded) {
          throw new Error("Partial slice save failure during reconciliation push.");
        }
      }
      await clearPackedSyncPending().catch(() => {});
      result.action = 'push';
      result.pushedCount = 1;
    } catch (e) {
      await markPackedSyncPending(e).catch(() => {});
      result.action = 'error';
    }
  } else {
    //noop
  }

  const completedAt = new Date().toISOString();
  await appendSyncRun({
    id: runId,
    startedAt,
    completedAt,
    ...result,
    triggeredBy,
  }).catch(() => {});

  if (result.action === 'pull' || result.action === 'push' || result.action === 'noop') {
    await setLastSuccessfulSyncAt(completedAt).catch(() => {});
  }

  return result;
}

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

export async function retryOutboxAsync(currentDb?: UnifiedDB): Promise<void> {
  const state = await getOutboxState();
  const hasPending = state.hasPendingPackedSync || state.pendingSlices.length > 0;
  if (!hasPending) return;

  let db = currentDb;
  if (!db) {
    const rawDb = await idbGet<string>(DB_KEY_MAIN);
    if (!rawDb) {
      return;
    }
    try {
      db = runMigrations(JSON.parse(rawDb) as Record<string, unknown>);
    } catch (e) {
      return;
    }
  }

  if (state.hasPendingPackedSync) {
    try {
      await remoteSaveDb(db);
      await clearPackedSyncPending();
      window.dispatchEvent(new CustomEvent('backup-completed', { detail: { type: 'remote' } }));
    } catch (e) {
      //noop
    }
  }

  if (state.pendingSlices.length > 0) {
    const facilityId = db.data.facilities.activeFacilityId;
    const store = db.data.facilityData[facilityId];
    if (!store) {
      return;
    }

    const succeeded: string[] = [];
    for (const sliceName of state.pendingSlices) {
      const slice = sliceName as StorageSlice;
      try {
        await StorageRepository.saveSlice(facilityId, slice, store[slice]);
        succeeded.push(sliceName);
      } catch (e) {
        //noop
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

export async function saveDBAsync(db: UnifiedDB, options: { skipRemote?: boolean } = {}): Promise<void> {
  window.dispatchEvent(new Event("backup-started"));
  validateCommitGate(db);

  db.updatedAt = new Date().toISOString();
  const packed = packV3(db);
  const serialized = JSON.stringify(packed);
  const size = serialized.length;

  const IDB_WARN_BYTES = 60 * 1024 * 1024;
  if (size > IDB_WARN_BYTES) {
    console.warn(`Storage warning: Database is ${(size / 1024 / 1024).toFixed(1)} MB — consider archiving old data.`);
  }

  const uniqueTmpKey = `${DB_KEY_TMP}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await idbSet(uniqueTmpKey, serialized);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  const tmpVerify = await idbGet<string>(uniqueTmpKey);
  if (!tmpVerify) {
    window.dispatchEvent(new Event("backup-failed"));
    throw new StorageError(
      "Save failed: storage write could not be verified. " +
      "This is often caused by a browser extension interfering with storage. " +
      "Try disabling extensions or using an Incognito window. Your data has NOT been lost."
    );
  }
  if (tmpVerify !== serialized) {
    let semanticallyEqual = false;
    try {
      semanticallyEqual =
        JSON.stringify(JSON.parse(tmpVerify)) === JSON.stringify(JSON.parse(serialized));
    } catch {
      //noop
    }
    if (!semanticallyEqual) {
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
  
  packed.integrity = db.integrity;
  const finalSerialized = JSON.stringify(packed);

  await idbSet(DB_KEY_MAIN, finalSerialized);
  await idbRemove(uniqueTmpKey).catch(() => {});

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
    //noop
  }
  
  if (!options.skipRemote) {
    const user = await getCurrentUser();
    if (user) {
      await remoteSaveDb(db)
        .then(async () => {
          await clearPackedSyncPending().catch(() => {});
          window.dispatchEvent(new CustomEvent("backup-completed", { detail: { type: 'remote' } }));
        })
        .catch(async (err) => {
          await markPackedSyncPending(err).catch(() => {});
          window.dispatchEvent(new Event("backup-failed"));
        });
    } else {
      await markPackedSyncPending(new Error("User not authenticated")).catch(() => {});
      window.dispatchEvent(new CustomEvent("backup-completed", { detail: { type: 'local' } }));
    }
  } else {
    window.dispatchEvent(new CustomEvent("backup-completed", { detail: { type: 'local' } }));
  }
}


export async function hardResetStorageAsync(): Promise<void> {
  try {
    await idbDeleteDatabase();
  } catch (e) {
    //noop
  }

  try {
    localStorage.clear();
  } catch (e) {
    //noop
  }
}

export function loadDB(): UnifiedDB {
  try {
    const raw = localStorage.getItem(DB_KEY_MAIN);
    if (!raw) return createEmptyDB();

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return runMigrations(parsed);
  } catch (e) {
    if (e instanceof SchemaMigrationError) throw e;
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
        //noop
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
      //noop
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

export async function restoreFromPrevAsync(): Promise<boolean> {
  try {
    const prev = await idbGet<string>(DB_KEY_PREV);
    if (!prev) return restoreFromPrev();
    
    let parsedDb: UnifiedDB | null = null;
    try {
      const parsed = JSON.parse(prev) as Record<string, unknown>;
      parsedDb = runMigrations(parsed);
      
      // Bump the updatedAt timestamp so this restored backup is considered the newest version by all devices
      parsedDb.updatedAt = new Date().toISOString();
      
      // Save the packed DB locally and remotely
      await saveDBAsync(parsedDb);
      
      // Save all slices to Firestore
      const activeFacilityId = parsedDb.data.facilities.activeFacilityId;
      const store = parsedDb.data.facilityData[activeFacilityId];
      if (store) {
        await StorageRepository.saveSlices(activeFacilityId, store, [...STORAGE_SLICES]);
      }
    } catch (e) {
      console.error("Failed to parse and push previous DB:", e);
      // Fallback to local-only restore if parsing/pushing fails
      await idbSet(DB_KEY_MAIN, prev);
      try { localStorage.setItem(DB_KEY_MAIN, prev); } catch {}
    }

    return true;
  } catch (e) {
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
    return false;
  }
}

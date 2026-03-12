import { UnifiedDB, MutationLogEntry, FacilityStore } from "../domain/models";
import { saveDBAsync, restoreFromPrevAsync, validateCommitGate } from "../storage/engine";
import { StorageRepository, StorageSlice, STORAGE_SLICES, SaveSlicesResult } from "../storage/repository";
import { getCurrentUser } from "../services/firebase";
import { remoteSaveDb } from "./api";
import {
  markPackedSyncPending,
  markSlicesPending,
  clearPackedSyncPending,
} from "../storage/syncOutbox";
import { LS_JUST_RESTORED_FLAG, LS_LAST_BACKUP_TS } from "../constants/storageKeys";

const MAX_MUTATION_LOG_ENTRIES = 500;

/**
 * Stable per-tab identifier used to stamp sync-signal documents.
 * The `onSnapshot` listener on the same tab compares this value and skips
 * signals that originate from itself, preventing unnecessary reconciliation
 * round-trips.
 */
export const SESSION_ID: string =
  typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random()}`;

/**
 * Debounce window (ms) for coalescing rapid slice-only saves into a single
 * remote push.  2 s is long enough to batch typical burst edits while still
 * guaranteeing a remote write within a few seconds of the last change.
 */
const REMOTE_SYNC_DEBOUNCE_MS = 2_000;

// Module-level debounce state — intentionally not exported.
let _remoteSyncTimer: ReturnType<typeof setTimeout> | null = null;
let _pendingRemoteSyncDb: UnifiedDB | null = null;
let _remoteSyncInFlight = false;

/**
 * Schedule a debounced remote sync of the full packed database.
 *
 * Rapid slice-only saves reset the timer so only one remote write fires
 * after the burst settles.  A local save (IDB + Firestore slices) is already
 * committed before this runs, so a remote-sync failure never rolls back
 * local data.
 */
function scheduleRemoteSync(db: UnifiedDB): void {
  // Always keep a reference to the most-recently saved DB so the debounced
  // push carries the latest state.
  _pendingRemoteSyncDb = db;

  if (_remoteSyncTimer !== null) {
    clearTimeout(_remoteSyncTimer);
  }

  console.log(`[Sync] Remote sync scheduled (debounced, fires in ${REMOTE_SYNC_DEBOUNCE_MS / 1000} s).`);

  _remoteSyncTimer = setTimeout(async () => {
    _remoteSyncTimer = null;
    const dbToSync = _pendingRemoteSyncDb;
    _pendingRemoteSyncDb = null;

    if (!dbToSync) return;

    // Avoid overlapping remote writes: if a sync is already in flight, the
    // next debounce cycle (triggered by the caller rescattering the timer)
    // will pick up the latest DB.  Re-schedule if needed.
    if (_remoteSyncInFlight) {
      console.log('[Sync] Remote sync already in flight; re-scheduling.');
      scheduleRemoteSync(dbToSync);
      return;
    }

    _remoteSyncInFlight = true;
    try {
      console.log('[Sync] Executing debounced remote sync...');
      await remoteSaveDb(dbToSync);
      console.log(`[Sync] Debounced remote sync successful (updatedAt: ${dbToSync.updatedAt}).`);
      // G7: record timestamp so the header badge reflects this cloud backup
      try { localStorage.setItem(LS_LAST_BACKUP_TS, Date.now().toString()); } catch { /* non-browser env */ }
      window.dispatchEvent(new CustomEvent('backup-completed', { detail: { type: 'remote' } }));
      await clearPackedSyncPending().catch(() => {});
    } catch (err) {
      console.error('[Sync] Debounced packed remote sync failed. Local data is safe in IDB. Queued in outbox for retry.', err);
      window.dispatchEvent(new Event('backup-failed'));
      await markPackedSyncPending(err).catch(() => {});
    } finally {
      _remoteSyncInFlight = false;
    }
  }, REMOTE_SYNC_DEBOUNCE_MS);
}

export interface MutationMeta {
  action: MutationLogEntry['action'];
  entityType: string;
  entityId: string;
  who?: string;
}

export const commandHandlers = {
  applyMutation: (db: UnifiedDB, activeFacilityId: string, updater: (draft: UnifiedDB) => void, meta?: MutationMeta): { nextDb: UnifiedDB, changedSlices: StorageSlice[], mainChanged: boolean } => {
    const nextDb = JSON.parse(JSON.stringify(db)) as UnifiedDB;
    updater(nextDb);

    const prevStore = db.data.facilityData[activeFacilityId];
    const nextStore = nextDb.data.facilityData[activeFacilityId];

    if (meta && nextStore) {
      const entry: MutationLogEntry = {
        timestamp: new Date().toISOString(),
        who: meta.who ?? 'unknown',
        action: meta.action,
        entityType: meta.entityType,
        entityId: meta.entityId,
      };
      if (!nextStore.mutationLog) nextStore.mutationLog = [];
      nextStore.mutationLog.push(entry);
      if (nextStore.mutationLog.length > MAX_MUTATION_LOG_ENTRIES) {
        nextStore.mutationLog = nextStore.mutationLog.slice(-MAX_MUTATION_LOG_ENTRIES);
      }
    }

    const changedSlices: StorageSlice[] = [];
    let mainChanged = false;

    if (prevStore && nextStore) {
      // Check which slices changed
      for (const slice of STORAGE_SLICES) {
        if (JSON.stringify(prevStore[slice]) !== JSON.stringify(nextStore[slice])) {
          changedSlices.push(slice);
        }
      }

      // Check if anything ELSE changed in the store
      for (const key of Object.keys(nextStore)) {
        if (!STORAGE_SLICES.includes(key as StorageSlice)) {
          if (JSON.stringify(prevStore[key as keyof FacilityStore]) !== JSON.stringify(nextStore[key as keyof FacilityStore])) {
            mainChanged = true;
            break;
          }
        }
      }
    } else {
      mainChanged = true;
    }

    // Check if facilities or other top-level things changed
    if (!mainChanged) {
      if (JSON.stringify(db.data.facilities) !== JSON.stringify(nextDb.data.facilities)) {
        mainChanged = true;
      }
    }

    return { nextDb, changedSlices, mainChanged };
  },

  saveDatabase: async (db: UnifiedDB, activeFacilityId: string, changedSlices: StorageSlice[], mainChanged: boolean) => {
    validateCommitGate(db);

    const store = db.data.facilityData[activeFacilityId];
    const user = await getCurrentUser();

    if (!user) {
        console.warn("User not authenticated, skipping remote sync. Saving locally.");
        await saveDBAsync(db, { skipRemote: true });
        return;
    }

    if (mainChanged || changedSlices.length === 0) {
      // Full save: saveDBAsync writes locally (IDB) and pushes the packed DB
      // remotely.  Individual slices are then synced on top for granularity.
      await saveDBAsync(db);
      if (store) {
        const result: SaveSlicesResult = await StorageRepository.saveSlices(activeFacilityId, store, [...STORAGE_SLICES]);
        if (!result.allSucceeded) {
          console.error(
            `[Sync] Partial slice save failure (main path). Failed slices: [${result.failedSlices.join(', ')}]. ` +
            `Local data is safe. Remote slices are partially out of sync.`,
          );
          window.dispatchEvent(new Event('backup-failed'));
          // Queue failed slices for retry.
          await markSlicesPending(result.failedSlices).catch(() => {});
        }
        // Notify other devices of the successful slice writes via a signal document.
        if (result.succeededSlices.length > 0) {
          await StorageRepository.writeSyncSignal(activeFacilityId, result.succeededSlices, SESSION_ID).catch(() => {});
        }
      }
    } else {
      // Slice-only path — local-first: persist to IDB before attempting remote
      // writes so a remote failure never leaves local data unsaved.
      await saveDBAsync(db, { skipRemote: true });

      if (store) {
        const result: SaveSlicesResult = await StorageRepository.saveSlices(activeFacilityId, store, changedSlices);
        if (result.allSucceeded) {
          console.log(`[Sync] Slice-only remote save successful (slices: ${changedSlices.join(', ')}).`);
          // Schedule a debounced remote sync so the packed Firebase document stays
          // current, enabling correct timestamp-based reconciliation at startup.
          scheduleRemoteSync(db);
          // Notify other devices of the change via a signal document.
          await StorageRepository.writeSyncSignal(activeFacilityId, result.succeededSlices, SESSION_ID).catch(() => {});
        } else {
          console.error(
            `[Sync] Partial slice save failure (slice-only path). Failed: [${result.failedSlices.join(', ')}]. ` +
            `Local data is safe in IDB. Packed remote sync will not be scheduled to avoid masking slice failures.`,
          );
          window.dispatchEvent(new Event('backup-failed'));
          // Queue failed slices for retry.
          await markSlicesPending(result.failedSlices).catch(() => {});
          // Do NOT schedule packed remote sync — the remote is partially out of
          // sync and pushing the packed DB would mask the per-slice failures.
        }
      }
    }

    try {
      const channel = new BroadcastChannel('ic_console_sync');
      channel.postMessage({ type: 'DB_UPDATED', changedSlices, mainChanged });
      channel.close();
    } catch (err) {
      console.warn("Failed to broadcast DB update:", err);
    }
  },

  restorePrevious: async () => {
    const ok = await restoreFromPrevAsync();
    if (ok) {
      // Guard must be set BEFORE reload so the bootstrap skips remote reconciliation
      // and loads the freshly-restored local IDB data instead.
      sessionStorage.setItem(LS_JUST_RESTORED_FLAG, "true");
      window.location.reload();
    } else {
      alert("No previous healthy snapshot found to restore.");
    }
  },

  hardReset: () => {
    if (confirm("Are you absolutely sure? This will wipe all data and reset the application.")) {
      localStorage.clear();
      window.location.reload();
    }
  }
};

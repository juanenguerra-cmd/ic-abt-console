import { UnifiedDB, MutationLogEntry, FacilityStore } from "../domain/models";
import { saveDBAsync, restoreFromPrevAsync, validateCommitGate } from "../storage/engine";
import { StorageRepository, StorageSlice, STORAGE_SLICES } from "../storage/repository";

const MAX_MUTATION_LOG_ENTRIES = 500;

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
    // Validate the entire DB before saving anything
    validateCommitGate(db);

    const store = db.data.facilityData[activeFacilityId];

    if (mainChanged || changedSlices.length === 0) {
      // If main changed, or nothing changed (force save), save the whole DB
      await saveDBAsync(db);
      if (store) {
        // Also sync slices to keep them up to date
        await StorageRepository.saveSlices(activeFacilityId, store, [...STORAGE_SLICES]);
      }
    } else {
      // Only slices changed
      if (store) {
        await StorageRepository.saveSlices(activeFacilityId, store, changedSlices);
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

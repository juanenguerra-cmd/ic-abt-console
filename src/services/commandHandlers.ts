import { UnifiedDB, MutationLogEntry } from "../domain/models";
import { saveDBAsync, restoreFromPrevAsync } from "../storage/engine";

const MAX_MUTATION_LOG_ENTRIES = 500;

export interface MutationMeta {
  action: MutationLogEntry['action'];
  entityType: string;
  entityId: string;
  who?: string;
}

export const commandHandlers = {
  applyMutation: (db: UnifiedDB, updater: (draft: UnifiedDB) => void, meta?: MutationMeta): UnifiedDB => {
    const nextDb = JSON.parse(JSON.stringify(db)) as UnifiedDB;
    updater(nextDb);

    if (meta) {
      const entry: MutationLogEntry = {
        timestamp: new Date().toISOString(),
        who: meta.who ?? 'unknown',
        action: meta.action,
        entityType: meta.entityType,
        entityId: meta.entityId,
      };
      const activeFacilityId = nextDb.data.facilities.activeFacilityId;
      const facilityStore = nextDb.data.facilityData[activeFacilityId];
      if (facilityStore) {
        if (!facilityStore.mutationLog) facilityStore.mutationLog = [];
        facilityStore.mutationLog.push(entry);
        if (facilityStore.mutationLog.length > MAX_MUTATION_LOG_ENTRIES) {
          facilityStore.mutationLog = facilityStore.mutationLog.slice(-MAX_MUTATION_LOG_ENTRIES);
        }
      }
    }
    return nextDb;
  },

  saveDatabase: async (db: UnifiedDB) => {
    await saveDBAsync(db);
    try {
      const channel = new BroadcastChannel('ic_console_sync');
      channel.postMessage({ type: 'DB_UPDATED' });
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


import { collection, doc, getDocs, setDoc, writeBatch, query, limit } from "firebase/firestore";
import { FacilityStore, UnifiedDB } from "../domain/models";
import { idbGet, idbSet } from "./idb";
import { DB_KEY_MAIN } from "../constants/storageKeys";
import { eventBus } from '@/src/services/eventBus';
import { getCurrentUser, db } from "../services/firebase";

export const STORAGE_SLICES = [
  "residents",
  "quarantine",
  "abts",
  "infections",
  "vaxEvents",
  "notes",
  "staff",
  "staffVaxEvents",
  "fitTestEvents",
  "auditSessions",
  "outbreaks",
  "outbreakCases",
  "outbreakExposures",
  "outbreakDailyStatuses",
  "exportProfiles",
  "surveyPackets",
  "infectionControlAuditSessions",
  "infectionControlAuditItems",
  "notifications",
  "contactTraceCases",
  "contactTraceExposures",
  "lineListEvents",
  "shiftLog",
  "mutationLog",
] as const;

export type StorageSlice = typeof STORAGE_SLICES[number];

/** Per-slice result from a remote save attempt. */
export interface SliceSaveResult {
  slice: StorageSlice;
  success: boolean;
  error?: unknown;
}

/** Aggregated result returned by {@link StorageRepository.saveSlices}. */
export interface SaveSlicesResult {
  allSucceeded: boolean;
  succeededSlices: StorageSlice[];
  failedSlices: StorageSlice[];
  results: SliceSaveResult[];
}

/** Number of retries per slice on transient remote write failures. */
const SLICE_SAVE_MAX_RETRIES = 2;
/** Base delay (ms) for exponential back-off between retries. */
const SLICE_SAVE_RETRY_BASE_MS = 500;

export class StorageRepository {
  static getSliceKey(facilityId: string, slice: string): string {
    return `${DB_KEY_MAIN}_slice_${facilityId}_${slice}`;
  }

  static getPrevSliceKey(facilityId: string, slice: string): string {
    return `${DB_KEY_MAIN}_prev_slice_${facilityId}_${slice}`;
  }

  static async saveMetadata(dbData: UnifiedDB): Promise<void> {
    const user = await getCurrentUser();
    if (!user) return;
    
    const metadata = {
      schemaName: dbData.schemaName,
      schemaVersion: dbData.schemaVersion,
      createdAt: dbData.createdAt,
      updatedAt: dbData.updatedAt,
      integrity: dbData.integrity,
      data: {
        facilities: dbData.data.facilities
      }
    };
    
    const metaRef = doc(db, 'users', user.uid, 'meta', 'db');
    await setDoc(metaRef, metadata);

    const activeFacilityId = dbData.data.facilities.activeFacilityId;
    const store = dbData.data.facilityData[activeFacilityId];
    if (store) {
      const facilityMeta = {
        currentRole: store.currentRole || null,
        lineListOverrides: store.lineListOverrides || {},
        dismissedRuleKeys: store.dismissedRuleKeys || [],
        notificationMeta: store.notificationMeta || {},
      };
      const facMetaRef = doc(db, 'users', user.uid, 'facilities', activeFacilityId, 'meta', 'config');
      await setDoc(facMetaRef, facilityMeta);
    }
  }

  static async loadMetadata(): Promise<Partial<UnifiedDB> | null> {
    const user = await getCurrentUser();
    if (!user) return null;
    
    const metaRef = doc(db, 'users', user.uid, 'meta', 'db');
    const snapshot = await getDocs(collection(db, 'users', user.uid, 'meta'));
    let metadata: any = null;
    snapshot.forEach(doc => {
      if (doc.id === 'db') metadata = doc.data();
    });
    
    return metadata;
  }

  static async loadFacilityMeta(facilityId: string): Promise<any | null> {
    const user = await getCurrentUser();
    if (!user) return null;
    
    const facMetaRef = doc(db, 'users', user.uid, 'facilities', facilityId, 'meta', 'config');
    const snapshot = await getDocs(collection(db, 'users', user.uid, 'facilities', facilityId, 'meta'));
    let facMeta: any = null;
    snapshot.forEach(doc => {
      if (doc.id === 'config') facMeta = doc.data();
    });
    return facMeta;
  }

  static async saveSlice(facilityId: string, slice: StorageSlice, data: any): Promise<void> {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error(`[Sync] Cannot save slice '${slice}': user is not authenticated.`);
    }

    const sliceCollection = collection(db, 'users', user.uid, 'facilities', facilityId, slice);

    const items: object[] = [];
    if (data) {
      if (Array.isArray(data)) {
        items.push(...data);
      } else {
        items.push(...Object.values(data as Record<string, object>));
      }
    }
    
    const operations: { docRef: any, data: any }[] = [];

    items.forEach((item: any, index: number) => {
        let docId = item.id;
        if (slice === 'mutationLog') docId = `log_${index}_${item.timestamp}`;

        if (item && docId) {
            const docRef = doc(sliceCollection, docId);
            operations.push({ docRef, data: item });
        } else {
            console.warn(`[Sync] Item in slice '${slice}' is missing an ID and will not be saved.`, item);
        }
    });

    const CHUNK_SIZE = 500;
    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
        const chunk = operations.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(op => {
            batch.set(op.docRef, op.data);
        });
        await batch.commit();
    }
    
    console.log(`[Sync] Slice '${slice}' saved to Firestore (${items.length} items).`);
  }

  /**
   * Load a single slice from Firestore.
   *
   * Primary path (facility-scoped):
   *   users/{uid}/facilities/{facilityId}/{slice}/{docId}
   *
   * Legacy fallback path (user-only, pre-facility-scoping fix):
   *   users/{uid}/{slice}/{docId}
   *
   * If the new path is empty but legacy data exists, the data is
   * automatically migrated to the facility-scoped path and returned.
   * Old data is preserved at the legacy path (non-destructive migration).
   */
  static async loadSlice(facilityId: string, slice: StorageSlice): Promise<any | null> {
    const user = await getCurrentUser();
    if (!user) {
      console.warn(`Attempted to load slice '${slice}' without an authenticated user. Skipping.`);
      return null;
    }

    // Primary: facility-scoped path — must match saveSlice exactly.
    const sliceCollection = collection(db, 'users', user.uid, 'facilities', facilityId, slice);
    const snapshot = await getDocs(sliceCollection);

    if (!snapshot.empty) {
      if (slice === 'mutationLog') {
        const data: any[] = [];
        snapshot.docs.forEach(d => data.push(d.data()));
        return data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      }
      const data: { [key: string]: any } = {};
      snapshot.docs.forEach(d => {
        const docData = d.data();
        const docId = docData.id;
        if (docData && docId) {
          data[docId] = docData;
        }
      });
      return data;
    }

    // Fallback: legacy user-only path (no facilityId segment in the path).
    // This catches records written before the facility-scoping fix was applied.
    console.warn(
      `[Migration] Slice '${slice}' not found at facility-scoped path. Checking legacy path.`
    );
    const legacyCollection = collection(db, 'users', user.uid, slice);
    const legacySnapshot = await getDocs(legacyCollection);

    if (legacySnapshot.empty) {
      return null;
    }

    // Parse legacy documents.
    if (slice === 'mutationLog') {
      const data: any[] = [];
      legacySnapshot.docs.forEach(d => data.push(d.data()));
      const sortedData = data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      console.log(
        `[Migration] Migrating slice '${slice}' from legacy path to ` +
        `facility-scoped path for facility '${facilityId}'.`
      );
      try {
        await this.saveSlice(facilityId, slice, sortedData);
        console.log(`[Migration] Slice '${slice}' migrated successfully.`);
      } catch (err) {
        console.error(
          `[Migration] Failed to migrate slice '${slice}' to facility-scoped path. ` +
          `Legacy data returned without completing migration.`,
          err,
        );
      }
      return sortedData;
    }

    const data: { [key: string]: any } = {};
    legacySnapshot.docs.forEach(d => {
      const docData = d.data();
      const docId = docData.id;
      if (docData && docId) {
        data[docId] = docData;
      }
    });

    // Auto-migrate to the new facility-scoped path so subsequent reads use
    // the correct location. The legacy data is NOT deleted (safe migration).
    console.log(
      `[Migration] Migrating slice '${slice}' from legacy path to ` +
      `facility-scoped path for facility '${facilityId}'.`
    );
    try {
      await this.saveSlice(facilityId, slice, data);
      console.log(`[Migration] Slice '${slice}' migrated successfully.`);
    } catch (err) {
      console.error(
        `[Migration] Failed to migrate slice '${slice}' to facility-scoped path. ` +
        `Legacy data returned without completing migration.`,
        err,
      );
    }
    return data;
  }


  static async probeUserRoots(uid: string, facilityId: string) {
    const roots = [
      collection(db, 'users', uid, 'facilities', facilityId, 'slices'),
      collection(db, 'users', uid, 'slices'),
      collection(db, 'userdbs', uid, 'slices'),
      collection(db, 'userdbs', uid, 'facilities', facilityId, 'slices'),
    ];

    for (const root of roots) {
      const snap = await getDocs(query(root, limit(1)));
      console.log(`[probeUserRoots] ${root.path} -> count=${snap.size}`);
    }
  }

  static async migrateSlicesToFacilityScope(
    facilityId: string,
  ): Promise<{ migrated: StorageSlice[]; skipped: StorageSlice[]; failed: StorageSlice[] }> {
    const user = await getCurrentUser();
    if (!user) {
      console.warn('[Migration] Cannot migrate slices: user is not authenticated.');
      return { migrated: [], skipped: [], failed: [] };
    }

    const migrated: StorageSlice[] = [];
    const skipped: StorageSlice[] = [];
    const failed: StorageSlice[] = [];

    for (const slice of STORAGE_SLICES) {
      try {
        const newCollection = collection(db, 'users', user.uid, 'facilities', facilityId, slice);
        const legacyCollection = collection(db, 'users', user.uid, slice);
        const [newSnapshot, legacySnapshot] = await Promise.all([
          getDocs(newCollection),
          getDocs(legacyCollection),
        ]);

        if (!newSnapshot.empty) {
          skipped.push(slice);
          continue;
        }

        if (legacySnapshot.empty) {
          skipped.push(slice);
          continue;
        }

        if (slice === 'mutationLog') {
          const data: any[] = [];
          legacySnapshot.docs.forEach(doc => data.push(doc.data()));
          const sortedData = data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          await this.saveSlice(facilityId, slice, sortedData);
          migrated.push(slice);
          console.log(
            `[Migration] Slice '${slice}' migrated to facility-scoped path for facility '${facilityId}'.`
          );
          continue;
        }

        const data: { [key: string]: any } = {};
        legacySnapshot.docs.forEach(doc => {
          const docData = doc.data();
          const docId = docData.id;
          if (docData && docId) {
            data[docId] = docData;
          }
        });

        await this.saveSlice(facilityId, slice, data);
        migrated.push(slice);
        console.log(
          `[Migration] Slice '${slice}' migrated to facility-scoped path for facility '${facilityId}'.`
        );
      } catch (err) {
        console.error(
          `[Migration] Failed to migrate slice '${slice}' for facility '${facilityId}'.`,
          err,
        );
        failed.push(slice);
      }
    }

    console.log(
      `[Migration] Complete for facility '${facilityId}'. ` +
      `Migrated: [${migrated.join(', ')}], ` +
      `Skipped: [${skipped.join(', ')}], ` +
      `Failed: [${failed.join(', ')}].`
    );
    return { migrated, skipped, failed };
  }

  static async restoreSliceFromPrev(facilityId: string, slice: StorageSlice): Promise<boolean> {
    const prevKey = this.getPrevSliceKey(facilityId, slice);
    const key = this.getSliceKey(facilityId, slice);
    
    const prev = await idbGet<string>(prevKey);
    if (prev) {
      await idbSet(key, prev);
      return true;
    }
    return false;
  }

  private static async saveSliceWithRetry(
    facilityId: string,
    slice: StorageSlice,
    data: any,
  ): Promise<SliceSaveResult> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= SLICE_SAVE_MAX_RETRIES; attempt++) {
      try {
        await this.saveSlice(facilityId, slice, data);
        return { slice, success: true };
      } catch (err) {
        lastError = err;
        if (attempt < SLICE_SAVE_MAX_RETRIES) {
          const delayMs = SLICE_SAVE_RETRY_BASE_MS * Math.pow(2, attempt);
          console.warn(
            `[Sync] Slice '${slice}' save failed (attempt ${attempt + 1}/${SLICE_SAVE_MAX_RETRIES + 1}). ` +
            `Retrying in ${delayMs} ms…`,
            err,
          );
          await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    console.error(`[Sync] Slice '${slice}' failed after ${SLICE_SAVE_MAX_RETRIES + 1} attempts.`, lastError);
    return { slice, success: false, error: lastError };
  }

  static async saveSlices(
    facilityId: string,
    store: FacilityStore,
    changedSlices: StorageSlice[],
  ): Promise<SaveSlicesResult> {
    const emptyResult: SaveSlicesResult = {
      allSucceeded: true,
      succeededSlices: [],
      failedSlices: [],
      results: [],
    };

    if (changedSlices.length === 0) {
      return emptyResult;
    }

    const user = await getCurrentUser();
    if (!user) {
      const authErr = new Error("Cannot save slices: user is not authenticated.");
      const results: SliceSaveResult[] = changedSlices.map((slice) => ({
        slice,
        success: false,
        error: authErr,
      }));
      return {
        allSucceeded: false,
        succeededSlices: [],
        failedSlices: [...changedSlices],
        results,
      };
    }

    eventBus.emit('sync-start', { slices: changedSlices });
    console.log(`[Sync] Saving slices to Firestore: ${changedSlices.join(', ')}`);

    const results: SliceSaveResult[] = [];

    for (const slice of changedSlices) {
      const result = await this.saveSliceWithRetry(facilityId, slice, store[slice]);
      results.push(result);
    }

    const succeededSlices = results.filter((r) => r.success).map((r) => r.slice);
    const failedSlices = results.filter((r) => !r.success).map((r) => r.slice);
    const allSucceeded = failedSlices.length === 0;

    if (allSucceeded) {
      console.log(`[Sync] All slices saved to Firestore successfully.`);
    } else {
      console.error(
        `[Sync] Partial slice save failure — failed: [${failedSlices.join(', ')}], ` +
        `succeeded: [${succeededSlices.join(', ')}].`,
      );
    }

    eventBus.emit('sync-end', { allSucceeded, failedSlices });

    return { allSucceeded, succeededSlices, failedSlices, results };
  }

  static async restoreAllSlicesFromPrev(facilityId: string): Promise<void> {
    const promises = STORAGE_SLICES.map((slice) => 
      this.restoreSliceFromPrev(facilityId, slice)
    );
    await Promise.all(promises);
  }

  static async clearAllSlices(facilityId: string): Promise<void> {
    return Promise.resolve();
  }

  static async writeSyncSignal(
    facilityId: string,
    changedSlices: StorageSlice[],
    sessionId: string,
  ): Promise<void> {
    try {
      const user = await getCurrentUser();
      if (!user) return;
      const signalRef = doc(db, 'users', user.uid, 'meta', 'sync');
      await setDoc(signalRef, {
        lastUpdatedAt: new Date().toISOString(),
        sessionId,
        facilityId,
        changedSlices,
      });
    } catch (err) {
      console.warn('[Sync] Failed to write sync signal:', err);
    }
  }
}

export function resolveActiveFacilityId(meta: any, remoteHints?: string[]): string {
  if (meta?.activeFacilityId) return meta.activeFacilityId;
  if (remoteHints && remoteHints.length > 0) return remoteHints[0];
  return 'fac-default';
}

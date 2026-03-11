
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

const inflightSliceLoads = new Map<string, Promise<Record<string, any> | null>>();

/** Returns true when a Firestore error is a permission-denied error. */
function isPermissionDenied(err: unknown): boolean {
  return !!(
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'permission-denied'
  );
}

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

  static loadSlice(facilityId: string, sliceName: StorageSlice): Promise<Record<string, any> | null> {
    // Deduplicate concurrent in-flight loads for the same slice.
    // getCurrentUser is called inside _loadSliceInternal so the dedup key must be
    // computed asynchronously; we store the whole outer promise in the map so that
    // any subsequent caller that arrives before the first resolves gets the same result.
    const pendingKey = `pending::${facilityId}::${sliceName}`;
    const inflight = inflightSliceLoads.get(pendingKey);
    if (inflight) return inflight;

    const promise = this._loadSliceInternal(facilityId, sliceName).finally(() => {
      inflightSliceLoads.delete(pendingKey);
    });
    inflightSliceLoads.set(pendingKey, promise);
    return promise;
  }

  private static async _loadSliceInternal(facilityId: string, sliceName: StorageSlice): Promise<Record<string, any> | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    const uid = user.uid;

    // 1. Try facility-scoped collection: users/{uid}/facilities/{facilityId}/{sliceName}
    const facilityCol = collection(db, 'users', uid, 'facilities', facilityId, sliceName);
    const facilitySnap = await getDocs(facilityCol);

    if (!facilitySnap.empty) {
      const result: Record<string, any> = {};
      facilitySnap.docs.forEach(d => {
        if (d.id) result[d.id] = d.data();
      });
      return result;
    }

    // 2. Fall back to legacy path: users/{uid}/{sliceName}
    //    A permission-denied error means the path doesn't exist or isn't accessible —
    //    treat it as "not found" and continue rather than aborting the whole load.
    let legacySnap;
    try {
      const legacyCol = collection(db, 'users', uid, sliceName);
      legacySnap = await getDocs(legacyCol);
    } catch (err) {
      if (isPermissionDenied(err)) {
        console.warn(`[loadSlice] Permission denied on legacy path users/${uid}/${sliceName}. Skipping legacy probe.`);
        return null;
      }
      throw err;
    }

    if (legacySnap.empty) {
      return null;
    }

    // Build result from legacy docs
    const result: Record<string, any> = {};
    legacySnap.docs.forEach(d => {
      if (d.id) result[d.id] = d.data();
    });

    if (Object.keys(result).length === 0) {
      return null;
    }

    // 3. Auto-migrate to facility-scoped path (non-destructive: legacy data is NOT deleted)
    try {
      const targetCol = collection(db, 'users', uid, 'facilities', facilityId, sliceName);
      const batch = writeBatch(db);
      legacySnap.docs.forEach(d => {
        if (d.id) batch.set(doc(targetCol, d.id), d.data());
      });
      await batch.commit();
      console.log(`[Migration] Slice '${sliceName}' promoted to facility-scoped path for facility '${facilityId}'.`);
    } catch (err) {
      console.warn(`[Migration] Failed to promote slice '${sliceName}':`, err);
    }

    return result;
  }

  /** @deprecated Use {@link StorageRepository.loadSlice} directly — deduplication is now built-in. */
  static loadSliceCached(facilityId: string, sliceName: StorageSlice): Promise<Record<string, any> | null> {
    return this.loadSlice(facilityId, sliceName);
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

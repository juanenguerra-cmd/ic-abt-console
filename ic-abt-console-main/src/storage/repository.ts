import { collection, doc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { FacilityStore, UnifiedDB } from "../domain/models";
import { idbGet, idbSet } from "./idb";
import { DB_KEY_MAIN } from "../constants/storageKeys";
import { eventBus } from '../services/eventBus';
import { getCurrentUser, db } from "../services/firebase";

export const STORAGE_SLICES = [
  "residents",
  "abts",
  "infections",
  "vaxEvents",
  "auditSessions",
  "infectionControlAuditSessions",
  "notifications",
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

  /**
   * Write a single slice to Firestore.
   *
   * The remote path is facility-scoped:
   *   users/{uid}/facilities/{facilityId}/{slice}/{docId}
   *
   * Both `saveSlice` and `loadSlice` must use the same path so reads and
   * writes remain aligned.
   */
  static async saveSlice(facilityId: string, slice: StorageSlice, data: any): Promise<void> {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error(`[Sync] Cannot save slice '${slice}': user is not authenticated.`);
    }

    // Facility-scoped Firestore path — facilityId is explicit in the hierarchy.
    const sliceCollection = collection(db, 'users', user.uid, 'facilities', facilityId, slice);
    const batch = writeBatch(db);

    // data may be a Record<string, T> or an array — handle both shapes.
    const items: object[] = Array.isArray(data)
      ? (data as object[])
      : Object.values(data as Record<string, object>);
    items.forEach((item: any) => {
        // The item must have an `id` property to be used as the document ID.
        if (item && item.id) {
            const docRef = doc(sliceCollection, item.id);
            batch.set(docRef, item);
        }
    });

    await batch.commit();
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
      const data: { [key: string]: any } = {};
      snapshot.docs.forEach(doc => {
        const docData = doc.data();
        if (docData && docData.id) {
          data[docData.id] = docData;
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
    const data: { [key: string]: any } = {};
    legacySnapshot.docs.forEach(doc => {
      const docData = doc.data();
      if (docData && docData.id) {
        data[docData.id] = docData;
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

  /**
   * Explicitly migrate all slices for a facility from the legacy user-only
   * Firestore path to the facility-scoped path.
   *
   * Legacy path: users/{uid}/{slice}/{docId}
   * New path:    users/{uid}/facilities/{facilityId}/{slice}/{docId}
   *
   * This is a safe, non-destructive operation — existing data at the legacy
   * path is preserved. Slices that already have data at the new path are
   * skipped to avoid overwriting newer writes.
   *
   * Call this once per facility after deploying the facility-scoping fix to
   * ensure any pre-existing remote data is moved to the correct path.
   */
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
        // Fetch both the new path and the legacy path concurrently.
        const newCollection = collection(db, 'users', user.uid, 'facilities', facilityId, slice);
        const legacyCollection = collection(db, 'users', user.uid, slice);
        const [newSnapshot, legacySnapshot] = await Promise.all([
          getDocs(newCollection),
          getDocs(legacyCollection),
        ]);

        // Skip slices that already have data at the new facility-scoped path.
        if (!newSnapshot.empty) {
          skipped.push(slice);
          continue;
        }

        if (legacySnapshot.empty) {
          skipped.push(slice);
          continue;
        }

        // Parse legacy data.
        const data: { [key: string]: any } = {};
        legacySnapshot.docs.forEach(doc => {
          const docData = doc.data();
          if (docData && docData.id) {
            data[docData.id] = docData;
          }
        });

        // Write to the new facility-scoped path.
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
    // This is a legacy IndexedDB function and is no longer used for Firestore-backed slices.
    const prevKey = this.getPrevSliceKey(facilityId, slice);
    const key = this.getSliceKey(facilityId, slice);
    
    const prev = await idbGet<string>(prevKey);
    if (prev) {
      await idbSet(key, prev);
      return true;
    }
    return false;
  }

  /**
   * Attempt to write a single slice to Firestore, retrying up to
   * {@link SLICE_SAVE_MAX_RETRIES} times on failure.
   *
   * Returns a {@link SliceSaveResult} — never throws.
   */
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
          // Exponential back-off: 500 ms, 1 000 ms, 2 000 ms, …
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

  /**
   * Save multiple slices to Firestore sequentially, with per-slice retry.
   *
   * Key guarantees:
   * - Never throws: partial failures are captured in the returned result.
   * - Sequential execution prevents uncontrolled concurrent writes.
   * - Returns a {@link SaveSlicesResult} so callers can distinguish full,
   *   partial, and total remote failures and act accordingly.
   */
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
      // Authentication failure is a hard stop — surface it as a total failure
      // so callers do not treat it as a silent no-op.
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

    // Sequential execution — avoids uncontrolled concurrent writes and makes
    // per-slice failures easy to isolate and log.
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

  static async mergeSlicesIntoDB(db: UnifiedDB): Promise<void> {
    const activeFacilityId = db.data.facilities.activeFacilityId;
    const store = db.data.facilityData[activeFacilityId];
    if (!store) return;

    const promises = STORAGE_SLICES.map(async (slice) => {
      const data = await this.loadSlice(activeFacilityId, slice);
      if (data) {
        // @ts-ignore
        store[slice] = data;
      }
    });

    await Promise.all(promises);
  }

  static async restoreAllSlicesFromPrev(facilityId: string): Promise<void> {
    // This is a legacy IndexedDB function and will not restore Firestore data.
    const promises = STORAGE_SLICES.map((slice) => 
      this.restoreSliceFromPrev(facilityId, slice)
    );
    await Promise.all(promises);
  }

  static async clearAllSlices(facilityId: string): Promise<void> {
    // This method no longer clears application data from IndexedDB as it's now stored in Firestore.
    return Promise.resolve();
  }

  /**
   * Write a lightweight sync-signal document to Firestore so that other
   * devices can detect the change via an `onSnapshot` listener and trigger
   * remote reconciliation without polling.
   *
   * Path: users/{uid}/meta/sync
   *
   * The `sessionId` field lets the listener on the writing device skip its own
   * signal and avoid a pointless reconciliation round-trip.
   *
   * This is a best-effort write — failures are swallowed so they never block
   * the main save path.
   */
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

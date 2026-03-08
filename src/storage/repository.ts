import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { FacilityStore, UnifiedDB } from "../domain/models";
import { idbGet, idbSet } from "./idb";
import { DB_KEY_MAIN } from "../constants/storageKeys";
import { eventBus } from '@/src/services/eventBus';
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
      console.warn(`[Sync] Attempted to save slice '${slice}' without an authenticated user. Skipping.`);
      return;
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
   * Uses the same facility-scoped path as {@link saveSlice}:
   *   users/{uid}/facilities/{facilityId}/{slice}/{docId}
   */
  static async loadSlice(facilityId: string, slice: StorageSlice): Promise<any | null> {
    const user = await getCurrentUser();
    if (!user) {
      console.warn(`Attempted to load slice '${slice}' without an authenticated user. Skipping.`);
      return null;
    }

    // Facility-scoped path — must match saveSlice exactly.
    const sliceCollection = collection(db, 'users', user.uid, 'facilities', facilityId, slice);
    const snapshot = await getDocs(sliceCollection);

    if (snapshot.empty) {
        return null;
    }
    
    const data: { [key: string]: any } = {};
    snapshot.docs.forEach(doc => {
        const docData = doc.data();
        if (docData && docData.id) {
            data[docData.id] = docData;
        }
    });
    return data;
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
}

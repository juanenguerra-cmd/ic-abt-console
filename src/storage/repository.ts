import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { FacilityStore, UnifiedDB } from "../domain/models";
import { idbGet, idbSet, idbRemove } from "./idb";
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

export class StorageRepository {
  static getSliceKey(facilityId: string, slice: string): string {
    return `${DB_KEY_MAIN}_slice_${facilityId}_${slice}`;
  }

  static getPrevSliceKey(facilityId: string, slice: string): string {
    return `${DB_KEY_MAIN}_prev_slice_${facilityId}_${slice}`;
  }

  static async saveSlice(facilityId: string, slice: StorageSlice, data: any): Promise<void> {
    const user = await getCurrentUser();
    if (!user) {
      console.warn(`Attempted to save slice '${slice}' without an authenticated user. Skipping.`);
      return;
    }

    const sliceCollection = collection(db, 'users', user.uid, slice);
    const batch = writeBatch(db);

    // data is an array of items. We write each item as a document.
    data.forEach((item: any) => {
        // The item must have an `id` property to be used as the document ID.
        if (item.id) {
            const docRef = doc(sliceCollection, item.id);
            batch.set(docRef, item);
        }
    });

    await batch.commit();
  }

  static async loadSlice(facilityId: string, slice: StorageSlice): Promise<any | null> {
    const user = await getCurrentUser();
    if (!user) {
      console.warn(`Attempted to load slice '${slice}' without an authenticated user. Skipping.`);
      return null;
    }

    const sliceCollection = collection(db, 'users', user.uid, slice);
    const snapshot = await getDocs(sliceCollection);

    if (snapshot.empty) {
        // Return null to indicate that no data exists.
        return null;
    }
    
    return snapshot.docs.map(doc => doc.data());
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

  static async saveSlices(facilityId: string, store: FacilityStore, changedSlices: StorageSlice[]): Promise<void> {
    eventBus.emit('sync-start');
    try {
        const promises = changedSlices.map((slice) => 
          this.saveSlice(facilityId, slice, store[slice])
        );
        await Promise.all(promises);
    } finally {
        eventBus.emit('sync-end');
    }
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

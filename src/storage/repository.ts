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

  static async loadSlice(facilityId: string, slice: StorageSlice): Promise<{ [key: string]: any } | null> {
    const user = await getCurrentUser();
    if (!user) {
      console.warn(`Attempted to load slice '${slice}' without an authenticated user. Skipping.`);
      return null;
    }

    const sliceCollection = collection(db, 'users', user.uid, slice);
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

  static async saveSlices(facilityId: string, store: FacilityStore, changedSlices: StorageSlice[]): Promise<void> {
    if (changedSlices.length === 0) {
        return;
    }
    
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Cannot save slices: user is not authenticated.");
    }

    eventBus.emit('sync-start');

    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const batch = writeBatch(db);

            for (const slice of changedSlices) {
                const sliceData = store[slice];
                const sliceCollection = collection(db, 'users', user.uid, slice);
                
                if (sliceData) {
                    const items = Object.values(sliceData as any);
                    items.forEach((item: any) => {
                        if (item && item.id) {
                            const docRef = doc(sliceCollection, item.id);
                            batch.set(docRef, item);
                        }
                    });
                }
            }

            await batch.commit();
            eventBus.emit('sync-end');
            console.log("Slices saved successfully to remote.");
            return; // Success
        } catch (error) {
            console.error(`Failed to save slices to remote (attempt ${attempt}/${MAX_RETRIES}):`, error);
            if (attempt === MAX_RETRIES) {
                eventBus.emit('sync-end');
                window.dispatchEvent(new Event('backup-failed'));
                throw error;
            }
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
        }
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

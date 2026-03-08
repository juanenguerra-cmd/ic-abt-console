import { FacilityStore, UnifiedDB } from "../domain/models";
import { idbGet, idbSet, idbRemove } from "./idb";
import { DB_KEY_MAIN } from "../constants/storageKeys";
import { eventBus } from '@/src/services/eventBus';

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
    const key = this.getSliceKey(facilityId, slice);
    const prevKey = this.getPrevSliceKey(facilityId, slice);

    // Backup current slice to PREV before overwriting
    const current = await idbGet<string>(key);
    if (current) {
      await idbSet(prevKey, current).catch(() => {});
    }

    await idbSet(key, JSON.stringify(data));
  }

  static async loadSlice(facilityId: string, slice: StorageSlice): Promise<any | null> {
    const key = this.getSliceKey(facilityId, slice);
    const raw = await idbGet<string>(key);
    return raw ? JSON.parse(raw) : null;
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
    const promises = STORAGE_SLICES.map((slice) => 
      this.restoreSliceFromPrev(facilityId, slice)
    );
    await Promise.all(promises);
  }

  static async clearAllSlices(facilityId: string): Promise<void> {
    const promises = STORAGE_SLICES.flatMap((slice) => [
      idbRemove(this.getSliceKey(facilityId, slice)),
      idbRemove(this.getPrevSliceKey(facilityId, slice))
    ]);
    await Promise.all(promises).catch(() => {});
  }
}

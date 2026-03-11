import { UnifiedDB } from "../domain/models";
import { getCurrentUser } from "./firebase";
import { StorageRepository, STORAGE_SLICES } from "../storage/repository";

export const remoteFetchDb = async (): Promise<UnifiedDB | null> => {
  const user = await getCurrentUser();
  if (!user) {
    console.warn("[remoteFetchDb] No authenticated user. Remote fetch skipped.");
    return null;
  }

  const metadata = await StorageRepository.loadMetadata();
  if (!metadata) return null;

  const db = metadata as UnifiedDB;
  db.data.facilityData = {};

  const activeFacilityId = db.data.facilities?.activeFacilityId;
  if (activeFacilityId) {
    db.data.facilityData[activeFacilityId] = {} as any;

    await Promise.all(
      STORAGE_SLICES.map(async (slice) => {
        const data = await StorageRepository.loadSlice(user.uid, activeFacilityId, slice);
        if (data) {
          // @ts-ignore
          db.data.facilityData[activeFacilityId][slice] = data;
        }
      })
    );

    const facMeta = await StorageRepository.loadFacilityMeta(activeFacilityId);
    if (facMeta) {
      db.data.facilityData[activeFacilityId].currentRole = facMeta.currentRole;
      db.data.facilityData[activeFacilityId].lineListOverrides = facMeta.lineListOverrides;
      db.data.facilityData[activeFacilityId].dismissedRuleKeys = facMeta.dismissedRuleKeys;
      db.data.facilityData[activeFacilityId].notificationMeta = facMeta.notificationMeta;
    }
  }

  return db;
};

export const remoteSaveDb = async (db: UnifiedDB): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) {
    console.warn("[remoteSaveDb] No authenticated user. Remote save skipped.");
    return false;
  }

  await StorageRepository.saveMetadata(db);
  return true;
};

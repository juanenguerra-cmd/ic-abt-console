import { UnifiedDB } from "../domain/models";
import { getCurrentUser } from "./firebase";
import { StorageRepository, STORAGE_SLICES } from "../storage/repository";

const REMOTE_FETCH_TIMEOUT_MS = 15_000;

export const remoteFetchDb = async (): Promise<UnifiedDB | null> => {
  const fetchPromise = (async () => {
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

      const sliceResults = await Promise.allSettled(
        STORAGE_SLICES.map(async (slice) => {
          const data = await StorageRepository.loadSlice(activeFacilityId, slice);
          return { slice, data };
        })
      );

      for (const result of sliceResults) {
        if (result.status === 'fulfilled') {
          const { slice, data } = result.value;
          if (data != null) {
            // @ts-ignore
            db.data.facilityData[activeFacilityId][slice] = data;
          }
        } else {
          console.error('[remoteFetchDb] Slice load failed:', result.reason);
        }
      }

      const facMeta = await StorageRepository.loadFacilityMeta(activeFacilityId);
      if (facMeta) {
        db.data.facilityData[activeFacilityId].currentRole = facMeta.currentRole;
        db.data.facilityData[activeFacilityId].lineListOverrides = facMeta.lineListOverrides;
        db.data.facilityData[activeFacilityId].dismissedRuleKeys = facMeta.dismissedRuleKeys;
        db.data.facilityData[activeFacilityId].notificationMeta = facMeta.notificationMeta;
      }
    }

    return db;
  })();

  const timeoutPromise = new Promise<null>((resolve) =>
    setTimeout(() => {
      console.warn('[remoteFetchDb] Remote fetch timed out, falling back to local.');
      resolve(null);
    }, REMOTE_FETCH_TIMEOUT_MS)
  );

  return Promise.race([fetchPromise, timeoutPromise]);
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

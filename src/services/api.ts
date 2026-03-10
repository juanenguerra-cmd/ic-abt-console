import { UnifiedDB } from "../domain/models";
import { getCurrentUser } from "./firebase";
import { StorageRepository, STORAGE_SLICES } from "../storage/repository";

const waitUntilAuthenticated = async (timeout = 5000): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const user = await getCurrentUser();
        if (user) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    return false;
};

export const remoteFetchDb = async (): Promise<UnifiedDB | null> => {
    const isAuthenticated = await waitUntilAuthenticated();
    if (!isAuthenticated) {
        console.warn("Attempted to fetch remote DB without an authenticated user. Returning null.");
        return null;
    }

    const metadata = await StorageRepository.loadMetadata();
    if (!metadata) {
        return null;
    }

    const db = metadata as UnifiedDB;
    db.data.facilityData = {};

    const activeFacilityId = db.data.facilities?.activeFacilityId;
    if (activeFacilityId) {
        db.data.facilityData[activeFacilityId] = {} as any;
        const promises = STORAGE_SLICES.map(async (slice) => {
            const data = await StorageRepository.loadSlice(activeFacilityId, slice);
            if (data) {
                // @ts-ignore
                db.data.facilityData[activeFacilityId][slice] = data;
            }
        });
        await Promise.all(promises);

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

export const remoteSaveDb = async (db: UnifiedDB): Promise<void> => {
    const isAuthenticated = await waitUntilAuthenticated();
    if (!isAuthenticated) {
        console.warn("Attempted to save remote DB without an authenticated user. Skipping.");
        return;
    }

    await StorageRepository.saveMetadata(db);

    const activeFacilityId = db.data.facilities?.activeFacilityId;
    if (activeFacilityId) {
        const store = db.data.facilityData[activeFacilityId];
        if (store) {
            await StorageRepository.saveSlices(activeFacilityId, store, STORAGE_SLICES);
        }
    }
};

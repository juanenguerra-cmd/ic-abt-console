import { UnifiedDB } from "../domain/models";
import { getCurrentUser, db } from "./firebase";
import { StorageRepository, STORAGE_SLICES } from "../storage/repository";
import { doc, setDoc } from "firebase/firestore";

export const remoteFetchDb = async (): Promise<UnifiedDB | null> => {
    const user = await getCurrentUser();
    if (!user) {
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

export const remoteSaveDb = async (db: UnifiedDB, sessionId?: string): Promise<void> => {
    const user = await getCurrentUser();
    if (!user) {
        console.warn("Attempted to save remote DB without an authenticated user. Skipping.");
        return;
    }

    await StorageRepository.saveMetadata(db);
    
    const activeFacilityId = db.data.facilities.activeFacilityId;
    const store = db.data.facilityData[activeFacilityId];
    const slicesToSave = [...STORAGE_SLICES];

    if (store) {
        const sliceResult = await StorageRepository.saveSlices(activeFacilityId, store, slicesToSave);
        if (!sliceResult.allSucceeded) {
            console.warn(`Partial slice save failure during remote save. Failed: ${sliceResult.failedSlices.join(', ')}`);
        }
    }

    if (sessionId) {
        const signalRef = doc(db, 'users', user.uid, 'meta', 'sync');
        try {
            await setDoc(signalRef, {
                sessionId: sessionId,
                lastUpdatedAt: db.updatedAt,
                facilityId: activeFacilityId,
                changedSlices: slicesToSave,
            });
            console.log(`[API] Fired sync signal for session ${sessionId}.`);
        } catch (e) {
            console.error('[API] Failed to fire sync signal:', e);
        }
    }
};

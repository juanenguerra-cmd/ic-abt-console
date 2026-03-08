import { getFunctions, httpsCallable } from "firebase/functions";
import { UnifiedDB } from "../storage/engine";
import { getCurrentUser } from "./firebase";

const functions = getFunctions();

const getDb = httpsCallable(functions, 'getDb');
const setDb = httpsCallable(functions, 'setDb');

export const remoteFetchDb = async (): Promise<UnifiedDB> => {
    const user = await getCurrentUser();
    if (!user) {
        console.warn("Attempted to fetch remote DB without an authenticated user. Returning empty DB.");
        // Return a default, empty, or placeholder DB structure to prevent downstream errors.
        return {} as UnifiedDB;
    }

    const result = await getDb();
    return result.data as UnifiedDB;
};

export const remoteSaveDb = async (db: UnifiedDB): Promise<void> => {
    const user = await getCurrentUser();
    if (!user) {
        console.warn("Attempted to save remote DB without an authenticated user. Skipping.");
        return;
    }

    await setDb(db);
};

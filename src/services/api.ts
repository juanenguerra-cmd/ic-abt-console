import { getFunctions, httpsCallable } from "firebase/functions";
import { UnifiedDB } from "../storage/engine";
import { auth } from "./firebase";

const functions = getFunctions();

const getDb = httpsCallable(functions, 'getDb');
const setDb = httpsCallable(functions, 'setDb');

export const remoteFetchDb = async (): Promise<UnifiedDB> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    const result = await getDb();
    return result.data as UnifiedDB;
};

export const remoteSaveDb = async (db: UnifiedDB): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");

    await setDb(db);
};

import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  User,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import { getFirestore, Firestore, terminate, clearIndexedDbPersistence, initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing Firebase env var: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv("VITE_FIREBASE_API_KEY"),
  authDomain: requireEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: requireEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: requireEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requireEnv("VITE_FIREBASE_APP_ID"),
};

const app: FirebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db: Firestore = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
const functions = getFunctions(app);
const storage = getStorage(app);

let authReadyPromise: Promise<User | null> | null = null;

export function waitForAuthReady(): Promise<User | null> {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, async (user) => {
        try {
          if (user) {
            unsub();
            resolve(user);
            return;
          }

          // Anonymous fallback for internal/local-first use
          const cred = await signInAnonymously(auth);
          unsub();
          resolve(cred.user);
        } catch (error) {
          console.error("Auth bootstrap failed:", error);
          unsub();
          resolve(null);
        }
      });
    });
  }

  return authReadyPromise;
}

export async function getCurrentUser(): Promise<User | null> {
  return auth.currentUser ?? (await waitForAuthReady());
}

/**
 * Shuts down the active Firestore instance and clears its local IndexedDB cache.
 * This is a recovery mechanism for "Unexpected state" errors.
 * The page MUST be reloaded after calling this function.
 */
export const clearFirestoreCache = async (): Promise<void> => {
  if (!db) return;
  try {
    console.warn("Terminating Firestore instance and clearing persistence...");
    // Shut down the existing DB connection.
    await terminate(db);
    // Get a new, temporary DB instance to clear the cache for the app.
    await clearIndexedDbPersistence(getFirestore(app));
    console.warn("Firestore persistence cleared.");
  } catch (error) {
    console.error("Failed to clear Firestore persistence:", error);
    // This is a last-ditch effort, if it fails, the user may need to clear manually.
    throw new Error("Automatic cache clearing failed. Please clear your browser\'s site data for this domain.");
  }
};

export { app, auth, db, functions, storage };

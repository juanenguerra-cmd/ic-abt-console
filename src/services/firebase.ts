import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, User } from "firebase/auth";
import { 
  getFirestore, 
  connectFirestoreEmulator, 
  clearIndexedDbPersistence, 
  terminate, 
  Firestore 
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// WARNING: Replace this with your actual Firebase config object.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA...",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "...",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "...",
};

let app: FirebaseApp;
let auth: any;
let db: Firestore;
let functions: any;
let storage: any;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);
  storage = getStorage(app);
} catch (e) {
  console.error("Firebase initialization failed:", e);
  // In a real app, you might want to show a global error message.
}

if (window.location.hostname === "localhost" && db) {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, "http://localhost:9099");
    connectFunctionsEmulator(functions, "localhost", 5001);
    connectStorageEmulator(storage, "localhost", 9199);
    console.log("Connected to Firebase emulators");
  } catch (e) {
    console.error("Firebase emulator connection failed:", e);
  }
}

/**
 * A utility function to get the current signed-in user.
 * @returns The current Firebase user object or null.
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

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

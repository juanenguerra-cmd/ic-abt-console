// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAkHhm5rS2QNsOTPzqlgkViMcMXwujLl0Y",
  authDomain: "infection-control-progra-6110a.firebaseapp.com",
  projectId: "infection-control-progra-6110a",
  storageBucket: "infection-control-progra-6110a.firebasestorage.app",
  messagingSenderId: "9546433510",
  appId: "1:9546433510:web:8e3eccd34f857da027cc27",
  measurementId: "G-K2HGQCMZYY"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/**
 * Returns a promise that resolves with the authenticated user, or null if not authenticated.
 * This function is crucial for preventing race conditions where parts of the app
 * try to access user-specific data before authentication is fully initialized.
 */
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    // If the user is already available synchronously, resolve immediately.
    if (auth.currentUser) {
      return resolve(auth.currentUser);
    }
    // Otherwise, wait for the first auth state change.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Unsubscribe to only get the value once.
      resolve(user);
    });
  });
};

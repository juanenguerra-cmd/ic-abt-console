// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5qJ_qRmT78Ss718mVKLXll_1rPd306_A",
  authDomain: "ic-abt-console-44321826-ea0eb.firebaseapp.com",
  projectId: "ic-abt-console-44321826-ea0eb",
  storageBucket: "ic-abt-console-44321826-ea0eb.appspot.com",
  messagingSenderId: "1082693079493",
  appId: "1:1082693079493:web:07e4c5a3e7c36195b6a9d7"
  // measurementId is optional and can be added here later
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

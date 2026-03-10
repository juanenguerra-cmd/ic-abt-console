import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../index.css";
import { auth } from "../services/firebase"; // Import auth instance
import { onAuthStateChanged } from "firebase/auth"; // Import onAuthStateChanged

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Wait for auth state to be confirmed before rendering the app
onAuthStateChanged(auth, (user) => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

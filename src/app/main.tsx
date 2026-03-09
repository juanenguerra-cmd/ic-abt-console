import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../index.css";
import "../services/firebase"; // Initialize Firebase
import { logAppBanner } from "../debug/appBanner";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Print startup banner: version, build, env, SW status, sync mode.
// Helps distinguish app errors from browser-extension console noise.
logAppBanner();

// Register service worker for offline-first support.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

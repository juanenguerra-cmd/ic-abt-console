import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "../index.css";
import { AppProviders } from "./providers";
import { logAppBanner } from "../debug/appBanner";

logAppBanner();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);

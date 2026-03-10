/**
 * appBanner.ts
 *
 * Prints a concise startup banner to the browser console so that developers can
 * immediately confirm:
 *   - Which version / build is running
 *   - Which environment (development | production | staging)
 *   - Whether the PWA service worker is active
 *   - Which sync mode is configured
 *
 * This helps distinguish app-level problems from browser-extension console noise.
 * See docs/debugging-console-errors.md for a full guide on isolating extension
 * errors during development.
 *
 * The banner is a no-op in test environments.
 */

import { VERSION_HISTORY } from "../constants/versionHistory";

declare const __BUILD_ID__: string;

async function getSwStatus(): Promise<string> {
  if (!("serviceWorker" in navigator)) return "not supported";
  try {
    // Use no-arg form to find any registration in scope, regardless of exact path
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return "not registered";
    if (reg.active) return reg.active.state; // 'activated' | 'activating' | ...
    if (reg.installing) return "installing";
    if (reg.waiting) return "waiting";
    return "registered";
  } catch {
    return "unknown";
  }
}

/** Call once at app startup (from main.tsx). */
export async function logAppBanner(): Promise<void> {
  // Skip in test / SSR environments
  if (typeof window === "undefined" || typeof console === "undefined") return;
  // Skip if console.group is not available (some test runners strip it)
  if (typeof console.group !== "function") return;

  const version = VERSION_HISTORY[0]?.version ?? "unknown";
  const env = import.meta.env.MODE ?? "unknown";
  const buildHash = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'unknown';
  const swStatus = await getSwStatus();

  const bannerStyle = "font-weight:bold;color:#2563eb;font-size:11px";
  const labelStyle = "color:#6b7280;font-size:11px";
  const valueStyle = "color:#111827;font-size:11px";

  console.group("%c[IC ABT Console] — App Startup", bannerStyle);
  console.log("%cVersion    %c" + version, labelStyle, valueStyle);
  console.log("%cBuild      %c" + buildHash, labelStyle, valueStyle);
  console.log("%cEnv        %c" + env, labelStyle, valueStyle);
  console.log("%cSW status  %c" + swStatus, labelStyle, valueStyle);
  console.log("%cSync mode  %cfirebase + IDB outbox", labelStyle, valueStyle);
  console.log(
    "%cDebug tip  %cOpen in Incognito to filter extension noise. See docs/debugging-console-errors.md",
    labelStyle,
    valueStyle
  );
  console.groupEnd();
}

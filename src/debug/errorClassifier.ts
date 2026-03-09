/**
 * errorClassifier.ts
 *
 * Classifies runtime errors into three categories so developers can quickly
 * tell whether a console error is meaningful or just noise:
 *
 *   'extension'       – Originating from a browser extension (chrome-extension://,
 *                       moz-extension://, ERR_FAILED on extension URIs, etc.).
 *                       These are NEVER caused by app code and should be ignored
 *                       during debugging (see docs/debugging-console-errors.md).
 *
 *   'service-worker'  – Originating from the PWA service-worker or Cache Storage
 *                       API.  Usually transient; clear site data and reload.
 *
 *   'app'             – An actual application error that should be investigated
 *                       and fixed.
 */

export type ErrorKind = "extension" | "service-worker" | "app";

const EXTENSION_PATTERNS: RegExp[] = [
  /chrome-extension:\/\//i,
  /moz-extension:\/\//i,
  /safari-extension:\/\//i,
  /safari-web-extension:\/\//i,
  // "Failed to fetch dynamically imported module … chrome-extension://…"
  /dynamically imported module.*extension/i,
  // "Denying load of chrome-extension://… resources"
  /Denying load of.*extension/i,
  // net::ERR_FAILED on extension URIs
  /ERR_FAILED.*extension/i,
  /extension.*ERR_FAILED/i,
  // Generic extension:// scheme
  /[a-z]+-extension:\/\//i,
];

const SW_PATTERNS: RegExp[] = [
  /service.?worker/i,
  /\bsw\.js\b/i,
  /cache storage/i,
  /caches\.open/i,
  /workbox/i,
];

/**
 * Returns the kind of error based on its message and stack trace.
 * Pass `null` to get the default `'app'` classification.
 */
export function classifyError(error: Error | null | undefined): ErrorKind {
  if (!error) return "app";

  const text = [error.message ?? "", error.stack ?? ""].join(" ");

  if (EXTENSION_PATTERNS.some((re) => re.test(text))) return "extension";
  if (SW_PATTERNS.some((re) => re.test(text))) return "service-worker";

  return "app";
}

/**
 * Human-readable label for each error kind, suitable for console output.
 */
export const ERROR_KIND_LABEL: Record<ErrorKind, string> = {
  extension: "⚠️ BROWSER EXTENSION (safe to ignore)",
  "service-worker": "🔧 SERVICE WORKER / CACHE",
  app: "🔴 APP ERROR",
};

# Debugging Console Errors — Extension Noise vs. Real App Errors

## TL;DR

Console messages like the ones below are **not** caused by the IC ABT Console
application. They originate from browser extensions and should be ignored
during normal debugging:

```
Denying load of chrome-extension://... resources
chrome-extension://invalid/ net::ERR_FAILED
Failed to fetch dynamically imported module from chrome-extension://...
```

---

## Why These Errors Appear

Modern browsers let extensions inject scripts and load resources using the
`chrome-extension://` (Chrome/Edge) or `moz-extension://` (Firefox) URI
schemes. When an extension tries to load a resource that has been blocked
or whose manifest no longer matches the installed version, the browser
logs an error to the **shared** DevTools console — the same console that
shows app errors.

These errors are emitted by the browser / extension sandbox, **not** by the
app bundle. There is nothing to fix in the application code.

### Common error patterns and their origins

| Console message | Origin |
|---|---|
| `Denying load of chrome-extension://…` | Browser blocked an extension resource (policy or CSP) |
| `chrome-extension://invalid/ net::ERR_FAILED` | Extension tried to fetch an internal resource that no longer exists |
| `Failed to fetch dynamically imported module from chrome-extension://…` | Extension's own dynamic `import()` failed inside its own bundle |
| `Could not establish connection. Receiving end does not exist.` | Extension tried to message a tab/service-worker that has unloaded |

---

## How to Confirm an Error Is Extension-Related

1. **Open in Incognito / InPrivate mode** — extensions are disabled by default.
   If the error disappears, it was caused by an extension.

2. **Disable all extensions** — go to `chrome://extensions` (or `about:addons`
   in Firefox) and toggle them all off.  Reload the app and check the console.

3. **Check the error source URL** — in DevTools, errors show their source file.
   Any file path starting with `chrome-extension://`, `moz-extension://`, or
   similar is **not** from the app bundle.

4. **Use the app startup banner** — at every startup the app logs a
   `[IC ABT Console] — App Startup` group to the console.  This confirms the
   correct version, build hash, environment, and service-worker state.  If you
   see *only* extension errors before the banner, the app itself is loading
   correctly.

---

## Service Worker / Cache Issues

The PWA service worker (`/sw.js`) and the Workbox cache layers can also
produce console output:

| Message | Meaning |
|---|---|
| `Service worker installed` | SW registered successfully on first load |
| `Service worker activated` | SW is now in control of the page |
| `Service worker registration failed: …` | SW could not register (network error, HTTPS required, etc.) |
| Workbox `cache-first` / `network-first` messages | Cache strategy logs from vite-plugin-pwa |

### Troubleshooting service-worker errors

1. Open **DevTools → Application → Service Workers** and check the current
   state (`activated`, `waiting`, `installing`).
2. Click **"Update"** if a new version is waiting.
3. For a clean slate: **"Unregister"** the SW, then clear **Cache Storage**
   under the Application panel, and hard-reload (`Cmd+Shift+R` / `Ctrl+Shift+R`).
4. Service-worker errors that reference `sw.js` in the stack trace are **not**
   extension errors — investigate them as real issues.

---

## App Error Classification

The `ErrorBoundary` component (`src/app/ErrorBoundary.tsx`) and the
`classifyError` utility (`src/debug/errorClassifier.ts`) automatically
label every caught error with one of three categories:

| Label | Meaning | Action |
|---|---|---|
| 🔴 APP ERROR | Genuine app-level failure | Investigate and fix |
| 🔧 SERVICE WORKER / CACHE | PWA cache or SW problem | Clear cache and reload; check SW state |
| ⚠️ BROWSER EXTENSION (safe to ignore) | Extension-injected error | Open Incognito to confirm; ignore in app code |

The label appears both in the browser console and in the error-boundary UI
"Source" line, making it easy to triage without reading stack traces.

---

## App Debug Banner

On every page load the application prints a startup group to the DevTools
console:

```
[IC ABT Console] — App Startup
  Version    1.0.0
  Build      a1b2c3d          ← short git commit hash
  Env        production
  SW status  activated
  Sync mode  firebase + IDB outbox
  Debug tip  Open in Incognito to filter extension noise. See docs/debugging-console-errors.md
```

Use this banner to:

- **Confirm the correct build is deployed** — the build hash matches the
  deployed commit in CI.
- **Check SW state at a glance** — no need to open the Application panel.
- **Verify environment** — ensures `development` builds are not accidentally
  served in production.

---

## Quick Checklist for Debugging Session

- [ ] Open the app in **Incognito / InPrivate** mode first
- [ ] Confirm the **app startup banner** is visible in the console
- [ ] Note the **Build** hash and verify it matches the expected deploy
- [ ] Check **SW status** in the banner (should be `activated`)
- [ ] Filter the console to **Errors only** to reduce noise
- [ ] Ignore any messages whose source URL starts with `chrome-extension://`
      or `moz-extension://`
- [ ] For SW issues: open **DevTools → Application → Service Workers** and
      inspect state / update / unregister as needed
- [ ] For real app errors: copy the error details from the error-boundary UI
      and file an issue

---

## Do NOT Attempt to Suppress Extension Errors in App Code

Browser extensions run in a sandboxed context. The app has no mechanism to
intercept, catch, or silence errors that extensions emit to the shared
console.  Any attempt to do so (e.g., overriding `console.error` or adding a
global `window.onerror` filter) would be fragile, browser-version-dependent,
and would risk silencing real app errors.

The correct approach is documentation (this file) and the error-classification
labels described above.

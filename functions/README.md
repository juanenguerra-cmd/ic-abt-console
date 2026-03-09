# Firebase Cloud Functions

> **Important:** This directory contains **Firebase Cloud Functions** (Node.js, `firebase-functions` SDK).
> It is **NOT** a Cloudflare Pages Functions directory and will **not** be processed by Cloudflare's
> Worker runtime.

## Functions

| Name | Description |
|------|-------------|
| `getDb` | Fetches the user's packed `UnifiedDB` document from the `userdbs/{uid}` Firestore collection. Requires authentication. |
| `setDb` | Writes the user's packed `UnifiedDB` document to `userdbs/{uid}`. Requires authentication. |
| `createCustomToken` | Generates a Firebase custom auth token with optional additional claims. Admins may target other UIDs. |

## Deployment

Deploy with Firebase CLI:

```bash
firebase deploy --only functions
```

These functions are **not** deployed as part of the Cloudflare Pages build. Cloudflare only serves
the static SPA from the `dist/` directory. All serverless logic runs on Firebase's infrastructure.

## Why is this directory at the root?

Firebase CLI expects functions in `./functions` relative to `firebase.json`. This is a Firebase
project layout convention, not a Cloudflare convention.

If Cloudflare Pages tries to auto-detect `functions/` as a Pages Functions directory, it will fail
to build the Worker because `index.js` uses Firebase-specific APIs. If this causes build issues,
add a `functions/.cloudflare-ignore` marker or configure the Cloudflare Pages build settings to
skip the functions directory.

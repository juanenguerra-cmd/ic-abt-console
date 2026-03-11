const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize the Admin SDK using Application Default Credentials (ADC).
// When deployed to Cloud Functions / Cloud Run, ADC is provided automatically
// by the managed environment — no service account key file is required.
//
// For local development outside the emulator, set the environment variable:
//   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
// and then run: firebase emulators:start --only functions
//
// IMPORTANT: Never commit a service account key file to source control and
// never expose admin credentials to the client application.
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// LEGACY — getDb/setDb read/write to the 'userdbs/{uid}' collection, which is
// the old packed-document persistence path. The frontend no longer calls these
// functions; persistence is now handled by StorageRepository directly against
// the facility-scoped Firestore slice path: users/{uid}/facilities/{id}/{slice}.
// These exports are retained here because existing deployments may still have
// stored data at userdbs/{uid} that can be migrated. Do not call these from new
// frontend code.
exports.getDb = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  const uid = context.auth.uid;
  const docRef = db.collection("userdbs").doc(uid);
  const doc = await docRef.get();
  if (!doc.exists) {
    return {};
  } else {
    return doc.data();
  }
});

exports.setDb = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  const uid = context.auth.uid;
  const docRef = db.collection("userdbs").doc(uid);
  await docRef.set(data);
  return { success: true };
});

/**
 * createCustomToken — generates a Firebase custom auth token with custom claims.
 *
 * Uses Admin SDK `auth.createCustomToken(uid, additionalClaims)` which
 * replaces the legacy `FirebaseTokenGenerator` / database secret pattern.
 *
 * The client can exchange this token with `signInWithCustomToken(auth, token)`
 * (firebase/auth) to obtain a standard ID token that carries the new claims.
 *
 * Authorization:
 *   - Callers with the `admin` custom claim may pass an optional `data.uid` to
 *     create a token for a different user (e.g., to assign roles).
 *   - All other authenticated callers may only create a token for themselves.
 *
 * Optional `additionalClaims` (plain object) can be passed in `data.claims`
 * to embed custom attributes (e.g. { admin: true, facilityId: "..." }) into
 * the resulting token.
 */
exports.createCustomToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const isAdmin = context.auth.token && context.auth.token.admin === true;

  // Determine the target UID: admins may specify another user; others get their own.
  let targetUid = context.auth.uid;
  if (data && typeof data.uid === "string" && data.uid.length > 0) {
    if (!isAdmin) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only administrators may create tokens for other users."
      );
    }
    targetUid = data.uid;
  }

  const additionalClaims =
    data && typeof data.claims === "object" && data.claims !== null
      ? data.claims
      : undefined;

  const token = await auth.createCustomToken(targetUid, additionalClaims);
  return { token };
});

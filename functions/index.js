const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

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

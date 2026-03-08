import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  Unsubscribe,
  DocumentData,
  QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { CollectionName } from '../types';

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the facility-scoped Firestore collection reference.
 * Path: users/{uid}/facilities/{facilityId}/{collectionName}
 */
function facilityCollectionRef(uid: string, facilityId: string, collectionName: CollectionName) {
  return collection(db, 'users', uid, 'facilities', facilityId, collectionName);
}

/**
 * Returns a facility-scoped document reference.
 * Path: users/{uid}/facilities/{facilityId}/{collectionName}/{docId}
 */
function facilityDocRef(
  uid: string,
  facilityId: string,
  collectionName: CollectionName,
  docId: string,
) {
  return doc(db, 'users', uid, 'facilities', facilityId, collectionName, docId);
}

// ─── Facility management ──────────────────────────────────────────────────────

/**
 * Ensures a default facility document exists for the user.
 * Returns the facilityId to use for all subsequent operations.
 */
export async function ensureDefaultFacility(uid: string): Promise<string> {
  const facilitiesRef = collection(db, 'users', uid, 'facilities');
  const snapshot = await getDocs(facilitiesRef);

  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  // Create a default facility
  const newFacilityRef = doc(facilitiesRef);
  await setDoc(newFacilityRef, {
    name: 'My Facility',
    createdAt: new Date().toISOString(),
  });
  return newFacilityRef.id;
}

// ─── Generic CRUD ─────────────────────────────────────────────────────────────

/** Add a new document to a facility-scoped collection. Returns the new document id. */
export async function addItem<T extends DocumentData>(
  uid: string,
  facilityId: string,
  collectionName: CollectionName,
  data: Omit<T, 'id'>,
): Promise<string> {
  const colRef = facilityCollectionRef(uid, facilityId, collectionName);
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: data.createdAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Overwrite a document (creates if it does not exist). */
export async function setItem<T extends DocumentData>(
  uid: string,
  facilityId: string,
  collectionName: CollectionName,
  docId: string,
  data: Omit<T, 'id'>,
): Promise<void> {
  const ref = facilityDocRef(uid, facilityId, collectionName, docId);
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Partially update an existing document. */
export async function updateItem(
  uid: string,
  facilityId: string,
  collectionName: CollectionName,
  docId: string,
  data: Partial<DocumentData>,
): Promise<void> {
  const ref = facilityDocRef(uid, facilityId, collectionName, docId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Delete a document from a facility-scoped collection. */
export async function deleteItem(
  uid: string,
  facilityId: string,
  collectionName: CollectionName,
  docId: string,
): Promise<void> {
  const ref = facilityDocRef(uid, facilityId, collectionName, docId);
  await deleteDoc(ref);
}

/** Fetch all documents from a facility-scoped collection once. */
export async function getItems<T>(
  uid: string,
  facilityId: string,
  collectionName: CollectionName,
): Promise<T[]> {
  const colRef = facilityCollectionRef(uid, facilityId, collectionName);
  const snapshot = await getDocs(query(colRef));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
}

/** Fetch a single document. Returns null if it does not exist. */
export async function getItem<T>(
  uid: string,
  facilityId: string,
  collectionName: CollectionName,
  docId: string,
): Promise<T | null> {
  const ref = facilityDocRef(uid, facilityId, collectionName, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as T;
}

// ─── Real-time listeners ──────────────────────────────────────────────────────

/**
 * Subscribe to live updates on a facility-scoped collection.
 * Calls `callback` with the full list of items on every change.
 * Returns an unsubscribe function.
 */
export function subscribeToCollection<T>(
  uid: string,
  facilityId: string,
  collectionName: CollectionName,
  callback: (items: T[]) => void,
): Unsubscribe {
  const colRef = facilityCollectionRef(uid, facilityId, collectionName);
  return onSnapshot(query(colRef), (snapshot: QuerySnapshot) => {
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    callback(items);
  });
}

// ─── Typed convenience helpers ────────────────────────────────────────────────
// These wrap the generics with the concrete slice name so callers don't have
// to repeat the collection string literal.

import type { Resident, ABT, IPEvent, Vaccination, Audit, Notification, Settings } from '../types';

export const residents = {
  add: (uid: string, fid: string, data: Omit<Resident, 'id'>) =>
    addItem<Resident>(uid, fid, 'residents', data),
  set: (uid: string, fid: string, id: string, data: Omit<Resident, 'id'>) =>
    setItem<Resident>(uid, fid, 'residents', id, data),
  update: (uid: string, fid: string, id: string, data: Partial<Resident>) =>
    updateItem(uid, fid, 'residents', id, data),
  delete: (uid: string, fid: string, id: string) => deleteItem(uid, fid, 'residents', id),
  getAll: (uid: string, fid: string) => getItems<Resident>(uid, fid, 'residents'),
  get: (uid: string, fid: string, id: string) => getItem<Resident>(uid, fid, 'residents', id),
  subscribe: (uid: string, fid: string, cb: (items: Resident[]) => void) =>
    subscribeToCollection<Resident>(uid, fid, 'residents', cb),
};

export const abts = {
  add: (uid: string, fid: string, data: Omit<ABT, 'id'>) =>
    addItem<ABT>(uid, fid, 'abts', data),
  set: (uid: string, fid: string, id: string, data: Omit<ABT, 'id'>) =>
    setItem<ABT>(uid, fid, 'abts', id, data),
  update: (uid: string, fid: string, id: string, data: Partial<ABT>) =>
    updateItem(uid, fid, 'abts', id, data),
  delete: (uid: string, fid: string, id: string) => deleteItem(uid, fid, 'abts', id),
  getAll: (uid: string, fid: string) => getItems<ABT>(uid, fid, 'abts'),
  get: (uid: string, fid: string, id: string) => getItem<ABT>(uid, fid, 'abts', id),
  subscribe: (uid: string, fid: string, cb: (items: ABT[]) => void) =>
    subscribeToCollection<ABT>(uid, fid, 'abts', cb),
};

export const ipEvents = {
  add: (uid: string, fid: string, data: Omit<IPEvent, 'id'>) =>
    addItem<IPEvent>(uid, fid, 'ipEvents', data),
  set: (uid: string, fid: string, id: string, data: Omit<IPEvent, 'id'>) =>
    setItem<IPEvent>(uid, fid, 'ipEvents', id, data),
  update: (uid: string, fid: string, id: string, data: Partial<IPEvent>) =>
    updateItem(uid, fid, 'ipEvents', id, data),
  delete: (uid: string, fid: string, id: string) => deleteItem(uid, fid, 'ipEvents', id),
  getAll: (uid: string, fid: string) => getItems<IPEvent>(uid, fid, 'ipEvents'),
  get: (uid: string, fid: string, id: string) => getItem<IPEvent>(uid, fid, 'ipEvents', id),
  subscribe: (uid: string, fid: string, cb: (items: IPEvent[]) => void) =>
    subscribeToCollection<IPEvent>(uid, fid, 'ipEvents', cb),
};

export const vaccinations = {
  add: (uid: string, fid: string, data: Omit<Vaccination, 'id'>) =>
    addItem<Vaccination>(uid, fid, 'vaccinations', data),
  set: (uid: string, fid: string, id: string, data: Omit<Vaccination, 'id'>) =>
    setItem<Vaccination>(uid, fid, 'vaccinations', id, data),
  update: (uid: string, fid: string, id: string, data: Partial<Vaccination>) =>
    updateItem(uid, fid, 'vaccinations', id, data),
  delete: (uid: string, fid: string, id: string) => deleteItem(uid, fid, 'vaccinations', id),
  getAll: (uid: string, fid: string) => getItems<Vaccination>(uid, fid, 'vaccinations'),
  get: (uid: string, fid: string, id: string) =>
    getItem<Vaccination>(uid, fid, 'vaccinations', id),
  subscribe: (uid: string, fid: string, cb: (items: Vaccination[]) => void) =>
    subscribeToCollection<Vaccination>(uid, fid, 'vaccinations', cb),
};

export const audits = {
  add: (uid: string, fid: string, data: Omit<Audit, 'id'>) =>
    addItem<Audit>(uid, fid, 'audits', data),
  set: (uid: string, fid: string, id: string, data: Omit<Audit, 'id'>) =>
    setItem<Audit>(uid, fid, 'audits', id, data),
  update: (uid: string, fid: string, id: string, data: Partial<Audit>) =>
    updateItem(uid, fid, 'audits', id, data),
  delete: (uid: string, fid: string, id: string) => deleteItem(uid, fid, 'audits', id),
  getAll: (uid: string, fid: string) => getItems<Audit>(uid, fid, 'audits'),
  get: (uid: string, fid: string, id: string) => getItem<Audit>(uid, fid, 'audits', id),
  subscribe: (uid: string, fid: string, cb: (items: Audit[]) => void) =>
    subscribeToCollection<Audit>(uid, fid, 'audits', cb),
};

export const notifications = {
  add: (uid: string, fid: string, data: Omit<Notification, 'id'>) =>
    addItem<Notification>(uid, fid, 'notifications', data),
  set: (uid: string, fid: string, id: string, data: Omit<Notification, 'id'>) =>
    setItem<Notification>(uid, fid, 'notifications', id, data),
  update: (uid: string, fid: string, id: string, data: Partial<Notification>) =>
    updateItem(uid, fid, 'notifications', id, data),
  delete: (uid: string, fid: string, id: string) => deleteItem(uid, fid, 'notifications', id),
  getAll: (uid: string, fid: string) => getItems<Notification>(uid, fid, 'notifications'),
  get: (uid: string, fid: string, id: string) =>
    getItem<Notification>(uid, fid, 'notifications', id),
  subscribe: (uid: string, fid: string, cb: (items: Notification[]) => void) =>
    subscribeToCollection<Notification>(uid, fid, 'notifications', cb),
};

export const settings = {
  get: (uid: string, fid: string) => getItem<Settings>(uid, fid, 'settings', 'default'),
  set: (uid: string, fid: string, data: Omit<Settings, 'id'>) =>
    setItem<Settings>(uid, fid, 'settings', 'default', data),
  update: (uid: string, fid: string, data: Partial<Settings>) =>
    updateItem(uid, fid, 'settings', 'default', data),
  subscribe: (uid: string, fid: string, cb: (item: Settings | null) => void) => {
    const ref = facilityDocRef(uid, fid, 'settings', 'default');
    return onSnapshot(ref, (snap) => {
      cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Settings) : null);
    });
  },
};

// Re-export serverTimestamp for callers that need a Firestore server-side timestamp
export { serverTimestamp };

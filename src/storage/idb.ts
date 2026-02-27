/**
 * IndexedDB async storage adapter.
 * Replaces the 5 MB localStorage ceiling with a practically unlimited
 * browser-native key/value store.  All reads and writes are async.
 */

const IDB_DB_NAME = "ic_console_idb";
const IDB_DB_VERSION = 1;
const IDB_STORE_NAME = "kv";

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, IDB_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.put(value, key);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
  });
}

export async function idbRemove(key: string): Promise<void> {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.delete(key);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("IDB transaction aborted"));
  });
}

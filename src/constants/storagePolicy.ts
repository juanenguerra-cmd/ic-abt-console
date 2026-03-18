export const STORAGE_POLICY = {
  /**
   * Keeps IndexedDB as the canonical live store.
   * Turn this back on only if a rollback needs the legacy localStorage mirror.
   */
  writeLegacyLocalStorageMirror: false,

  /**
   * Use compact JSON for manual backup downloads so exported files stay smaller.
   */
  compactBackupExport: true,
} as const;

export type StoragePolicy = typeof STORAGE_POLICY;

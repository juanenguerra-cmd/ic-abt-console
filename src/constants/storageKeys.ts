export const DB_KEY_MAIN = "UNIFIED_DB_MAIN";
export const DB_KEY_PREV = "UNIFIED_DB_PREV";
export const DB_KEY_TMP = "UNIFIED_DB_TMP";
export const LS_PIN_CODE = "ltc_pin_code";
export const LS_LAST_BACKUP_TS = "ltc_last_backup_timestamp";
/** IndexedDB key for the persisted active user role. */
export const IDB_ROLE_KEY = "ltc_current_role";
/** localStorage key tracking the last user-activity timestamp (for idle lock). */
export const LS_LAST_ACTIVE_TS = "ltc_last_active_timestamp";
/** Idle threshold in milliseconds before the PIN lock screen re-engages (30 min). */
export const IDLE_THRESHOLD_MS = 30 * 60 * 1000;

export const DB_KEY_MAIN = "UNIFIED_DB_MAIN";
export const DB_KEY_PREV = "UNIFIED_DB_PREV";
export const DB_KEY_TMP = "UNIFIED_DB_TMP";
export const LS_PIN_CODE = "ltc_pin_code";
export const LS_LAST_BACKUP_TS = "ltc_last_backup_timestamp";
/** localStorage key for the active facility ID. */
export const LS_ACTIVE_FACILITY_ID = "ltc_active_facility_id";
/** IndexedDB key for the persisted active user role. */
export const IDB_ROLE_KEY = "ltc_current_role";
/** localStorage key tracking the last user-activity timestamp (for idle lock). */
export const LS_LAST_ACTIVE_TS = "ltc_last_active_timestamp";
/** Idle threshold in milliseconds before the PIN lock screen re-engages (30 min). */
export const IDLE_THRESHOLD_MS = 30 * 60 * 1000;

/** localStorage key for user-pinned nav shortcuts on the Home page. */
export const PINNED_NAVS = "icn_pinned_navs";
/** localStorage key for recently used @-tagged resident names on the Home page. */
export const RECENT_TAGS = "icn_recent_tags";
/** Sentinel flag to prevent hydration from overwriting a freshly restored backup. */
export const LS_JUST_RESTORED_FLAG = "ltc_just_restored_flag";

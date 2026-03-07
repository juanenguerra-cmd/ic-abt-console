import { LS_LAST_ACTIVE_TS, IDLE_THRESHOLD_MS } from "../constants/storageKeys";

export const sessionService = {
  updateActivity: () => {
    localStorage.setItem(LS_LAST_ACTIVE_TS, Date.now().toString());
  },
  isIdle: (): boolean => {
    const lastActiveStr = localStorage.getItem(LS_LAST_ACTIVE_TS);
    if (!lastActiveStr) return false;
    const lastActiveMs = parseInt(lastActiveStr, 10);
    if (isNaN(lastActiveMs)) return false;
    return Date.now() - lastActiveMs > IDLE_THRESHOLD_MS;
  },
  setupActivityTracking: () => {
    const updateActivity = () => sessionService.updateActivity();
    window.addEventListener("click", updateActivity, { passive: true });
    window.addEventListener("keydown", updateActivity, { passive: true });
    return () => {
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("keydown", updateActivity);
    };
  }
};

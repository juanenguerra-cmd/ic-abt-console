import { LS_LAST_BACKUP_TS } from "../constants/storageKeys";

export const alertService = {
  /**
   * Show a non-blocking in-app toast notification.
   * Dispatches the 'app-toast' CustomEvent which AppProviders listens for
   * and renders using the same banner pattern as the save-error toast.
   */
  show: (message: string, opts?: { type?: 'success' | 'error' | 'info' }) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message, type: opts?.type ?? 'info' },
        })
      );
    }
  },

  getBackupStatus: () => {
    const lastBackupTimestamp = localStorage.getItem(LS_LAST_BACKUP_TS);
    if (lastBackupTimestamp) {
      const lastBackupDate = new Date(parseInt(lastBackupTimestamp, 10));
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const diffMs = Date.now() - lastBackupDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      
      let label = '';
      if (diffHours < 24) {
        label = `Backup: ${diffHours}h ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        label = `Backup: ${diffDays}d ago`;
      }
      
      return {
        needsBackup: lastBackupDate < oneDayAgo,
        label
      };
    }
    
    return {
      needsBackup: true,
      label: 'No backup'
    };
  }
};

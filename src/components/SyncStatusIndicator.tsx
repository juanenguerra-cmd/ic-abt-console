import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Cloud, Upload, AlertCircle, WifiOff, Loader } from 'lucide-react';
import { useSyncStatus } from '../app/providers';

type VisualState = 'initializing' | 'offline' | 'synced' | 'syncing' | 'pending' | 'error' | 'conflict';

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

const SyncStatusIndicator: React.FC = () => {
  const { syncStatus, triggerSync } = useSyncStatus();
  const [isTriggeringSync, setIsTriggeringSync] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Subscribe to browser online/offline events so the indicator reacts
  // immediately when network connectivity changes.
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { isSyncing, lastSyncedAt, lastSyncAction, lastError, hasPendingWrites, failedWrites, recentConflictCount } = syncStatus;

  const visualState: VisualState = (() => {
    // Offline: browser reports no network connection, or last sync action was offline.
    if (!isOnline || lastSyncAction === 'offline') return 'offline';
    if (isSyncing || isTriggeringSync) return 'syncing';
    if (lastError && lastSyncAction === 'error') return 'error';
    if (recentConflictCount > 0) return 'conflict';
    if (hasPendingWrites) return 'pending';
    if (lastSyncAction === null) return 'initializing';
    if (lastSyncAction === 'pull' || lastSyncAction === 'push') return 'synced';
    if (lastSyncAction === 'noop') return 'synced';
    return 'synced';
  })();

  const handleSyncNow = async () => {
    if (isTriggeringSync || isSyncing) return;
    setIsTriggeringSync(true);
    try {
      await triggerSync();
    } finally {
      setIsTriggeringSync(false);
    }
  };

  const getIndicator = () => {
    switch (visualState) {
      case 'initializing':
        return {
          Icon: Loader,
          text: 'Initializing…',
          className: 'text-neutral-400',
          iconClass: 'animate-spin',
        };
      case 'offline':
        return {
          Icon: WifiOff,
          text: 'Offline',
          className: 'text-neutral-500',
          iconClass: '',
        };
      case 'syncing':
        return {
          Icon: RefreshCw,
          text: 'Syncing…',
          className: 'text-neutral-500',
          iconClass: 'animate-spin',
        };
      case 'pending':
        return {
          Icon: Upload,
          text: failedWrites > 0 ? `${failedWrites} write${failedWrites !== 1 ? 's' : ''} pending` : 'Pending sync',
          className: 'text-amber-500',
          iconClass: '',
        };
      case 'error':
        return {
          Icon: AlertTriangle,
          text: 'Sync issue',
          className: 'text-red-500',
          iconClass: '',
        };
      case 'conflict':
        return {
          Icon: AlertCircle,
          text: `${recentConflictCount} conflict${recentConflictCount !== 1 ? 's' : ''}`,
          className: 'text-orange-500',
          iconClass: '',
        };
      case 'synced':
      default:
        return {
          Icon: Cloud,
          text: 'Synced',
          className: 'text-green-600',
          iconClass: '',
        };
    }
  };

  const { Icon, text, className, iconClass } = getIndicator();
  const timeLabel = formatRelativeTime(lastSyncedAt);

  return (
    <div className="flex items-center gap-2">
      <div
        aria-live="polite"
        aria-atomic="true"
        className={`flex items-center gap-1.5 text-sm font-medium ${className}`}
      >
        <Icon size={16} className={iconClass} />
        <span>{text}</span>
        {timeLabel && visualState !== 'syncing' && (
          <span className="text-xs font-normal text-neutral-400">{timeLabel}</span>
        )}
      </div>
      <button
        onClick={handleSyncNow}
        disabled={isSyncing || isTriggeringSync}
        title="Sync Now"
        className="p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Sync Now"
      >
        <RefreshCw size={13} className={isSyncing || isTriggeringSync ? 'animate-spin' : ''} />
      </button>
    </div>
  );
};

export default SyncStatusIndicator;


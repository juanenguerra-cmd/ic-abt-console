import React, { useState } from 'react';
import { CheckCircle, RefreshCw, AlertTriangle, Cloud, Upload, AlertCircle } from 'lucide-react';
import { useSyncStatus } from '../app/providers';

type VisualState = 'synced' | 'syncing' | 'pending' | 'error' | 'local' | 'conflict';

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

  const { isSyncing, lastSyncedAt, lastSyncAction, lastError, hasPendingWrites, recentConflictCount } = syncStatus;

  const visualState: VisualState = (() => {
    if (isSyncing || isTriggeringSync) return 'syncing';
    if (lastError && lastSyncAction === 'error') return 'error';
    if (recentConflictCount > 0) return 'conflict';
    if (hasPendingWrites) return 'pending';
    if (lastSyncAction === 'pull' || lastSyncAction === 'push') return 'synced';
    if (lastSyncAction === 'noop') return 'synced';
    if (lastSyncAction === 'offline') return 'local';
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
          text: 'Pending sync',
          className: 'text-amber-500',
          iconClass: '',
        };
      case 'error':
        return {
          Icon: AlertTriangle,
          text: 'Sync error',
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
      case 'local':
        return {
          Icon: CheckCircle,
          text: 'Saved locally',
          className: 'text-blue-600',
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


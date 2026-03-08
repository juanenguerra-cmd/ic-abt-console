import React, { useState, useEffect } from 'react';
import { CheckCircle, RefreshCw, AlertTriangle, Cloud, Upload } from 'lucide-react';
import { hasOutboxItems } from '../storage/syncOutbox';

type SyncState = 'synced' | 'syncing' | 'pending' | 'error' | 'local';

const SyncStatusIndicator: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Read the initial outbox state on mount.
  useEffect(() => {
    hasOutboxItems().then((hasPending) => {
      if (hasPending) {
        setSyncState('pending');
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleSyncStart = () => setSyncState('syncing');
    const handleSyncSuccess = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.type === 'remote') {
        setSyncState('synced');
      } else {
        setSyncState('local');
      }
      setLastSynced(new Date());
    };
    const handleSyncError = () => setSyncState('error');

    // Outbox changes: switch to 'pending' when items are queued.
    const handleOutboxChanged = (event: Event) => {
      const isEmpty = (event as CustomEvent<{ isEmpty: boolean }>).detail?.isEmpty;
      if (!isEmpty) {
        setSyncState('pending');
      }
    };

    window.addEventListener('backup-started', handleSyncStart);
    window.addEventListener('backup-completed', handleSyncSuccess);
    window.addEventListener('backup-failed', handleSyncError);
    window.addEventListener('sync-outbox-changed', handleOutboxChanged);

    // Set initial synced time
    setSyncState('synced');
    setLastSynced(new Date());

    return () => {
      window.removeEventListener('backup-started', handleSyncStart);
      window.removeEventListener('backup-completed', handleSyncSuccess);
      window.removeEventListener('backup-failed', handleSyncError);
      window.removeEventListener('sync-outbox-changed', handleOutboxChanged);
    };
  }, []);

  const getIndicator = () => {
    switch (syncState) {
      case 'syncing':
        return {
          Icon: RefreshCw,
          text: 'Syncing...',
          className: 'text-neutral-500 animate-spin',
        };
      case 'pending':
        return {
          Icon: Upload,
          text: 'Pending sync',
          className: 'text-amber-500',
        };
      case 'error':
        return {
          Icon: AlertTriangle,
          text: 'Sync Error',
          className: 'text-red-500',
        };
      case 'local':
        return {
          Icon: CheckCircle,
          text: 'Saved locally',
          className: 'text-blue-600',
        };
      case 'synced':
      default:
        return {
          Icon: Cloud,
          text: `Synced`,
          className: 'text-green-600',
        };
    }
  };

  const { Icon, text, className } = getIndicator();

  return (
    <>
      {/* Top indicator bar */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-transparent">
        <div className={`h-full transition-all duration-500 ease-in-out ${
          syncState === 'synced' ? 'w-full bg-emerald-500' :
          syncState === 'syncing' ? 'w-2/3 bg-blue-500 animate-pulse' :
          syncState === 'pending' ? 'w-1/3 bg-amber-500' :
          syncState === 'local' ? 'w-full bg-blue-400' :
          'w-full bg-red-500'
        }`} />
      </div>

      <div className={`flex items-center gap-2 text-sm font-medium ${className}`}>
        <Icon size={16} />
        <span>{text}</span>
      </div>
    </>
  );
};

export default SyncStatusIndicator;


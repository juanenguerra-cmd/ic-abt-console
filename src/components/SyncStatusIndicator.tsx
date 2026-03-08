import React, { useState, useEffect } from 'react';
import { CheckCircle, RefreshCw, AlertTriangle, Cloud } from 'lucide-react';

type SyncState = 'synced' | 'syncing' | 'error' | 'local';

const SyncStatusIndicator: React.FC = () => {
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

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

    window.addEventListener('backup-started', handleSyncStart);
    window.addEventListener('backup-completed', handleSyncSuccess);
    window.addEventListener('backup-failed', handleSyncError);

    // Set initial synced time
    setSyncState('synced');
    setLastSynced(new Date());

    return () => {
      window.removeEventListener('backup-started', handleSyncStart);
      window.removeEventListener('backup-completed', handleSyncSuccess);
      window.removeEventListener('backup-failed', handleSyncError);
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
    <div className={`flex items-center gap-2 text-sm font-medium ${className}`}>
      <Icon size={16} />
      <span>{text}</span>
    </div>
  );
};

export default SyncStatusIndicator;

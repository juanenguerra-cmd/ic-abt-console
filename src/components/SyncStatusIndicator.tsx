import React, { useState, useEffect } from 'react';
import { CheckCircle, RefreshCw, AlertTriangle } from 'lucide-react';

const SyncStatusIndicator: React.FC = () => {
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    const handleSyncStart = () => setSyncState('syncing');
    const handleSyncSuccess = () => {
      setSyncState('synced');
      setLastSynced(new Date());
    };
    const handleSyncError = () => setSyncState('error');

    window.addEventListener('backup-started', handleSyncStart);
    window.addEventListener('backup-completed', handleSyncSuccess);
    window.addEventListener('backup-failed', handleSyncError);

    // Set initial synced time
    handleSyncSuccess();

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
      case 'synced':
      default:
        return {
          Icon: CheckCircle,
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

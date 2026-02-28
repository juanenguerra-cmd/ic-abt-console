import React, { useState, useEffect } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Bell, AlertTriangle, Info, CheckCircle2, X, Download } from 'lucide-react';
import { AppNotification } from '../../domain/models';
import { useNavigate } from 'react-router-dom';
import { runDetectionPipeline } from './detectionPipeline';

export const useNotifications = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  useEffect(() => {
    if (!store) return;
    runDetectionPipeline(store, activeFacilityId, updateDB);
  }, [store, activeFacilityId, updateDB]);

  const dismissNotification = (id: string) => {
    updateDB(draft => {
      const facilityData = draft.data.facilityData[activeFacilityId];
      if (facilityData.notifications && facilityData.notifications[id]) {
        facilityData.notifications[id].status = 'dismissed';
      }
    });
  };

  const markAsRead = (id: string) => {
    updateDB(draft => {
      const facilityData = draft.data.facilityData[activeFacilityId];
      if (facilityData.notifications && facilityData.notifications[id]) {
        facilityData.notifications[id].status = 'read';
      }
    });
  };

  const markAllAsRead = () => {
    updateDB(draft => {
      const facilityData = draft.data.facilityData[activeFacilityId];
      if (facilityData.notifications) {
        Object.values(facilityData.notifications).forEach((n: any) => {
          if (n.status === 'unread') {
            n.status = 'read';
          }
        });
      }
    });
  };

  const allNotifications = Object.values(store.notifications || {});
  const notifications = allNotifications.filter(n => n.status === 'unread');
  const historyNotifications = allNotifications.filter(n => n.status === 'read' || n.status === 'dismissed');

  return { notifications, historyNotifications, dismissNotification, markAsRead, markAllAsRead };
};

export const NotificationsPage: React.FC = () => {
  const { notifications, historyNotifications, dismissNotification, markAsRead, markAllAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState<'new' | 'all'>('new');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const navigate = useNavigate();

  const getIcon = (category: string) => {
    switch (category) {
      case 'ADMISSION_SCREENING': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'VAX_GAP': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'VAX_REOFFER': return <AlertTriangle className="w-5 h-5 text-purple-500" />;
      case 'LINE_LIST_REVIEW': return <Info className="w-5 h-5 text-blue-500" />;
      case 'SYMPTOM_WATCH': return <Info className="w-5 h-5 text-blue-500" />;
      case 'OUTBREAK_SUGGESTION': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'DEVICE_LINK': return <Info className="w-5 h-5 text-blue-500" />;
      case 'ABT_STEWARDSHIP': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'DEVICE_REVIEW': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default: return <Bell className="w-5 h-5 text-neutral-500" />;
    }
  };

  const getBgColor = (category: string, isRead: boolean) => {
    if (isRead) return 'bg-white border-neutral-200 opacity-75';
    switch (category) {
      case 'ADMISSION_SCREENING': return 'bg-red-50 border-red-200';
      case 'VAX_GAP': return 'bg-amber-50 border-amber-200';
      case 'VAX_REOFFER': return 'bg-purple-50 border-purple-200';
      case 'LINE_LIST_REVIEW': return 'bg-blue-50 border-blue-200';
      case 'SYMPTOM_WATCH': return 'bg-blue-50 border-blue-200';
      case 'OUTBREAK_SUGGESTION': return 'bg-red-50 border-red-200';
      case 'DEVICE_LINK': return 'bg-blue-50 border-blue-200';
      case 'ABT_STEWARDSHIP': return 'bg-orange-50 border-orange-200';
      case 'DEVICE_REVIEW': return 'bg-orange-50 border-orange-200';
      default: return 'bg-white border-neutral-200';
    }
  };

  const getTitle = (category: string) => {
    switch (category) {
      case 'ADMISSION_SCREENING': return 'Missing Admission Screening';
      case 'VAX_GAP': return 'Vaccine Due/Overdue';
      case 'VAX_REOFFER': return 'Vaccine Re-Offer Due';
      case 'LINE_LIST_REVIEW': return 'Line List Review Recommended';
      case 'SYMPTOM_WATCH': return 'Symptom Watch';
      case 'OUTBREAK_SUGGESTION': return 'Possible Outbreak Cluster';
      case 'DEVICE_LINK': return 'Device Link Detected';
      case 'ABT_STEWARDSHIP': return 'ABT Stewardship Time-Out Due';
      case 'DEVICE_REVIEW': return 'Device Necessity Review Due';
      default: return 'Notification';
    }
  };

  const getTypeLabel = (category: string) => {
    switch (category) {
      case 'ADMISSION_SCREENING': return 'alert';
      case 'VAX_GAP': return 'warning';
      case 'VAX_REOFFER': return 'warning';
      case 'LINE_LIST_REVIEW': return 'info';
      case 'SYMPTOM_WATCH': return 'info';
      case 'OUTBREAK_SUGGESTION': return 'alert';
      case 'DEVICE_LINK': return 'info';
      case 'ABT_STEWARDSHIP': return 'warning';
      case 'DEVICE_REVIEW': return 'warning';
      default: return 'info';
    }
  };

  const handleViewResident = (residentId?: string) => {
    if (!residentId) return;
    navigate('/resident-board', { state: { selectedResidentId: residentId, openProfile: true } });
  };

  const handleOpenRecord = (notif: AppNotification) => {
    if (!notif.residentId) return;
    if (notif.refs?.abtId) {
      navigate('/resident-board', { state: { selectedResidentId: notif.residentId, openModal: 'abt', editId: notif.refs.abtId } });
    } else if (notif.refs?.ipId) {
      navigate('/resident-board', { state: { selectedResidentId: notif.residentId, openModal: 'ip', editId: notif.refs.ipId } });
    } else if (notif.refs?.vaxId) {
      navigate('/resident-board', { state: { selectedResidentId: notif.residentId, openModal: 'vax', editId: notif.refs.vaxId } });
    } else if (notif.refs?.noteId) {
      navigate('/resident-board', { state: { selectedResidentId: notif.residentId } });
    }
  };

  const displayList = (activeTab === 'new' ? notifications : [...notifications, ...historyNotifications])
    .filter(n => categoryFilter === 'all' || n.category === categoryFilter)
    .filter(n => unitFilter === 'all' || n.unit === unitFilter)
    .sort((a, b) => new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime());

  const uniqueCategories = Array.from(new Set([...notifications, ...historyNotifications].map(n => n.category)));
  const uniqueUnits = Array.from(new Set([...notifications, ...historyNotifications].map(n => n.unit).filter(Boolean)));

  const handleExportCSV = () => {
    if (displayList.length === 0) return;

    const headers = ['Category', 'Type', 'Title', 'Message', 'Unit', 'Room', 'Detected At', 'Status'];
    
    const escapeCSV = (value: string | undefined | null) => {
      if (!value) return '""';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = displayList.map(notif => [
      escapeCSV(notif.category),
      escapeCSV(getTypeLabel(notif.category)),
      escapeCSV(getTitle(notif.category)),
      escapeCSV(notif.message),
      escapeCSV(notif.unit),
      escapeCSV(notif.room),
      escapeCSV(new Date(notif.createdAtISO).toLocaleString()),
      escapeCSV(notif.status)
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `notifications_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-neutral-50 shrink-0">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-neutral-900">Notifications & Recommendations</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="text-sm border-neutral-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{getTitle(c)}</option>)}
            </select>
            <select 
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
              className="text-sm border-neutral-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="all">All Units</option>
              {uniqueUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div className="flex bg-neutral-200 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('new')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'new' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}
              >
                New Detections {notifications.length > 0 && <span className="ml-2 bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded-full text-xs">{notifications.length}</span>}
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'all' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900'}`}
              >
                All
              </button>
            </div>
            {activeTab === 'new' && notifications.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
              >
                Mark All Read
              </button>
            )}
            <button
              onClick={handleExportCSV}
              disabled={displayList.length === 0}
              className="px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          {displayList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-500 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 opacity-50" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm">No {activeTab === 'new' ? 'new' : ''} recommendations or alerts at this time.</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto">
              {displayList.map(notif => {
                const isRead = notif.status === 'read' || notif.status === 'dismissed';
                const typeLabel = getTypeLabel(notif.category);
                return (
                  <div 
                    key={notif.id} 
                    className={`flex flex-col sm:flex-row items-start gap-4 p-4 rounded-lg border ${getBgColor(notif.category, isRead)} transition-all hover:shadow-md`}
                    data-testid={`notification-item-${notif.id}`}
                  >
                    <div className="shrink-0 mt-1">
                      {getIcon(notif.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          typeLabel === 'alert' ? 'bg-red-100 text-red-700' :
                          typeLabel === 'warning' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {typeLabel}
                        </span>
                        <h3 className="text-sm font-bold text-neutral-900">{getTitle(notif.category)}</h3>
                      </div>
                      <p className="text-sm text-neutral-700 mb-2">{notif.message}</p>
                      
                      {notif.clusterDetails && notif.clusterDetails.length > 0 && (
                        <div className="mb-3 bg-white/50 rounded border border-neutral-200 p-2">
                          <p className="text-xs font-semibold text-neutral-700 mb-1">Involved Residents:</p>
                          <ul className="text-xs text-neutral-600 space-y-1">
                            {notif.clusterDetails.map((detail, idx) => (
                              <li key={idx} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                                <button 
                                  onClick={() => handleViewResident(detail.residentId)}
                                  className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                  {detail.residentName}
                                </button>
                                <span className="text-neutral-400">
                                  (via {detail.refType === 'abt' ? 'Antibiotic Record' : 'Note'})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
                        {(notif.unit || notif.room) && (
                          <span>Location: {notif.unit || 'Unknown'}{notif.room ? ` - ${notif.room}` : ''}</span>
                        )}
                        <span>Detected: {new Date(notif.createdAtISO).toLocaleString()}</span>
                      </div>
                      
                      <div className="mt-4 flex flex-wrap gap-2">
                        {notif.residentId && (
                          <button 
                            onClick={() => handleViewResident(notif.residentId)}
                            className="px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-xs font-medium transition-colors"
                          >
                            View Resident
                          </button>
                        )}
                        {notif.refs && Object.keys(notif.refs).length > 0 && notif.residentId && (
                          <button 
                            onClick={() => handleOpenRecord(notif)}
                            className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100 text-xs font-medium transition-colors"
                          >
                            Open Record
                          </button>
                        )}
                        {!isRead && (
                          <button 
                            onClick={() => markAsRead(notif.id)}
                            className="px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-xs font-medium transition-colors"
                          >
                            Mark as Read
                          </button>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={() => dismissNotification(notif.id)}
                      className="shrink-0 p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-white/50 rounded-md transition-colors"
                      title="Dismiss completely"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

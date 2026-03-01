import React, { useState, useEffect, useMemo } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Bell, AlertTriangle, Info, CheckCircle2, X, Download, ChevronDown, ChevronRight, Printer, ListPlus } from 'lucide-react';
import { AppNotification } from '../../domain/models';
import { useNavigate } from 'react-router-dom';
import { runDetectionPipeline } from './detectionPipeline';
import { AddToLineListModal } from './AddToLineListModal';

export const useNotifications = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  useEffect(() => {
    if (!store) return;
    runDetectionPipeline(store, activeFacilityId, updateDB);
  }, [store, activeFacilityId, updateDB]);

  const clearNotification = (id: string) => {
    updateDB(draft => {
      const facilityData = draft.data.facilityData[activeFacilityId];
      if (facilityData.notifications && facilityData.notifications[id]) {
        // Intentionally clear the notification without writing any dismissal
        // metadata so this action does not persist suppression state.
        delete facilityData.notifications[id];
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
  const historyNotifications = allNotifications.filter(n => n.status === 'read');

  return { notifications, historyNotifications, clearNotification, markAsRead, markAllAsRead };
};

/** Duration (ms) for which the "saved" success toast is displayed. */
const TOAST_DISPLAY_DURATION_MS = 4000;

export const NotificationsPage: React.FC = () => {
  const { store } = useFacilityData();
  const { notifications, historyNotifications, clearNotification, markAsRead, markAllAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState<'new' | 'all'>('new');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');
  const [expandedVaxGroups, setExpandedVaxGroups] = useState<Set<string>>(new Set());
  const [selectedVaxGroups, setSelectedVaxGroups] = useState<Set<string>>(new Set());
  const [lineListModalNotif, setLineListModalNotif] = useState<AppNotification | null>(null);
  const [lineListSavedId, setLineListSavedId] = useState<string | null>(null);
  const navigate = useNavigate();

  type GroupResident = {
    residentId?: string;
    mrn?: string;
    name: string;
    firstName?: string;
    lastName?: string;
    unit?: string;
    room?: string;
  };

  type GroupedVaxNotification = {
    id: string;
    category: 'VAX_GAP';
    statusBucket: 'Overdue' | 'Due';
    vaccine: string;
    title: string;
    residents: GroupResident[];
    notifications: AppNotification[];
    latestCreatedAtISO: string;
  };

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
      case 'AUDIT_OVERDUE': return <AlertTriangle className="w-5 h-5 text-red-600" />;
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
      case 'AUDIT_OVERDUE': return 'bg-red-50 border-red-200';
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
      case 'AUDIT_OVERDUE': return 'Corrective Action Overdue';
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
      case 'AUDIT_OVERDUE': return 'alert';
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

  const groupedVaxNotifications = useMemo<GroupedVaxNotification[]>(() => {
    if (!store) return [];

    const groups = new Map<string, GroupedVaxNotification>();
    const vaxNotifications = displayList.filter(n => n.category === 'VAX_GAP');

    vaxNotifications.forEach(notif => {
      const vax = notif.refs?.vaxId ? store.vaxEvents?.[notif.refs.vaxId] : undefined;
      const resident = notif.residentId ? store.residents?.[notif.residentId] : undefined;

      if (resident && (resident.isHistorical || resident.backOfficeOnly || resident.status === 'Discharged' || resident.status === 'Deceased')) {
        return;
      }

      const statusBucket: 'Overdue' | 'Due' = vax?.status === 'overdue' ? 'Overdue' : 'Due';
      const vaccine = vax?.vaccine || 'Unknown Vaccine';
      const residentName = resident?.displayName || notif.message.split(' is due for ')[0] || 'Unknown Resident';
      const residentRecord: GroupResident = {
        residentId: notif.residentId,
        mrn: resident?.mrn,
        name: residentName,
        firstName: resident?.firstName,
        lastName: resident?.lastName,
        unit: resident?.currentUnit || notif.unit,
        room: resident?.currentRoom || notif.room,
      };

      const key = `${statusBucket.toLowerCase()}::${vaccine.toLowerCase()}`;
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          id: `vax-group-${key}`,
          category: 'VAX_GAP',
          statusBucket,
          vaccine,
          title: `Vaccine ${statusBucket} — ${vaccine}`,
          residents: [residentRecord],
          notifications: [notif],
          latestCreatedAtISO: notif.createdAtISO,
        });
        return;
      }

      const hasResident = existing.residents.some(r => r.residentId && r.residentId === residentRecord.residentId);
      if (!hasResident) {
        existing.residents.push(residentRecord);
      }
      existing.notifications.push(notif);
      if (new Date(notif.createdAtISO).getTime() > new Date(existing.latestCreatedAtISO).getTime()) {
        existing.latestCreatedAtISO = notif.createdAtISO;
      }
    });

    const sortResidents = (a: GroupResident, b: GroupResident) => {
      const aHasLocation = Boolean(a.unit || a.room);
      const bHasLocation = Boolean(b.unit || b.room);

      if (aHasLocation || bHasLocation) {
        const unitCompare = (a.unit || '').localeCompare(b.unit || '', undefined, { numeric: true, sensitivity: 'base' });
        if (unitCompare !== 0) return unitCompare;
        const roomCompare = (a.room || '').localeCompare(b.room || '', undefined, { numeric: true, sensitivity: 'base' });
        if (roomCompare !== 0) return roomCompare;
      }

      const aLast = a.lastName || '';
      const bLast = b.lastName || '';
      const lastCompare = aLast.localeCompare(bLast, undefined, { sensitivity: 'base' });
      if (lastCompare !== 0) return lastCompare;

      const aFirst = a.firstName || a.name;
      const bFirst = b.firstName || b.name;
      return aFirst.localeCompare(bFirst, undefined, { sensitivity: 'base' });
    };

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        residents: group.residents.sort(sortResidents),
      }))
      .sort((a, b) => {
        if (a.statusBucket !== b.statusBucket) {
          return a.statusBucket === 'Overdue' ? -1 : 1;
        }
        return a.vaccine.localeCompare(b.vaccine, undefined, { sensitivity: 'base' });
      });
  }, [displayList, store]);

  const nonVaxDisplayList = displayList.filter(n => n.category !== 'VAX_GAP');

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

  const toggleVaxGroupExpanded = (groupId: string) => {
    setExpandedVaxGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const toggleVaxGroupSelected = (groupId: string) => {
    setSelectedVaxGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleSelectAllVaxGroups = () => {
    setSelectedVaxGroups(new Set(groupedVaxNotifications.map(group => group.id)));
  };

  const handleClearVaxSelection = () => {
    setSelectedVaxGroups(new Set());
  };

  const handlePrintSelected = () => {
    const selectedGroups = groupedVaxNotifications.filter(group => selectedVaxGroups.has(group.id));
    if (selectedGroups.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    const body = selectedGroups.map(group => `
      <section class="group">
        <h2>${group.title}</h2>
        <div class="meta">Count: ${group.residents.length}</div>
        <ul>
          ${group.residents.map(resident => `<li>
            <strong>${resident.name}</strong>
            ${resident.mrn ? `<div class="sub">MRN: ${resident.mrn}</div>` : ''}
            ${(resident.unit || resident.room) ? `<div class="sub">Location: ${resident.unit || 'Unknown'}${resident.room ? ` - ${resident.room}` : ''}</div>` : ''}
          </li>`).join('')}
        </ul>
      </section>
    `).join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Notifications & Recommendations</title>
          <style>
            @page { margin: 0.5in; }
            body { font-family: Arial, sans-serif; color: #111827; margin: 0; font-size: 12px; }
            h1 { margin: 0 0 4px; font-size: 22px; }
            .printed-at { margin-bottom: 16px; color: #4b5563; font-size: 11px; }
            .group { margin-bottom: 16px; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; }
            h2 { margin: 0 0 6px; font-size: 16px; }
            .meta { margin-bottom: 8px; font-size: 12px; color: #374151; }
            ul { margin: 0; padding-left: 18px; }
            li { margin-bottom: 8px; }
            .sub { margin-left: 8px; color: #4b5563; font-size: 11px; }
          </style>
        </head>
        <body>
          <h1>Notifications & Recommendations</h1>
          <div class="printed-at">Printed: ${new Date().toLocaleString()}</div>
          ${body}
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const markGroupedVaxAsRead = (group: GroupedVaxNotification) => {
    group.notifications.filter(n => n.status === 'unread').forEach(n => markAsRead(n.id));
  };

  const dismissGroupedVax = (group: GroupedVaxNotification) => {
    const selectedGroups = groupedVaxNotifications.filter(vaxGroup => selectedVaxGroups.has(vaxGroup.id));

    if (selectedGroups.length > 0) {
      selectedGroups.forEach(vaxGroup => {
        vaxGroup.notifications.forEach(n => clearNotification(n.id));
      });
      setSelectedVaxGroups(new Set());
      return;
    }

    group.notifications.forEach(n => clearNotification(n.id));
  };

  return (
    <>
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
              {groupedVaxNotifications.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-amber-800 font-medium">
                    Grouped vaccine notifications: {groupedVaxNotifications.length}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleSelectAllVaxGroups}
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-200 rounded-md hover:bg-amber-100"
                    >
                      Select all
                    </button>
                    <button
                      onClick={handleClearVaxSelection}
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-200 rounded-md hover:bg-amber-100"
                    >
                      Clear
                    </button>
                    <button
                      onClick={handlePrintSelected}
                      disabled={selectedVaxGroups.size === 0}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Printer className="w-4 h-4" />
                      Print selected
                    </button>
                  </div>
                </div>
              )}

              {groupedVaxNotifications.map(group => {
                const isExpanded = expandedVaxGroups.has(group.id);
                const isSelected = selectedVaxGroups.has(group.id);
                const isRead = group.notifications.every(n => n.status !== 'unread');

                return (
                  <div
                    key={group.id}
                    className={`p-4 rounded-lg border ${getBgColor('VAX_GAP', isRead)} transition-all hover:shadow-md`}
                    data-testid={`notification-item-${group.id}`}
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVaxGroupSelected(group.id)}
                        className="mt-1 h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                        aria-label={`Select ${group.title}`}
                      />
                      <div className="shrink-0 mt-1">{getIcon('VAX_GAP')}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">warning</span>
                          <h3 className="text-sm font-bold text-neutral-900">{group.title}</h3>
                          <span className="text-xs bg-white border border-amber-300 text-amber-800 font-semibold px-2 py-0.5 rounded-full">{group.residents.length}</span>
                        </div>
                        <p className="text-sm text-neutral-700 mb-2">{group.residents.length} resident{group.residents.length === 1 ? '' : 's'} in this vaccine {group.statusBucket.toLowerCase()} group.</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-500">
                          <span>Detected: {new Date(group.latestCreatedAtISO).toLocaleString()}</span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => toggleVaxGroupExpanded(group.id)}
                            className="px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-xs font-medium transition-colors flex items-center gap-1"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            {isExpanded ? 'Collapse Residents' : 'Expand Residents'}
                          </button>
                          {!isRead && (
                            <button
                              onClick={() => markGroupedVaxAsRead(group)}
                              className="px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-xs font-medium transition-colors"
                            >
                              Mark as Read
                            </button>
                          )}
                        </div>

                        {isExpanded && (
                          <div className="mt-3 bg-white/60 rounded border border-neutral-200 p-3">
                            <p className="text-xs font-semibold text-neutral-700 mb-2">Residents</p>
                            <ul className="text-xs text-neutral-700 space-y-2">
                              {group.residents.map((resident, idx) => (
                                <li key={`${group.id}-${resident.residentId || resident.mrn || idx}`} className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
                                    {resident.residentId ? (
                                      <button
                                        onClick={() => handleViewResident(resident.residentId)}
                                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline text-left"
                                      >
                                        {resident.name}
                                      </button>
                                    ) : (
                                      <span className="font-medium">{resident.name}</span>
                                    )}
                                  </div>
                                  {resident.mrn && <span className="ml-3 text-neutral-500">MRN: {resident.mrn}</span>}
                                  {(resident.unit || resident.room) && (
                                    <span className="ml-3 text-neutral-500">Location: {resident.unit || 'Unknown'}{resident.room ? ` - ${resident.room}` : ''}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => dismissGroupedVax(group)}
                        className="shrink-0 p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-white/50 rounded-md transition-colors"
                        title="Dismiss completely"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {nonVaxDisplayList.map(notif => {
                const isRead = notif.status === 'read';
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
                        {(notif.category === 'LINE_LIST_REVIEW' || notif.category === 'SYMPTOM_WATCH') && notif.residentId && !notif.actedAt && (
                          <button
                            onClick={() => setLineListModalNotif(notif)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md hover:bg-blue-100 text-xs font-medium transition-colors"
                          >
                            <ListPlus className="w-3.5 h-3.5" />
                            Add to Line List
                          </button>
                        )}
                        {(notif.category === 'LINE_LIST_REVIEW' || notif.category === 'SYMPTOM_WATCH') && notif.actedAt && (
                          <span className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md">
                            ✓ Added to Line List
                          </span>
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
                      onClick={() => clearNotification(notif.id)}
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

      {/* Add to Line List modal */}
      {lineListModalNotif && (
        <AddToLineListModal
          notification={lineListModalNotif}
          onClose={() => setLineListModalNotif(null)}
          onSaved={() => {
            setLineListSavedId(lineListModalNotif.id);
            setLineListModalNotif(null);
            setTimeout(() => setLineListSavedId(null), TOAST_DISPLAY_DURATION_MS);
          }}
        />
      )}

      {/* Success toast */}
      {lineListSavedId && (
        <div className="fixed bottom-6 right-6 z-[9999] bg-emerald-600 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Line list entry saved successfully.
        </div>
      )}
    </div>
    </>
  );
};

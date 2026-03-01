import React, { useState, useMemo } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Users, AlertCircle, FileText, Inbox, Building2, ClipboardCheck, Bell, Activity, ChevronRight, SlidersHorizontal, TrendingUp, Shield } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FloorMap, RoomStatus } from '../Heatmap/FloorMap';
import { CensusModal } from './CensusModal';
import { ActivePrecautionsModal } from './ActivePrecautionsModal';
import { AdmissionScreeningModal } from './AdmissionScreeningModal';
import { ActiveAbtModal } from './ActiveAbtModal';
import { OutbreakDrilldownModal } from './OutbreakDrilldownModal';
import { FloorLayout, Resident } from '../../domain/models';

const CELL_WIDTH = 100;
const CELL_HEIGHT = 52;
const GAP = 16;

export const Dashboard: React.FC = () => {
  const { db } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const location = useLocation();
  const navigate = useNavigate();
  const facility = db.data.facilities.byId[activeFacilityId];
  
  const layout: FloorLayout = useMemo(() => {
    if (facility.floorLayouts && facility.floorLayouts.length > 0) {
      return facility.floorLayouts[0];
    }

    let roomLabels: string[] = [];
    try {
      const storedMapping = localStorage.getItem('ltc_facility_rooms_config');
      if (storedMapping) {
        const mapping = JSON.parse(storedMapping);
        Object.values(mapping).forEach((roomsStr: any) => {
          const rooms = roomsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
          roomLabels.push(...rooms);
        });
        roomLabels = Array.from(new Set(roomLabels)).sort();
      }
    } catch (e) {}

    if (roomLabels.length === 0) {
      // Fallback to all residents' rooms
      const uniqueRooms = new Set<string>();
      (Object.values(store.residents || {}) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).forEach(r => {
        if (r.currentRoom) uniqueRooms.add(r.currentRoom);
      });
      roomLabels = Array.from(uniqueRooms).sort();
    }

    if (roomLabels.length === 0) {
      return {
        id: 'empty',
        facilityId: activeFacilityId,
        name: 'Empty Layout',
        version: 1,
        updatedAt: new Date().toISOString(),
        rooms: []
      };
    }

    // Generate generic grid layout
    const cols = Math.max(Math.ceil(Math.sqrt(roomLabels.length)), 4);
    const rooms = roomLabels.map((label, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        roomId: `room-${label}`,
        x: col * (CELL_WIDTH + GAP),
        y: row * (CELL_HEIGHT + GAP),
        w: CELL_WIDTH,
        h: CELL_HEIGHT,
        label: label,
      };
    });

    return {
      id: 'generic',
      facilityId: activeFacilityId,
      name: 'Generic Layout',
      version: 1,
      updatedAt: new Date().toISOString(),
      rooms: rooms
    };
  }, [activeFacilityId, facility.floorLayouts, store.residents]);

  const roomStatuses = useMemo(() => {
    const statuses: Record<string, RoomStatus> = {};
    const activeInfections = Object.values(store.infections || {}).filter(ip => ip.status === 'active');
    
    (Object.values(store.residents || {}) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).forEach(res => {
      if (res.currentRoom) {
        const room = layout.rooms.find(r => r.label === res.currentRoom || r.label === res.currentRoom.replace(/^\d/, ''));
        if (room) {
          const infection = activeInfections.find(ip => ip.residentRef.kind === 'mrn' && ip.residentRef.id === res.mrn);
          if (infection) {
            if (infection.outbreakId) {
              statuses[room.roomId] = 'outbreak';
            } else if (infection.ebp) {
              statuses[room.roomId] = 'ebp';
            } else if (infection.isolationType) {
              statuses[room.roomId] = 'isolation';
            }
          }
        }
      }
    });
    return statuses;
  }, [store.residents, store.infections, layout.rooms]);

  const [showCensusModal, setShowCensusModal] = useState(false);
  const [showPrecautionsModal, setShowPrecautionsModal] = useState(false);
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [showAbtModal, setShowAbtModal] = useState(false);
  const [showOutbreakModal, setShowOutbreakModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [tileSize, setTileSize] = useState<number>(() => {
    const stored = localStorage.getItem(`ltc_floor_tile_size_global:${activeFacilityId}`);
    return stored ? Math.min(10, Math.max(1, parseInt(stored, 10))) : 5;
  });

  React.useEffect(() => {
    if ((location.state as { openModal?: string } | null)?.openModal === 'precautions') {
      setShowPrecautionsModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const units = useMemo(() => {
    const unitSet = new Set<string>();
    (Object.values(store.residents || {}) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).forEach(r => {
      if (r.currentUnit?.trim()) unitSet.add(r.currentUnit.trim());
    });
    return Array.from(unitSet).sort();
  }, [store.residents]);

  const filteredLayout = useMemo(() => {
    if (selectedUnit === "all") return layout;
    const roomsInUnit = new Set(
      (Object.values(store.residents || {}) as Resident[])
        .filter(r => !r.isHistorical && !r.backOfficeOnly)
        .filter(r => r.currentUnit === selectedUnit && r.currentRoom)
        .map(r => r.currentRoom!)
    );
    return { ...layout, rooms: layout.rooms.filter(r => roomsInUnit.has(r.label || "")) };
  }, [layout, selectedUnit, store.residents]);

  // Calculate stats
  const activeResidents = (Object.values(store.residents || {}) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).filter(r => r.currentUnit && r.currentUnit.trim() !== "" && r.currentUnit.toLowerCase() !== "unassigned");
  // Refined census: exclude residents with unit === 'unknown'
  const residentCount = activeResidents.filter(r => r.currentUnit?.toLowerCase() !== 'unknown').length;
  const activePrecautionsCount = (Object.values(store.infections || {}) as any[]).filter(ip => ip.status === 'active' && (ip.isolationType || ip.ebp)).length;
  const outbreakCount = (Object.values(store.outbreaks || {}) as any[]).filter(o => o.status !== 'closed').length;
  const abtCount = (Object.values(store.abts || {}) as any[]).filter(a => a.status === 'active').length;
  const qCount = Object.keys(store.quarantine).length;

  // Today's work queue counts
  const today = new Date().toISOString().split('T')[0];
  const newNotificationsCount = Object.values(store.notifications || {}).filter(n => n.status === 'unread').length;
  const abtNeedsReviewCount = (Object.values(store.abts || {}) as any[]).filter(a => a.status === 'active' && a.reviewDate && a.reviewDate <= today).length;

  // Audit Center metrics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const auditSessions = Object.values(store.infectionControlAuditSessions || {}) as any[];
  const auditItems = Object.values(store.infectionControlAuditItems || {}) as any[];
  const auditsLast30 = auditSessions.filter((s: any) => new Date(s.createdAt) >= thirtyDaysAgo).length;
  const openCorrectiveActions = auditItems.filter((i: any) => i.response === 'NON_COMPLIANT' && i.correctiveAction?.trim() && !i.completedAt).length;
  const nonCompliantItems = auditItems.filter((i: any) => i.response === 'NON_COMPLIANT').length;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recentAdmissions = (Object.values(store.residents || {}) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).filter(r => r.admissionDate && new Date(r.admissionDate) > threeDaysAgo);

  const residentsNeedingScreeningCount = recentAdmissions.filter(r => {
    const hasScreeningNote = Object.values(store.notes || {}).some(n => 
      n.residentRef.kind === 'mrn' && 
      n.residentRef.id === r.mrn && 
      n.title?.includes('Admission Screening')
    );
    return !hasScreeningNote;
  }).length;
  
  const capacityRate = facility.bedCapacity ? ((residentCount / facility.bedCapacity) * 100).toFixed(1) : null;

  // E1: Days-of-Therapy (DOT) calculator
  const nowForDot = new Date();
  const totalDotDays = (Object.values(store.abts || {}) as any[]).reduce((sum: number, abt: any) => {
    if (abt.status !== 'active' || !abt.startDate) return sum;
    const start = new Date(abt.startDate);
    const days = Math.max(0, Math.floor((nowForDot.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return sum + days;
  }, 0);
  // DOT per 1,000 resident-days (rolling 30-day denominator = residentCount * 30)
  const dotPer1000 = residentCount > 0 ? ((totalDotDays / (residentCount * 30)) * 1000).toFixed(1) : null;

  // E2: Vaccination coverage (residents)
  const residentVaxByMrn: Record<string, Set<string>> = {};
  (Object.values(store.vaxEvents || {}) as any[]).forEach((vax: any) => {
    if (vax.status === 'given' && vax.residentRef?.id) {
      if (!residentVaxByMrn[vax.residentRef.id]) residentVaxByMrn[vax.residentRef.id] = new Set();
      residentVaxByMrn[vax.residentRef.id].add((vax.vaccine || '').toLowerCase().split(' ')[0]);
    }
  });
  const residentVaxTotal = (Object.values(store.vaxEvents || {}) as any[]).filter((v: any) => v.residentRef?.kind === 'mrn').length;
  const residentVaxGiven = (Object.values(store.vaxEvents || {}) as any[]).filter((v: any) => v.residentRef?.kind === 'mrn' && v.status === 'given').length;
  const residentVaxCoverage = residentVaxTotal > 0 ? Math.round((residentVaxGiven / residentVaxTotal) * 100) : null;

  // E2: Vaccination coverage (staff)
  const staffVaxTotal = Object.values(store.staffVaxEvents || {}).length;
  const staffVaxGiven = (Object.values(store.staffVaxEvents || {}) as any[]).filter((v: any) => v.status === 'given').length;
  const staffVaxCoverage = staffVaxTotal > 0 ? Math.round((staffVaxGiven / staffVaxTotal) * 100) : null;

  // Flu/COVID-19 season banner
  const nowForSeason = new Date();
  const seasonYear = nowForSeason.getMonth() < 8 ? nowForSeason.getFullYear() - 1 : nowForSeason.getFullYear();
  const fluSeasonStart = new Date(seasonYear, 9, 1); // Oct 1
  const fluSeasonEnd = new Date(seasonYear + 1, 4, 15); // May 15
  const isFluSeason = nowForSeason >= fluSeasonStart && nowForSeason <= fluSeasonEnd;

  const activeResidentMrns = new Set(
    (Object.values(store.residents || {}) as Resident[])
      .filter(r => !r.isHistorical && !r.backOfficeOnly && r.status === 'Active')
      .map(r => r.mrn)
  );
  const totalActiveResidents = activeResidentMrns.size;

  // Flu coverage: residents with a flu shot given this season
  const fluVaxMrns = new Set<string>();
  const covidVaxMrns = new Set<string>();
  (Object.values(store.vaxEvents || {}) as any[]).forEach((vax: any) => {
    const resId = vax.residentRef?.id;
    if (!resId || !activeResidentMrns.has(resId)) return;
    const vaccineLower = (vax.vaccine || '').toLowerCase();
    if (vax.status === 'given' && vax.dateGiven) {
      const givenDate = new Date(vax.dateGiven);
      if (vaccineLower.includes('flu') || vaccineLower.includes('influenza')) {
        if (givenDate >= fluSeasonStart) fluVaxMrns.add(resId);
      }
      if (vaccineLower.includes('covid') || vaccineLower.includes('sars-cov-2')) {
        covidVaxMrns.add(resId);
      }
    }
  });
  const fluCoverage = totalActiveResidents > 0 ? Math.round((fluVaxMrns.size / totalActiveResidents) * 100) : null;
  const covidCoverage = totalActiveResidents > 0 ? Math.round((covidVaxMrns.size / totalActiveResidents) * 100) : null;

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Flu/COVID-19 Season Banner */}
        {isFluSeason && (fluCoverage !== null || covidCoverage !== null) && (
          <div className={`rounded-lg border px-4 py-3 flex flex-wrap items-center gap-4 text-sm ${(fluCoverage !== null && fluCoverage < 80) ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300'}`}>
            <span className="font-semibold text-neutral-800">🍂 Flu Season Active ({fluSeasonStart.getFullYear()}–{fluSeasonEnd.getFullYear()})</span>
            {fluCoverage !== null && (
              <span className={`font-medium ${fluCoverage >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                Flu Vaccine: {fluCoverage}% ({fluVaxMrns.size}/{totalActiveResidents} residents)
              </span>
            )}
            {covidCoverage !== null && (
              <span className={`font-medium ${covidCoverage >= 80 ? 'text-emerald-700' : 'text-amber-700'}`}>
                COVID-19: {covidCoverage}% ({covidVaxMrns.size}/{totalActiveResidents} residents)
              </span>
            )}
            <button onClick={() => navigate('/resident-board', { state: { vaxFilter: true } })} className="ml-auto text-xs underline text-neutral-600 hover:text-neutral-900">View Vaccination Board →</button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div onClick={() => setShowCensusModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Census</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-neutral-900">{residentCount}</p>
                  {capacityRate && (
                    <span className="text-xs font-medium text-neutral-500">
                      ({capacityRate}% capacity)
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowPrecautionsModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active Precautions</p>
                <p className="text-2xl font-bold text-neutral-900">{activePrecautionsCount}</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowOutbreakModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active Outbreaks</p>
                <p className="text-2xl font-bold text-neutral-900">{outbreakCount}</p>
                <p className="text-xs text-neutral-400 mt-0.5">Click to drill down</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
          <div onClick={() => navigate('/notifications', { state: { category: 'ADMISSION_SCREENING' } })} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Admission Screening</p>
                <p className="text-2xl font-bold text-neutral-900">{residentsNeedingScreeningCount}</p>
                <p className="text-xs text-neutral-400 mt-0.5">Needs screening</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowAbtModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active ABTs</p>
                <p className="text-2xl font-bold text-neutral-900">{abtCount}</p>
                <p className="text-xs text-neutral-400 mt-0.5">Click to drill down</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Inbox className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Audit Center Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div onClick={() => navigate('/audit-center')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Audits (Last 30d)</p>
                <p className="text-2xl font-bold text-neutral-900">{auditsLast30}</p>
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg">
                <ClipboardCheck className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </div>
          <div onClick={() => navigate('/audit-center')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Open Corrective Actions</p>
                <p className="text-2xl font-bold text-neutral-900">{openCorrectiveActions}</p>
              </div>
              <div className="p-2 bg-yellow-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
          </div>
          <div onClick={() => navigate('/audit-center')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Non-Compliant Items</p>
                <p className="text-2xl font-bold text-neutral-900">{nonCompliantItems}</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <ClipboardCheck className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* E1: DOT Calculator & E2: Vaccination Coverage */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div onClick={() => navigate('/resident-board', { state: { abtActive: true } })} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Days of Therapy (DOT)</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-neutral-900">{totalDotDays}</p>
                  <span className="text-xs text-neutral-500">days total</span>
                </div>
                {dotPer1000 !== null && (
                  <p className="text-xs text-neutral-500 mt-0.5">{dotPer1000} DOT / 1,000 resident-days</p>
                )}
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div onClick={() => navigate('/resident-board', { state: { vaxFilter: true } })} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Resident Vax Coverage</p>
                {residentVaxCoverage !== null ? (
                  <>
                    <p className="text-2xl font-bold text-neutral-900">{residentVaxCoverage}%</p>
                    <div className="mt-1 h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${residentVaxCoverage >= 80 ? 'bg-emerald-500' : residentVaxCoverage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${residentVaxCoverage}%` }} />
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">{residentVaxGiven} of {residentVaxTotal} doses given</p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-400 mt-1">No data</p>
                )}
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div onClick={() => navigate('/staff')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Staff Vax Coverage</p>
                {staffVaxCoverage !== null ? (
                  <>
                    <p className="text-2xl font-bold text-neutral-900">{staffVaxCoverage}%</p>
                    <div className="mt-1 h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${staffVaxCoverage >= 80 ? 'bg-emerald-500' : staffVaxCoverage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${staffVaxCoverage}%` }} />
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5">{staffVaxGiven} of {staffVaxTotal} doses given</p>
                  </>
                ) : (
                  <p className="text-sm text-neutral-400 mt-1">No data</p>
                )}
              </div>
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Today's IC Work Queue */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
          <h2 className="text-lg font-bold text-neutral-900 mb-4">Today's IC Work Queue</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => navigate('/notifications')}
              className="flex items-center gap-3 p-4 rounded-lg border border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-left group"
            >
              <div className="p-2 bg-red-50 rounded-lg shrink-0">
                <Bell className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-neutral-900">{newNotificationsCount}</p>
                <p className="text-xs font-medium text-neutral-600">New alerts / positives</p>
                <p className="text-xs text-neutral-400">Open Notifications →</p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-indigo-400 shrink-0" />
            </button>

            <button
              onClick={() => navigate('/resident-board', { state: { onPrecautions: true } })}
              className="flex items-center gap-3 p-4 rounded-lg border border-neutral-200 hover:border-amber-300 hover:bg-amber-50 transition-colors text-left group"
            >
              <div className="p-2 bg-amber-50 rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-neutral-900">{activePrecautionsCount}</p>
                <p className="text-xs font-medium text-neutral-600">Active precautions</p>
                <p className="text-xs text-neutral-400">Open Resident Board →</p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-amber-400 shrink-0" />
            </button>

            <button
              onClick={() => navigate('/outbreaks')}
              className="flex items-center gap-3 p-4 rounded-lg border border-neutral-200 hover:border-orange-300 hover:bg-orange-50 transition-colors text-left group"
            >
              <div className="p-2 bg-orange-50 rounded-lg shrink-0">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-neutral-900">{outbreakCount}</p>
                <p className="text-xs font-medium text-neutral-600">Outbreak tasks due</p>
                <p className="text-xs text-neutral-400">Open Outbreak Manager →</p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-orange-400 shrink-0" />
            </button>

            <button
              onClick={() => navigate('/resident-board', { state: { abtActive: true } })}
              className="flex items-center gap-3 p-4 rounded-lg border border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors text-left group"
            >
              <div className="p-2 bg-emerald-50 rounded-lg shrink-0">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-neutral-900">{abtNeedsReviewCount}</p>
                <p className="text-xs font-medium text-neutral-600">ABT reviews due</p>
                <p className="text-xs text-neutral-400">Open Resident Board →</p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-emerald-400 shrink-0" />
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-neutral-900">Live Floor Map</h2>
            <div className="flex items-center gap-4">
              {units.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-neutral-500" />
                  <select
                    value={selectedUnit}
                    onChange={e => setSelectedUnit(e.target.value)}
                    className="border border-neutral-300 rounded-md px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">All Units</option>
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              )}
              <div className="flex items-center gap-2" title="Tile size (1–10)">
                <SlidersHorizontal className="w-4 h-4 text-neutral-400" />
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={tileSize}
                  onChange={e => {
                    const val = parseInt(e.target.value, 10);
                    setTileSize(val);
                    localStorage.setItem(`ltc_floor_tile_size_global:${activeFacilityId}`, String(val));
                  }}
                  className="w-24 accent-indigo-600"
                  aria-label="Floor map tile size"
                />
                <span className="text-xs text-neutral-500 w-4 text-center">{tileSize}</span>
              </div>
            </div>
          </div>
          <FloorMap 
            key={tileSize}
            layout={filteredLayout} 
            facilityId={activeFacilityId}
            unitId={selectedUnit}
            roomStatuses={roomStatuses}
          />
        </div>
      </div>
      {showCensusModal && <CensusModal onClose={() => setShowCensusModal(false)} />}
      {showPrecautionsModal && <ActivePrecautionsModal onClose={() => setShowPrecautionsModal(false)} />}
      {showScreeningModal && <AdmissionScreeningModal onClose={() => setShowScreeningModal(false)} />}
      {showAbtModal && <ActiveAbtModal onClose={() => setShowAbtModal(false)} />}
      {showOutbreakModal && <OutbreakDrilldownModal onClose={() => setShowOutbreakModal(false)} />}
    </>
  );
};

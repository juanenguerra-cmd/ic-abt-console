import React, { useState, useMemo } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Users, AlertCircle, FileText, Inbox, Building2, ClipboardCheck, Bell, Activity, ChevronRight, SlidersHorizontal, TrendingUp, Shield, X, ArrowUpRight } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FloorMap, RoomStatus } from '../Heatmap/FloorMap';
import { CensusModal } from './CensusModal';
import { ActivePrecautionsModal } from './ActivePrecautionsModal';
import { AdmissionScreeningModal } from './AdmissionScreeningModal';
import { ActiveAbtModal } from './ActiveAbtModal';
import { OutbreakDrilldownModal } from './OutbreakDrilldownModal';
import { FloorLayout, Resident } from '../../domain/models';
import { computeSymptomIndicators, SymptomIndicator } from '../../utils/symptomIndicators';
import { getActiveABT, isActiveCensusResident, normalizeStatus } from '../../utils/countCardDataHelpers';

const CELL_WIDTH = 100;
const CELL_HEIGHT = 52;
const GAP = 16;

export const Dashboard: React.FC = () => {
  const { db } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const location = useLocation();
  const navigate = useNavigate();
  const facility = db?.data?.facilities?.byId?.[activeFacilityId] || { units: [], floorLayouts: [] };
  
  const layout: FloorLayout = useMemo(() => {
    if (facility?.floorLayouts && facility.floorLayouts.length > 0) {
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
    const activeInfections = Object.values(store.infections || {}).filter(ip => ip && ip.status === 'active');
    
    (Object.values(store.residents || {}) as Resident[]).filter(r => r && !r.isHistorical && !r.backOfficeOnly).forEach(res => {
      if (res.currentRoom) {
        const room = layout.rooms.find(r => r.label === res.currentRoom || r.label === res.currentRoom?.replace(/^\d/, ''));
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
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [tileSize, setTileSize] = useState<number>(() => {
    const stored = localStorage.getItem(`ltc_floor_tile_size_global:${activeFacilityId}`);
    return stored ? Math.min(10, Math.max(1, parseInt(stored, 10))) : 5;
  });

  // Rolling clock for the 96-hour window — refreshes every 60 seconds so
  // stale indicators expire automatically without a manual page reload.
  const [nowMs, setNowMs] = useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    if ((location.state as { openModal?: string } | null)?.openModal === 'precautions') {
      setShowPrecautionsModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const units = useMemo(() => {
    const unitSet = new Set<string>();
    (Object.values(store.residents || {}) as Resident[]).filter(r => r && !r.isHistorical && !r.backOfficeOnly).forEach(r => {
      if (r.currentUnit?.trim()) unitSet.add(r.currentUnit.trim());
    });
    return Array.from(unitSet).sort();
  }, [store.residents]);

  const filteredLayout = useMemo(() => {
    if (selectedUnit === "all") return layout;
    const roomsInUnit = new Set(
      (Object.values(store.residents || {}) as Resident[])
        .filter(r => r && !r.isHistorical && !r.backOfficeOnly)
        .filter(r => r.currentUnit === selectedUnit && r.currentRoom)
        .map(r => r.currentRoom!)
    );
    return { ...layout, rooms: layout.rooms.filter(r => roomsInUnit.has(r.label || "")) };
  }, [layout, selectedUnit, store.residents]);

  const perResidentIndicators = useMemo(
    () => computeSymptomIndicators(store, nowMs),
    [store, nowMs]
  );

  const symptomIndicators = useMemo((): Record<string, SymptomIndicator> => {
    const perRoom: Record<string, SymptomIndicator> = {};
    (Object.values(store.residents || {}) as Resident[])
      .filter(r => r && !r.isHistorical && !r.backOfficeOnly)
      .forEach(res => {
        if (!res.currentRoom) return;
        const sig = perResidentIndicators[res.mrn];
        if (!sig?.respiratory && !sig?.gi) return;
        const room = filteredLayout.rooms.find(
          r => r.label === res.currentRoom || r.label === res.currentRoom?.replace(/^\d/, '')
        );
        if (!room) return;
        const existing = perRoom[room.roomId];
        perRoom[room.roomId] = {
          respiratory: (existing?.respiratory || sig.respiratory),
          gi: (existing?.gi || sig.gi),
        };
      });
    return perRoom;
  }, [perResidentIndicators, store.residents, filteredLayout.rooms]);

  const roomResidentsMap = useMemo(() => {
    const map: Record<string, Resident[]> = {};
    (Object.values(store.residents || {}) as Resident[])
      .filter(r => r && !r.isHistorical && !r.backOfficeOnly)
      .forEach(r => {
        const room = filteredLayout.rooms.find(rm =>
          rm.label === r.currentRoom ||
          rm.label === r.currentRoom?.replace(/^\d/, '')
        );
        if (room) {
          if (!map[room.roomId]) map[room.roomId] = [];
          map[room.roomId].push(r);
        }
      });
    return map;
  }, [store.residents, filteredLayout.rooms]);

  // Calculate stats
  const activeResidents = (Object.values(store.residents || {}) as Resident[])
    .filter(r => r && isActiveCensusResident(r))
    .filter(r => r && normalizeStatus(r.status) === 'active');
  
  const residentCount = activeResidents.length;
  const activePrecautionsCount = (Object.values(store.infections || {}) as any[]).filter(ip => ip && ip.status === 'active' && (ip.isolationType || ip.ebp)).length;
  const outbreakCount = (Object.values(store.outbreaks || {}) as any[]).filter(o => o && o.status !== 'closed').length;
  const activeAbtCourses = getActiveABT(Object.values(store.abts || {})) as any[];
  const abtCount = activeAbtCourses.length;
  const qCount = Object.keys(store.quarantine || {}).length;

  // Today's work queue counts
  const today = new Date().toISOString().split('T')[0];
  const newNotificationsCount = Object.values(store.notifications || {}).filter(n => n && n.status === 'unread').length;
  const abtNeedsReviewCount = activeAbtCourses.filter(a => a && a.reviewDate && a.reviewDate <= today).length;

  // Action Items Lists
  const nowForDot = new Date();
  const vaxDueList = (Object.values(store.vaxEvents || {}) as any[]).filter(v => v && (v.status === 'due' || v.status === 'overdue'));
  const ipActive14DaysList = (Object.values(store.infections || {}) as any[]).filter(ip => {
    if (!ip || ip.status !== 'active') return false;
    const createdDate = new Date(ip.createdAt || ip.onsetDate || nowForDot);
    const fourteenDaysAgo = new Date(nowForDot.getTime() - 14 * 24 * 60 * 60 * 1000);
    return createdDate < fourteenDaysAgo;
  });
  const abtActiveList = activeAbtCourses;

  // Audit Center metrics
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const auditSessions = Object.values(store.infectionControlAuditSessions || {}) as any[];
  const auditItems = Object.values(store.infectionControlAuditItems || {}) as any[];
  const auditsLast30 = auditSessions.filter((s: any) => s && s.createdAt && new Date(s.createdAt) >= thirtyDaysAgo).length;
  const openCorrectiveActions = auditItems.filter((i: any) => i && i.response === 'NON_COMPLIANT' && i.correctiveAction?.trim() && !i.completedAt).length;
  const nonCompliantItems = auditItems.filter((i: any) => i && i.response === 'NON_COMPLIANT').length;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recentAdmissions = (Object.values(store.residents || {}) as Resident[]).filter(r => r && !r.isHistorical && !r.backOfficeOnly).filter(r => r && r.admissionDate && new Date(r.admissionDate) > threeDaysAgo);

  const residentsNeedingScreeningCount = recentAdmissions.filter(r => {
    if (!r) return false;
    const hasScreeningNote = Object.values(store.notes || {}).some(n => 
      n && 
      n.residentRef &&
      n.residentRef.kind === 'mrn' && 
      n.residentRef.id === r.mrn && 
      n.title?.includes('Admission Screening')
    );
    return !hasScreeningNote;
  }).length;
  
  const capacityRate = (facility as any)?.bedCapacity ? ((residentCount / (facility as any).bedCapacity) * 100).toFixed(1) : null;

  // E1: Days-of-Therapy (DOT) calculator
  const totalDotDays = (Object.values(store.abts || {}) as any[]).reduce((sum: number, abt: any) => {
    if (normalizeStatus(abt.status) !== 'active' || !abt.startDate) return sum;
    const start = new Date(abt.startDate);
    const days = Math.max(0, Math.floor((nowForDot.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return sum + days;
  }, 0);
  // DOT per 1,000 resident-days (rolling 30-day denominator = residentCount * 30)
  const dotPer1000 = residentCount > 0 ? ((totalDotDays / (residentCount * 30)) * 1000).toFixed(1) : null;

  // Flu/COVID-19 season banner
  const nowForSeason = new Date();
  const seasonYear = nowForSeason.getMonth() < 7 ? nowForSeason.getFullYear() - 1 : nowForSeason.getFullYear();
  const fluSeasonStart = new Date(seasonYear, 7, 1); // Aug 1
  const fluSeasonEnd = new Date(seasonYear + 1, 4, 31); // May 31
  const isFluSeason = nowForSeason >= fluSeasonStart && nowForSeason <= fluSeasonEnd;

  const activeResidentMrns = new Set(
    activeResidents.map(r => r.mrn)
  );
  const totalActiveResidents = activeResidentMrns.size;

  // Flu coverage: residents with a flu shot given this season
  const fluVaxMrns = new Set<string>();
  const covidVaxMrns = new Set<string>();
  (Object.values(store.vaxEvents || {}) as any[]).forEach((vax: any) => {
    if (!vax) return;
    const resId = vax.residentRef?.id;
    if (!resId || !activeResidentMrns.has(resId)) return;
    const vaccineLower = (vax.vaccine || '').toLowerCase();
    const dateToUse = vax.dateGiven || vax.administeredDate;
    if (vax.status === 'given' && dateToUse) {
      const givenDate = new Date(dateToUse);
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

  // E2: Vaccination coverage (residents)
  // We use the flu coverage during flu season, or COVID coverage otherwise.
  const residentVaxCoverage = isFluSeason ? fluCoverage : covidCoverage;
  const residentVaxGiven = isFluSeason ? fluVaxMrns.size : covidVaxMrns.size;
  const residentVaxTotal = totalActiveResidents;
  const vaxLabel = isFluSeason ? "Flu Vax Coverage" : "COVID Vax Coverage";

  // E2: Vaccination coverage (staff)
  const staffVaxTotal = Object.values(store.staffVaxEvents || {}).length;
  const staffVaxGiven = (Object.values(store.staffVaxEvents || {}) as any[]).filter((v: any) => v && v.status === 'given').length;
  const staffVaxCoverage = staffVaxTotal > 0 ? Math.round((staffVaxGiven / staffVaxTotal) * 100) : null;

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
        {/* Facility Overview */}
        <div>
          <h2 className="text-lg font-bold text-neutral-900 mb-4">Facility Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div onClick={() => setShowCensusModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Census</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-neutral-900">{residentCount}</p>
                    {capacityRate && (
                      <span className="text-xs font-medium text-neutral-500">
                        ({capacityRate}% capacity)
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>
            <div onClick={() => setShowPrecautionsModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Active Precautions</p>
                  <p className="text-2xl font-bold text-neutral-900">{activePrecautionsCount}</p>
                </div>
                <div className="p-2 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
              </div>
            </div>
            <div onClick={() => setShowOutbreakModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Active Outbreaks</p>
                  <p className="text-2xl font-bold text-neutral-900">{outbreakCount}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Click to drill down</p>
                </div>
                <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                </div>
              </div>
            </div>
            <div onClick={() => navigate('/notifications', { state: { category: 'ADMISSION_SCREENING' } })} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Admission Screening</p>
                  <p className="text-2xl font-bold text-neutral-900">{residentsNeedingScreeningCount}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Needs screening</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                  <FileText className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </div>
            <div onClick={() => setShowAbtModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Active ABTs</p>
                  <p className="text-2xl font-bold text-neutral-900">{abtCount}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Click to drill down</p>
                </div>
                <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                  <Inbox className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
          {/* Audit Center Metrics */}
          <div>
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Compliance & Audits</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div onClick={() => navigate('/audit-center')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Audits (Last 30d)</p>
                    <p className="text-2xl font-bold text-neutral-900">{auditsLast30}</p>
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <ClipboardCheck className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
              </div>
              <div onClick={() => navigate('/audit-center')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Open Corrective Actions</p>
                    <p className="text-2xl font-bold text-neutral-900">{openCorrectiveActions}</p>
                  </div>
                  <div className="p-2 bg-yellow-50 rounded-lg group-hover:bg-yellow-100 transition-colors">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
              </div>
              <div onClick={() => navigate('/audit-center')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Non-Compliant Items</p>
                    <p className="text-2xl font-bold text-neutral-900">{nonCompliantItems}</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors">
                    <ClipboardCheck className="w-5 h-5 text-red-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* E1: DOT Calculator & E2: Vaccination Coverage */}
          <div>
            <h2 className="text-lg font-bold text-neutral-900 mb-4">Stewardship & Coverage</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div onClick={() => navigate('/resident-board', { state: { abtActive: true } })} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Days of Therapy (DOT)</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-bold text-neutral-900">{totalDotDays}</p>
                      <span className="text-xs text-neutral-500">days total</span>
                    </div>
                    {dotPer1000 !== null && (
                      <p className="text-xs text-neutral-500 mt-0.5">{dotPer1000} DOT / 1,000 resident-days</p>
                    )}
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                </div>
              </div>
              <div onClick={() => navigate('/resident-board', { state: { vaxFilter: true } })} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">{vaxLabel}</p>
                    {residentVaxCoverage !== null ? (
                      <>
                        <p className="text-2xl font-bold text-neutral-900">{residentVaxCoverage}%</p>
                        <div className="mt-1 h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${residentVaxCoverage >= 80 ? 'bg-emerald-500' : residentVaxCoverage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${residentVaxCoverage}%` }} />
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">{residentVaxGiven} of {residentVaxTotal} vaccinated</p>
                      </>
                    ) : (
                      <p className="text-sm text-neutral-400 mt-1">No data</p>
                    )}
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg shrink-0 group-hover:bg-blue-100 transition-colors">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </div>
              <div onClick={() => navigate('/staff')} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:shadow-md hover:border-indigo-200 transition-all group">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium text-neutral-500 group-hover:text-indigo-600 transition-colors">Staff Vax Coverage</p>
                    {staffVaxCoverage !== null ? (
                      <>
                        <p className="text-2xl font-bold text-neutral-900">{staffVaxCoverage}%</p>
                        <div className="mt-1 h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${staffVaxCoverage >= 80 ? 'bg-emerald-500' : staffVaxCoverage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${staffVaxCoverage}%` }} />
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">{staffVaxGiven} of {staffVaxTotal} doses given</p>
                      </>
                    ) : (
                      <p className="text-sm text-neutral-400 mt-1">No data</p>
                    )}
                  </div>
                  <div className="p-2 bg-indigo-50 rounded-lg shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <Shield className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's IC Work Queue */}
        <div>
          <h2 className="text-lg font-bold text-neutral-900 mb-4">Today's IC Work Queue</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/notifications')}
              className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-indigo-200 transition-all text-left group"
            >
              <div className="p-2 bg-red-50 rounded-lg shrink-0 group-hover:bg-red-100 transition-colors">
                <Bell className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-neutral-900">{newNotificationsCount}</p>
                <p className="text-xs font-medium text-neutral-600 group-hover:text-indigo-600 transition-colors">New alerts / positives</p>
                <p className="text-xs text-neutral-400">Open Notifications →</p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-indigo-400 shrink-0 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/resident-board', { state: { onPrecautions: true } })}
              className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-amber-200 transition-all text-left group"
            >
              <div className="p-2 bg-amber-50 rounded-lg shrink-0 group-hover:bg-amber-100 transition-colors">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-neutral-900">{activePrecautionsCount}</p>
                <p className="text-xs font-medium text-neutral-600 group-hover:text-amber-600 transition-colors">Active precautions</p>
                <p className="text-xs text-neutral-400">Open Resident Board →</p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-amber-400 shrink-0 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/outbreaks')}
              className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-orange-200 transition-all text-left group"
            >
              <div className="p-2 bg-orange-50 rounded-lg shrink-0 group-hover:bg-orange-100 transition-colors">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-neutral-900">{outbreakCount}</p>
                <p className="text-xs font-medium text-neutral-600 group-hover:text-orange-600 transition-colors">Outbreak tasks due</p>
                <p className="text-xs text-neutral-400">Open Outbreak Manager →</p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-orange-400 shrink-0 transition-colors" />
            </button>

            <button
              onClick={() => navigate('/resident-board', { state: { abtActive: true } })}
              className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-neutral-200 hover:shadow-md hover:border-emerald-200 transition-all text-left group"
            >
              <div className="p-2 bg-emerald-50 rounded-lg shrink-0 group-hover:bg-emerald-100 transition-colors">
                <Activity className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xl font-bold text-neutral-900">{abtNeedsReviewCount}</p>
                <p className="text-xs font-medium text-neutral-600 group-hover:text-emerald-600 transition-colors">ABT reviews due</p>
                <p className="text-xs text-neutral-400">Open Resident Board →</p>
              </div>
              <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-emerald-400 shrink-0 transition-colors" />
            </button>
          </div>
        </div>

        {/* Action Items / Needs Review */}
        <div>
          <h2 className="text-lg font-bold text-neutral-900 mb-4">Needs Review</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* VAX Due */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
              <div className="bg-amber-50 border-b border-amber-100 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <h3 className="font-semibold text-amber-900 text-sm">Vaccinations Due</h3>
                </div>
                <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{vaxDueList.length}</span>
              </div>
              <div className="p-0 flex-1 overflow-y-auto max-h-60">
                {vaxDueList.length > 0 ? (
                  <ul className="divide-y divide-neutral-100">
                    {vaxDueList.map(vax => {
                      const res = store.residents?.[vax.residentRef?.id];
                      return (
                        <li key={vax.id} className="p-3 hover:bg-neutral-50 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-neutral-900">{res?.displayName || 'Unknown'}</p>
                            <p className="text-xs text-neutral-500">{vax.vaccine} • Due: {vax.dueDate || 'Unknown'}</p>
                          </div>
                          <button onClick={() => navigate('/resident-board', { state: { vaxFilter: true } })} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Review</button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="p-6 text-center text-sm text-neutral-400">No vaccinations due.</div>
                )}
              </div>
            </div>

            {/* IP > 14 Days */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
              <div className="bg-red-50 border-b border-red-100 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <h3 className="font-semibold text-red-900 text-sm">IP Events &gt; 14 Days</h3>
                </div>
                <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-0.5 rounded-full">{ipActive14DaysList.length}</span>
              </div>
              <div className="p-0 flex-1 overflow-y-auto max-h-60">
                {ipActive14DaysList.length > 0 ? (
                  <ul className="divide-y divide-neutral-100">
                    {ipActive14DaysList.map(ip => {
                      const res = store.residents?.[ip.residentRef?.id];
                      return (
                        <li key={ip.id} className="p-3 hover:bg-neutral-50 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-neutral-900">{res?.displayName || 'Unknown'}</p>
                            <p className="text-xs text-neutral-500">{ip.infectionCategory || 'Infection'} • Started: {ip.onsetDate || ip.createdAt?.split('T')[0]}</p>
                          </div>
                          <button onClick={() => navigate('/resident-board', { state: { onPrecautions: true } })} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Review</button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="p-6 text-center text-sm text-neutral-400">No prolonged IP events.</div>
                )}
              </div>
            </div>

            {/* Active ABT Courses */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
              <div className="bg-emerald-50 border-b border-emerald-100 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-semibold text-emerald-900 text-sm">Active ABT Courses</h3>
                </div>
                <span className="bg-emerald-200 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded-full">{abtActiveList.length}</span>
              </div>
              <div className="p-0 flex-1 overflow-y-auto max-h-60">
                {abtActiveList.length > 0 ? (
                  <ul className="divide-y divide-neutral-100">
                    {abtActiveList.map(abt => {
                      const res = store.residents?.[abt.residentRef?.id];
                      return (
                        <li key={abt.id} className="p-3 hover:bg-neutral-50 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-neutral-900">{res?.displayName || 'Unknown'}</p>
                            <p className="text-xs text-neutral-500">{abt.medication} • End: {abt.endDate || 'Ongoing'}</p>
                          </div>
                          <button onClick={() => setShowAbtModal(true)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Review</button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="p-6 text-center text-sm text-neutral-400">No active ABT courses.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-neutral-900">Live Floor Map</h2>
              <button
                onClick={() => navigate('/floor-map')}
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
              >
                View Full Map <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
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
            symptomIndicators={symptomIndicators}
            onRoomClick={(roomId) => setSelectedRoomId(roomId)}
          />
          {selectedRoomId && (() => {
            const residents = roomResidentsMap[selectedRoomId] ?? [];
            const roomLabel = filteredLayout.rooms.find(r => r.roomId === selectedRoomId)?.label ?? selectedRoomId;
            return (
              <div className="mt-3 bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-2 relative">
                <button
                  onClick={() => setSelectedRoomId(null)}
                  className="absolute top-2 right-2 text-neutral-400 hover:text-neutral-700"
                >
                  <X className="w-4 h-4" />
                </button>
                <p className="text-sm font-bold text-neutral-700">Room {roomLabel}</p>
                {residents.length === 0 ? (
                  <p className="text-sm text-neutral-400">Unoccupied</p>
                ) : (
                  residents.map(r => {
                    const residentIndicator = perResidentIndicators[r.mrn] ?? { respiratory: false, gi: false };
                    return (
                    <div key={r.mrn} className="flex items-center justify-between bg-white border border-neutral-200 rounded-md px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-neutral-800">{r.displayName}</p>
                        <p className="text-xs text-neutral-400">MRN: {r.mrn}</p>
                        <div className="flex gap-1 mt-0.5">
                          {residentIndicator.respiratory && (
                            <span className="text-[9px] font-bold bg-orange-500 text-white px-1 rounded">Resp 96h</span>
                          )}
                          {residentIndicator.gi && (
                            <span className="text-[9px] font-bold bg-purple-500 text-white px-1 rounded">GI 96h</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => navigate('/resident-board', { state: { focusMrn: r.mrn } })}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View Profile →
                      </button>
                    </div>
                    );
                  })
                )}
              </div>
            );
          })()}
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

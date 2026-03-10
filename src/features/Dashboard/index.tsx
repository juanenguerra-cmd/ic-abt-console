import React, { useState, useMemo, useEffect } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Settings } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RoomStatus } from '../Heatmap/FloorMap';
import { CensusModal } from './CensusModal';
import { ActivePrecautionsModal } from './ActivePrecautionsModal';
import { AdmissionScreeningModal } from './AdmissionScreeningModal';
import { ActiveAbtModal } from './ActiveAbtModal';
import { OutbreakDrilldownModal } from './OutbreakDrilldownModal';
import { FloorLayout, Resident } from '../../domain/models';
import { computeSymptomIndicators, SymptomIndicator } from '../../utils/symptomIndicators';
import { getActiveABT, isActiveCensusResident, normalizeStatus } from '../../utils/countCardDataHelpers';
import { 
  SeasonBannerWidget, 
  FacilityOverviewWidget, 
  ComplianceWidget, 
  StewardshipWidget, 
  WorkQueueWidget, 
  NeedsReviewWidget, 
  FloorMapWidget,
  CommandCenterWidget
} from './DashboardWidgets';
import { LS_LAST_BACKUP_TS } from '../../constants/storageKeys';
import { DetectionRules } from '../../services/detectionRules';
import { CustomizeDashboardModal } from './CustomizeDashboardModal';

const CELL_WIDTH = 100;
const CELL_HEIGHT = 52;
const GAP = 16;

const DEFAULT_WIDGETS = [
  { id: 'season-banner', label: 'Season Banner', visible: true },
  { id: 'command-center', label: 'Clinical Command Center', visible: true },
  { id: 'facility-overview', label: 'Facility Overview', visible: true },
  { id: 'work-queue', label: "Today's Work Queue", visible: true },
  { id: 'compliance', label: 'Compliance & Audits', visible: true },
  { id: 'stewardship', label: 'Stewardship & Coverage', visible: true },
  { id: 'needs-review', label: 'Needs Review', visible: true },
  { id: 'floor-map', label: 'Live Floor Map', visible: true },
];

export const Dashboard: React.FC = () => {
  const { db } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const location = useLocation();
  const navigate = useNavigate();
  const facility = db?.data?.facilities?.byId?.[activeFacilityId] || { units: [], floorLayouts: [] };
  
  const [widgets, setWidgets] = useState(() => {
    try {
      const stored = localStorage.getItem(`dashboard_widgets_${activeFacilityId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {}
    return DEFAULT_WIDGETS;
  });

  const [showCustomizeModal, setShowCustomizeModal] = useState(false);

  useEffect(() => {
    localStorage.setItem(`dashboard_widgets_${activeFacilityId}`, JSON.stringify(widgets));
  }, [widgets, activeFacilityId]);

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
    (Object.values(store.residents || {}) as Resident[]).filter(r => r && isActiveCensusResident(r)).forEach(r => {
      if (r.currentUnit?.trim()) unitSet.add(r.currentUnit.trim());
    });
    return Array.from(unitSet).sort();
  }, [store.residents]);

  const filteredLayout = useMemo(() => {
    if (selectedUnit === "all") return layout;
    const roomsInUnit = new Set(
      (Object.values(store.residents || {}) as Resident[])
        .filter(r => r && isActiveCensusResident(r))
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
      .filter(r => r && isActiveCensusResident(r))
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
      .filter(r => r && isActiveCensusResident(r))
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
    .filter(r => r && isActiveCensusResident(r));
  
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

  const recentAdmissions = (Object.values(store.residents || {}) as Resident[]).filter(r => r && isActiveCensusResident(r)).filter(r => r && r.admissionDate && new Date(r.admissionDate) > threeDaysAgo);

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

  // Command Center Alert Calculations
  const stewardshipEscalations = useMemo(() => {
    return Object.values(store.abts || {}).map((abt: any) => ({
      abt,
      alert: DetectionRules.checkAbt14DayEscalation(abt, nowForDot)
    })).filter(x => x.alert);
  }, [store.abts, nowForDot]);

  const isolationReviews = useMemo(() => {
    return Object.values(store.infections || {}).map((ip: any) => ({
      ip,
      alert: DetectionRules.checkIpNoIsolationAlert(ip, nowForDot)
    })).filter(x => x.alert);
  }, [store.infections, nowForDot]);

  const backupStatus = useMemo(() => {
    const lastBackupTimestamp = localStorage.getItem(LS_LAST_BACKUP_TS);
    if (!lastBackupTimestamp) return { isStale: true, label: 'No backup found' };
    
    const lastBackupDate = new Date(parseInt(lastBackupTimestamp, 10));
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const isStale = lastBackupDate < oneDayAgo;
    const diffMs = Date.now() - lastBackupDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const label = diffHours < 24 ? `${diffHours}h ago` : `${Math.floor(diffHours / 24)}d ago`;
    
    return { isStale, label: `Last backup: ${label}` };
  }, []);

  const widgetProps = {
    navigate,
    store,
    activeFacilityId,
    facility,
    isFluSeason, fluCoverage, covidCoverage, fluVaxMrns, covidVaxMrns, totalActiveResidents, fluSeasonStart, fluSeasonEnd,
    residentCount, capacityRate, activePrecautionsCount, outbreakCount, residentsNeedingScreeningCount, abtCount,
    setShowCensusModal, setShowPrecautionsModal, setShowOutbreakModal, setShowAbtModal, setShowScreeningModal,
    auditsLast30, openCorrectiveActions, nonCompliantItems,
    totalDotDays, dotPer1000, residentVaxCoverage, residentVaxGiven, residentVaxTotal, vaxLabel, staffVaxCoverage, staffVaxGiven, staffVaxTotal,
    newNotificationsCount, abtNeedsReviewCount,
    vaxDueList, ipActive14DaysList, abtActiveList,
    units, selectedUnit, setSelectedUnit, tileSize, setTileSize, filteredLayout, roomStatuses, symptomIndicators, selectedRoomId, setSelectedRoomId, roomResidentsMap, perResidentIndicators,
    stewardshipEscalations, isolationReviews, backupStatus
  };

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="flex justify-end">
          <button
            onClick={() => setShowCustomizeModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 hover:text-indigo-600 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Customize Dashboard
          </button>
        </div>

        {widgets.filter((w: any) => w.visible).map((widget: any) => {
          switch (widget.id) {
            case 'season-banner': return <SeasonBannerWidget key={widget.id} {...widgetProps} />;
            case 'command-center': return <CommandCenterWidget key={widget.id} {...widgetProps} />;
            case 'facility-overview': return <FacilityOverviewWidget key={widget.id} {...widgetProps} />;
            case 'work-queue': return <WorkQueueWidget key={widget.id} {...widgetProps} />;
            case 'compliance': return <ComplianceWidget key={widget.id} {...widgetProps} />;
            case 'stewardship': return <StewardshipWidget key={widget.id} {...widgetProps} />;
            case 'needs-review': return <NeedsReviewWidget key={widget.id} {...widgetProps} />;
            case 'floor-map': return <FloorMapWidget key={widget.id} {...widgetProps} />;
            default: return null;
          }
        })}
      </div>

      {showCustomizeModal && (
        <CustomizeDashboardModal 
          widgets={widgets} 
          setWidgets={setWidgets} 
          onClose={() => setShowCustomizeModal(false)} 
        />
      )}

      {showCensusModal && <CensusModal onClose={() => setShowCensusModal(false)} />}
      {showPrecautionsModal && <ActivePrecautionsModal onClose={() => setShowPrecautionsModal(false)} />}
      {showScreeningModal && <AdmissionScreeningModal onClose={() => setShowScreeningModal(false)} />}
      {showAbtModal && <ActiveAbtModal onClose={() => setShowAbtModal(false)} />}
      {showOutbreakModal && <OutbreakDrilldownModal onClose={() => setShowOutbreakModal(false)} />}
    </>
  );
};

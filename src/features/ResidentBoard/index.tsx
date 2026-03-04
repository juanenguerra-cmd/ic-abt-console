import React, { useState, useMemo, useEffect } from "react";
import { useFacilityData, useDatabase } from "../../app/providers";
import { Resident } from "../../domain/models";
import { Search, Filter, AlertCircle, Shield, Activity, Syringe, Thermometer, Users, X, Upload, Plus, FileText, Settings, Map, Printer, Inbox, ArrowLeft, ExternalLink } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { CensusParserModal } from "./CensusParserModal";
import { AbtCourseModal } from "./AbtCourseModal";
import { IpEventModal } from "./IpEventModal";
import { VaxEventModal } from "./VaxEventModal";
import { ResidentProfileModal } from "./ResidentProfileModal";
import { SettingsModal } from "./SettingsModal";
import { ShiftReport } from "./ShiftReport";
import { QuarantineLinkModal } from "./QuarantineLinkModal";
import { NewAdmissionIpScreening } from "./PrintableForms/NewAdmissionIpScreening";
import { useUndoToast } from "../../components/UndoToast";
import { EmptyState } from "../../components/EmptyState";
import { computeResidentSignals, ResidentSignals } from "../../utils/residentSignals";
import { computeSymptomIndicators } from "../../utils/symptomIndicators";
import { getActiveABT, getVaxDue, isActiveCensusResident, normalizeStatus } from "../../utils/countCardDataHelpers";
import { ContactTraceCaseModal } from "../ContactTracing/ContactTraceCaseModal";
import { v4 as uuidv4 } from "uuid";
import { startPrint } from "../../print/startPrint";

/**
 * Colour lookup for Kanban tile strips and tinted backgrounds.
 * yellow = Isolation (formal precaution type assigned)
 * blue   = EBP only (Enhanced Barrier Precautions / MDRO)
 * green  = Active ABT course
 */
const TILE_COLORS: Record<string, { strip: string; bg: string }> = {
  yellow: { strip: '#eab308', bg: 'rgba(234,179,8,0.05)' },
  blue:   { strip: '#3b82f6', bg: 'rgba(59,130,246,0.05)' },
  green:  { strip: '#22c55e', bg: 'rgba(34,197,94,0.05)' },
  none:   { strip: 'transparent', bg: 'transparent' },
};

export const ResidentBoard: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { db, updateDB } = useDatabase();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showUndo } = useUndoToast();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActiveOnly, setFilterActiveOnly] = useState(true);
  const [filterAbtOnly, setFilterAbtOnly] = useState(() => searchParams.get('abtActive') === 'true');
  const [filterUnit, setFilterUnit] = useState<string>(() => searchParams.get('unit') || "");
  const [filterOnPrecautions, setFilterOnPrecautions] = useState(() => searchParams.get('onPrecautions') === 'true');
  const [filterLast24h, setFilterLast24h] = useState(() => searchParams.get('last24h') === 'true');
  const [filterNeedsReview, setFilterNeedsReview] = useState(() => searchParams.get('needsReview') === 'true');
  const [filterVaxDueOnly, setFilterVaxDueOnly] = useState(() => searchParams.get('vaxDue') === 'true');
  const [showAllActiveResidents, setShowAllActiveResidents] = useState(false);
  
  const [selectedResidentId, setSelectedResidentId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCensusModal, setShowCensusModal] = useState(false);
  
  const [view, setView] = useState<'board' | 'report' | 'quarantine'>('board');

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [printingResidentId, setPrintingResidentId] = useState<string | null>(null);
  const [linkingQuarantineId, setLinkingQuarantineId] = useState<string | null>(null);

  const [showAbtModal, setShowAbtModal] = useState(false);
  const [editingAbtId, setEditingAbtId] = useState<string | null>(null);
  
  const [showIpModal, setShowIpModal] = useState(false);
  const [editingIpId, setEditingIpId] = useState<string | null>(null);
  
  const [showVaxModal, setShowVaxModal] = useState(false);
  const [editingVaxId, setEditingVaxId] = useState<string | null>(null);

  const [showContactTraceModal, setShowContactTraceModal] = useState(false);
  const [contactTraceCaseId, setContactTraceCaseId] = useState<string | null>(null);

  // Sync filter state to URL search params
  const updateFilters = (updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, val]) => {
        if (val === null || val === '' || val === 'false') {
          next.delete(key);
        } else {
          next.set(key, val);
        }
      });
      return next;
    }, { replace: true });
  };

  // Read filters from navigation state (from Dashboard Work Queue cards etc.)
  useEffect(() => {
    const state = location.state as { 
      filterUnit?: string;
      onPrecautions?: boolean;
      abtActive?: boolean;
      selectedResidentId?: string;
      openProfile?: boolean;
      openModal?: 'abt' | 'ip' | 'vax';
      vaxFilter?: boolean;
      editId?: string;
    } | null;
    
    if (state) {
      const paramUpdates: Record<string, string | null> = {};
      if (state.filterUnit) { setFilterUnit(state.filterUnit); paramUpdates.unit = state.filterUnit; }
      if (state.onPrecautions) { setFilterOnPrecautions(true); paramUpdates.onPrecautions = 'true'; }
      if (state.abtActive) { setFilterAbtOnly(true); paramUpdates.abtActive = 'true'; }
      if (state.vaxFilter) { setFilterVaxDueOnly(true); paramUpdates.vaxDue = 'true'; }
      if (Object.keys(paramUpdates).length > 0) updateFilters(paramUpdates);
      if (state.selectedResidentId) {
        setSelectedResidentId(state.selectedResidentId);
        if (state.openProfile) setShowProfileModal(true);
        if (state.openModal === 'abt') { setEditingAbtId(state.editId || null); setShowAbtModal(true); }
        if (state.openModal === 'ip') { setEditingIpId(state.editId || null); setShowIpModal(true); }
        if (state.openModal === 'vax') { setEditingVaxId(state.editId || null); setShowVaxModal(true); }
      }
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const residents = (Object.values(store.residents || {}) as Resident[]).filter(r => r);
  const activeInfections = (Object.values(store.infections || {}) as any[]).filter(i => i && i.status === 'active');
  const activeABTs = getActiveABT(Object.values(store.abts || {})) as any[];
  const vaxEvents = (Object.values(store.vaxEvents || {}) as any[]).filter(v => v);
  const today = new Date().toISOString().split('T')[0];
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Pre-compute symptom map + signal map once per store snapshot
  const symptomMap = useMemo(() => computeSymptomIndicators(store, Date.now()), [store]);
  const signalMap = useMemo<Record<string, ResidentSignals>>(() => {
    const nowMs = Date.now();
    const map: Record<string, ResidentSignals> = {};
    residents.forEach(r => {
      if (r && r.mrn) {
        map[r.mrn] = computeResidentSignals(r.mrn, store, nowMs, symptomMap);
      }
    });
    return map;
  }, [store, residents, symptomMap]);
  
  // Calculate age
  const getAge = (dob?: string) => {
    if (!dob) return "?";
    const birthDate = new Date(dob);
    const todayDate = new Date();
    let age = todayDate.getFullYear() - birthDate.getFullYear();
    const m = todayDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && todayDate.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Filter logic
  const filteredResidents = useMemo(() => {
    return residents.filter(r => {
      // Exclude unassigned residents since they are not true active census
      if (!isActiveCensusResident(r)) {
        return false;
      }

      // Global Search
      const matchesSearch = 
        (r.displayName || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
        (r.mrn || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.currentRoom && r.currentRoom.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      // Toggles
      if (filterActiveOnly && normalizeStatus(r.status) !== "active") return false;
      
      if (filterAbtOnly) {
        const hasAbt = activeABTs.some(a => a.residentRef.kind === "mrn" && a.residentRef.id === r.mrn);
        if (!hasAbt) return false;
      }

      if (filterOnPrecautions) {
        const hasIP = activeInfections.some(i => i.residentRef.kind === "mrn" && i.residentRef.id === r.mrn && (i.isolationType || i.ebp));
        if (!hasIP) return false;
      }

      if (filterLast24h) {
        const updatedAt = (r as any).updatedAt || r.admissionDate || '';
        if (!updatedAt || updatedAt < twentyFourHoursAgo) return false;
      }

      if (filterNeedsReview) {
        const dueAbt = activeABTs.find(a => a.residentRef.kind === "mrn" && a.residentRef.id === r.mrn && a.reviewDate && a.reviewDate <= today);
        if (!dueAbt) return false;
      }

      if (filterVaxDueOnly) {
        const hasDueVax = getVaxDue(vaxEvents, r.mrn).length > 0;
        if (!hasDueVax) return false;
      }

      if (filterUnit && r.currentUnit?.trim() !== filterUnit) return false;

      // Default signal filter: when no explicit toggle is active and showAllActiveResidents is OFF,
      // only show residents who have at least one IC-relevant signal.
      if (!showAllActiveResidents && !filterActiveOnly && !filterAbtOnly && !filterOnPrecautions && !filterLast24h && !filterNeedsReview && !filterVaxDueOnly && !filterUnit) {
        const sigs = signalMap[r.mrn];
        if (sigs && !sigs.hasActivePrecaution && !sigs.hasEbp && !sigs.hasActiveAbt && !sigs.hasDueVax && !sigs.hasRecentSymptoms96h) {
          return false;
        }
      }

      return true;
    });
  }, [residents, searchQuery, filterActiveOnly, filterAbtOnly, filterOnPrecautions, filterLast24h, filterNeedsReview, filterVaxDueOnly, activeABTs, activeInfections, filterUnit, today, twentyFourHoursAgo, showAllActiveResidents, signalMap, vaxEvents]);

  // Group by Unit
  const units = useMemo(() => {
    const groups: Record<string, Resident[]> = {};
    filteredResidents.forEach(r => {
      let unit = r.currentUnit || "Unassigned";
      unit = unit.replace(/\s*\(continued\)\s*/i, '').trim();
      if (!groups[unit]) groups[unit] = [];
      groups[unit].push(r);
    });
    
    // Sort each unit by room
    Object.keys(groups).forEach(unit => {
      groups[unit].sort((a, b) => (a.currentRoom || "").localeCompare(b.currentRoom || ""));
    });
    
    return groups;
  }, [filteredResidents]);



  const handlePrintCensus = () => {
    const precautionsByMrn = activeInfections.reduce<Record<string, string[]>>((acc, infection: any) => {
      if (infection.residentRef?.kind !== "mrn") return acc;
      const label = [infection.isolationType, infection.ebp ? "EBP" : ""].filter(Boolean).join(" / ");
      if (!label) return acc;
      if (!acc[infection.residentRef.id]) acc[infection.residentRef.id] = [];
      if (!acc[infection.residentRef.id].includes(label)) acc[infection.residentRef.id].push(label);
      return acc;
    }, {});

    startPrint("census-rounding", () => {
      const rows = filteredResidents
        .slice()
        .sort((a, b) => (a.currentUnit || "").localeCompare(b.currentUnit || "") || (a.currentRoom || "").localeCompare(b.currentRoom || ""))
        .map((resident) => ({
          unit: resident.currentUnit || "",
          room: resident.currentRoom || "",
          name: resident.displayName || `${resident.lastName || ""}, ${resident.firstName || ""}`.trim().replace(/^,\s*/, ""),
          mrn: resident.mrn || "",
          precautions: (precautionsByMrn[resident.mrn] || []).join(", "),
        }));

      return {
        facility: db.data.facilities.byId[activeFacilityId]?.name || "Long Beach Nursing and Rehabilitation Center",
        title: "Census Rounds Sheet",
        meta: { unit: filterUnit || "All" },
        rows,
      };
    });
  };

  const handleClearQuarantine = () => {
    const snapshot = { ...store.quarantine };
    updateDB(draft => {
      draft.data.facilityData[activeFacilityId].quarantine = {};
    });
    showUndo({
      message: `Quarantine inbox cleared (${Object.keys(snapshot).length} records)`,
      onUndo: () => {
        updateDB(draft => {
          draft.data.facilityData[activeFacilityId].quarantine = snapshot;
        });
      },
    });
  };

  if (view === 'quarantine') {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100">
        <div className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('board')} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-neutral-900">Quarantine Inbox</h1>
          </div>
          <button 
            onClick={handleClearQuarantine}
            className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 text-sm font-medium"
          >
            Clear All
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(store.quarantine || {}).map(qRes => (
              <div key={qRes.tempId} className="bg-white border rounded-xl p-4 shadow-sm border-rose-200">
                <h4 className="text-lg font-bold text-neutral-900 mb-1">{qRes.displayName || "Unknown Name"}</h4>
                <p className="text-sm text-neutral-500 mb-2">DOB: {qRes.dob || "Unknown"} ({qRes.dob ? `${getAge(qRes.dob)} yrs` : ""})</p>
                <div className="flex gap-2 text-sm">
                  <span className="bg-neutral-100 px-2 py-1 rounded text-neutral-700 font-medium">Unit: {qRes.unitSnapshot || "N/A"}</span>
                  <span className="bg-neutral-100 px-2 py-1 rounded text-neutral-700 font-medium">Room: {qRes.roomSnapshot || "N/A"}</span>
                </div>
              </div>
            ))}
            {Object.keys(store.quarantine).length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  icon={<Inbox className="w-16 h-16 text-neutral-300" />}
                  title="Quarantine Inbox is empty"
                  description="Residents parsed from the census that could not be matched automatically will appear here for manual review."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'report') {
    return <ShiftReport onBack={() => setView('board')} />;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100">
      {/* Top Bar */}
      <div className="bg-white border-b border-neutral-200 px-6 py-3 flex flex-wrap items-center gap-3 shrink-0" role="toolbar" aria-label="Resident board controls">
        <h1 className="text-xl font-bold text-neutral-900 shrink-0">Resident Board</h1>
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" aria-hidden="true" />
          <input 
            type="search"
            aria-label="Search residents by name, MRN, or room"
            placeholder="Search name, MRN, room..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500 w-56"
          />
        </div>

        {/* IC-first filter toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => { const v = !filterOnPrecautions; setFilterOnPrecautions(v); updateFilters({ onPrecautions: v ? 'true' : null }); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterOnPrecautions ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}
            aria-pressed={filterOnPrecautions}
          >
            On Precautions
          </button>
          <button
            onClick={() => { const v = !filterLast24h; setFilterLast24h(v); updateFilters({ last24h: v ? 'true' : null }); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterLast24h ? 'bg-blue-100 border-blue-400 text-blue-800' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}
            aria-pressed={filterLast24h}
          >
            Changed 24h
          </button>
          <button
            onClick={() => { const v = !filterAbtOnly; setFilterAbtOnly(v); updateFilters({ abtActive: v ? 'true' : null }); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterAbtOnly ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}
            aria-pressed={filterAbtOnly}
          >
            ABT Active
          </button>
          <button
            onClick={() => { const v = !filterNeedsReview; setFilterNeedsReview(v); updateFilters({ needsReview: v ? 'true' : null }); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterNeedsReview ? 'bg-purple-100 border-purple-400 text-purple-800' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}
            aria-pressed={filterNeedsReview}
          >
            Needs Review
          </button>
          <button
            onClick={() => { const v = !filterVaxDueOnly; setFilterVaxDueOnly(v); updateFilters({ vaxDue: v ? 'true' : null }); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterVaxDueOnly ? 'bg-fuchsia-100 border-fuchsia-400 text-fuchsia-800' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}
            aria-pressed={filterVaxDueOnly}
          >
            VAX Due
          </button>
          <button
            onClick={() => { const v = !filterActiveOnly; setFilterActiveOnly(v); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterActiveOnly ? 'bg-sky-100 border-sky-400 text-sky-800' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}
            aria-pressed={filterActiveOnly}
          >
            Active Only
          </button>
          <div className="w-px h-5 bg-neutral-300 mx-1" aria-hidden="true" />
          <button
            onClick={() => setShowAllActiveResidents(v => !v)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${showAllActiveResidents ? 'bg-neutral-800 border-neutral-800 text-white' : 'bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}
            aria-pressed={showAllActiveResidents}
            title="When OFF, only residents with active precautions, ABT, due vaccines, or recent symptoms are shown"
          >
            Show all active residents
          </button>
          {filterUnit && (
            <div className="flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full text-xs font-medium border border-indigo-300">
              Unit: {filterUnit}
              <button onClick={() => { setFilterUnit(""); updateFilters({ unit: null }); }} aria-label={`Remove unit filter: ${filterUnit}`} className="ml-0.5 hover:text-indigo-900">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {(filterOnPrecautions || filterLast24h || filterAbtOnly || filterNeedsReview || filterVaxDueOnly || filterActiveOnly || filterUnit) && (
            <button
              onClick={() => {
                setFilterOnPrecautions(false);
                setFilterLast24h(false);
                setFilterAbtOnly(false);
                setFilterNeedsReview(false);
                setFilterActiveOnly(false);
                setFilterVaxDueOnly(false);
                setFilterUnit("");
                setSearchParams({}, { replace: true });
              }}
              className="px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-300 text-neutral-500 hover:bg-neutral-50"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={handlePrintCensus}
            className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            Print Census
          </button>
          <button 
            onClick={() => setShowCensusModal(true)}
            aria-label="Upload or update census file"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            Census
          </button>
          <button 
            onClick={() => setView('quarantine')}
            aria-label="View quarantine inbox"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md text-sm font-medium hover:bg-rose-100 transition-colors"
          >
            <Inbox className="w-4 h-4" aria-hidden="true" />
            Quarantine
          </button>
          <button 
            onClick={() => setView('report')}
            aria-label="View shift report"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            Shift Report
          </button>
          <button 
            onClick={() => setShowSettingsModal(true)}
            aria-label="Board settings"
            className="p-1.5 bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-md hover:bg-neutral-200 transition-colors"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Link-out banners */}
      {filterOnPrecautions && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-3 shrink-0 text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Showing residents on active precautions.</span>
          <button onClick={() => navigate('/outbreaks')} className="ml-auto flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium underline">
            <ExternalLink className="w-3 h-3" /> Open Outbreak Manager
          </button>
          <button onClick={() => navigate('/audit-center')} className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium underline">
            <ExternalLink className="w-3 h-3" /> Open Audit Center
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex overflow-x-auto p-4 gap-4">
          {Object.keys(units).length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<Users className="w-16 h-16 text-neutral-300" />}
                title="No residents on the board"
                description={
                  searchQuery || filterActiveOnly || filterAbtOnly || filterUnit || filterOnPrecautions || filterLast24h || filterNeedsReview
                    ? "No residents match your current filters. Try clearing the filters above."
                    : "Upload a census file to populate the board, or add residents manually through Settings."
                }
                action={
                  !searchQuery && !filterActiveOnly && !filterAbtOnly && !filterUnit && !filterOnPrecautions && !filterLast24h && !filterNeedsReview ? (
                    <button
                      onClick={() => setShowCensusModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                    >
                      <Upload className="w-4 h-4" aria-hidden="true" />
                      Upload Census
                    </button>
                  ) : undefined
                }
              />
            </div>
          )}
          {(Object.entries(units) as [string, Resident[]][])
            .sort(([unitNameA], [unitNameB]) => {
              const order = ['Unit 2', 'Unit 3', 'Unit 4'];
              const indexA = order.indexOf(unitNameA);
              const indexB = order.indexOf(unitNameB);
              if (indexA !== -1 && indexB !== -1) return indexA - indexB;
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              return unitNameA.localeCompare(unitNameB);
            })
            .map(([unitName, unitResidents]) => (
            <div key={unitName} className="flex flex-col min-w-[18rem] flex-1 bg-neutral-50 rounded-xl border border-neutral-200 overflow-hidden">
              <div className="bg-white px-4 py-3 border-b border-neutral-200 flex justify-between items-center shrink-0">
                <h2 className="font-bold text-neutral-800">{unitName}</h2>
                <span className="bg-neutral-200 text-neutral-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unitResidents.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {unitResidents.map(resident => {
                  const hasAllergies = resident.allergies && resident.allergies.length > 0;
                  const isActive = resident.status === "Active";
                  const sigs = signalMap[resident.mrn] || { hasActivePrecaution: false, hasEbp: false, hasActiveAbt: false, hasDueVax: false, hasRecentSymptoms96h: false, strip: 'none' as const };
                  const tileColor = TILE_COLORS[sigs.strip] ?? TILE_COLORS.none;
                  const isSelected = selectedResidentId === resident.mrn;

                  return (
                    <div 
                      key={resident.mrn}
                      onClick={() => {
                        setSelectedResidentId(resident.mrn);
                        setShowProfileModal(true);
                      }}
                      style={{ background: tileColor.bg }}
                      className={`relative border rounded-lg cursor-pointer transition-all shadow-sm hover:shadow-md overflow-hidden ${
                        isSelected ? "border-indigo-500 ring-1 ring-indigo-500" : "border-neutral-200"
                      }`}
                    >
                      {/* Left colour strip — yellow=Isolation, blue=EBP, green=ABT */}
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg" style={{ backgroundColor: tileColor.strip }} />
                      <div className="pl-4 pr-3 py-3">
                        {/* Header Row */}
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-bold text-neutral-900 truncate pr-2" title={resident.displayName}>
                            {resident.displayName}
                          </h4>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedResidentId(resident.mrn);
                                setEditingAbtId(null);
                                setShowAbtModal(true);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Add ABT"
                            >
                              <Activity className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedResidentId(resident.mrn);
                                setEditingIpId(null);
                                setShowIpModal(true);
                              }}
                              className="p-1 text-amber-600 hover:bg-amber-50 rounded"
                              title="Add IP Event"
                            >
                              <Shield className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedResidentId(resident.mrn);
                                setEditingVaxId(null);
                                setShowVaxModal(true);
                              }}
                              className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                              title="Add Vaccination"
                            >
                              <Syringe className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintingResidentId(resident.mrn);
                              }}
                              className="p-1 text-neutral-500 hover:bg-neutral-100 rounded"
                              title="Print New Admission IP Screening Form"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0 ml-1">
                              {resident.currentRoom || "N/A"}
                            </span>
                          </div>
                        </div>
                        
                        {/* Sub-row */}
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs text-neutral-500 font-mono">{resident.mrn}</span>
                          <span className="text-xs text-neutral-500">{getAge(resident.dob)} yrs</span>
                        </div>

                        {/* Chip Row */}
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {hasAllergies && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white shadow-sm uppercase tracking-wider">
                              Allergies
                            </span>
                          )}
                          {isActive && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500 text-white shadow-sm uppercase tracking-wider">
                              Active
                            </span>
                          )}
                          {/* Isolation chip — only fires when isolationType is set (NOT for EBP-only residents) */}
                          {sigs.hasActivePrecaution && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white shadow-sm uppercase tracking-wider">
                              Isolation
                            </span>
                          )}
                          {/* EBP chip — blue, distinct from Isolation */}
                          {sigs.hasEbp && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white shadow-sm uppercase tracking-wider">
                              EBP
                            </span>
                          )}
                          {sigs.hasActiveAbt && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white shadow-sm uppercase tracking-wider">
                              ABT Active
                            </span>
                          )}
                          {sigs.hasDueVax && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500 text-white shadow-sm uppercase tracking-wider">
                              VAX Due
                            </span>
                          )}
                          {sigs.hasRecentSymptoms96h && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-white shadow-sm uppercase tracking-wider">
                              Sx ≤96h
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resident Profile Modal */}
      {showProfileModal && selectedResidentId && (
        <ResidentProfileModal
          residentId={selectedResidentId}
          onClose={() => setShowProfileModal(false)}
          onAddAbt={() => { setEditingAbtId(null); setShowAbtModal(true); }}
          onAddIp={() => { setEditingIpId(null); setShowIpModal(true); }}
          onAddVax={() => { setEditingVaxId(null); setShowVaxModal(true); }}
          onEditAbt={(id) => { setEditingAbtId(id); setShowAbtModal(true); }}
          onEditIp={(id) => { setEditingIpId(id); setShowIpModal(true); }}
          onEditVax={(id) => { setEditingVaxId(id); setShowVaxModal(true); }}
          onDeleteAbt={(id) => {
            if (!confirm("Delete this antibiotic course? An undo option will appear briefly after deletion.")) return;
            const snapshot = db.data.facilityData[activeFacilityId]?.abts?.[id];
            if (!snapshot) return;
            updateDB(draft => { delete draft.data.facilityData[activeFacilityId].abts[id]; }, { action: 'delete', entityType: 'ABTCourse', entityId: id });
            showUndo({ message: "ABT course deleted", onUndo: () => updateDB(draft => { draft.data.facilityData[activeFacilityId].abts[id] = snapshot; }) });
          }}
          onDeleteIp={(id) => {
            if (!confirm("Delete this infection/precaution event? An undo option will appear briefly after deletion.")) return;
            const snapshot = db.data.facilityData[activeFacilityId]?.infections?.[id];
            if (!snapshot) return;
            updateDB(draft => { delete draft.data.facilityData[activeFacilityId].infections[id]; }, { action: 'delete', entityType: 'IPEvent', entityId: id });
            showUndo({ message: "IP event deleted", onUndo: () => updateDB(draft => { draft.data.facilityData[activeFacilityId].infections[id] = snapshot; }) });
          }}
          onDeleteVax={(id) => {
            if (!confirm("Delete this vaccination record? An undo option will appear briefly after deletion.")) return;
            const snapshot = db.data.facilityData[activeFacilityId]?.vaxEvents?.[id];
            if (!snapshot) return;
            updateDB(draft => { delete draft.data.facilityData[activeFacilityId].vaxEvents[id]; }, { action: 'delete', entityType: 'VaxEvent', entityId: id });
            showUndo({ message: "Vaccination record deleted", onUndo: () => updateDB(draft => { draft.data.facilityData[activeFacilityId].vaxEvents[id] = snapshot; }) });
          }}
          onStartContactTrace={(ref) => {
            if (!selectedResidentId) return;
            const now = new Date().toISOString();
            const newCaseId = uuidv4();
            updateDB((draft) => {
              const fd = draft.data.facilityData[activeFacilityId];
              if (!fd.contactTraceCases) fd.contactTraceCases = {};
              fd.contactTraceCases[newCaseId] = {
                id: newCaseId,
                status: 'open',
                indexResidentMrn: selectedResidentId,
                indexRef: ref,
                createdAt: now,
                updatedAt: now,
              };
            }, { action: 'create', entityType: 'ContactTraceCase', entityId: newCaseId });
            setContactTraceCaseId(newCaseId);
            setShowContactTraceModal(true);
          }}
        />
      )}

      {/* Contact Trace Case Modal */}
      {showContactTraceModal && contactTraceCaseId && (
        <ContactTraceCaseModal
          caseId={contactTraceCaseId}
          onClose={() => { setShowContactTraceModal(false); setContactTraceCaseId(null); }}
        />
      )}

      {printingResidentId && (
        <NewAdmissionIpScreening 
          residentId={printingResidentId} 
          onClose={() => setPrintingResidentId(null)} 
        />
      )}

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {/* Census Parser Modal */}
      {showCensusModal && (
        <CensusParserModal onClose={() => setShowCensusModal(false)} />
      )}

      {/* ABT Course Modal */}
      {showAbtModal && selectedResidentId && (
        <AbtCourseModal 
          residentId={selectedResidentId}
          existingAbt={editingAbtId ? store.abts[editingAbtId] : undefined}
          onClose={() => {
            setShowAbtModal(false);
            setEditingAbtId(null);
          }} 
        />
      )}

      {/* IP Event Modal */}
      {showIpModal && selectedResidentId && (
        <IpEventModal 
          residentId={selectedResidentId}
          existingIp={editingIpId ? store.infections[editingIpId] : undefined}
          onClose={() => {
            setShowIpModal(false);
            setEditingIpId(null);
          }} 
        />
      )}

      {/* Vax Event Modal */}
      {showVaxModal && selectedResidentId && (
        <VaxEventModal 
          residentId={selectedResidentId}
          existingVax={editingVaxId ? store.vaxEvents[editingVaxId] : undefined}
          onClose={() => {
            setShowVaxModal(false);
            setEditingVaxId(null);
          }} 
        />
      )}
    </div>
  );
};

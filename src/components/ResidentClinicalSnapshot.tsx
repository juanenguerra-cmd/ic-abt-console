import React, { useMemo } from 'react';
import { 
  Shield, 
  Activity, 
  AlertCircle, 
  Syringe, 
  Zap, 
  Clock, 
  Link as LinkIcon,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  PlusCircle
} from 'lucide-react';
import { useFacilityData } from '../app/providers';
import { useResidentAlerts } from '../hooks/useResidentAlerts';
import { getAbtDays } from '../utils/countCardDataHelpers';
import { normalizeClinicalDevices, getDeviceDay } from '../utils/clinicalDevices';
import { IPEvent, ABTCourse, VaxEvent, OutbreakCase, SymptomClass } from '../domain/models';

interface LineListSuggestion {
  symptomClass: SymptomClass;
  label: string;
  onsetDate: string;
  sourceEventId: string;
}

interface Props {
  residentId: string;
  className?: string;
  compact?: boolean;
  onAddToLineList?: (opts: { symptomClass: SymptomClass; onsetDate: string; sourceEventId: string }) => void;
}

export const ResidentClinicalSnapshot: React.FC<Props> = ({ residentId, className = "", compact = false, onAddToLineList }) => {
  const { store } = useFacilityData();
  const resident = store.residents[residentId];
  const alerts = useResidentAlerts(residentId);

  if (!resident) return null;

  // 1. Isolation Status
  const activeInfections = useMemo(() => {
    return Object.values(store.infections || {}).filter(ip => 
      ip.residentRef.kind === 'mrn' && 
      ip.residentRef.id === resident.mrn && 
      ip.status === 'active'
    );
  }, [store.infections, resident.mrn]);

  const isolation = useMemo(() => {
    const ipWithIso = activeInfections.find(ip => ip.isolationType && ip.isolationType !== 'None');
    return ipWithIso ? { type: ipWithIso.isolationType, id: ipWithIso.id } : null;
  }, [activeInfections]);

  // 2. Active Antibiotics
  const activeAbts = useMemo(() => {
    return Object.values(store.abts || {}).filter(abt => 
      abt.residentRef.kind === 'mrn' && 
      abt.residentRef.id === resident.mrn && 
      abt.status === 'active'
    );
  }, [store.abts, resident.mrn]);

  // 3. Device Flags
  const devices = useMemo(() => normalizeClinicalDevices(resident), [resident]);
  const activeDevices = useMemo(() => {
    const list = [];
    if (devices.oxygen.enabled) list.push({ name: 'Oxygen', mode: devices.oxygen.mode });
    if (devices.urinaryCatheter.active) list.push({ name: 'Urinary Cath', day: getDeviceDay(devices.urinaryCatheter.insertedDate) });
    if (devices.indwellingCatheter.active) list.push({ name: 'Indwelling Cath', day: getDeviceDay(devices.indwellingCatheter.insertedDate) });
    if (devices.midline.active) list.push({ name: 'Midline', day: getDeviceDay(devices.midline.insertedDate) });
    if (devices.picc.active) list.push({ name: 'PICC', day: getDeviceDay(devices.picc.insertedDate) });
    if (devices.piv.active) list.push({ name: 'PIV', day: getDeviceDay(devices.piv.insertedDate) });
    if (devices.centralLine.active) list.push({ name: 'Central Line', day: getDeviceDay(devices.centralLine.insertedDate) });
    if (devices.trach.active) list.push({ name: 'Trach', day: getDeviceDay(devices.trach.insertedDate) });
    if (devices.peg.active) list.push({ name: 'PEG', day: getDeviceDay(devices.peg.insertedDate) });
    if (devices.woundVac.active) list.push({ name: 'Wound Vac', day: getDeviceDay(devices.woundVac.insertedDate) });
    if (devices.dialysisAccess.active) list.push({ name: 'Dialysis Access', day: getDeviceDay(devices.dialysisAccess.insertedDate) });
    if (devices.ostomy.active) list.push({ name: 'Ostomy' });
    return list;
  }, [devices]);

  // 4. Outbreak Linkage
  const outbreakLink = useMemo(() => {
    const caseRecord = Object.values(store.outbreakCases || {}).find(c => 
      c.residentRef.kind === 'mrn' && 
      c.residentRef.id === resident.mrn &&
      c.caseStatus !== 'ruled_out'
    );
    if (!caseRecord) return null;
    const outbreak = store.outbreaks[caseRecord.outbreakId];
    return outbreak ? { id: outbreak.id, title: outbreak.title, status: caseRecord.caseStatus } : null;
  }, [store.outbreakCases, store.outbreaks, resident.mrn]);

  // 5. Vaccine Gaps
  const vaxGaps = useMemo(() => {
    return Object.values(store.vaxEvents || {}).filter(v => 
      v.residentRef.kind === 'mrn' && 
      v.residentRef.id === resident.mrn && 
      (v.status === 'due' || v.status === 'overdue')
    );
  }, [store.vaxEvents, resident.mrn]);

  // 6. Line List Suggestions
  const lineListSuggestions = useMemo<LineListSuggestion[]>(() => {
    if (!onAddToLineList) return [];
    const suggestions: LineListSuggestion[] = [];

    const RESP_KEYWORDS = /\b(pneumo|influenza|flu|covid|rsv|respiratory|upper.?resp|lower.?resp|ili)\b/i;
    const GI_KEYWORDS = /\b(cdiff|c\.?\s*diff|clostridium|norovirus|gastro|diarr|gi\b|vomit)\b/i;

    const isAlreadyListed = (sc: SymptomClass) =>
      Object.values(store.lineListEvents || {}).some(
        ev => ev.residentId === resident.mrn && ev.symptomClass === sc
      );

    // Check active IP events
    for (const ip of activeInfections) {
      const text = [ip.infectionCategory, ip.infectionSite, ip.organism].filter(Boolean).join(' ');
      let symptomClass: SymptomClass | null = null;
      if (RESP_KEYWORDS.test(text)) symptomClass = 'resp';
      else if (GI_KEYWORDS.test(text)) symptomClass = 'gi';

      if (!symptomClass || isAlreadyListed(symptomClass)) continue;

      const onsetDate = ip.onsetDate ?? ip.createdAt;
      const label = `IP Event: ${ip.infectionCategory || 'Infection'} (${symptomClass === 'resp' ? 'Respiratory' : 'GI'})`;
      suggestions.push({ symptomClass, label, onsetDate, sourceEventId: ip.id });
    }

    // Check active ABT courses
    for (const abt of activeAbts) {
      const text = [abt.medication, abt.indication, abt.infectionSource, abt.syndromeCategory].filter(Boolean).join(' ');
      let symptomClass: SymptomClass | null = null;
      if (RESP_KEYWORDS.test(text)) symptomClass = 'resp';
      else if (GI_KEYWORDS.test(text)) symptomClass = 'gi';

      if (!symptomClass) continue;

      // Skip if there's already an IP event suggestion for the same class
      if (suggestions.some(s => s.symptomClass === symptomClass)) continue;

      if (isAlreadyListed(symptomClass)) continue;

      const onsetDate = abt.startDate ?? abt.createdAt;
      const label = `ABT: ${abt.medication} (${symptomClass === 'resp' ? 'Respiratory' : 'GI'})`;
      suggestions.push({ symptomClass, label, onsetDate, sourceEventId: abt.id });
    }

    return suggestions;
  }, [activeInfections, activeAbts, store.lineListEvents, resident.mrn, onAddToLineList]);

  return (
    <div className={`bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm ${className}`}>
      {/* Header */}
      {!compact && (
        <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200 flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Clinical Snapshot</span>
          <div className="flex gap-1">
            {alerts.length > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full animate-pulse">
                <AlertCircle className="w-3 h-3" />
                {alerts.length} ACTION
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Row 1: Isolation & Outbreak */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={`p-3 rounded-lg border flex flex-col gap-1 ${isolation ? 'bg-red-50 border-red-100' : 'bg-neutral-50 border-neutral-100'}`}>
            <div className="flex items-center gap-2 text-neutral-500">
              <Shield className={`w-4 h-4 ${isolation ? 'text-red-600' : 'text-neutral-400'}`} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Isolation</span>
            </div>
            <p className={`text-sm font-bold ${isolation ? 'text-red-900' : 'text-neutral-400'}`}>
              {isolation ? isolation.type : 'None Active'}
            </p>
          </div>

          <div className={`p-3 rounded-lg border flex flex-col gap-1 ${outbreakLink ? 'bg-amber-50 border-amber-100' : 'bg-neutral-50 border-neutral-100'}`}>
            <div className="flex items-center gap-2 text-neutral-500">
              <LinkIcon className={`w-4 h-4 ${outbreakLink ? 'text-amber-600' : 'text-neutral-400'}`} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Outbreak</span>
            </div>
            <p className={`text-sm font-bold truncate ${outbreakLink ? 'text-amber-900' : 'text-neutral-400'}`}>
              {outbreakLink ? outbreakLink.title : 'No Linkage'}
            </p>
          </div>
        </div>

        {/* Row 2: Antibiotics */}
        <div className={`p-3 rounded-lg border flex flex-col gap-2 ${activeAbts.length > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-neutral-50 border-neutral-100'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-neutral-500">
              <Activity className={`w-4 h-4 ${activeAbts.length > 0 ? 'text-emerald-600' : 'text-neutral-400'}`} />
              <span className="text-[10px] font-bold uppercase tracking-tight">Active Antibiotics</span>
            </div>
            {activeAbts.length > 0 && <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">{activeAbts.length} ACTIVE</span>}
          </div>
          
          {activeAbts.length > 0 ? (
            <div className="space-y-1.5">
              {activeAbts.map(abt => {
                const days = getAbtDays(abt.startDate, abt.endDate);
                return (
                  <div key={abt.id} className="flex items-center justify-between bg-white/50 p-1.5 rounded border border-emerald-200/50">
                    <span className="text-xs font-bold text-emerald-900 truncate max-w-[150px]">{abt.medication}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-emerald-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Day {days?.current || 1}
                      </span>
                      {days?.total && (
                        <span className="text-[10px] font-bold text-neutral-400">/ {days.total}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm font-bold text-neutral-400">No Active Courses</p>
          )}
        </div>

        {/* Row 3: Devices & Risk Flags */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-neutral-500">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Devices & Risk Flags</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeDevices.length > 0 ? (
              activeDevices.map((d, i) => (
                <span key={i} className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-indigo-100 flex items-center gap-1">
                  {d.name}
                  {d.day !== undefined && d.day !== null && <span className="opacity-60">D{d.day}</span>}
                  {d.mode && <span className="opacity-60">({d.mode})</span>}
                </span>
              ))
            ) : (
              <span className="text-xs text-neutral-400 italic">No devices active</span>
            )}
          </div>
        </div>

        {/* Row 4: Vaccine Gaps */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-neutral-500">
            <Syringe className="w-4 h-4 text-purple-500" />
            <span className="text-[10px] font-bold uppercase tracking-tight">Vaccine Gaps</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {vaxGaps.length > 0 ? (
              vaxGaps.map((v, i) => (
                <span key={i} className={`px-2 py-1 text-[10px] font-bold rounded-md border flex items-center gap-1 ${v.status === 'overdue' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                  {v.vaccine}
                  <span className="opacity-60 uppercase">{v.status}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-neutral-400 italic">Up to date</span>
            )}
          </div>
        </div>

        {/* Action Badges */}
        {alerts.length > 0 && (
          <div className="pt-2 border-t border-neutral-100">
            <div className="space-y-1.5">
              {alerts.map((alert, i) => (
                <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-[11px] font-medium ${alert.category === 'ABT_STEWARDSHIP' ? 'bg-orange-50 text-orange-800' : 'bg-red-50 text-red-800'}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{alert.message}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 opacity-50" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Line List Suggestions */}
        {lineListSuggestions.length > 0 && onAddToLineList && (
          <div className="pt-2 border-t border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-tight text-blue-600">Line List Suggestions</span>
            </div>
            <div className="space-y-1.5">
              {lineListSuggestions.map((s, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-2">
                    <PlusCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="text-[11px] font-medium text-blue-800 truncate">{s.label}</span>
                  </div>
                  <button
                    onClick={() => onAddToLineList({ symptomClass: s.symptomClass, onsetDate: s.onsetDate, sourceEventId: s.sourceEventId })}
                    className="ml-2 shrink-0 px-2 py-1 text-[10px] font-bold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                  >
                    Add Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

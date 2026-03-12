import React from 'react';
import { Download } from 'lucide-react';
import { useFacilityData } from '../app/providers';
import { IPEvent, ABTCourse, Resident } from '../domain/models';
import { exportToCsv } from '../utils/csvExport';
import { todayLocalDateInputValue } from '../lib/dateUtils';

const RESPIRATORY_PATTERN = /pneumonia|influenza|covid|rsv|respiratory|\buri\b|\burti\b|\blrti\b|bronchitis|pertussis|tuberculosis|\btb\b/;
const GI_PATTERN = /norovirus|c\.?\s*diff|cdiff|cdx|gastroenteritis|\bgi\b|gastrointestinal|diarrhea|vomiting|rotavirus|salmonella|e\.?\s*coli/;

const isRespiratoryOrGI = (text?: string): boolean => {
  if (!text) return false;
  const lower = text.toLowerCase();
  return RESPIRATORY_PATTERN.test(lower) || GI_PATTERN.test(lower);
};

export const LineListExportButton: React.FC<{ label?: string; compact?: boolean }> = ({ 
  label = "Generate Line List (CSV)", 
  compact 
}) => {
  const { store } = useFacilityData();

  const handleExport = () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeInfections = (Object.values(store.infections) as IPEvent[]).filter(ip =>
      ip.status === 'active' && isRespiratoryOrGI(ip.infectionCategory)
    );
    const relevantAbts = (Object.values(store.abts) as ABTCourse[]).filter(abt => {
      const hasRespOrGI = isRespiratoryOrGI(abt.syndromeCategory) || isRespiratoryOrGI(abt.indication);
      if (!hasRespOrGI) return false;
      if (abt.status === 'active') return true;
      if (abt.status === 'completed' && abt.endDate && new Date(abt.endDate) >= sevenDaysAgo) return true;
      return false;
    });

    const residentMap = new Map<string, {
      res: any;
      infections: IPEvent[];
      abts: ABTCourse[];
    }>();

    const getRes = (ref: any) => ref.kind === 'mrn' ? store.residents[ref.id] : store.quarantine[ref.id];

    activeInfections.forEach(ip => {
      const res = getRes(ip.residentRef);
      if (!res) return;
      const key = (res as any).mrn || (res as any).tempId;
      if (!residentMap.has(key)) {
        residentMap.set(key, { res, infections: [], abts: [] });
      }
      residentMap.get(key)!.infections.push(ip);
    });

    relevantAbts.forEach(abt => {
      const res = getRes(abt.residentRef);
      if (!res) return;
      const key = (res as any).mrn || (res as any).tempId;
      if (!residentMap.has(key)) {
        residentMap.set(key, { res, infections: [], abts: [] });
      }
      residentMap.get(key)!.abts.push(abt);
    });

    const headers = [
      'Resident Name', 'MRN', 'Unit', 'Room', 
      'Infection Category', 'Isolation Type', 'Organism', 'Onset Date',
      'ABT Medication', 'ABT Start Date', 'Culture Collected', 'Notes'
    ];

    const rows = Array.from(residentMap.values()).map(({ res, infections, abts }) => {
      const mrn = (res as any).mrn || (res as any).tempId || '—';
      const unit = (res as any).currentUnit || (res as any).unitSnapshot || '—';
      const room = (res as any).currentRoom || (res as any).roomSnapshot || '—';

      return [
        res.displayName || '—',
        mrn,
        unit,
        room,
        infections.map(i => i.infectionCategory).join('; '),
        infections.map(i => i.isolationType).join('; '),
        infections.map(i => i.organism).join('; '),
        infections.map(i => i.onsetDate || '').join('; '),
        abts.map(a => a.medication).join('; '),
        abts.map(a => a.startDate || '').join('; '),
        abts.map(a => a.cultureCollected ? 'Yes' : 'No').join('; '),
        [...infections.map(i => i.notes), ...abts.map(a => a.notes)].filter(Boolean).join(' | ')
      ];
    });

    exportToCsv(`Line_List_${todayLocalDateInputValue()}`, [headers, ...rows]);
  };

  return (
    <button
      onClick={handleExport}
      title={compact ? label : undefined}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded-md transition-colors shadow-sm border border-indigo-200 ${compact ? 'px-2' : ''}`}
    >
      <Download className="w-4 h-4" />
      {!compact && label}
    </button>
  );
};

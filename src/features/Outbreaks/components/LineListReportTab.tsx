import React, { useState, useMemo } from 'react';
import { Printer } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../../app/providers';
import { Outbreak, LineListEvent, ABTCourse, VaxEvent, Resident, SymptomTag } from '../../../domain/models';
import { ILILineListTable } from './ILILineListTable';
import { GILineListTable } from './GILineListTable';
import './linelist-print.css';

// ─── RowModel ────────────────────────────────────────────────────────────────

export interface RowModel {
  eventId?: string;
  onsetDateISO?: string;
  room: string;
  unit: string;
  age: string;
  name: string;
  sex: string;
  onsetDate: string;
  fluVax: string;
  pneuVax: string;
  fever: string;
  symptoms: SymptomTag[];
  isolationInitiated: string;
  providerNotified: string;
  testOrdered: string;
  abt: string;
  disposition: string;
  notes: string;
}

// ─── EditableCell ─────────────────────────────────────────────────────────────

interface EditableCellProps {
  value: string;
  autoFilled?: boolean;
  className?: string;
  colSpan?: number;
  style?: React.CSSProperties;
}

export function EditableCell({
  value,
  autoFilled,
  className,
  colSpan,
  style,
}: EditableCellProps) {
  const classes = [
    'editable-cell',
    autoFilled ? 'autofill' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <td
      colSpan={colSpan}
      contentEditable
      suppressContentEditableWarning
      className={classes}
      style={style}
    >
      {value}
    </td>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function computeAge(dob: string | undefined, onsetDateISO: string): string {
  if (!dob) return '';
  const birth = new Date(dob);
  const onset = new Date(onsetDateISO);
  if (isNaN(birth.getTime()) || isNaN(onset.getTime())) return '';
  let age = onset.getFullYear() - birth.getFullYear();
  const monthDiff = onset.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && onset.getDate() < birth.getDate())) {
    age--;
  }
  return String(age);
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/** Infer symptom class from outbreak syndromeCategory or title. */
function inferSymptomClass(outbreak: Outbreak): 'resp' | 'gi' | null {
  const src = ((outbreak.syndromeCategory ?? '') + ' ' + (outbreak.title ?? '')).toLowerCase();
  if (/\b(resp|flu|influenza|ili|covid|pneumo|upper\s*resp|lower\s*resp|cold|cough)\b/.test(src)) {
    return 'resp';
  }
  if (/\b(gi|gastro|noro|vomit|diarr|gastroenteritis)\b/.test(src)) {
    return 'gi';
  }
  return null;
}

// ─── LineListReportTab ────────────────────────────────────────────────────────

interface Props {
  outbreak: Outbreak;
}

export const LineListReportTab: React.FC<Props> = ({ outbreak }) => {
  const { store } = useFacilityData();
  const { db } = useDatabase();

  const facilityName =
    db.data.facilities.byId[outbreak.facilityId]?.name ?? outbreak.facilityId;

  const initialStart = (outbreak.startDate ?? '').split('T')[0] || today();
  const initialEnd = (outbreak.endDate ?? '').split('T')[0] || today();

  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);

  const inferred = inferSymptomClass(outbreak);
  const [symptomClass, setSymptomClass] = useState<'resp' | 'gi'>(inferred ?? 'resp');

  // ── Build rows ──────────────────────────────────────────────────────────────

  const rows = useMemo((): RowModel[] => {
    const events = Object.values(store.lineListEvents ?? {}) as LineListEvent[];

    const filtered = events.filter((ev) => {
      if (ev.facilityId !== outbreak.facilityId) return false;
      if (ev.symptomClass !== symptomClass) return false;
      const onset = ev.onsetDateISO?.split('T')[0] ?? '';
      if (startDate && onset < startDate) return false;
      if (endDate && onset > endDate) return false;
      return true;
    });

    // Sort by onset date asc, then name
    filtered.sort((a, b) => {
      const dateComp = (a.onsetDateISO ?? '').localeCompare(b.onsetDateISO ?? '');
      if (dateComp !== 0) return dateComp;
      const resA = store.residents[a.residentId];
      const resB = store.residents[b.residentId];
      return (resA?.displayName ?? '').localeCompare(resB?.displayName ?? '');
    });

    return filtered.map((ev) => {
      const resident: Resident | undefined = store.residents[ev.residentId];

      // Find active ABT course overlapping onset date
      const onsetDate = ev.onsetDateISO?.split('T')[0] ?? '';
      const abtCourse = (Object.values(store.abts) as ABTCourse[]).find((abt) => {
        if (abt.residentRef.kind !== 'mrn' || abt.residentRef.id !== ev.residentId) return false;
        const abtStart = (abt.startDate ?? '').split('T')[0];
        const abtEnd = abt.endDate ? abt.endDate.split('T')[0] : null;
        if (abtStart && onsetDate < abtStart) return false;
        if (abtEnd && onsetDate > abtEnd) return false;
        return true;
      });

      // Find flu vax
      const fluVax = (Object.values(store.vaxEvents) as VaxEvent[]).find((v) => {
        if (v.residentRef.kind !== 'mrn' || v.residentRef.id !== ev.residentId) return false;
        if (v.status !== 'given') return false;
        return v.vaccine.toLowerCase().includes('influenza');
      });

      // Find pneumo vax
      const pneuVax = (Object.values(store.vaxEvents) as VaxEvent[]).find((v) => {
        if (v.residentRef.kind !== 'mrn' || v.residentRef.id !== ev.residentId) return false;
        if (v.status !== 'given') return false;
        const name = v.vaccine.toLowerCase();
        return name.includes('pneumo') || name.includes('pneu');
      });

      const feverVal = ev.fever === true ? 'Y' : ev.fever === false ? 'N' : 'U';

      return {
        eventId: ev.id,
        onsetDateISO: ev.onsetDateISO,
        room: resident?.currentRoom ?? '',
        unit: resident?.currentUnit ?? '',
        age: computeAge(resident?.dob, ev.onsetDateISO),
        name: resident?.displayName ?? '',
        sex: resident?.sex ?? '',
        onsetDate: formatDate(ev.onsetDateISO),
        fluVax: fluVax ? 'Y' : 'N',
        pneuVax: pneuVax ? 'Y' : 'N',
        fever: feverVal,
        symptoms: ev.symptoms ?? [],
        isolationInitiated: ev.isolationInitiated ? 'Y' : 'N',
        providerNotified: ev.providerNotified ? 'Y' : 'N',
        testOrdered: ev.testOrdered ? 'Y' : 'N',
        abt: abtCourse?.medication ?? '',
        disposition: ev.disposition ?? '',
        notes: ev.notes ?? '',
      };
    });
  }, [store, outbreak.facilityId, symptomClass, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const title = symptomClass === 'resp'
    ? 'Respiratory / ILI Line List'
    : 'Gastroenteritis Line List';

  return (
    <div>
      {/* Controls — hidden on print */}
      <div className="no-print mb-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-lg font-semibold text-neutral-800">
            Line List Report —{' '}
            <span className={symptomClass === 'resp' ? 'text-blue-700' : 'text-emerald-700'}>
              {title}
            </span>
          </h2>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Landscape
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-6 bg-neutral-50 border border-neutral-200 rounded-lg p-4">
          {/* Symptom class selector — only shown when cannot be inferred */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-600">Report Type:</span>
            <select
              value={symptomClass}
              onChange={(e) => setSymptomClass(e.target.value as 'resp' | 'gi')}
              className="text-sm border border-neutral-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="resp">Respiratory / ILI</option>
              <option value="gi">Gastroenteritis (GI)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-600">Date Range:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm border border-neutral-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-neutral-400">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm border border-neutral-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <span className="text-xs text-neutral-500">
            {rows.length} event{rows.length !== 1 ? 's' : ''} found
          </span>
        </div>

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          ⚠️ All cells are editable on-screen for annotation purposes. Edits are for print only and are
          <strong> not saved</strong> to the database.
        </p>
      </div>

      {/* Print root — this div is targeted by @media print */}
      <div id="linelist-print-root">
        {symptomClass === 'resp' ? (
          <ILILineListTable
            rows={rows}
            facilityName={facilityName}
            startDate={formatDate(startDate)}
            endDate={formatDate(endDate)}
          />
        ) : (
          <GILineListTable
            rows={rows}
            facilityName={facilityName}
            startDate={formatDate(startDate)}
            endDate={formatDate(endDate)}
          />
        )}

        <div className="report-footer" style={{ marginTop: '6px', fontSize: '11px', color: '#888', textAlign: 'center' }}>
          Generated by IC &amp; ABT Console · {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};

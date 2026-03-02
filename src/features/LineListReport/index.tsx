import React from 'react';
import { Printer, Plus } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { ILILineListTable, ILIRowModel } from './ILILineListTable';
import { GILineListTable, GIRowModel } from './GILineListTable';
import { ManualAddLineListModal } from './ManualAddLineListModal';
import { EditLineListEntryModal } from './EditLineListEntryModal';
import { formatDate, computeAge } from './lineListUtils';
import './linelist-print.css';

import type { SymptomClass, LineListEvent, ABTCourse, VaxEvent } from '../../domain/models';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultDates(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LineListReportPage() {
  const { activeFacilityId, store } = useFacilityData();
  const { db } = useDatabase();

  const facility = db.data.facilities.byId[activeFacilityId];
  const facilityName = facility?.name ?? '';

  const units: string[] = facility?.units?.map((u) => u.name) ?? [];

  const defaults = getDefaultDates();
  const [tab, setTab] = React.useState<SymptomClass>('resp');
  const [startDate, setStartDate] = React.useState(defaults.start);
  const [endDate, setEndDate] = React.useState(defaults.end);
  const [selectedUnit, setSelectedUnit] = React.useState('all');
  const [reportRows, setReportRows] = React.useState<ILIRowModel[] | GIRowModel[] | null>(null);
  const [reportTab, setReportTab] = React.useState<SymptomClass>('resp');
  const [showManualAdd, setShowManualAdd] = React.useState(false);
  const [editingEventId, setEditingEventId] = React.useState<string | null>(null);

  const handleGenerate = () => {
    const startISO = startDate;
    const endISO = endDate;

    const allEvents = Object.values(store.lineListEvents ?? {}) as LineListEvent[];

    const filtered = allEvents
      .filter((ev) => {
        const onsetDay = ev.onsetDateISO.slice(0, 10);
        const unitMatch =
          selectedUnit === 'all' ||
          (store.residents[ev.residentId]?.currentUnit ?? '') === selectedUnit;
        return (
          ev.symptomClass === tab &&
          ev.facilityId === activeFacilityId &&
          onsetDay >= startISO &&
          onsetDay <= endISO &&
          unitMatch
        );
      })
      .sort((a, b) => a.onsetDateISO.localeCompare(b.onsetDateISO));

    const abts = Object.values(store.abts ?? {}) as ABTCourse[];
    const vaxEvents = Object.values(store.vaxEvents ?? {}) as VaxEvent[];

    if (tab === 'resp') {
      const rows: ILIRowModel[] = filtered.map((ev) => {
        const resident = store.residents[ev.residentId];
        const age = computeAge(resident?.dob, ev.onsetDateISO);

        const abtCourse = abts
          .filter(
            (a) =>
              a.residentRef.kind === 'mrn' &&
              a.residentRef.id === ev.residentId &&
              (a.startDate ?? '') <= ev.onsetDateISO.slice(0, 10) &&
              (a.endDate == null || a.endDate >= ev.onsetDateISO.slice(0, 10))
          )
          .sort((a, b) =>
            (b.startDate ?? '').localeCompare(a.startDate ?? '')
          )[0];

        const fluVaxEvent = vaxEvents.find(
          (v) =>
            v.residentRef.kind === 'mrn' &&
            v.residentRef.id === ev.residentId &&
            v.vaccine.toLowerCase().includes('influenza') &&
            v.status === 'given'
        );
        const pneuVaxEvent = vaxEvents.find(
          (v) =>
            v.residentRef.kind === 'mrn' &&
            v.residentRef.id === ev.residentId &&
            v.vaccine.toLowerCase().includes('pneumo') &&
            v.status === 'given'
        );

        return {
          eventId: ev.id,
          room: resident?.currentRoom ?? '',
          unit: resident?.currentUnit ?? '',
          age,
          name: resident?.displayName ?? '',
          sex: resident?.sex ?? '',
          onsetDate: formatDate(ev.onsetDateISO),
          fluVax: fluVaxEvent ? 'Y' : 'N',
          pneuVax: pneuVaxEvent ? 'Y' : 'N',
          fever: ev.fever === true ? 'Y' : ev.fever === false ? 'N' : 'U',
          symptoms: ev.symptoms ?? [],
          isolationInitiated: ev.isolationInitiated ? 'Y' : 'N',
          providerNotified: ev.providerNotified ? 'Y' : 'N',
          testOrdered: ev.testOrdered ? 'Y' : 'N',
          abt: abtCourse?.medication ?? '',
          disposition: ev.disposition ?? '',
          notes: ev.notes ?? '',
        };
      });
      setReportRows(rows);
      setReportTab('resp');
    } else {
      const rows: GIRowModel[] = filtered.map((ev) => {
        const resident = store.residents[ev.residentId];
        const age = computeAge(resident?.dob, ev.onsetDateISO);

        const abtCourse = abts
          .filter(
            (a) =>
              a.residentRef.kind === 'mrn' &&
              a.residentRef.id === ev.residentId &&
              (a.startDate ?? '') <= ev.onsetDateISO.slice(0, 10) &&
              (a.endDate == null || a.endDate >= ev.onsetDateISO.slice(0, 10))
          )
          .sort((a, b) =>
            (b.startDate ?? '').localeCompare(a.startDate ?? '')
          )[0];

        return {
          eventId: ev.id,
          room: resident?.currentRoom ?? '',
          unit: resident?.currentUnit ?? '',
          age,
          name: resident?.displayName ?? '',
          sex: resident?.sex ?? '',
          onsetDate: formatDate(ev.onsetDateISO),
          fever: ev.fever === true ? 'Y' : ev.fever === false ? 'N' : 'U',
          symptoms: ev.symptoms ?? [],
          isolationInitiated: ev.isolationInitiated ? 'Y' : 'N',
          providerNotified: ev.providerNotified ? 'Y' : 'N',
          testOrdered: ev.testOrdered ? 'Y' : 'N',
          abt: abtCourse?.medication ?? '',
          disposition: ev.disposition ?? '',
          notes: ev.notes ?? '',
        };
      });
      setReportRows(rows);
      setReportTab('gi');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6">
      {/* Filter bar — hidden on print */}
      <div className="no-print mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-neutral-900">Line List Report</h1>
        </div>

        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          ⚠️ All cells are editable on-screen for annotation purposes. Edits are <strong>saved</strong> to the facility record.
        </p>

        {/* Tab toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab('resp')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'resp'
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Resp (ILI)
          </button>
          <button
            onClick={() => setTab('gi')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === 'gi'
                ? 'bg-indigo-600 text-white'
                : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
            }`}
          >
            GI
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-600" htmlFor="ll-start-date">
              Start Date
            </label>
            <input
              id="ll-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-600" htmlFor="ll-end-date">
              End Date
            </label>
            <input
              id="ll-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-600" htmlFor="ll-unit">
              Unit
            </label>
            <select
              id="ll-unit"
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="border border-neutral-300 rounded px-2 py-1 text-sm"
            >
              <option value="all">All</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            Generate Report
          </button>
          <button
            onClick={() => setShowManualAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Entry
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-md text-sm font-medium hover:bg-neutral-200 transition-colors"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            Print
          </button>
        </div>
      </div>

      {/* Report output */}
      <div id="linelist-print-root">
        {reportRows !== null && reportTab === 'resp' && (
          <ILILineListTable
            rows={reportRows as ILIRowModel[]}
            facilityName={facilityName}
            startDate={formatDate(startDate)}
            endDate={formatDate(endDate)}
            facilityId={activeFacilityId}
            onEditRow={(id) => setEditingEventId(id)}
          />
        )}
        {reportRows !== null && reportTab === 'gi' && (
          <GILineListTable
            rows={reportRows as GIRowModel[]}
            facilityName={facilityName}
            startDate={formatDate(startDate)}
            endDate={formatDate(endDate)}
            facilityId={activeFacilityId}
            onEditRow={(id) => setEditingEventId(id)}
          />
        )}
        {reportRows === null && (
          <div className="text-center text-neutral-400 py-16 text-sm no-print">
            Select filters and click <strong>Generate Report</strong> to view the line list.
          </div>
        )}
      </div>

      {showManualAdd && (
        <ManualAddLineListModal
          symptomClass={tab}
          onClose={() => setShowManualAdd(false)}
          onSaved={(newId) => {
            setShowManualAdd(false);
            handleGenerate();
          }}
        />
      )}

      {editingEventId && (
        <EditLineListEntryModal
          eventId={editingEventId}
          onClose={() => setEditingEventId(null)}
          onSaved={() => {
            setEditingEventId(null);
            handleGenerate();
          }}
        />
      )}
    </div>
  );
}

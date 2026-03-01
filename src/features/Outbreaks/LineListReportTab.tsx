import React, { useState } from "react";
import { useFacilityData } from "../../app/providers";
import { OutbreakCase, Resident, QuarantineResident } from "../../domain/models";
import { Printer, RotateCcw, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { EditableCell } from "../../components/EditableCell";
import { useLineListOverrides, TemplateType } from "../../hooks/useLineListOverrides";

interface Props {
  outbreakId: string;
}

// ─── ILI row shape (auto-filled fields only) ─────────────────────────────────
interface IliRow {
  room: string;
  age: string;
  name: string;
  sex_m: string;
  sex_f: string;
  onset_date: string;
}

// ─── GI row shape (auto-filled fields only) ──────────────────────────────────
interface GiRow {
  case_initials: string;
  unit: string;
  room: string;
  onset_date: string;
}

function getInitials(displayName: string): string {
  return displayName
    .split(/\s+/)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 3);
}

function getAge(dob: string | undefined): string {
  if (!dob) return "";
  const birth = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  return String(age);
}

export const LineListReportTab: React.FC<Props> = ({ outbreakId }) => {
  const { store, activeFacilityId } = useFacilityData();
  const [template, setTemplate] = useState<TemplateType>("ili");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { overrides, saveOverride, retryFailedSaves, resetOverrides, isLoading, loadError, saveStatus } =
    useLineListOverrides({ outbreakId, facilityId: activeFacilityId, template });

  // ── Build case rows from store ──────────────────────────────────────────────
  const cases = (Object.values(store.outbreakCases) as OutbreakCase[])
    .filter((c) => c.outbreakId === outbreakId)
    .filter((c) => {
      if (!startDate && !endDate) return true;
      const onset = c.symptomOnsetDate ?? "";
      if (startDate && onset < startDate) return false;
      if (endDate && onset > endDate) return false;
      return true;
    })
    .sort((a, b) => (a.symptomOnsetDate ?? "").localeCompare(b.symptomOnsetDate ?? ""));

  const getResidentRecord = (c: OutbreakCase): Resident | QuarantineResident | undefined => {
    if (c.residentRef.kind === "mrn") return store.residents[c.residentRef.id];
    if (c.residentRef.kind === "quarantine") return store.quarantine[c.residentRef.id];
    return undefined;
  };

  const buildIliRow = (c: OutbreakCase, _i: number): IliRow => {
    const res = getResidentRecord(c);
    const dob = (res as Resident)?.dob;
    const sex = (res as Resident)?.sex ?? "";
    return {
      room: c.locationSnapshot?.room ?? (res as Resident)?.currentRoom ?? "",
      age: getAge(dob),
      name: res?.displayName ?? "",
      sex_m: sex.toLowerCase().startsWith("m") ? "X" : "",
      sex_f: sex.toLowerCase().startsWith("f") ? "X" : "",
      onset_date: c.symptomOnsetDate ?? "",
    };
  };

  const buildGiRow = (c: OutbreakCase, _i: number): GiRow => {
    const res = getResidentRecord(c);
    return {
      case_initials: res?.displayName ? getInitials(res.displayName) : "",
      unit: c.locationSnapshot?.unit ?? (res as Resident)?.currentUnit ?? "",
      room: c.locationSnapshot?.room ?? (res as Resident)?.currentRoom ?? "",
      onset_date: c.symptomOnsetDate ?? "",
    };
  };

  // ── Render helpers ──────────────────────────────────────────────────────────
  const cell = (
    rowIndex: number,
    colKey: string,
    autoValue: string
  ) => (
    <EditableCell
      key={colKey}
      autoValue={autoValue}
      override={overrides[`${rowIndex}::${colKey}`]}
      autoFilled={!!autoValue}
      rowIndex={rowIndex}
      colKey={colKey}
      onSave={saveOverride}
    />
  );

  // Skeleton rows while loading
  const skeletonCount = Math.max(cases.length, 3);

  const handleReset = () => {
    const confirmed = window.confirm(
      "This will clear all manual edits for this report.\nAuto-filled data will be restored. Continue?"
    );
    if (!confirmed) return;
    resetOverrides();
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Save status indicator ───────────────────────────────────────────────────
  const SaveIndicator: React.FC = () => {
    if (saveStatus === "saving")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-neutral-400 ml-3">
          <Loader2 className="w-3 h-3 animate-spin" />
          Saving…
        </span>
      );
    if (saveStatus === "saved")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 ml-3">
          <CheckCircle className="w-3 h-3" />
          Saved ✓
        </span>
      );
    if (saveStatus === "error")
      return (
        <span className="inline-flex items-center gap-1 text-xs text-red-500 ml-3">
          <AlertCircle className="w-3 h-3" />
          Save failed —
          <button
            onClick={retryFailedSaves}
            className="underline"
          >
            Retry
          </button>
        </span>
      );
    return null;
  };

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-bold text-neutral-900">Line List Report</h2>
          {/* Template selector */}
          <div className="flex rounded-md overflow-hidden border border-neutral-300 text-sm">
            <button
              onClick={() => setTemplate("ili")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                template === "ili"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              ILI
            </button>
            <button
              onClick={() => setTemplate("gi")}
              className={`px-3 py-1.5 font-medium transition-colors border-l border-neutral-300 ${
                template === "gi"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              GI
            </button>
          </div>
        </div>

        {/* Date range */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-neutral-600">
            Start:
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-neutral-300 rounded px-2 py-1 text-neutral-800 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-neutral-600">
            End:
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-neutral-300 rounded px-2 py-1 text-neutral-800 text-sm"
            />
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-neutral-800 text-white rounded-md hover:bg-neutral-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Landscape
          </button>
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Auto-fill
          </button>
          <SaveIndicator />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500 border-t border-neutral-100 pt-2">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#f0f4ff] border border-[#1a3a6e] inline-block" />
            Blue = auto-filled
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#fff8e1] border border-[#7c3d00] inline-block" />
            Amber = manually edited
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
            <CheckCircle className="w-3 h-3" />
            Changes are saved automatically
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {loadError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 no-print">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {loadError}
        </div>
      )}
      <div className="printable-area overflow-x-auto">
        {isLoading ? (
          <SkeletonTable template={template} rowCount={skeletonCount} />
        ) : template === "ili" ? (
          <IliTable
            cases={cases}
            buildRow={buildIliRow}
            cell={cell}
          />
        ) : (
          <GiTable
            cases={cases}
            buildRow={buildGiRow}
            cell={cell}
          />
        )}
      </div>
    </div>
  );
};

// ─── Skeleton loader ──────────────────────────────────────────────────────────
const SkeletonTable: React.FC<{ template: TemplateType; rowCount: number }> = ({
  template,
  rowCount,
}) => {
  const colCount = template === "ili" ? 14 : 10;
  return (
    <table className="w-full border-collapse text-xs border border-neutral-200">
      <tbody>
        {Array.from({ length: rowCount }).map((_, ri) => (
          <tr key={ri} className="animate-pulse">
            {Array.from({ length: colCount }).map((__, ci) => (
              <td key={ci} className="border border-neutral-200 p-2">
                <div className="h-3 bg-neutral-200 rounded w-full" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── ILI table ────────────────────────────────────────────────────────────────
interface IliTableProps {
  cases: OutbreakCase[];
  buildRow: (c: OutbreakCase, i: number) => IliRow;
  cell: (rowIndex: number, colKey: string, autoValue: string) => React.ReactElement;
}

const IliTable: React.FC<IliTableProps> = ({ cases, buildRow, cell }) => {
  const TH: React.FC<{ children?: React.ReactNode; colSpan?: number }> = ({
    children,
    colSpan,
  }) => (
    <th
      colSpan={colSpan}
      className="border border-neutral-300 bg-neutral-100 px-1 py-1 text-center text-[9pt] font-semibold whitespace-nowrap"
    >
      {children}
    </th>
  );

  const rows: Array<OutbreakCase | null> =
    cases.length > 0 ? cases : Array.from({ length: 5 }, () => null);

  return (
    <table className="w-full border-collapse text-[8pt] border border-neutral-300 print:text-[6.5pt]">
      <thead>
        <tr>
          <TH>Room</TH>
          <TH>Age</TH>
          <TH>Name</TH>
          <TH colSpan={2}>Sex</TH>
          <TH colSpan={2}>Flu</TH>
          <TH colSpan={2}>Pneu</TH>
          <TH>CVD</TH>
          <TH>COPD</TH>
          <TH>DM</TH>
          <TH>Anemia</TH>
          <TH>Renal</TH>
          <TH>CA</TH>
          <TH>Steroids</TH>
          <TH>Onset Date</TH>
          <TH>Temp</TH>
          <TH>Cough</TH>
          <TH>Cong.</TH>
          <TH>Pharyn.</TH>
          <TH>Rhinitis</TH>
          <TH>HA</TH>
          <TH>Fever Dur.</TH>
          <TH>Hosp Date</TH>
          <TH>Date Died</TH>
          <TH>Lab Results</TH>
          <TH>Antibiotic</TH>
          <TH>X-ray</TH>
          <TH>Pneumonia</TH>
        </tr>
        <tr>
          <TH />
          <TH />
          <TH />
          <TH>M</TH>
          <TH>F</TH>
          <TH>Y</TH>
          <TH>N</TH>
          <TH>Y</TH>
          <TH>N</TH>
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
          <TH />
        </tr>
      </thead>
      <tbody>
        {rows.map((c, i) => {
          const row: IliRow = c ? buildRow(c, i) : { room: "", age: "", name: "", sex_m: "", sex_f: "", onset_date: "" };
          return (
            <tr key={i}>
              {cell(i, "room", row.room ?? "")}
              {cell(i, "age", row.age ?? "")}
              {cell(i, "name", row.name ?? "")}
              {cell(i, "sex_m", row.sex_m ?? "")}
              {cell(i, "sex_f", row.sex_f ?? "")}
              {cell(i, "flu_y", "")}
              {cell(i, "flu_n", "")}
              {cell(i, "pneu_y", "")}
              {cell(i, "pneu_n", "")}
              {cell(i, "cvd", "")}
              {cell(i, "copd", "")}
              {cell(i, "dm", "")}
              {cell(i, "anemia", "")}
              {cell(i, "renal", "")}
              {cell(i, "ca", "")}
              {cell(i, "steroids", "")}
              {cell(i, "onset_date", row.onset_date ?? "")}
              {cell(i, "highest_temp", "")}
              {cell(i, "cough", "")}
              {cell(i, "congestion", "")}
              {cell(i, "pharyngitis", "")}
              {cell(i, "rhinitis", "")}
              {cell(i, "headache", "")}
              {cell(i, "fever_duration", "")}
              {cell(i, "hosp_date", "")}
              {cell(i, "date_died", "")}
              {cell(i, "lab_results", "")}
              {cell(i, "antibiotic", "")}
              {cell(i, "xray", "")}
              {cell(i, "pneumonia", "")}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

// ─── GI table ─────────────────────────────────────────────────────────────────
interface GiTableProps {
  cases: OutbreakCase[];
  buildRow: (c: OutbreakCase, i: number) => GiRow;
  cell: (rowIndex: number, colKey: string, autoValue: string) => React.ReactElement;
}

const GiTable: React.FC<GiTableProps> = ({ cases, buildRow, cell }) => {
  const TH: React.FC<{ children?: React.ReactNode; colSpan?: number }> = ({
    children,
    colSpan,
  }) => (
    <th
      colSpan={colSpan}
      className="border border-neutral-300 bg-neutral-100 px-1 py-1 text-center text-[9pt] font-semibold whitespace-nowrap"
    >
      {children}
    </th>
  );

  const rows: Array<OutbreakCase | null> =
    cases.length > 0 ? cases : Array.from({ length: 5 }, () => null);

  return (
    <table className="w-full border-collapse text-[8pt] border border-neutral-300 print:text-[6.5pt]">
      <thead>
        <tr>
          <TH>Initials</TH>
          <TH>Unit</TH>
          <TH>Room</TH>
          <TH>Onset Date</TH>
          <TH>Fever</TH>
          <TH>Tmax</TH>
          <TH>Nausea</TH>
          <TH>Vomiting</TH>
          <TH>Diarrhea</TH>
          <TH>Abd Cramps</TH>
          <TH>Duration</TH>
          <TH>MD Seen</TH>
          <TH>Hospitalized</TH>
          <TH>Hospital</TH>
          <TH>Died</TH>
          <TH>Date Death</TH>
          <TH>ABT</TH>
          <TH>Antidiarrheal</TH>
          <TH>Lab</TH>
          <TH>Specimen</TH>
          <TH>Collect Date</TH>
          <TH>Test Type</TH>
          <TH>Result</TH>
        </tr>
      </thead>
      <tbody>
        {rows.map((c, i) => {
          const row: GiRow = c ? buildRow(c, i) : { case_initials: "", unit: "", room: "", onset_date: "" };
          return (
            <tr key={i}>
              {cell(i, "case_initials", row.case_initials ?? "")}
              {cell(i, "unit", row.unit ?? "")}
              {cell(i, "room", row.room ?? "")}
              {cell(i, "onset_date", row.onset_date ?? "")}
              {cell(i, "fever", "")}
              {cell(i, "tmax", "")}
              {cell(i, "nausea", "")}
              {cell(i, "vomiting", "")}
              {cell(i, "diarrhea", "")}
              {cell(i, "abd_cramps", "")}
              {cell(i, "duration", "")}
              {cell(i, "physician_seen", "")}
              {cell(i, "hospitalized", "")}
              {cell(i, "hospital_name", "")}
              {cell(i, "died", "")}
              {cell(i, "date_death", "")}
              {cell(i, "abt_yn", "")}
              {cell(i, "antidiarrheal", "")}
              {cell(i, "lab_yn", "")}
              {cell(i, "specimen_type", "")}
              {cell(i, "collect_date", "")}
              {cell(i, "test_type", "")}
              {cell(i, "result", "")}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

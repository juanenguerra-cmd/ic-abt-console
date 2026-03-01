import React, { useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useDatabase, useFacilityData } from "../../app/providers";
import { ABTCourse, QuarantineResident, Resident, ResidentRef, VaxEvent } from "../../domain/models";
import { getMigrationTemplate, MigrationDatasetType } from "../../lib/migration/csvTemplates";
import {
  buildAutoMapping,
  CsvColumnMapping,
  getDatasetFields,
  importMappedRows,
  parseCsv,
} from "../../lib/migration/csvImport";
import { AbtCsvStagingRow, evaluateAbtStagingRow, parseAbtCsvToStaging } from "../../parsers/abtCsvParser";
import { parseRawAbtOrderListing, RawAbtStagingRow, ResolutionLevel } from "../../parsers/rawAbtOrderListingParser";
import { parseRawVaxList, RawVaxStagingRow } from "../../parsers/rawVaxListParser";

const DATASET_LABELS: Record<MigrationDatasetType, string> = {
  ABT: "ABT",
  IP: "IP",
  VAX: "VAX",
};

// ─── ABT Raw Staging — Dropdown Options & Cascade ─────────────────────────────

const SOURCE_OPTIONS = [
  "", "Urinary", "Respiratory", "Skin", "GI", "Bloodstream",
  "Bone", "Eye", "Ear", "Oral", "CNS", "Cardiovascular",
  "Chronic", "Prophylaxis", "Other",
];

const CATEGORY_OPTIONS = [
  "", "UTI", "LRTI", "URTI", "SSTI", "CDI", "Gastroenteritis",
  "BSI", "Osteomyelitis", "Eye Infection", "Otitis", "Dental",
  "Suppression", "Prophylaxis", "H. Pylori", "Meningitis",
  "Endocarditis", "Other",
];

const SYNDROME_OPTIONS = [
  "", "Genitourinary", "Respiratory", "Skin/Soft Tissue",
  "Gastrointestinal", "Bloodstream", "Musculoskeletal",
  "Eye/Ear", "Oral", "CNS", "Cardiovascular",
  "Chronic Suppression", "Prophylaxis", "Other",
];

const INDICATION_CASCADE: Record<string, { category: string; syndrome: string }> = {
  Urinary:        { category: "UTI",           syndrome: "Genitourinary"       },
  Respiratory:    { category: "LRTI",          syndrome: "Respiratory"         },
  Skin:           { category: "SSTI",          syndrome: "Skin/Soft Tissue"    },
  GI:             { category: "CDI",           syndrome: "Gastrointestinal"    },
  Bloodstream:    { category: "BSI",           syndrome: "Bloodstream"         },
  Bone:           { category: "Osteomyelitis", syndrome: "Musculoskeletal"     },
  Eye:            { category: "Eye Infection", syndrome: "Eye/Ear"             },
  Ear:            { category: "Otitis",        syndrome: "Eye/Ear"             },
  Oral:           { category: "Dental",        syndrome: "Oral"                },
  CNS:            { category: "Meningitis",    syndrome: "CNS"                 },
  Cardiovascular: { category: "Endocarditis",  syndrome: "Cardiovascular"      },
  Chronic:        { category: "Suppression",   syndrome: "Chronic Suppression" },
  Prophylaxis:    { category: "Prophylaxis",   syndrome: "Prophylaxis"         },
};

// ─── VAX Raw Staging — Dropdown Options ───────────────────────────────────────

const VAX_TYPE_OPTIONS = [
  "Influenza", "COVID-19", "Pneumococcal", "Shingles", "Other",
];

const VAX_STATUS_OPTIONS: Array<"Vaccinated" | "Historical" | "Refused"> = [
  "Vaccinated", "Historical", "Refused",
];

// ─── 3-Tier Resident Resolution ────────────────────────────────────────────────
//
// Tier 1 — Active census:    store.residents where isHistorical !== true
//           and status is not Discharged / Deceased
// Tier 2 — Historical list:  store.residents where isHistorical === true
// Tier 3 — Unresolved:       QuarantineResident created at commit time;
//           record committed with residentRef: { kind: "quarantine" }
//
// The wizard re-runs resolution live on every MRN keystroke in the staging table.

const resolveResident = (
  mrn: string,
  residents: Record<string, Resident>
): { resolution: ResolutionLevel; displayName: string } => {
  if (!mrn.trim()) return { resolution: 'unresolved', displayName: '' };

  const active = Object.values(residents).find(
    (r) => r.mrn === mrn && !r.isHistorical && r.status !== 'Discharged' && r.status !== 'Deceased'
  );
  if (active) return { resolution: 'active', displayName: active.displayName };

  const historical = Object.values(residents).find(
    (r) => r.mrn === mrn && r.isHistorical === true
  );
  if (historical) return { resolution: 'historical', displayName: historical.displayName };

  return { resolution: 'unresolved', displayName: '' };
};

const resolutionBadge = (resolution: ResolutionLevel, displayName: string) => {
  if (resolution === 'active')
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 whitespace-nowrap">✅ {displayName || 'Active'}</span>;
  if (resolution === 'historical')
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 whitespace-nowrap">🟡 {displayName || 'Historical'}</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 whitespace-nowrap">🔴 Unresolved</span>;
};

export const CsvMigrationWizard: React.FC = () => {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [datasetType, setDatasetType] = useState<MigrationDatasetType>("IP");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<CsvColumnMapping[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [importErrors, setImportErrors] = useState<{ rowNumber: number; message: string }[]>([]);
  const [importMode, setImportMode] = useState<"CSV" | "RAW">("CSV");
  const [rawAbtText, setRawAbtText] = useState("");
  const [rawVaxText, setRawVaxText] = useState("");
  const [rawAbtRows, setRawAbtRows] = useState<RawAbtStagingRow[]>([]);
  const [rawVaxRows, setRawVaxRows] = useState<RawVaxStagingRow[]>([]);
  const [vaxTypeSelection, setVaxTypeSelection] = useState("Influenza");
  const [vaxStatusSelection, setVaxStatusSelection] = useState<"Vaccinated" | "Historical" | "Refused">("Vaccinated");
  const [abtCsvRows, setAbtCsvRows] = useState<AbtCsvStagingRow[]>([]);

  const fields = useMemo(() => getDatasetFields(datasetType), [datasetType]);
  const residents = useMemo(() => Object.values(store.residents || {}) as Resident[], [store.residents]);
  const unmappedColumns = useMemo(
    () => mapping.filter((item) => !item.mappedField).map((item) => item.column),
    [mapping]
  );

  const hasRawErrors = useMemo(() => {
    if (datasetType === "ABT") return rawAbtRows.some((row) => row.status === "ERROR" && !row.skip);
    if (datasetType === "VAX") return rawVaxRows.some((row) => row.status === "ERROR" && !row.skip);
    return false;
  }, [datasetType, rawAbtRows, rawVaxRows]);
  const existingAbts = useMemo(() => Object.values(store.abts || {}) as ABTCourse[], [store.abts]);
  const hasAbtCsvErrors = useMemo(
    () => abtCsvRows.some((row) => row.status === "ERROR" && !row.skip),
    [abtCsvRows]
  );

  const applyAbtDuplicateMarking = (rowsToCheck: RawAbtStagingRow[]): RawAbtStagingRow[] => {
    const existingAbts = Object.values(store.abts || {}) as ABTCourse[];
    return rowsToCheck.map((row) => {
      const duplicate = existingAbts.find((abt) => {
        const med   = (abt.medication || "").trim().toLowerCase();
        const route = (abt.route || "").trim().toLowerCase();
        const start = (abt.startDate || "").slice(0, 10);
        return (
          abt.residentRef.id === row.mrn &&
          med === (row.medicationName || row.orderSummaryRaw).trim().toLowerCase() &&
          start === row.startDate &&
          route === (row.routeNormalized || "Other").toLowerCase()
        );
      });
      if (!duplicate) return row;
      return {
        ...row,
        status: "NEEDS_REVIEW",
        skip: true,
        warnings: [...row.warnings, `Possible duplicate: ${duplicate.medication} (${(duplicate.startDate || "").slice(0, 10)})`],
      };
    });
  };

  const applyVaxDuplicateMarking = (rowsToCheck: RawVaxStagingRow[]): RawVaxStagingRow[] => {
    const existingVax = Object.values(store.vaxEvents || {}) as VaxEvent[];
    return rowsToCheck.map((row) => {
      const duplicate = existingVax.find(
        (event) =>
          event.residentRef.id === row.mrn &&
          (event.vaccine || "").toLowerCase() === row.vaccineType.toLowerCase() &&
          (event.dateGiven || "").slice(0, 10) === row.eventDate &&
          event.status === row.eventStatus
      );
      if (!duplicate) return row;
      return {
        ...row,
        status: "NEEDS_REVIEW",
        skip: true,
        warnings: [...row.warnings, `Possible duplicate: ${duplicate.vaccine} (${(duplicate.dateGiven || "").slice(0, 10)})`],
      };
    });
  };

  const downloadTemplate = (type: MigrationDatasetType) => {
    const { filename, csv } = getMigrationTemplate(type);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCurrentCsv = (rawCsv: string) => {
    if (datasetType === "ABT") {
      try {
        const parsedRows = parseAbtCsvToStaging(rawCsv, existingAbts);
        if (!parsedRows.length) { alert("CSV is missing headers or data rows."); return; }
        setAbtCsvRows(parsedRows);
        setImportErrors([]);
      } catch (error) {
        console.error("Failed to parse ABT CSV:", error);
        alert("Failed to parse ABT CSV.");
      }
      return;
    }
    const parsed = parseCsv(rawCsv);
    if (!parsed.headers.length || !parsed.rows.length) { alert("CSV is missing headers or data rows."); return; }
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(buildAutoMapping(parsed.headers, datasetType));
    setImportErrors([]);
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      setCsvText(text);
      parseCurrentCsv(text);
    };
    reader.readAsText(file);
    setFileName(file.name);
  };

  const handleImport = () => {
    if (datasetType === "ABT") {
      if (!abtCsvRows.length) { alert("Upload ABT CSV and parse it first."); return; }
      if (hasAbtCsvErrors) { alert("Cannot commit while unskipped error rows exist."); return; }
      let imported = 0;
      let skipped = 0;
      let quarantineCreated = 0;
      updateDB((draft) => {
        const facility = draft.data.facilityData[activeFacilityId];
        facility.abts = facility.abts || {};
        facility.quarantine = facility.quarantine || {};
        abtCsvRows.forEach((row) => {
          if (row.skip || row.status === "ERROR") { skipped += 1; return; }
          const res = resolveResident(row.data.mrn, store.residents);
          let residentRef: ResidentRef;
          if (res.resolution === 'unresolved') {
            const tempId = `Q:${uuidv4()}`;
            const qr: QuarantineResident = {
              tempId,
              displayName: row.data.residentName || row.data.mrn,
              source: 'census_missing_mrn',
              rawHint: row.data.mrn,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            facility.quarantine[tempId] = qr;
            residentRef = { kind: 'quarantine', id: tempId };
            quarantineCreated += 1;
          } else {
            residentRef = { kind: 'mrn', id: row.data.mrn };
          }
          const id = uuidv4();
          facility.abts[id] = {
            id,
            residentRef,
            status: row.data.status as ABTCourse["status"],
            medication: row.data.medicationName,
            medicationClass: row.data.medicationClass || undefined,
            dose: row.data.dose || undefined,
            route: row.data.route || undefined,
            frequency: row.data.frequency || undefined,
            indication: row.data.indication || undefined,
            startDate: row.data.startDate || undefined,
            endDate: row.data.endDate || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          imported += 1;
        });
      });
      alert(`ABT import complete.\nImported: ${imported}\nSkipped: ${skipped}${quarantineCreated ? `\nQuarantine created: ${quarantineCreated}` : ''}`);
      setAbtCsvRows([]);
      return;
    }
    if (!rows.length || !mapping.length) { alert("Upload or paste CSV and parse it first."); return; }
    let summary = { importedCount: 0, updatedCount: 0, errors: [] as { rowNumber: number; message: string }[] };
    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      summary = importMappedRows(datasetType, rows, mapping, {
        residents: facility.residents,
        quarantine: facility.quarantine,
        abts: facility.abts,
        infections: facility.infections,
        vaxEvents: facility.vaxEvents,
        nowISO: new Date().toISOString(),
        createId: () => uuidv4(),
      });
    });
    const errorText = summary.errors.slice(0, 10).map((e) => `Row ${e.rowNumber}: ${e.message}`).join("\n");
    alert(
      `${datasetType} import complete.\nCreated: ${summary.importedCount}\nUpdated: ${summary.updatedCount}\nSkipped: ${summary.errors.length}${
        errorText ? `\n\nErrors:\n${errorText}` : ""
      }`
    );
    setImportErrors(summary.errors);
  };

  // ─── RAW Parse — runs resolution pass immediately after duplicate marking ────
  const parseRawImport = () => {
    if (datasetType === "ABT") {
      const withDupes = applyAbtDuplicateMarking(parseRawAbtOrderListing(rawAbtText));
      setRawAbtRows(
        withDupes.map((row) => {
          const res = resolveResident(row.mrn, store.residents);
          return { ...row, residentResolution: res.resolution, residentDisplayName: res.displayName };
        })
      );
      return;
    }
    if (datasetType === "VAX") {
      const withDupes = applyVaxDuplicateMarking(parseRawVaxList(rawVaxText, vaxTypeSelection, vaxStatusSelection));
      setRawVaxRows(
        withDupes.map((row) => {
          const res = resolveResident(row.mrn, store.residents);
          return { ...row, residentResolution: res.resolution, residentDisplayName: res.displayName };
        })
      );
    }
  };

  // ─── RAW Commit ────────────────────────────────────────────────────────────
  const commitRawImport = () => {
    if (hasRawErrors) { alert("Cannot commit while unskipped error rows exist."); return; }
    let imported = 0;
    let skipped = 0;
    let duplicatesSkipped = 0;
    let errorsSkipped = 0;
    let quarantineCreated = 0;
    const now = new Date().toISOString();

    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      facility.abts       = facility.abts       || {};
      facility.vaxEvents  = facility.vaxEvents  || {};
      facility.quarantine = facility.quarantine || {};

      const buildRef = (row: RawAbtStagingRow | RawVaxStagingRow): ResidentRef => {
        if (row.residentResolution !== 'unresolved') {
          return { kind: 'mrn', id: row.mrn };
        }
        const tempId = `Q:${uuidv4()}`;
        const qr: QuarantineResident = {
          tempId,
          displayName: row.residentNameRaw || row.mrn,
          source: 'census_missing_mrn',
          rawHint: row.mrn || row.residentNameRaw,
          createdAt: now,
          updatedAt: now,
        };
        facility.quarantine[tempId] = qr;
        quarantineCreated += 1;
        return { kind: 'quarantine', id: tempId };
      };

      if (datasetType === "ABT") {
        rawAbtRows.forEach((row) => {
          if (row.skip || row.status === "ERROR") {
            skipped += 1;
            if (row.status === "ERROR") errorsSkipped += 1;
            if (row.warnings.some((w) => w.toLowerCase().includes("duplicate"))) duplicatesSkipped += 1;
            return;
          }
          const id = uuidv4();
          facility.abts[id] = {
            id,
            residentRef:      buildRef(row),
            status:           row.orderStatusRaw.toLowerCase().includes("complete") ? "completed" : "active",
            medication:       row.medicationName || row.orderSummaryRaw,
            dose:             row.dose             || undefined,
            route:            row.routeNormalized  || row.routeRaw  || undefined,
            frequency:        row.frequencyNormalized || row.frequencyRaw || undefined,
            indication:       row.indicationRaw    || undefined,
            infectionSource:  row.sourceOfInfection || undefined,
            syndromeCategory: row.syndrome          || undefined,
            startDate:        row.startDate         || undefined,
            endDate:          row.endDate           || undefined,
            notes:            row.endDateWasComputed ? "End date computed from extracted duration." : undefined,
            createdAt:        now,
            updatedAt:        now,
          };
          imported += 1;
        });
      }

      if (datasetType === "VAX") {
        rawVaxRows.forEach((row) => {
          if (row.skip || row.status === "ERROR") {
            skipped += 1;
            if (row.status === "ERROR") errorsSkipped += 1;
            if (row.warnings.some((w) => w.toLowerCase().includes("duplicate"))) duplicatesSkipped += 1;
            return;
          }
          const id = uuidv4();
          facility.vaxEvents[id] = {
            id,
            residentRef:      buildRef(row),
            vaccine:          row.vaccineType,
            status:           row.eventStatus as VaxEvent["status"],
            administeredDate: row.eventDate,
            dateGiven:        row.eventDate,
            source:           "csv-import",
            createdAt:        now,
            updatedAt:        now,
          };
          imported += 1;
        });
      }
    });

    alert(
      `RAW import complete.\nImported: ${imported}\nSkipped: ${skipped}` +
      `\nDuplicates skipped: ${duplicatesSkipped}\nErrors skipped: ${errorsSkipped}` +
      (quarantineCreated ? `\n\n⚠️ ${quarantineCreated} resident(s) not found in census or historical list — added to Quarantine for manual linking.` : '')
    );
  };

  const statusBadge = (status: string) => {
    if (status === "ERROR")        return <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">❌ Error</span>;
    if (status === "NEEDS_REVIEW") return <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700">⚠ Needs review</span>;
    if (status === "DUPLICATE")    return <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">🟣 Duplicate</span>;
    return <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">✅ Parsed</span>;
  };

  const updateAbtCsvRow = (rowId: string, field: keyof AbtCsvStagingRow["data"], value: string) => {
    setAbtCsvRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId
          ? evaluateAbtStagingRow(rowId, { ...row.data, [field]: value }, existingAbts)
          : row
      )
    );
  };

  const updateVaxRow = <K extends keyof RawVaxStagingRow>(
    id: string,
    field: K,
    value: RawVaxStagingRow[K]
  ) =>
    setRawVaxRows((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => downloadTemplate("IP")} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 hover:bg-neutral-50">
          <Download className="w-4 h-4" /> Download IP Template
        </button>
        <button onClick={() => downloadTemplate("ABT")} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 hover:bg-neutral-50">
          <Download className="w-4 h-4" /> Download ABT Template
        </button>
        <button onClick={() => downloadTemplate("VAX")} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 hover:bg-neutral-50">
          <Download className="w-4 h-4" /> Download VAX Template
        </button>
      </div>

      {(datasetType === "ABT" || datasetType === "VAX") && (
        <div className="flex gap-2">
          <button onClick={() => setImportMode("CSV")} className={`px-3 py-1.5 rounded-md text-sm ${importMode === "CSV" ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-700"}`}>CSV Mapper</button>
          <button onClick={() => setImportMode("RAW")} className={`px-3 py-1.5 rounded-md text-sm ${importMode === "RAW" ? "bg-indigo-600 text-white" : "bg-neutral-100 text-neutral-700"}`}>RAW Import</button>
        </div>
      )}

      {importMode === "CSV" && (
        <div className="border border-neutral-200 rounded-md p-4 space-y-3">
          {datasetType === "ABT" && (
            <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              Upload CSV → Parse → Review/Edit in Preview → Commit Import. Nothing is saved until Commit Import.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <select
              value={datasetType}
              onChange={(e) => { setDatasetType(e.target.value as MigrationDatasetType); setHeaders([]); setRows([]); setMapping([]); }}
              className="sm:col-span-1 border border-neutral-300 rounded-md p-2 text-sm"
            >
              <option value="IP">IP</option>
              <option value="ABT">ABT</option>
              <option value="VAX">VAX</option>
            </select>
            <button onClick={() => fileInputRef.current?.click()} className="sm:col-span-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 hover:bg-neutral-50">
              <Upload className="w-4 h-4" />
              {fileName ? "Replace CSV" : "Upload CSV"}
            </button>
            <button onClick={() => parseCurrentCsv(csvText)} className="sm:col-span-1 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">
              Parse {DATASET_LABELS[datasetType]} CSV
            </button>
            <button onClick={handleImport} className="sm:col-span-1 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:bg-neutral-300" disabled={datasetType === "ABT" && hasAbtCsvErrors}>
              {datasetType === "ABT" ? "Commit Import" : "Import CSV"}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="Paste CSV content here (optional)" rows={6} className="w-full border border-neutral-300 rounded-md p-2 text-sm font-mono" />

          {datasetType === "ABT" && abtCsvRows.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-neutral-900">Parsed Items Preview</h4>
              <div className="overflow-x-auto border border-neutral-200 rounded-md">
                <table className="min-w-full text-xs">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-2 py-1">Status</th>
                      <th className="px-2 py-1">Skip</th>
                      <th className="px-2 py-1">MRN</th>
                      <th className="px-2 py-1">Resident</th>
                      <th className="px-2 py-1">Medication</th>
                      <th className="px-2 py-1">Medication Class</th>
                      <th className="px-2 py-1">Dose</th>
                      <th className="px-2 py-1">Route</th>
                      <th className="px-2 py-1">Frequency</th>
                      <th className="px-2 py-1">Start</th>
                      <th className="px-2 py-1">End</th>
                      <th className="px-2 py-1">Indication</th>
                      <th className="px-2 py-1">Course Status</th>
                      <th className="px-2 py-1">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abtCsvRows.map((row) => (
                      <tr key={row.rowId} className={row.skip ? "opacity-60 bg-neutral-50" : ""}>
                        <td className="px-2 py-1">{statusBadge(row.status)}</td>
                        <td className="px-2 py-1"><input type="checkbox" checked={row.skip} onChange={(e) => setAbtCsvRows((prev) => prev.map((item) => item.rowId === row.rowId ? { ...item, skip: e.target.checked } : item))} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.mrn} onChange={(e) => updateAbtCsvRow(row.rowId, "mrn", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.residentName} onChange={(e) => updateAbtCsvRow(row.rowId, "residentName", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.medicationName} onChange={(e) => updateAbtCsvRow(row.rowId, "medicationName", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.medicationClass} onChange={(e) => updateAbtCsvRow(row.rowId, "medicationClass", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.dose} onChange={(e) => updateAbtCsvRow(row.rowId, "dose", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.route} onChange={(e) => updateAbtCsvRow(row.rowId, "route", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.frequency} onChange={(e) => updateAbtCsvRow(row.rowId, "frequency", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.startDate} onChange={(e) => updateAbtCsvRow(row.rowId, "startDate", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.endDate} onChange={(e) => updateAbtCsvRow(row.rowId, "endDate", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.indication} onChange={(e) => updateAbtCsvRow(row.rowId, "indication", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1" value={row.data.status} onChange={(e) => updateAbtCsvRow(row.rowId, "status", e.target.value)} /></td>
                        <td className="px-2 py-1 max-w-xs">
                          {row.errors.concat(row.warnings).join("; ")}
                          {row.duplicateMatch && (
                            <div className="text-[10px] text-purple-700 mt-1">Match: {row.duplicateMatch.medication} ({row.duplicateMatch.startDate}) [{row.duplicateMatch.status}]</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {importMode === "RAW" && (datasetType === "ABT" || datasetType === "VAX") && (
        <div className="border border-neutral-200 rounded-md p-4 space-y-3">

          {/* Resolution legend */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">✅ Active census</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">🟡 Historical resident</span>
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">🔴 Unresolved — will create Quarantine record at commit</span>
          </div>

          {datasetType === "VAX" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Default Vaccine Type</label>
                <select value={vaxTypeSelection} onChange={(e) => setVaxTypeSelection(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm">
                  {VAX_TYPE_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Default Event Status</label>
                <select value={vaxStatusSelection} onChange={(e) => setVaxStatusSelection(e.target.value as "Vaccinated" | "Historical" | "Refused")} className="w-full border border-neutral-300 rounded-md p-2 text-sm">
                  {VAX_STATUS_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
          )}

          <textarea
            value={datasetType === "ABT" ? rawAbtText : rawVaxText}
            onChange={(e) => (datasetType === "ABT" ? setRawAbtText(e.target.value) : setRawVaxText(e.target.value))}
            placeholder={datasetType === "ABT" ? "Paste Order Listing Report raw text" : "Paste VAX raw list lines"}
            rows={8}
            className="w-full border border-neutral-300 rounded-md p-2 text-sm font-mono"
          />

          <div className="flex gap-2">
            <button onClick={parseRawImport} className="px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700">Parse</button>
            <button
              onClick={() => { if (datasetType === "ABT") { setRawAbtText(""); setRawAbtRows([]); } else { setRawVaxText(""); setRawVaxRows([]); } }}
              className="px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-700"
            >Clear</button>
            <button onClick={commitRawImport} disabled={hasRawErrors} className="px-3 py-2 rounded-md bg-emerald-600 disabled:bg-neutral-300 text-white text-sm">Commit Import</button>
          </div>

          {/* ABT RAW staging table */}
          {datasetType === "ABT" && rawAbtRows.length > 0 && (
            <div className="overflow-x-auto border border-neutral-200 rounded-md">
              <table className="min-w-full text-xs">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Skip</th>
                    <th className="px-2 py-1">MRN</th>
                    <th className="px-2 py-1">Resident</th>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Medication</th>
                    <th className="px-2 py-1">Dose</th>
                    <th className="px-2 py-1">Route</th>
                    <th className="px-2 py-1">Frequency</th>
                    <th className="px-2 py-1">Start</th>
                    <th className="px-2 py-1">End</th>
                    <th className="px-2 py-1">Indication</th>
                    <th className="px-2 py-1">Source of Infection</th>
                    <th className="px-2 py-1">Category</th>
                    <th className="px-2 py-1">Syndrome</th>
                    <th className="px-2 py-1">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {rawAbtRows.map((row) => {
                    const updateField = (field: keyof RawAbtStagingRow, value: string | boolean) =>
                      setRawAbtRows((prev) => prev.map((item) => item.id === row.id ? { ...item, [field]: value } : item));
                    return (
                      <tr key={row.id} className={row.skip ? "opacity-50 bg-neutral-50" : ""}>
                        <td className="px-2 py-1">{statusBadge(row.status)}</td>
                        <td className="px-2 py-1"><input type="checkbox" checked={row.skip} onChange={(e) => updateField("skip", e.target.checked)} /></td>

                        {/* MRN — re-resolves resident on every keystroke */}
                        <td className="px-2 py-1">
                          <input
                            className="border rounded p-1 w-20 text-xs"
                            value={row.mrn}
                            onChange={(e) => {
                              const newMrn = e.target.value;
                              const res = resolveResident(newMrn, store.residents);
                              setRawAbtRows((prev) => prev.map((item) =>
                                item.id === row.id
                                  ? { ...item, mrn: newMrn, residentResolution: res.resolution, residentDisplayName: res.displayName }
                                  : item
                              ));
                            }}
                          />
                        </td>

                        {/* Resident resolution badge */}
                        <td className="px-2 py-1 whitespace-nowrap">{resolutionBadge(row.residentResolution, row.residentDisplayName)}</td>

                        <td className="px-2 py-1"><input className="border rounded p-1 w-28 text-xs" value={row.residentNameRaw} onChange={(e) => updateField("residentNameRaw", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1 w-32 text-xs" value={row.medicationName} onChange={(e) => updateField("medicationName", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1 w-16 text-xs" value={row.dose} onChange={(e) => updateField("dose", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1 w-14 text-xs" value={row.routeNormalized} onChange={(e) => updateField("routeNormalized", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1 w-16 text-xs" value={row.frequencyNormalized} onChange={(e) => updateField("frequencyNormalized", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1 w-24 text-xs" value={row.startDate} onChange={(e) => updateField("startDate", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1 w-24 text-xs" value={row.endDate} onChange={(e) => updateField("endDate", e.target.value)} /></td>
                        <td className="px-2 py-1"><input className="border rounded p-1 w-24 text-xs" value={row.indicationRaw} onChange={(e) => updateField("indicationRaw", e.target.value)} /></td>
                        <td className="px-2 py-1">
                          <select className="border rounded p-1 text-xs w-28" value={row.sourceOfInfection}
                            onChange={(e) => {
                              const src = e.target.value;
                              const cascade = INDICATION_CASCADE[src];
                              setRawAbtRows((prev) => prev.map((item) =>
                                item.id === row.id
                                  ? { ...item, sourceOfInfection: src, indicationCategory: cascade?.category ?? item.indicationCategory, syndrome: cascade?.syndrome ?? item.syndrome }
                                  : item
                              ));
                            }}
                          >
                            {SOURCE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt || "— select —"}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select className="border rounded p-1 text-xs w-28" value={row.indicationCategory} onChange={(e) => updateField("indicationCategory", e.target.value)}>
                            {CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt || "— select —"}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <select className="border rounded p-1 text-xs w-28" value={row.syndrome} onChange={(e) => updateField("syndrome", e.target.value)}>
                            {SYNDROME_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt || "— select —"}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1 max-w-xs text-amber-700 text-[10px]">{row.errors.concat(row.warnings).join("; ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VAX RAW staging table */}
          {datasetType === "VAX" && rawVaxRows.length > 0 && (
            <div className="overflow-x-auto border border-neutral-200 rounded-md">
              <table className="min-w-full text-xs">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Skip</th>
                    <th className="px-2 py-1">MRN</th>
                    <th className="px-2 py-1">Resident</th>
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Vaccine Type</th>
                    <th className="px-2 py-1">Event Status</th>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {rawVaxRows.map((row) => (
                    <tr key={row.id} className={row.skip ? "opacity-50 bg-neutral-50" : ""}>
                      <td className="px-2 py-1">{statusBadge(row.status)}</td>
                      <td className="px-2 py-1"><input type="checkbox" checked={row.skip} onChange={(e) => updateVaxRow(row.id, "skip", e.target.checked)} /></td>

                      {/* MRN — re-resolves resident on every keystroke */}
                      <td className="px-2 py-1">
                        <input
                          className="border rounded p-1 w-20 text-xs"
                          value={row.mrn}
                          onChange={(e) => {
                            const newMrn = e.target.value;
                            const res = resolveResident(newMrn, store.residents);
                            setRawVaxRows((prev) => prev.map((item) =>
                              item.id === row.id
                                ? { ...item, mrn: newMrn, residentResolution: res.resolution, residentDisplayName: res.displayName }
                                : item
                            ));
                          }}
                        />
                      </td>

                      {/* Resident resolution badge */}
                      <td className="px-2 py-1 whitespace-nowrap">{resolutionBadge(row.residentResolution, row.residentDisplayName)}</td>

                      <td className="px-2 py-1"><input className="border rounded p-1 w-28 text-xs" value={row.residentNameRaw} onChange={(e) => updateVaxRow(row.id, "residentNameRaw", e.target.value)} /></td>
                      <td className="px-2 py-1">
                        <select className="border rounded p-1 text-xs w-28" value={row.vaccineType} onChange={(e) => updateVaxRow(row.id, "vaccineType", e.target.value)}>
                          {VAX_TYPE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        <select className="border rounded p-1 text-xs w-24" value={row.eventStatus} onChange={(e) => updateVaxRow(row.id, "eventStatus", e.target.value as RawVaxStagingRow["eventStatus"])}>
                          {VAX_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1"><input className="border rounded p-1 w-24 text-xs" value={row.eventDate} onChange={(e) => updateVaxRow(row.id, "eventDate", e.target.value)} /></td>
                      <td className="px-2 py-1 max-w-xs text-amber-700 text-[10px]">{row.errors.concat(row.warnings).join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {datasetType !== "ABT" && mapping.length > 0 && (
        <div className="border border-neutral-200 rounded-md p-4 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 mb-2">Mapping Summary</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs border border-neutral-200">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="text-left px-2 py-1 border-b border-neutral-200">CSV Column</th>
                    <th className="text-left px-2 py-1 border-b border-neutral-200">Mapped Internal Field</th>
                  </tr>
                </thead>
                <tbody>
                  {mapping.map((entry, index) => (
                    <tr key={`${entry.column}-${index}`}>
                      <td className="px-2 py-1 border-b border-neutral-100">{entry.column}</td>
                      <td className="px-2 py-1 border-b border-neutral-100">
                        <select
                          value={entry.mappedField || ""}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            setMapping((prev) => prev.map((item, i) => i === index ? { ...item, mappedField: value } : item));
                          }}
                          className="border border-neutral-300 rounded p-1 text-xs"
                        >
                          <option value="">(Unmapped)</option>
                          {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unmappedColumns.length > 0 && (
              <p className="text-xs text-amber-700 mt-2">Unmapped columns: {unmappedColumns.join(", ")}</p>
            )}
          </div>
          {importErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <h4 className="text-xs font-semibold text-red-800 mb-1">Row-level errors</h4>
              <ul className="text-xs text-red-700 list-disc pl-4 space-y-1 max-h-28 overflow-auto">
                {importErrors.map((error, index) => <li key={`${error.rowNumber}-${index}`}>Row {error.rowNumber}: {error.message}</li>)}
              </ul>
            </div>
          )}
          <div>
            <h4 className="text-sm font-semibold text-neutral-900 mb-2">Preview (first 20 rows)</h4>
            <div className="overflow-x-auto max-h-64 border border-neutral-200">
              <table className="min-w-full text-xs">
                <thead className="bg-neutral-50 sticky top-0">
                  <tr>{headers.map((header) => <th key={header} className="text-left px-2 py-1 border-b border-neutral-200">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {headers.map((_, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-2 py-1 border-b border-neutral-100">{row[cellIndex] || ""}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

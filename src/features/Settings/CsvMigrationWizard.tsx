import React, { useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useDatabase, useFacilityData } from "../../app/providers";
import { getMigrationTemplate, MigrationDatasetType } from "../../lib/migration/csvTemplates";
import {
  buildAutoMapping,
  CsvColumnMapping,
  getDatasetFields,
  importMappedRows,
  parseCsv,
} from "../../lib/migration/csvImport";

const DATASET_LABELS: Record<MigrationDatasetType, string> = {
  ABT: "ABT",
  IP: "IP",
  VAX: "VAX",
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

  const fields = useMemo(() => getDatasetFields(datasetType), [datasetType]);
  const unmappedColumns = useMemo(
    () => mapping.filter((item) => !item.mappedField).map((item) => item.column),
    [mapping]
  );

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
    const parsed = parseCsv(rawCsv);
    if (!parsed.headers.length || !parsed.rows.length) {
      alert("CSV is missing headers or data rows.");
      return;
    }
    const nextMapping = buildAutoMapping(parsed.headers, datasetType);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMapping(nextMapping);
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
    if (!rows.length || !mapping.length) {
      alert("Upload or paste CSV and parse it first.");
      return;
    }
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
    const errorText = summary.errors
      .slice(0, 10)
      .map((error) => `Row ${error.rowNumber}: ${error.message}`)
      .join("\n");
    alert(
      `${datasetType} import complete.\nCreated: ${summary.importedCount}\nUpdated: ${summary.updatedCount}\nSkipped: ${summary.errors.length}${
        errorText ? `\n\nErrors:\n${errorText}` : ""
      }`
    );
    setImportErrors(summary.errors);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => downloadTemplate("IP")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 hover:bg-neutral-50"
        >
          <Download className="w-4 h-4" />
          Download IP Template
        </button>
        <button
          onClick={() => downloadTemplate("ABT")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 hover:bg-neutral-50"
        >
          <Download className="w-4 h-4" />
          Download ABT Template
        </button>
        <button
          onClick={() => downloadTemplate("VAX")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 hover:bg-neutral-50"
        >
          <Download className="w-4 h-4" />
          Download VAX Template
        </button>
      </div>

      <div className="border border-neutral-200 rounded-md p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={datasetType}
            onChange={(event) => {
              setDatasetType(event.target.value as MigrationDatasetType);
              setHeaders([]);
              setRows([]);
              setMapping([]);
            }}
            className="sm:col-span-1 border border-neutral-300 rounded-md p-2 text-sm"
          >
            <option value="IP">IP</option>
            <option value="ABT">ABT</option>
            <option value="VAX">VAX</option>
          </select>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="sm:col-span-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-neutral-300 bg-white text-sm text-neutral-700 hover:bg-neutral-50"
          >
            <Upload className="w-4 h-4" />
            {fileName ? "Replace CSV" : "Upload CSV"}
          </button>
          <button
            onClick={() => parseCurrentCsv(csvText)}
            className="sm:col-span-1 px-3 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
          >
            Parse {DATASET_LABELS[datasetType]} CSV
          </button>
          <button
            onClick={handleImport}
            className="sm:col-span-1 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700"
          >
            Import CSV
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
        />
        <textarea
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          placeholder="Paste CSV content here (optional)"
          rows={6}
          className="w-full border border-neutral-300 rounded-md p-2 text-sm font-mono"
        />
      </div>

      {mapping.length > 0 && (
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
                          onChange={(event) => {
                            const value = event.target.value || null;
                            setMapping((prev) =>
                              prev.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, mappedField: value } : item
                              )
                            );
                          }}
                          className="border border-neutral-300 rounded p-1 text-xs"
                        >
                          <option value="">(Unmapped)</option>
                          {fields.map((field) => (
                            <option key={field} value={field}>
                              {field}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unmappedColumns.length > 0 && (
              <p className="text-xs text-amber-700 mt-2">
                Unmapped columns: {unmappedColumns.join(", ")}
              </p>
            )}
          </div>
          {importErrors.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <h4 className="text-xs font-semibold text-red-800 mb-1">Row-level errors</h4>
              <ul className="text-xs text-red-700 list-disc pl-4 space-y-1 max-h-28 overflow-auto">
                {importErrors.map((error, index) => (
                  <li key={`${error.rowNumber}-${index}`}>
                    Row {error.rowNumber}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-neutral-900 mb-2">Preview (first 20 rows)</h4>
            <div className="overflow-x-auto max-h-64 border border-neutral-200">
              <table className="min-w-full text-xs">
                <thead className="bg-neutral-50 sticky top-0">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className="text-left px-2 py-1 border-b border-neutral-200">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 20).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {headers.map((_, cellIndex) => (
                        <td key={`${rowIndex}-${cellIndex}`} className="px-2 py-1 border-b border-neutral-100">
                          {row[cellIndex] || ""}
                        </td>
                      ))}
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

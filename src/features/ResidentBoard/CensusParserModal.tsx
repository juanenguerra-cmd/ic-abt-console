import React, { useState } from "react";
import { X, Upload, AlertCircle, AlertTriangle } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { Resident } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";

interface Props {
  onClose: () => void;
}

const ROOM_ID_PATTERN = /^\d+(?:-[A-Za-z0-9]+)?$/; // e.g. 101, 101-A

type ParsedRow = Record<string, string>;

interface CollisionEntry {
  rowIndex: number;
  parsed: ParsedRow;
  existing: Resident;
}

interface InvalidRow {
  row: number;
  reason: string;
}

// ---------- CollisionReviewStep sub-component ----------

interface CollisionReviewStepProps {
  collisions: CollisionEntry[];
  choices: Record<string, 'keep' | 'apply'>;
  onChoiceChange: (mrn: string, choice: 'keep' | 'apply') => void;
  parserMode: 'census' | 'listing';
}

const getCensusDiffFields = (parsed: ParsedRow, existing: Resident): { field: string; current: string; imported: string }[] => [
  { field: 'Room',   current: existing.currentRoom || '',    imported: parsed.room || '' },
  { field: 'Unit',   current: existing.currentUnit || '',    imported: parsed.unit || '' },
  { field: 'Status', current: existing.status || '',         imported: parsed.status || '' },
  { field: 'Payor',  current: existing.payor || '',          imported: parsed.payor || '' },
  { field: 'DOB',    current: existing.dob || '',            imported: parsed.dob || '' },
].filter(f => f.imported && f.current !== f.imported);

const getListingDiffFields = (parsed: ParsedRow, existing: Resident): { field: string; current: string; imported: string }[] => [
  { field: 'Sex',                current: existing.sex || '',              imported: parsed.gender || '' },
  { field: 'Admission Date',     current: existing.admissionDate || '',    imported: parsed.admissionDate || '' },
  { field: 'Attending MD',       current: existing.attendingMD || '',      imported: parsed.primaryMD || '' },
  { field: 'Primary Diagnosis',  current: existing.primaryDiagnosis || '', imported: parsed.primaryDiagnosis || '' },
  { field: 'Allergies',          current: (existing.allergies || []).join(', '), imported: parsed.allergies || '' },
].filter(f => f.imported && f.current !== f.imported);

const CollisionReviewStep: React.FC<CollisionReviewStepProps> = ({ collisions, choices, onChoiceChange, parserMode }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-amber-800 bg-amber-50 p-3 rounded-md border border-amber-300">
      <AlertTriangle className="w-5 h-5 shrink-0" />
      <p className="text-sm font-semibold">{collisions.length} MRN collision{collisions.length > 1 ? 's' : ''} detected — choose an action for each</p>
    </div>
    <div className="space-y-4 overflow-y-auto max-h-[50vh]">
      {collisions.map(({ parsed, existing }) => {
        const mrn = parsed.mrn;
        const diffFields = parserMode === 'census'
          ? getCensusDiffFields(parsed, existing)
          : getListingDiffFields(parsed, existing);
        return (
          <div key={mrn} className="border border-neutral-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm font-semibold text-neutral-800">
                MRN <span className="font-mono">{mrn}</span> — {existing.displayName}
              </span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-neutral-700 cursor-pointer">
                  <input
                    type="radio"
                    name={`collision-${mrn}`}
                    value="keep"
                    checked={choices[mrn] === 'keep'}
                    onChange={() => onChoiceChange(mrn, 'keep')}
                    className="text-neutral-600 focus:ring-neutral-500"
                  />
                  Keep Existing
                </label>
                <label className="flex items-center gap-1.5 text-sm text-amber-700 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name={`collision-${mrn}`}
                    value="apply"
                    checked={choices[mrn] === 'apply'}
                    onChange={() => onChoiceChange(mrn, 'apply')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  Apply Import
                </label>
              </div>
            </div>
            {diffFields.length > 0 ? (
              <table className="min-w-full divide-y divide-neutral-100 text-xs">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="px-4 py-1.5 text-left font-medium text-neutral-500">Field</th>
                    <th className="px-4 py-1.5 text-left font-medium text-neutral-500">Current Value</th>
                    <th className="px-4 py-1.5 text-left font-medium text-neutral-500">Imported Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {diffFields.map(f => (
                    <tr key={f.field} className="bg-yellow-50">
                      <td className="px-4 py-1.5 font-medium text-neutral-700">{f.field}</td>
                      <td className="px-4 py-1.5 text-neutral-500">{f.current || <em className="text-neutral-400">empty</em>}</td>
                      <td className="px-4 py-1.5 text-amber-800 font-medium">{f.imported}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-4 py-2 text-xs text-neutral-500 italic">No field changes detected for this record.</p>
            )}
          </div>
        );
      })}
    </div>
  </div>
);

// ---------- Main modal ----------

export const CensusParserModal: React.FC<Props> = ({ onClose }) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const [rawText, setRawText] = useState("");
  const [results, setResults] = useState<ParsedRow[] | null>(null);
  const [parserMode, setParserMode] = useState<"census" | "listing">("census");

  // Collision / invalid bucketing state
  const [newRows, setNewRows] = useState<ParsedRow[]>([]);
  const [collisions, setCollisions] = useState<CollisionEntry[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [collisionChoices, setCollisionChoices] = useState<Record<string, 'keep' | 'apply'>>({});

  // ---- bucket parsed rows into new / collision / invalid ----
  const bucketRows = (rows: ParsedRow[]) => {
    // Build lookup maps once to avoid O(n²) linear searches
    const mrnToResident = new Map<string, Resident>(
      Object.values(store.residents).map(r => [r.mrn.trim().toLowerCase(), r])
    );
    const nextNew: ParsedRow[] = [];
    const nextCollisions: CollisionEntry[] = [];
    const nextInvalid: InvalidRow[] = [];
    const nextChoices: Record<string, 'keep' | 'apply'> = {};

    rows.forEach((row, idx) => {
      const mrnRaw = (row.mrn || '').trim();
      if (!mrnRaw) {
        nextInvalid.push({ row: idx + 1, reason: 'Blank MRN' });
        return;
      }
      const mrnLower = mrnRaw.toLowerCase();
      const existing = mrnToResident.get(mrnLower);
      if (existing) {
        nextCollisions.push({ rowIndex: idx + 1, parsed: row, existing });
        nextChoices[mrnRaw] = 'keep'; // default: keep existing
      } else {
        nextNew.push(row);
      }
    });

    setNewRows(nextNew);
    setCollisions(nextCollisions);
    setInvalidRows(nextInvalid);
    setCollisionChoices(nextChoices);
  };

  const handleParse = () => {
    if (parserMode === "census") {
      parseCensus();
    } else {
      parseListing();
    }
  };

  const parseCensus = () => {
    const lines = rawText.split('\n');
    let currentUnit = "Unassigned";
    const parsed = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const unitMatch = trimmed.match(/Unit:\s*(.*?)\s*Bed Certification:/i);
      if (unitMatch) {
        currentUnit = unitMatch[1].replace(/\(continued\)/gi, '').trim();
        continue;
      }

      if (trimmed.includes("EMPTY")) {
        const room = trimmed.split(/\s+/)[0]?.trim();
        if (room && ROOM_ID_PATTERN.test(room)) {
          parsed.push({
            room,
            name: "",
            mrn: "",
            dob: "",
            status: "Empty",
            payor: "",
            unit: currentUnit
          });
        }
        continue;
      }

      let parts = trimmed.split('\t');
      if (parts.length < 5) {
        parts = trimmed.split(/\s{2,}/);
      }

      if (parts.length >= 4) {
        const room = parts[0].trim();
        const nameAndMrn = parts[1].trim();
        const dob = parts[2].trim();
        const status = parts[3].trim();
        
        const mrnMatch = nameAndMrn.match(/(.*?)\s*\((.*?)\)/);
        let name = nameAndMrn;
        let mrn = "";
        if (mrnMatch) {
          name = mrnMatch[1].trim();
          mrn = mrnMatch[2].trim();
        }

        let payor = "";
        if (parts.length >= 7) {
          payor = parts[6].trim();
        }

        parsed.push({
          room,
          name,
          mrn,
          dob,
          status,
          payor,
          unit: currentUnit
        });
      }
    }
    setResults(parsed);
    bucketRows(parsed);
  };

  const parseListing = () => {
    const lines = rawText.split('\n');
    const records: { nameAndMrn: string; gender: string; admissionDate: string; rest: string }[] = [];
    let currentRecord: { nameAndMrn: string; gender: string; admissionDate: string; rest: string } | null = null;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      if (line.startsWith('Date:') || line.startsWith('Time:') || line.startsWith('User:') || line.startsWith('Resident:') || line.startsWith('Name\tGender')) {
        continue;
      }

      const newResMatch = line.match(/^([A-Za-z\s',-]+ \([A-Za-z0-9-]+\))\s+([MF])\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.*)$/);
      if (newResMatch) {
        if (currentRecord) records.push(currentRecord);
        currentRecord = {
          nameAndMrn: newResMatch[1].trim(),
          gender: newResMatch[2].trim(),
          admissionDate: newResMatch[3].trim(),
          rest: newResMatch[4].trim()
        };
      } else if (currentRecord) {
        currentRecord.rest += " " + line;
      }
    }
    if (currentRecord) records.push(currentRecord);

    const parsed: ParsedRow[] = [];
    for (const rec of records) {
      const parts = rec.rest.split('\t').map((s: string) => s.trim()).filter((s: string) => s);
      let primaryDiagnosis = "";
      let primaryMD = "";
      let allergies = "";

      if (parts.length >= 3) {
        primaryDiagnosis = parts[parts.length - 1];
        primaryMD = parts[parts.length - 2];
        allergies = parts.slice(0, parts.length - 2).join(" ");
      } else if (parts.length === 2) {
        primaryMD = parts[0];
        primaryDiagnosis = parts[1];
      } else {
        allergies = parts[0] || "";
      }

      const mrnMatch = rec.nameAndMrn.match(/(.*?)\s*\((.*?)\)/);
      let name = rec.nameAndMrn;
      let mrn = "";
      if (mrnMatch) {
        name = mrnMatch[1].trim();
        mrn = mrnMatch[2].trim();
      }

      parsed.push({
        name,
        mrn,
        gender: rec.gender,
        admissionDate: rec.admissionDate,
        allergies,
        primaryMD,
        primaryDiagnosis,
        status: "Active"
      });
    }
    setResults(parsed);
    bucketRows(parsed);
  };

  const allCollisionsResolved = collisions.every(c => collisionChoices[c.parsed.mrn] !== undefined);

  const handleCommit = () => {
    if (!results) return;

    // Rows to actually upsert = newRows + collisions where choice is 'apply'
    const applyMrns = new Set(
      collisions
        .filter(c => collisionChoices[c.parsed.mrn] === 'apply')
        .map(c => c.parsed.mrn)
    );
    const rowsToUpsert = results.filter(p => {
      const mrn = (p.mrn || '').trim();
      if (!mrn) return false; // skip invalid
      const isCollision = collisions.some(c => c.parsed.mrn === mrn);
      return !isCollision || applyMrns.has(mrn);
    });

    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      const now = new Date().toISOString();

      rowsToUpsert.forEach(p => {
        let firstName = "";
        let lastName = p.name;
        if (p.name.includes(",")) {
          const [last, first] = p.name.split(",");
          lastName = last.trim();
          firstName = first ? first.trim() : "";
        }

        if (parserMode === "census") {
          const validStatus = ["Active", "Discharged", "Deceased"].includes(p.status)
            ? p.status as "Active" | "Discharged" | "Deceased"
            : "Active";

          if (p.mrn) {
            if (facility.residents[p.mrn]) {
              if (p.room) facility.residents[p.mrn].currentRoom = p.room;
              if (p.unit) facility.residents[p.mrn].currentUnit = p.unit;
              if (p.status) facility.residents[p.mrn].status = validStatus;
              if (p.payor) facility.residents[p.mrn].payor = p.payor;
              if (p.dob) facility.residents[p.mrn].dob = p.dob;
              facility.residents[p.mrn].updatedAt = now;
            } else {
              facility.residents[p.mrn] = {
                mrn: p.mrn,
                displayName: p.name,
                firstName,
                lastName,
                dob: p.dob,
                sex: undefined,
                admissionDate: undefined,
                currentRoom: p.room,
                currentUnit: p.unit,
                status: validStatus,
                payor: p.payor,
                attendingMD: undefined,
                primaryDiagnosis: undefined,
                allergies: [],
                createdAt: now,
                updatedAt: now,
              };
            }
          }
        } else {
          if (p.mrn) {
            if (facility.residents[p.mrn]) {
              if (p.gender) facility.residents[p.mrn].sex = p.gender;
              if (p.admissionDate) facility.residents[p.mrn].admissionDate = p.admissionDate;
              if (p.primaryMD) facility.residents[p.mrn].attendingMD = p.primaryMD;
              if (p.primaryDiagnosis) facility.residents[p.mrn].primaryDiagnosis = p.primaryDiagnosis;
              if (p.allergies) {
                facility.residents[p.mrn].allergies = p.allergies === "No Known Allergies"
                  ? []
                  : p.allergies.split(",").map((a: string) => a.trim());
              }
              facility.residents[p.mrn].updatedAt = now;
            } else {
              facility.residents[p.mrn] = {
                mrn: p.mrn,
                displayName: p.name,
                firstName,
                lastName,
                dob: undefined,
                sex: p.gender,
                admissionDate: p.admissionDate,
                currentRoom: undefined,
                currentUnit: undefined,
                status: undefined,
                payor: undefined,
                attendingMD: p.primaryMD,
                primaryDiagnosis: p.primaryDiagnosis,
                allergies: p.allergies && p.allergies !== "No Known Allergies"
                  ? p.allergies.split(",").map((a: string) => a.trim())
                  : [],
                createdAt: now,
                updatedAt: now,
              };
            }
          }
        }
      });
    });
    onClose();
  };

  const handleBack = () => {
    setResults(null);
    setNewRows([]);
    setCollisions([]);
    setInvalidRows([]);
    setCollisionChoices({});
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Update Census
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {!results ? (
            <>
              <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="parserMode" 
                    checked={parserMode === "census"} 
                    onChange={() => setParserMode("census")}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Census Report (Room/Status)
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 cursor-pointer">
                  <input 
                    type="radio" 
                    name="parserMode" 
                    checked={parserMode === "listing"} 
                    onChange={() => setParserMode("listing")}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Resident Listing (Clinical/Allergies)
                </label>
              </div>
              <p className="text-sm text-neutral-600">
                {parserMode === "census" 
                  ? "Paste your Census Report below. This is the authoritative source for census count and occupancy. Updates: Unit, Room, Status, Payor, and DOB."
                  : "Paste your Resident Listing Report below. This is the authoritative source for clinical fields. Updates: Attending MD, Diagnosis, Admission Date, Sex, and Allergies. Does not affect census count."}
              </p>
              <textarea
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder={parserMode === "census" 
                  ? "Unit: Unit 2   Bed Certification: All\n250-A\tCARRIGAN, PATRICIA (LON202356)\t12/15/1929\tActive\tMLCB1\tSTD\tMedicare A\tPrivate\tOCCUPIED"
                  : "CARRIGAN, PATRICIA (LON202356) \tF \t1/26/2026 \tNo Known Allergies \tDr. Nenad Grlic \tI69.322"}
                className="flex-1 min-h-[300px] p-3 border border-neutral-300 rounded-md font-mono text-xs whitespace-pre focus:ring-indigo-500 focus:border-indigo-500"
              />
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleParse}
                  disabled={!rawText.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  Parse Data
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Invalid rows banner */}
              {invalidRows.length > 0 && (
                <div className="bg-red-50 border border-red-300 rounded-md p-3 space-y-1">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-semibold">{invalidRows.length} invalid row{invalidRows.length > 1 ? 's' : ''} — will be skipped</p>
                  </div>
                  <ul className="text-xs text-red-700 pl-7 list-disc space-y-0.5">
                    {invalidRows.map((r, i) => (
                      <li key={i}>Row {r.row}: {r.reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Collision review step */}
              {collisions.length > 0 && (
                <CollisionReviewStep
                  collisions={collisions}
                  choices={collisionChoices}
                  onChoiceChange={(mrn, choice) => setCollisionChoices(prev => ({ ...prev, [mrn]: choice }))}
                  parserMode={parserMode}
                />
              )}

              {/* Summary of new records */}
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-md border border-emerald-200">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-medium">
                  {newRows.length} new record{newRows.length !== 1 ? 's' : ''} to import
                  {collisions.length > 0 ? `, ${collisions.length} collision${collisions.length !== 1 ? 's' : ''} require resolution` : ''}.
                </p>
              </div>

              {/* Preview table */}
              <div className="flex-1 overflow-y-auto border border-neutral-200 rounded-md">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50 sticky top-0">
                    <tr>
                      {parserMode === "census" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Unit</th>}
                      {parserMode === "census" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Room</th>}
                      <th className="px-4 py-2 text-left font-medium text-neutral-500">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-500">MRN</th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-500">Status</th>
                      {parserMode === "census" && <th className="px-4 py-2 text-left font-medium text-neutral-500">DOB</th>}
                      {parserMode === "census" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Payor</th>}
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Gender</th>}
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Admission Date</th>}
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Allergies</th>}
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">MD</th>}
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Diagnosis</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {results.map((r, i) => {
                      const isInvalid = invalidRows.some(inv => inv.row === i + 1);
                      const isCollision = collisions.some(c => c.parsed.mrn === r.mrn);
                      const rowClass = isInvalid
                        ? 'bg-red-50 opacity-60'
                        : isCollision
                          ? 'bg-amber-50'
                          : '';
                      return (
                        <tr key={i} className={rowClass}>
                          {parserMode === "census" && <td className="px-4 py-2 text-neutral-900">{r.unit}</td>}
                          {parserMode === "census" && <td className="px-4 py-2 text-neutral-900">{r.room}</td>}
                          <td className="px-4 py-2 text-neutral-900">{r.name}</td>
                          <td className="px-4 py-2 text-neutral-500 font-mono">{r.mrn || <span className="text-red-600 font-bold">Missing</span>}</td>
                          <td className="px-4 py-2 text-neutral-500 text-xs">
                            {isInvalid ? <span className="text-red-600 font-semibold">Skip</span> : isCollision ? <span className="text-amber-600 font-semibold">Collision</span> : <span className="text-emerald-600">New</span>}
                          </td>
                          {parserMode === "census" && <td className="px-4 py-2 text-neutral-500">{r.dob}</td>}
                          {parserMode === "census" && <td className="px-4 py-2 text-neutral-500">{r.payor}</td>}
                          {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500">{r.gender}</td>}
                          {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500">{r.admissionDate}</td>}
                          {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500 truncate max-w-[200px]" title={r.allergies}>{r.allergies}</td>}
                          {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500">{r.primaryMD}</td>}
                          {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500">{r.primaryDiagnosis}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCommit}
                  disabled={!allCollisionsResolved}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Import
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

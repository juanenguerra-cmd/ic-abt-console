import React, { useState } from "react";
import { X, Upload, AlertCircle, AlertTriangle, Search } from "lucide-react";
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
  choices: Record<string, 'skip' | 'merge' | 'replace'>;
  onChoiceChange: (mrn: string, choice: 'skip' | 'merge' | 'replace') => void;
  onSetAllChoices: (choice: 'skip' | 'merge' | 'replace') => void;
  parserMode: 'census' | 'listing';
}

const getCensusDiffFields = (parsed: ParsedRow, existing: Resident): { field: string; current: string; imported: string }[] => [
  { field: 'Room',   current: existing.currentRoom || '',    imported: parsed.room || '' },
  { field: 'Unit',   current: existing.currentUnit || '',    imported: parsed.unit || '' },
  { field: 'Status', current: existing.status || '',         imported: parsed.status || '' },
  { field: 'Payor',  current: existing.payor || '',          imported: parsed.payor || '' },
  { field: 'DOB',    current: existing.dob || '',            imported: parsed.dob || '' },
].filter(f => f.current !== f.imported);

const getListingDiffFields = (parsed: ParsedRow, existing: Resident): { field: string; current: string; imported: string }[] => [
  { field: 'Sex',                current: existing.sex || '',              imported: parsed.gender || '' },
  { field: 'Admission Date',     current: existing.admissionDate || '',    imported: parsed.admissionDate || '' },
  { field: 'Attending MD',       current: existing.attendingMD || '',      imported: parsed.primaryMD || '' },
  { field: 'Primary Diagnosis',  current: existing.primaryDiagnosis || '', imported: parsed.primaryDiagnosis || '' },
  { field: 'Allergies',          current: (existing.allergies || []).join(', '), imported: parsed.allergies || '' },
].filter(f => f.current !== f.imported);

const CollisionReviewStep: React.FC<CollisionReviewStepProps> = ({ collisions, choices, onChoiceChange, onSetAllChoices, parserMode }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between flex-wrap gap-2 text-amber-800 bg-amber-50 p-3 rounded-md border border-amber-300">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-semibold">{collisions.length} MRN collision{collisions.length > 1 ? 's' : ''} detected — choose an action for each</p>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => onSetAllChoices('skip')} className="text-xs px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100 text-amber-900 font-medium">Skip All</button>
        <button onClick={() => onSetAllChoices('merge')} className="text-xs px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100 text-amber-900 font-medium">Merge All</button>
        <button onClick={() => onSetAllChoices('replace')} className="text-xs px-2 py-1 bg-white border border-amber-300 rounded hover:bg-amber-100 text-amber-900 font-medium">Replace All</button>
      </div>
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
              <span className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                MRN <span className="font-mono">{mrn}</span> — {existing.displayName}
                {existing.status !== "Active" && (
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold border border-emerald-200">
                        REACTIVATION
                    </span>
                )}
              </span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-neutral-700 cursor-pointer">
                  <input
                    type="radio"
                    name={`collision-${mrn}`}
                    value="skip"
                    checked={choices[mrn] === 'skip'}
                    onChange={() => onChoiceChange(mrn, 'skip')}
                    className="text-neutral-600 focus:ring-neutral-500"
                  />
                  Skip
                </label>
                <label className="flex items-center gap-1.5 text-sm text-indigo-700 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name={`collision-${mrn}`}
                    value="merge"
                    checked={choices[mrn] === 'merge'}
                    onChange={() => onChoiceChange(mrn, 'merge')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  Merge
                </label>
                <label className="flex items-center gap-1.5 text-sm text-amber-700 cursor-pointer font-medium">
                  <input
                    type="radio"
                    name={`collision-${mrn}`}
                    value="replace"
                    checked={choices[mrn] === 'replace'}
                    onChange={() => onChoiceChange(mrn, 'replace')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  Replace
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
                    <th className="px-4 py-1.5 text-left font-medium text-neutral-500">Result ({choices[mrn] || 'pending'})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {diffFields.map(f => {
                    const choice = choices[mrn];
                    let result = f.current;
                    if (choice === 'replace') {
                      result = f.imported;
                    } else if (choice === 'merge') {
                      result = f.imported || f.current;
                    }
                    
                    return (
                      <tr key={f.field} className="bg-white">
                        <td className="px-4 py-1.5 font-medium text-neutral-700">{f.field}</td>
                        <td className="px-4 py-1.5 text-neutral-500">{f.current || <em className="text-neutral-400">empty</em>}</td>
                        <td className="px-4 py-1.5 text-neutral-500">{f.imported || <em className="text-neutral-400">empty</em>}</td>
                        <td className="px-4 py-1.5 font-medium text-indigo-700 bg-indigo-50/50">{result || <em className="text-neutral-400 font-normal">empty</em>}</td>
                      </tr>
                    );
                  })}
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
  const [collisionChoices, setCollisionChoices] = useState<Record<string, 'skip' | 'merge' | 'replace'>>({});
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  // ---- bucket parsed rows into new / collision / invalid ----
  const bucketRows = (rows: ParsedRow[]) => {
    // Build lookup maps once to avoid O(n²) linear searches
    const mrnToResident = new Map<string, Resident>(
      Object.values(store.residents).map(r => [r.mrn.trim().toLowerCase(), r])
    );
    const nextNew: ParsedRow[] = [];
    const nextCollisions: CollisionEntry[] = [];
    const nextInvalid: InvalidRow[] = [];
    const nextChoices: Record<string, 'skip' | 'merge' | 'replace'> = {};

    rows.forEach((row, idx) => {
      const mrnRaw = (row.mrn || '').trim();
      if (!mrnRaw) {
        nextInvalid.push({ row: idx + 1, reason: 'Blank MRN' });
        return;
      }
      const mrnLower = mrnRaw.toLowerCase();
      const existing = mrnToResident.get(mrnLower);
      if (existing) {
        // Auto-detect reactivation: if existing is Discharged/Deceased and new is Active (or implied Active)
        const newStatus = ["Active", "Discharged", "Deceased"].includes(row.status) ? row.status : "Active";
        const isReactivation = existing.status !== "Active" && newStatus === "Active";
        
        nextCollisions.push({ rowIndex: idx + 1, parsed: row, existing });
        if (isReactivation) {
            nextChoices[row.mrn] = 'merge'; // Default to merge for reactivations
        }
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

      let room = "";
      let nameAndMrn = "";
      let dob = "";
      let status = "";
      let payor = "";

      // Strategy 1: Column Split (Tab or 2+ Spaces)
      let parts = trimmed.split('\t');
      if (parts.length < 5) {
        parts = trimmed.split(/\s{2,}/);
      }

      if (parts.length >= 4) {
        room = parts[0].trim();
        nameAndMrn = parts[1].trim();
        dob = parts[2].trim();
        status = parts[3].trim();
        if (parts.length >= 7) {
            payor = parts[6].trim();
        }
      }

      // Strategy 2: Regex Fallback (if split failed to produce a valid MRN-containing string)
      // Matches: Room | Name (MRN) | DOB | Status ...
      if (!nameAndMrn.match(/\(.*\)/)) {
        // Relaxed regex:
        // 1. Room: non-whitespace
        // 2. Name+MRN: lazy match until DOB
        // 3. DOB: Date format
        // 4. Status: Word (Active, etc)
        // 5. Rest: Anything
        const regex = /^([A-Z0-9-]+)\s+(.+?\(.*?\))\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+([A-Za-z]+)(?:.*)/;
        const match = trimmed.match(regex);
        if (match) {
            room = match[1].trim();
            nameAndMrn = match[2].trim();
            dob = match[3].trim();
            status = match[4].trim();
            // Payor extraction is unreliable in regex fallback, skip for now or improve later
        }
      }

      if (room && nameAndMrn) {
        const mrnMatch = nameAndMrn.match(/(.*?)\s*\((.*?)\)/);
        let name = nameAndMrn;
        let mrn = "";
        if (mrnMatch) {
          name = mrnMatch[1].trim();
          mrn = mrnMatch[2].trim();
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
    const deduped: ParsedRow[] = [];
    const seenMrns = new Set<string>();
    let dups = 0;

    for (const p of parsed) {
        if (!p.mrn) {
            deduped.push(p);
            continue;
        }
        if (seenMrns.has(p.mrn)) {
            dups++;
            continue;
        }
        seenMrns.add(p.mrn);
        deduped.push(p);
    }

    setDuplicateCount(dups);
    setResults(deduped);
    bucketRows(deduped);
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

    const deduped: ParsedRow[] = [];
    const seenMrns = new Set<string>();
    let dups = 0;

    for (const p of parsed) {
        if (!p.mrn) {
            deduped.push(p);
            continue;
        }
        if (seenMrns.has(p.mrn)) {
            dups++;
            continue;
        }
        seenMrns.add(p.mrn);
        deduped.push(p);
    }

    setDuplicateCount(dups);
    setResults(deduped);
    bucketRows(deduped);
  };

  const allCollisionsResolved = collisions.every(c => collisionChoices[c.parsed.mrn] !== undefined);

  const commitWithChoices = (choices: Record<string, 'skip' | 'merge' | 'replace'>) => {
    if (!results) return;

    // Rows to actually upsert = newRows + collisions where choice is 'merge' or 'replace'
    const applyMrns = new Set(
      collisions
        .filter(c => choices[c.parsed.mrn] === 'merge' || choices[c.parsed.mrn] === 'replace')
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

      // In census mode, the imported report is authoritative for who is currently in census.
      // Residents not present in this import should no longer count as active census residents.
      const importedActiveMrns = parserMode === 'census'
        ? new Set(
            results
              .filter(r => (r.mrn || '').trim())
              .filter(r => ((r.status || '').trim().toLowerCase() || 'active') === 'active')
              .map(r => r.mrn.trim())
          )
        : new Set<string>();

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
              const choice = choices[p.mrn] || 'merge';
              if (choice === 'merge') {
                if (p.room) facility.residents[p.mrn].currentRoom = p.room;
                if (p.unit) facility.residents[p.mrn].currentUnit = p.unit;
                if (p.status) facility.residents[p.mrn].status = validStatus;
                if (p.payor) facility.residents[p.mrn].payor = p.payor;
                if (p.dob) facility.residents[p.mrn].dob = p.dob;
              } else if (choice === 'replace') {
                facility.residents[p.mrn].currentRoom = p.room || undefined;
                facility.residents[p.mrn].currentUnit = p.unit || undefined;
                facility.residents[p.mrn].status = validStatus;
                facility.residents[p.mrn].payor = p.payor || undefined;
                facility.residents[p.mrn].dob = p.dob || undefined;
              }
              
              if (facility.residents[p.mrn].status === 'Active') {
                facility.residents[p.mrn].isHistorical = false;
                facility.residents[p.mrn].backOfficeOnly = false;
              } else {
                Object.values(facility.infections || {}).forEach(ip => {
                  if (ip.residentRef.id === p.mrn && ip.status === 'active') {
                    ip.status = 'resolved';
                    ip.resolvedAt = now;
                    ip.updatedAt = now;
                  }
                });
                Object.values(facility.abts || {}).forEach(abt => {
                  if (abt.residentRef.id === p.mrn && abt.status === 'active') {
                    abt.status = 'discontinued';
                    abt.endDate = now;
                    abt.updatedAt = now;
                  }
                });
              }
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
              const choice = choices[p.mrn] || 'merge';
              if (choice === 'merge') {
                if (p.gender) facility.residents[p.mrn].sex = p.gender;
                if (p.admissionDate) facility.residents[p.mrn].admissionDate = p.admissionDate;
                if (p.primaryMD) facility.residents[p.mrn].attendingMD = p.primaryMD;
                if (p.primaryDiagnosis) facility.residents[p.mrn].primaryDiagnosis = p.primaryDiagnosis;
                if (p.allergies) {
                  facility.residents[p.mrn].allergies = p.allergies === "No Known Allergies"
                    ? []
                    : p.allergies.split(",").map((a: string) => a.trim());
                }
                // If importing clinical details for an active resident, ensure flags are cleared
                if (facility.residents[p.mrn].status === 'Active') {
                  facility.residents[p.mrn].isHistorical = false;
                  facility.residents[p.mrn].backOfficeOnly = false;
                }
              } else if (choice === 'replace') {
                facility.residents[p.mrn].sex = p.gender || undefined;
                facility.residents[p.mrn].admissionDate = p.admissionDate || undefined;
                facility.residents[p.mrn].attendingMD = p.primaryMD || undefined;
                facility.residents[p.mrn].primaryDiagnosis = p.primaryDiagnosis || undefined;
                facility.residents[p.mrn].allergies = p.allergies && p.allergies !== "No Known Allergies"
                  ? p.allergies.split(",").map((a: string) => a.trim())
                  : [];
                if (facility.residents[p.mrn].status === 'Active') {
                  facility.residents[p.mrn].isHistorical = false;
                  facility.residents[p.mrn].backOfficeOnly = false;
                }
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

      if (parserMode === 'census') {
        Object.values(facility.residents).forEach(resident => {
          if (resident.isHistorical || resident.backOfficeOnly) return;
          if ((resident.status || '').trim().toLowerCase() !== 'active') return;
          if (importedActiveMrns.has(resident.mrn)) return;

          resident.status = 'Discharged';
          resident.updatedAt = now;
          
          Object.values(facility.infections || {}).forEach(ip => {
            if (ip.residentRef.id === resident.mrn && ip.status === 'active') {
              ip.status = 'resolved';
              ip.resolvedAt = now;
              ip.updatedAt = now;
            }
          });
          Object.values(facility.abts || {}).forEach(abt => {
            if (abt.residentRef.id === resident.mrn && abt.status === 'active') {
              abt.status = 'discontinued';
              abt.endDate = now;
              abt.updatedAt = now;
            }
          });
        });
      }
    });
    onClose();
  };

  const handleCommit = () => commitWithChoices(collisionChoices);

  const handleImportAll = () => {
    const allApplyChoices = Object.fromEntries(
      collisions.map(c => [c.parsed.mrn, 'merge' as const])
    );
    commitWithChoices(allApplyChoices);
  };

  const handleBack = () => {
    setResults(null);
    setNewRows([]);
    setCollisions([]);
    setInvalidRows([]);
    setCollisionChoices({});
  };

  // Filter results by search query
  const filteredNew = newRows.filter(r => 
    !searchQuery || 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.room.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredCollisions = collisions.filter(c => 
    !searchQuery || 
    c.parsed.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.parsed.mrn.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.parsed.room.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600" />
            Import Census
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!results ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                <p className="font-medium mb-1">Instructions:</p>
                <ul className="list-disc list-inside space-y-1 opacity-90">
                  <li>Copy your census table from Excel or the EMR.</li>
                  <li>Paste it directly into the box below.</li>
                  <li>Ensure columns include: <strong>Room, Name (MRN), DOB, Status</strong>.</li>
                  <li>The system will automatically detect new residents and updates.</li>
                </ul>
              </div>
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
              <textarea
                className="w-full h-64 p-4 border border-neutral-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder={parserMode === "census" 
                  ? "Unit: Unit 2   Bed Certification: All\n250-A\tCARRIGAN, PATRICIA (LON202356)\t12/15/1929\tActive\tMLCB1\tSTD\tMedicare A\tPrivate\tOCCUPIED"
                  : "CARRIGAN, PATRICIA (LON202356) \tF \t1/26/2026 \tNo Known Allergies \tDr. Nenad Grlic \tI69.322"}
                value={rawText}
                onChange={e => setRawText(e.target.value)}
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
            </div>
          ) : (
            <div className="space-y-6">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input 
                    type="text" 
                    placeholder="Search results..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-700">{newRows.length}</div>
                  <div className="text-xs font-medium text-emerald-800 uppercase tracking-wide">New Records</div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-700">{collisions.length}</div>
                  <div className="text-xs font-medium text-amber-800 uppercase tracking-wide">Updates / Collisions</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-rose-700">{invalidRows.length}</div>
                  <div className="text-xs font-medium text-rose-800 uppercase tracking-wide">Invalid Rows</div>
                </div>
              </div>

              {/* Invalid rows banner */}
              {duplicateCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-md text-sm flex items-center gap-2 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>Removed {duplicateCount} duplicate record{duplicateCount !== 1 ? 's' : ''} from import.</span>
                </div>
              )}
              {invalidRows.length > 0 && (
                <div className="bg-red-50 border border-red-300 rounded-md p-3 space-y-1">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-bold text-sm">Skipped {invalidRows.length} invalid rows</span>
                  </div>
                  <div className="text-xs text-red-700 font-mono bg-white/50 p-2 rounded max-h-32 overflow-y-auto">
                    {invalidRows.map((r, i) => (
                      <div key={i} className="border-b border-red-100 last:border-0 py-1">
                        Line {r.row}: ({r.reason})
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Residents */}
              {filteredNew.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 mb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    New Residents ({filteredNew.length})
                  </h3>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-neutral-200">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Room</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Name (MRN)</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">DOB</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-neutral-200">
                        {filteredNew.map((r, i) => (
                          <tr key={i} className="hover:bg-neutral-50">
                            <td className="px-4 py-2 text-sm text-neutral-900 font-mono">{r.room}</td>
                            <td className="px-4 py-2 text-sm text-neutral-900 font-medium">
                              {r.name} <span className="text-neutral-500 font-normal">({r.mrn})</span>
                            </td>
                            <td className="px-4 py-2 text-sm text-neutral-500">{r.dob}</td>
                            <td className="px-4 py-2 text-sm text-neutral-500">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    {r.status}
                                </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-neutral-500">{r.unit || "Unassigned"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Collisions */}
              {filteredCollisions.length > 0 && (
                <CollisionReviewStep
                  collisions={filteredCollisions}
                  choices={collisionChoices}
                  onChoiceChange={(mrn, choice) => setCollisionChoices(prev => ({ ...prev, [mrn]: choice }))}
                  onSetAllChoices={(choice) => {
                    const nextChoices = { ...collisionChoices };
                    filteredCollisions.forEach(c => nextChoices[c.parsed.mrn] = choice);
                    setCollisionChoices(nextChoices);
                  }}
                  parserMode={parserMode}
                />
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50"
                >
                  Back
                </button>
                {collisions.length > 0 && (
                  <button
                    onClick={handleImportAll}
                    className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700"
                    title="Import all records, applying all collision updates"
                  >
                    Import All
                  </button>
                )}
                <button
                  onClick={handleCommit}
                  disabled={!allCollisionsResolved}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm Import
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

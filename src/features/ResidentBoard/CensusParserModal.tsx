import React, { useState } from "react";
import { X, Upload, AlertCircle } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { v4 as uuidv4 } from "uuid";

interface Props {
  onClose: () => void;
}

const ROOM_ID_PATTERN = /^\d+(?:-[A-Za-z0-9]+)?$/; // e.g. 101, 101-A

export const CensusParserModal: React.FC<Props> = ({ onClose }) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId } = useFacilityData();
  const [rawText, setRawText] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [parserMode, setParserMode] = useState<"census" | "listing">("census");

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
  };

  const parseListing = () => {
    const lines = rawText.split('\n');
    const records = [];
    let currentRecord: any = null;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      if (line.startsWith('Date:') || line.startsWith('Time:') || line.startsWith('User:') || line.startsWith('Resident:') || line.startsWith('Name\tGender')) {
        continue;
      }

      // Check if line starts a new resident
      // Looks like: "CARRIGAN, PATRICIA (LON202356) \tF \t1/26/2026 \t..."
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
        // Continuation line
        currentRecord.rest += " " + line;
      }
    }
    if (currentRecord) records.push(currentRecord);

    const parsed = [];
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
        status: "Active" // Default for listing report
      });
    }
    setResults(parsed);
  };

  const handleCommit = () => {
    if (!results) return;

    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      const now = new Date().toISOString();

      results.forEach(p => {
        // Parse name into first/last if possible
        let firstName = "";
        let lastName = p.name;
        if (p.name.includes(",")) {
          const [last, first] = p.name.split(",");
          lastName = last.trim();
          firstName = first ? first.trim() : "";
        }

        const validStatus = ["Active", "Discharged", "Deceased"].includes(p.status) 
          ? p.status as "Active" | "Discharged" | "Deceased" 
          : "Active";

        if (p.mrn) {
          if (facility.residents[p.mrn]) {
            // Update existing
            if (p.room) facility.residents[p.mrn].currentRoom = p.room;
            if (p.unit) facility.residents[p.mrn].currentUnit = p.unit;
            if (p.status) facility.residents[p.mrn].status = validStatus;
            if (p.payor) facility.residents[p.mrn].payor = p.payor;
            if (p.admissionDate) facility.residents[p.mrn].admissionDate = p.admissionDate;
            if (p.gender) facility.residents[p.mrn].sex = p.gender;
            if (p.primaryMD) facility.residents[p.mrn].attendingMD = p.primaryMD;
            if (p.primaryDiagnosis) facility.residents[p.mrn].primaryDiagnosis = p.primaryDiagnosis;
            if (p.allergies) {
              facility.residents[p.mrn].allergies = p.allergies === "No Known Allergies" 
                ? [] 
                : p.allergies.split(",").map((a: string) => a.trim());
            }
            facility.residents[p.mrn].updatedAt = now;
          } else {
            // Create new
            facility.residents[p.mrn] = {
              mrn: p.mrn,
              displayName: p.name,
              firstName,
              lastName,
              dob: p.dob || p.admissionDate, // Fallback if DOB missing
              sex: p.gender,
              admissionDate: p.admissionDate,
              currentRoom: p.room,
              currentUnit: p.unit,
              status: validStatus,
              payor: p.payor,
              attendingMD: p.primaryMD,
              primaryDiagnosis: p.primaryDiagnosis,
              allergies: p.allergies && p.allergies !== "No Known Allergies" ? p.allergies.split(",").map((a: string) => a.trim()) : [],
              createdAt: now,
              updatedAt: now,
            };
          }
        } else {
          // Send to quarantine
          const qId = `Q:${uuidv4()}`;
          facility.quarantine[qId] = {
            tempId: qId as `Q:${string}`,
            displayName: p.name || (p.room ? `Room ${p.room}` : "Unassigned"),
            dob: p.dob,
            unitSnapshot: p.unit,
            roomSnapshot: p.room,
            source: "census_missing_mrn",
            rawHint: JSON.stringify(p),
            createdAt: now,
            updatedAt: now,
          };
        }
      });
    });
    onClose();
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
                  ? "Paste your raw census data below. The parser will extract Unit, Room, Name, MRN, DOB, Status, and Payor."
                  : "Paste your Resident Listing Report below. The parser will extract Name, MRN, Gender, Admission Date, Allergies, MD, and Diagnosis."}
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
              <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-md border border-emerald-200">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm font-medium">Found {results.length} valid resident records.</p>
              </div>
              <div className="flex-1 overflow-y-auto border border-neutral-200 rounded-md">
                <table className="min-w-full divide-y divide-neutral-200 text-sm">
                  <thead className="bg-neutral-50 sticky top-0">
                    <tr>
                      {parserMode === "census" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Unit</th>}
                      {parserMode === "census" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Room</th>}
                      <th className="px-4 py-2 text-left font-medium text-neutral-500">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-neutral-500">MRN</th>
                      {parserMode === "census" && <th className="px-4 py-2 text-left font-medium text-neutral-500">DOB</th>}
                      {parserMode === "census" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Status</th>}
                      {parserMode === "census" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Payor</th>}
                      
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Gender</th>}
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Admission Date</th>}
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Allergies</th>}
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">MD</th>}
                      {parserMode === "listing" && <th className="px-4 py-2 text-left font-medium text-neutral-500">Diagnosis</th>}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {results.map((r, i) => (
                      <tr key={i}>
                        {parserMode === "census" && <td className="px-4 py-2 text-neutral-900">{r.unit}</td>}
                        {parserMode === "census" && <td className="px-4 py-2 text-neutral-900">{r.room}</td>}
                        <td className="px-4 py-2 text-neutral-900">{r.name}</td>
                        <td className="px-4 py-2 text-neutral-500 font-mono">{r.mrn || <span className="text-amber-600 font-bold">Missing (Quarantine)</span>}</td>
                        {parserMode === "census" && <td className="px-4 py-2 text-neutral-500">{r.dob}</td>}
                        {parserMode === "census" && <td className="px-4 py-2 text-neutral-500">{r.status}</td>}
                        {parserMode === "census" && <td className="px-4 py-2 text-neutral-500">{r.payor}</td>}
                        
                        {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500">{r.gender}</td>}
                        {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500">{r.admissionDate}</td>}
                        {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500 truncate max-w-[200px]" title={r.allergies}>{r.allergies}</td>}
                        {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500">{r.primaryMD}</td>}
                        {parserMode === "listing" && <td className="px-4 py-2 text-neutral-500">{r.primaryDiagnosis}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setResults(null)}
                  className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCommit}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  Commit to Database
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { X, Save, Pill, TestTube, FileText, Activity } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { ABTCourse } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";

interface Props {
  residentId: string;
  existingAbt?: ABTCourse;
  onClose: () => void;
}

export const AbtCourseModal: React.FC<Props> = ({ residentId, existingAbt, onClose }) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  
  const resident = residentId.startsWith("Q:") ? store.quarantine[residentId] : store.residents[residentId];

  // 1. Core Identity & Status
  const [status, setStatus] = useState<ABTCourse["status"]>(existingAbt?.status || "active");

  // 2. Prescription Details
  const [medication, setMedication] = useState(existingAbt?.medication || "");
  const [medicationClass, setMedicationClass] = useState(existingAbt?.medicationClass || "");
  const [route, setRoute] = useState(existingAbt?.route || "");
  const [frequency, setFrequency] = useState(existingAbt?.frequency || "");
  const [startDate, setStartDate] = useState(existingAbt?.startDate || "");
  const [endDate, setEndDate] = useState(existingAbt?.endDate || "");

  // 3. Clinical Context & Infection Source
  const [indication, setIndication] = useState(existingAbt?.indication || "");
  const [infectionSource, setInfectionSource] = useState(existingAbt?.infectionSource || "");
  const [syndromeCategory, setSyndromeCategory] = useState(existingAbt?.syndromeCategory || "");

  // 4. Lab, Culture & Diagnostics
  const [cultureCollected, setCultureCollected] = useState(existingAbt?.cultureCollected || false);
  const [cultureCollectionDate, setCultureCollectionDate] = useState(existingAbt?.cultureCollectionDate || "");
  const [cultureSource, setCultureSource] = useState(existingAbt?.cultureSource || "");
  const [organismIdentified, setOrganismIdentified] = useState(existingAbt?.organismIdentified || "");
  const [sensitivitySummary, setSensitivitySummary] = useState(existingAbt?.sensitivitySummary || "");

  // 5. System Metadata & Notes
  const [notes, setNotes] = useState(existingAbt?.notes || "");

  const handleSave = () => {
    if (!medication.trim()) {
      alert("Medication name is required.");
      return;
    }

    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      const now = new Date().toISOString();
      const abtId = existingAbt?.id || uuidv4();

      const residentRef = residentId.startsWith("Q:") 
        ? { kind: "quarantine" as const, id: residentId }
        : { kind: "mrn" as const, id: residentId };

      // Capture location snapshot if new
      const locationSnapshot = existingAbt?.locationSnapshot || {
        unit: (resident as any).currentUnit || (resident as any).unitSnapshot,
        room: (resident as any).currentRoom || (resident as any).roomSnapshot
      };

      facility.abts[abtId] = {
        id: abtId,
        residentRef,
        status,
        medication: medication.trim(),
        medicationClass: medicationClass.trim() || undefined,
        route: route.trim() || undefined,
        frequency: frequency.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        indication: indication.trim() || undefined,
        infectionSource: infectionSource.trim() || undefined,
        syndromeCategory: syndromeCategory.trim() || undefined,
        locationSnapshot,
        cultureCollected,
        cultureCollectionDate: cultureCollectionDate || undefined,
        cultureSource: cultureSource.trim() || undefined,
        organismIdentified: organismIdentified.trim() || undefined,
        sensitivitySummary: sensitivitySummary.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: existingAbt?.createdAt || now,
        updatedAt: now,
      };
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Pill className="w-5 h-5 text-emerald-600" />
            {existingAbt ? "Edit ABT Course" : "New ABT Course"}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          {/* 1 & 2: Prescription Details */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <Pill className="w-4 h-4 text-neutral-500" />
              Prescription Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Medication <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={medication}
                  onChange={e => setMedication(e.target.value)}
                  placeholder="e.g., Rocephin, Vancomycin"
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                <select 
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Drug Class</label>
                <input 
                  type="text" 
                  value={medicationClass}
                  onChange={e => setMedicationClass(e.target.value)}
                  placeholder="e.g., Cephalosporin"
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Route</label>
                <input 
                  type="text" 
                  value={route}
                  onChange={e => setRoute(e.target.value)}
                  placeholder="e.g., IV, PO"
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Frequency</label>
                <input 
                  type="text" 
                  value={frequency}
                  onChange={e => setFrequency(e.target.value)}
                  placeholder="e.g., BID, Q12H"
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">End Date</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </section>

          {/* 3. Clinical Context */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <Activity className="w-4 h-4 text-neutral-500" />
              Clinical Context
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Indication</label>
                <input 
                  type="text" 
                  value={indication}
                  onChange={e => setIndication(e.target.value)}
                  placeholder="e.g., Prophylaxis, Treatment"
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Syndrome Category</label>
                <input 
                  type="text" 
                  value={syndromeCategory}
                  onChange={e => setSyndromeCategory(e.target.value)}
                  placeholder="e.g., Respiratory, UTI"
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Infection Source</label>
                <input 
                  type="text" 
                  value={infectionSource}
                  onChange={e => setInfectionSource(e.target.value)}
                  placeholder="e.g., Community-acquired, Healthcare-associated"
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>
            </div>
          </section>

          {/* 4. Lab & Culture */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <TestTube className="w-4 h-4 text-neutral-500" />
              Labs & Cultures
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="cultureCollected"
                  checked={cultureCollected}
                  onChange={e => setCultureCollected(e.target.checked)}
                  className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="cultureCollected" className="text-sm font-medium text-neutral-700">Culture Collected Before ABT</label>
              </div>
              
              {cultureCollected && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Collection Date</label>
                    <input 
                      type="date" 
                      value={cultureCollectionDate}
                      onChange={e => setCultureCollectionDate(e.target.value)}
                      className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Source</label>
                    <input 
                      type="text" 
                      value={cultureSource}
                      onChange={e => setCultureSource(e.target.value)}
                      placeholder="e.g., Urine, Blood, Sputum"
                      className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Organism Identified</label>
                    <input 
                      type="text" 
                      value={organismIdentified}
                      onChange={e => setOrganismIdentified(e.target.value)}
                      placeholder="e.g., E. coli, MRSA"
                      className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Sensitivity Summary</label>
                    <input 
                      type="text" 
                      value={sensitivitySummary}
                      onChange={e => setSensitivitySummary(e.target.value)}
                      placeholder="e.g., Resistant to fluoroquinolones"
                      className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* 5. Notes */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <FileText className="w-4 h-4 text-neutral-500" />
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any additional narrative notes..."
              className="w-full min-h-[100px] border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 resize-y"
            />
          </section>

        </div>
        
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-100 text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            Save ABT Course
          </button>
        </div>
      </div>
    </div>
  );
};

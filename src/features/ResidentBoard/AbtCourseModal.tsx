import React, { useState, useEffect } from "react";
import { X, Save, Activity, TestTube, FileText, Link, Shield } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { ABTCourse, IPEvent } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";

interface Props {
  residentId: string;
  existingAbt?: ABTCourse;
  onClose: () => void;
}

// Dropdown options
const ROUTE_OPTIONS = ["PO", "IV", "IM", "Topical", "Inhaled", "Other"];
const FREQUENCY_OPTIONS = ["Daily", "BID", "TID", "QID", "Q4h", "Q6h", "Q8h", "Q12h", "Weekly", "Other"];
const SYNDROME_CATEGORY_OPTIONS = ["Respiratory", "Urinary", "Skin/Soft Tissue", "GI", "Bloodstream", "Other"];
const INFECTION_SOURCE_OPTIONS = ["Community-Acquired", "Hospital-Acquired", "Facility-Acquired", "Device-Associated", "Unknown"];
const TREATMENT_TYPE_OPTIONS = ["Empiric", "Targeted", "Prophylaxis", "Suppression"];

export const AbtCourseModal: React.FC<Props> = ({ residentId, existingAbt, onClose }) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  
  const resident = residentId.startsWith("Q:") ? store.quarantine[residentId] : store.residents[residentId];
  const activeIpEvents = (Object.values(store.infections) as IPEvent[]).filter(ip => ip.residentRef.id === residentId && ip.status === 'active');

  // Core Schema Fields
  const [status, setStatus] = useState<ABTCourse["status"]>(existingAbt?.status || "active");
  const [medication, setMedication] = useState(existingAbt?.medication || "");
  const [route, setRoute] = useState(existingAbt?.route || "");
  const [frequency, setFrequency] = useState(existingAbt?.frequency || "");
  const [indication, setIndication] = useState(existingAbt?.indication || "");
  const [startDate, setStartDate] = useState(existingAbt?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(existingAbt?.endDate || "");
  const [medicationClass, setMedicationClass] = useState(existingAbt?.medicationClass || "");
  const [syndromeCategory, setSyndromeCategory] = useState(existingAbt?.syndromeCategory || "");
  const [infectionSource, setInfectionSource] = useState(existingAbt?.infectionSource || "");
  const [notes, setNotes] = useState(existingAbt?.notes || "");

  // Extended fields (stored in diagnostics)
  const [treatmentType, setTreatmentType] = useState("");
  const [isDeviceAssociated, setIsDeviceAssociated] = useState(false);
  const [deviceType, setDeviceType] = useState("");
  const [cultureCollected, setCultureCollected] = useState(existingAbt?.cultureCollected || false);
  const [cultureCollectionDate, setCultureCollectionDate] = useState(existingAbt?.cultureCollectionDate || "");
  const [cultureSource, setCultureSource] = useState(existingAbt?.cultureSource || "");
  const [organismIdentified, setOrganismIdentified] = useState(existingAbt?.organismIdentified || "");
  const [sensitivitySummary, setSensitivitySummary] = useState(existingAbt?.sensitivitySummary || "");
  const [bloodWorkResults, setBloodWorkResults] = useState("");
  const [xrayResults, setXrayResults] = useState("");
  const [linkedIpEventId, setLinkedIpEventId] = useState("");

  useEffect(() => {
    if (existingAbt?.diagnostics) {
      const dx = existingAbt.diagnostics as any;
      setTreatmentType(dx.treatmentType || "");
      setIsDeviceAssociated(dx.isDeviceAssociated || false);
      setDeviceType(dx.deviceType || "");
      setBloodWorkResults(dx.bloodWorkResults || "");
      setXrayResults(dx.xrayResults || "");
      setLinkedIpEventId(dx.linkedIpEventId || "");
    }
  }, [existingAbt]);

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

      const locationSnapshot = existingAbt?.locationSnapshot || {
        unit: (resident as any).currentUnit || (resident as any).unitSnapshot,
        room: (resident as any).currentRoom || (resident as any).roomSnapshot
      };

      const diagnostics = {
        treatmentType: treatmentType || undefined,
        isDeviceAssociated: isDeviceAssociated || undefined,
        deviceType: isDeviceAssociated ? deviceType : undefined,
        bloodWorkResults: bloodWorkResults.trim() || undefined,
        xrayResults: xrayResults.trim() || undefined,
        linkedIpEventId: linkedIpEventId || undefined,
      };

      facility.abts[abtId] = {
        id: abtId,
        residentRef,
        status,
        medication: medication.trim(),
        route: route || undefined,
        frequency: frequency || undefined,
        indication: indication.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        medicationClass: medicationClass.trim() || undefined,
        syndromeCategory: syndromeCategory || undefined,
        infectionSource: infectionSource || undefined,
        cultureCollected,
        cultureCollectionDate: cultureCollected ? cultureCollectionDate : undefined,
        cultureSource: cultureCollected ? cultureSource.trim() : undefined,
        organismIdentified: cultureCollected ? organismIdentified.trim() : undefined,
        sensitivitySummary: cultureCollected ? sensitivitySummary.trim() : undefined,
        diagnostics,
        locationSnapshot,
        notes: notes.trim() || undefined,
        createdAt: existingAbt?.createdAt || now,
        updatedAt: now,
      };
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            {existingAbt ? "Edit Antibiotic Course" : "New Antibiotic Course"}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          {/* Core Details */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <Activity className="w-4 h-4 text-neutral-500" />
              Prescription Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                <select value={status} onChange={e => setStatus(e.target.value as any)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Medication <span className="text-red-500">*</span></label>
                <input type="text" value={medication} onChange={e => setMedication(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Route</label>
                <select value={route} onChange={e => setRoute(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <option value="">Select...</option>
                  {ROUTE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Frequency</label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <option value="">Select...</option>
                  {FREQUENCY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Drug Class</label>
                <input type="text" value={medicationClass} onChange={e => setMedicationClass(e.target.value)} placeholder="e.g., Cephalosporin" className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
            </div>
          </section>

          {/* Clinical Context */}
          <section>
             <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <Shield className="w-4 h-4 text-neutral-500" />
              Clinical Context
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Indication</label>
                <input type="text" value={indication} onChange={e => setIndication(e.target.value)} placeholder="e.g., Pneumonia, UTI" className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Syndrome/Category</label>
                <select value={syndromeCategory} onChange={e => setSyndromeCategory(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <option value="">Select...</option>
                  {SYNDROME_CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Infection Source</label>
                <select value={infectionSource} onChange={e => setInfectionSource(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <option value="">Select...</option>
                  {INFECTION_SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Treatment Type</label>
                <select value={treatmentType} onChange={e => setTreatmentType(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <option value="">Select...</option>
                  {TREATMENT_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="md:col-span-3 flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 cursor-pointer">
                  <input type="checkbox" checked={isDeviceAssociated} onChange={e => setIsDeviceAssociated(e.target.checked)} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" />
                  Device-Associated Infection
                </label>
                {isDeviceAssociated && (
                  <input type="text" value={deviceType} onChange={e => setDeviceType(e.target.value)} placeholder="e.g., Urinary Catheter" className="flex-1 border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                )}
              </div>
            </div>
          </section>

          {/* Diagnostics */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <TestTube className="w-4 h-4 text-neutral-500" />
              Diagnostics
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="cultureCollected" checked={cultureCollected} onChange={e => setCultureCollected(e.target.checked)} className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500" />
                <label htmlFor="cultureCollected" className="text-sm font-medium text-neutral-700">Culture Collected</label>
              </div>
              {cultureCollected && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-emerald-100">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Collection Date</label>
                    <input type="date" value={cultureCollectionDate} onChange={e => setCultureCollectionDate(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Source</label>
                    <input type="text" value={cultureSource} onChange={e => setCultureSource(e.target.value)} placeholder="e.g., Urine, Blood, Sputum" className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Organism(s) Identified</label>
                    <input type="text" value={organismIdentified} onChange={e => setOrganismIdentified(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Sensitivity Summary</label>
                    <textarea value={sensitivitySummary} onChange={e => setSensitivitySummary(e.target.value)} rows={2} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 resize-y" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Blood Work Results</label>
                  <textarea value={bloodWorkResults} onChange={e => setBloodWorkResults(e.target.value)} rows={2} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 resize-y" />
                </div>
                 <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">X-Ray / Imaging Results</label>
                  <textarea value={xrayResults} onChange={e => setXrayResults(e.target.value)} rows={2} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 resize-y" />
                </div>
              </div>
            </div>
          </section>
          
          {/* Linkages & Notes */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <Link className="w-4 h-4 text-neutral-500" />
              Linkages & Notes
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Link to Active IP Event</label>
                <select value={linkedIpEventId} onChange={e => setLinkedIpEventId(e.target.value)} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <option value="">None</option>
                  {activeIpEvents.map(ip => (
                    <option key={ip.id} value={ip.id}>
                      {ip.infectionCategory || "Unspecified"} ({ip.organism || "Unknown"}) - Started {new Date(ip.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 resize-y" />
              </div>
            </div>
          </section>

        </div>
        
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-100 text-sm font-medium">
            Cancel
          </button>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium">
            <Save className="w-4 h-4" />
            Save ABT Course
          </button>
        </div>
      </div>
    </div>
  );
};

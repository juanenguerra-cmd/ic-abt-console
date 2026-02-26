import React, { useState, useEffect } from "react";
import { X, Save, Shield, TestTube, FileText, Activity, AlertCircle } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { IPEvent, Outbreak } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";

interface Props {
  residentId: string;
  existingIp?: IPEvent;
  onClose: () => void;
}

const INFECTION_CATEGORY_OPTIONS = [
  "UTI",
  "Pneumonia",
  "Skin/Soft Tissue",
  "GI",
  "Bloodstream",
  "Sepsis",
  "MRSA",
  "VRE",
  "C. diff",
  "Scabies",
  "Lice",
  "Norovirus",
  "Influenza",
  "COVID-19",
  "RSV",
  "Meningitis",
  "Pertussis",
  "Tuberculosis",
  "Varicella (Chickenpox)",
  "Measles",
  "CAUTI",
  "CLABSI",
  "VAP",
  "Surgical Site Infection",
  "Pressure Ulcer",
  "Routine surveillance",
  "Other"
];

const INFECTION_SITE_OPTIONS = ["Urinary Tract", "Respiratory Tract", "Skin", "Soft Tissue", "Bloodstream", "Surgical Site", "GI Tract", "Eye", "Ear", "Other"];
const SOURCE_OPTIONS = ["Urinary", "Respiratory", "Skin/Soft Tissue", "GI", "Bloodstream", "Wound site", "Other"];
const DEVICE_OPTIONS = ["Urinary Catheter", "Central Line", "Feeding Tube", "Other"];

const EBP_ORGANISM_SUGGESTIONS = ["MRSA", "VRE", "ESBL", "CRE", "C. diff", "Acinetobacter", "Pseudomonas"];

const ISOLATION_CATEGORY_MAP: Record<string, string[]> = {
  "Contact": ["MRSA", "VRE", "C. diff", "Scabies", "Lice", "Norovirus", "ESBL", "CRE", "Acinetobacter"],
  "Droplet": ["Influenza", "COVID-19", "RSV", "Meningitis", "Pertussis"],
  "Airborne": ["Tuberculosis", "Varicella (Chickenpox)", "Measles", "COVID-19"],
  "Standard": ["Routine surveillance", "Other"]
};

export const IpEventModal: React.FC<Props> = ({ residentId, existingIp, onClose }) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  
  const resident = residentId.startsWith("Q:") ? store.quarantine[residentId] : store.residents[residentId];
  const activeOutbreaks = (Object.values(store.outbreaks) as Outbreak[]).filter(o => o.status !== 'closed');

  // Core Identity & Status
  const [status, setStatus] = useState<IPEvent["status"]>(existingIp?.status || "active");

  // Extended State (Serialized to Notes)
  const [protocol, setProtocol] = useState<"standard" | "isolation">("standard");
  const [isEbp, setIsEbp] = useState<boolean>(existingIp?.ebp || false);
  const [isolationTypes, setIsolationTypes] = useState<string[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);
  const [onsetDate, setOnsetDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventDetectedDate, setEventDetectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [precautionStartDate, setPrecautionStartDate] = useState(new Date().toISOString().split('T')[0]);

  // Clinical Fields
  const [infectionCategory, setInfectionCategory] = useState(existingIp?.infectionCategory || "");
  const [infectionSite, setInfectionSite] = useState(existingIp?.infectionSite || "");
  const [infectionTags, setInfectionTags] = useState<string[]>([]);
  const [sourceTags, setSourceTags] = useState<string[]>([]);
  
  // Tag Input State
  const [organismInput, setOrganismInput] = useState("");
  
  // Dates
  const [specimenCollectedDate, setSpecimenCollectedDate] = useState(existingIp?.specimenCollectedDate || "");
  const [labResultDate, setLabResultDate] = useState(existingIp?.labResultDate || "");

  // Notes
  const [notes, setNotes] = useState("");
  const [outbreakId, setOutbreakId] = useState(existingIp?.outbreakId || "");

  // Restore State on Mount
  useEffect(() => {
    if (existingIp) {
      if (existingIp.isolationType) setIsolationTypes(existingIp.isolationType.split(",").map(s => s.trim()));
      if (existingIp.organism) setInfectionTags(existingIp.organism.split(",").map(s => s.trim()));
      if (existingIp.sourceOfInfection) setSourceTags(existingIp.sourceOfInfection.split(",").map(s => s.trim()));
      if (existingIp.outbreakId) setOutbreakId(existingIp.outbreakId);
      
      if (existingIp.ebp) setIsEbp(true);
      if (existingIp.isolationType) setProtocol("isolation");
      else setProtocol("standard");

      if (existingIp.notes) {
        try {
          const match = existingIp.notes.match(/--- EXTENDED DATA ---\n(.*)/s);
          if (match) {
            const ext = JSON.parse(match[1]);
            if (ext.protocol && ext.protocol !== "ebp") setProtocol(ext.protocol);
            if (ext.deviceTypes) setDeviceTypes(ext.deviceTypes);
            if (ext.onsetDate) setOnsetDate(ext.onsetDate);
            if (ext.eventDetectedDate) setEventDetectedDate(ext.eventDetectedDate);
            if (ext.precautionStartDate) setPrecautionStartDate(ext.precautionStartDate);
            setNotes(existingIp.notes.replace(/\n\n--- EXTENDED DATA ---\n.*/s, ""));
          } else {
            setNotes(existingIp.notes);
          }
        } catch (e) {
          setNotes(existingIp.notes);
        }
      }
    }
  }, [existingIp]);

  // Cascading Logic 1: Protocol Change
  const updateIpProtocol = (newProtocol: "standard" | "isolation") => {
    setProtocol(newProtocol);
    if (newProtocol === "standard") {
      setIsolationTypes([]);
      setInfectionCategory("Routine surveillance");
      setDeviceTypes([]);
    } else if (newProtocol === "isolation") {
      setIsolationTypes(["Contact"]);
      setInfectionCategory("");
      setDeviceTypes([]);
    }
  };

  // Cascading Logic 2: Isolation Type Change
  const toggleIpIsolationType = (type: string) => {
    let newTypes = isolationTypes.includes(type)
      ? isolationTypes.filter(t => t !== type)
      : [...isolationTypes, type];
    
    setIsolationTypes(newTypes);

    if (isEbp && newTypes.length > 0) {
      const primary = newTypes[0];
      if (primary === "Device") setInfectionCategory("Device-associated");
      else if (primary === "Wound") {
        setInfectionCategory("Wound infection");
        if (!sourceTags.includes("Wound site")) setSourceTags([...sourceTags, "Wound site"]);
      }
      else if (primary === "MDRO") setInfectionCategory("MDRO colonization/infection");
      else setInfectionCategory("");
    }
  };

  // Cascading Logic 3: Category Change (Auto-population)
  const updateIpCategory = (cat: string) => {
    setInfectionCategory(cat);
    
    if (infectionTags.length === 0) {
      if (["MRSA", "VRE", "ESBL", "CRE", "C. diff"].includes(cat)) {
        setInfectionTags([cat]);
      } else if (cat === "COVID-19") {
        setInfectionTags(["SARS-CoV-2"]);
      } else if (cat === "Influenza") {
        setInfectionTags(["Influenza Virus"]);
      }
    }

    if (sourceTags.length === 0) {
      if (cat === "MRSA") setSourceTags(["Skin/Soft Tissue"]);
      if (cat === "C. diff") setSourceTags(["GI"]);
      if (cat === "COVID-19" || cat === "Influenza" || cat === "RSV") setSourceTags(["Respiratory"]);
    }
  };

  const toggleDeviceType = (type: string) => {
    setDeviceTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };

  const toggleSourceTag = (source: string) => {
    setSourceTags(prev => prev.includes(source) ? prev.filter(t => t !== source) : [...prev, source]);
  };

  const addOrganismTag = (tag: string) => {
    if (tag.trim() && !infectionTags.includes(tag.trim())) {
      setInfectionTags([...infectionTags, tag.trim()]);
    }
    setOrganismInput("");
  };

  const removeOrganismTag = (tag: string) => {
    setInfectionTags(infectionTags.filter(t => t !== tag));
  };

  // Dynamic Options
  const categoryOptions = protocol === "isolation" && isolationTypes.length > 0
    ? ISOLATION_CATEGORY_MAP[isolationTypes[0]] || []
    : [];

  const organismSuggestions = isEbp 
    ? EBP_ORGANISM_SUGGESTIONS 
    : (protocol === "isolation" && infectionCategory && ["MRSA", "VRE", "ESBL", "CRE", "C. diff"].includes(infectionCategory) ? [infectionCategory] : []);

  const handleSave = () => {
    updateDB((draft) => {
      const facility = draft.data.facilityData[activeFacilityId];
      const now = new Date().toISOString();
      const ipId = existingIp?.id || uuidv4();

      const residentRef = residentId.startsWith("Q:") 
        ? { kind: "quarantine" as const, id: residentId }
        : { kind: "mrn" as const, id: residentId };

      const locationSnapshot = existingIp?.locationSnapshot || {
        unit: (resident as any).currentUnit || (resident as any).unitSnapshot,
        room: (resident as any).currentRoom || (resident as any).roomSnapshot
      };

      const extData = {
        protocol,
        deviceTypes,
        onsetDate,
        eventDetectedDate,
        precautionStartDate
      };
      
      const finalNotes = notes.trim() 
        ? notes.trim() + `\n\n--- EXTENDED DATA ---\n${JSON.stringify(extData)}`
        : `--- EXTENDED DATA ---\n${JSON.stringify(extData)}`;

      facility.infections[ipId] = {
        id: ipId,
        residentRef,
        status,
        infectionCategory: infectionCategory.trim() || undefined,
        infectionSite: infectionSite.trim() || undefined,
        sourceOfInfection: sourceTags.join(", ") || undefined,
        isolationType: isolationTypes.join(", ") || undefined,
        ebp: isEbp,
        organism: infectionTags.join(", ") || undefined,
        specimenCollectedDate: specimenCollectedDate || undefined,
        labResultDate: labResultDate || undefined,
        outbreakId: outbreakId || undefined,
        locationSnapshot,
        notes: finalNotes,
        createdAt: existingIp?.createdAt || now,
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
            <Shield className="w-5 h-5 text-amber-600" />
            {existingIp ? "Edit Infection Event" : "New Infection Event"}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-8">
          
          {/* Protocol Selection */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <Activity className="w-4 h-4 text-neutral-500" />
              Protocol & Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Protocol Type</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                    <input type="radio" checked={protocol === "standard"} onChange={() => updateIpProtocol("standard")} className="text-amber-600 focus:ring-amber-500" />
                    Standard Precautions
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                    <input type="radio" checked={protocol === "isolation"} onChange={() => updateIpProtocol("isolation")} className="text-amber-600 focus:ring-amber-500" />
                    Isolation (Transmission-based)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer mt-2 pt-2 border-t border-neutral-200">
                    <input type="checkbox" checked={isEbp} onChange={(e) => setIsEbp(e.target.checked)} className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500" />
                    Enhanced Barrier Precautions (EBP)
                  </label>
                </div>
                <p className="mt-2 text-xs text-neutral-500">Determines form layout and required fields.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                <select 
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="active">Active</option>
                  <option value="resolved">Resolved</option>
                  <option value="historical">Historical</option>
                </select>
              </div>
            </div>
          </section>

          {/* Dynamic Isolation Types */}
          {(protocol !== "standard" || isEbp) && (
            <section className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
              <h3 className="text-sm font-bold text-neutral-900 mb-3">
                {isEbp ? "EBP Indication" : "Isolation Type"}
              </h3>
              <div className="flex flex-wrap gap-3">
                {(isEbp ? ["Device", "Wound", "MDRO", "Other"] : ["Contact", "Droplet", "Airborne", "Contact/Droplet"]).map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer bg-white px-3 py-1.5 rounded border border-neutral-200 shadow-sm hover:border-amber-300">
                    <input 
                      type="checkbox" 
                      checked={isolationTypes.includes(type)}
                      onChange={() => toggleIpIsolationType(type)}
                      className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                    />
                    {type}
                  </label>
                ))}
              </div>

              {/* Device Type Cascade */}
              {isEbp && isolationTypes.includes("Device") && (
                <div className="mt-4 pt-4 border-t border-amber-200/50">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Device Types</label>
                  <div className="flex flex-wrap gap-3">
                    {DEVICE_OPTIONS.map(device => (
                      <label key={device} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={deviceTypes.includes(device)}
                          onChange={() => toggleDeviceType(device)}
                          className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                        />
                        {device}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Classification & Source */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <AlertCircle className="w-4 h-4 text-neutral-500" />
              Infection Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Infection Category</label>
                <select 
                  value={infectionCategory}
                  onChange={e => updateIpCategory(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">Select Category...</option>
                  {INFECTION_CATEGORY_OPTIONS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Infection Site</label>
                <select
                  value={infectionSite}
                  onChange={e => setInfectionSite(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">Select Site...</option>
                  {INFECTION_SITE_OPTIONS.map(site => <option key={site} value={site}>{site}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Organism(s)</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {infectionTags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        {tag}
                        <button onClick={() => removeOrganismTag(tag)} className="hover:text-amber-900"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                  <input 
                    type="text" 
                    value={organismInput}
                    onChange={e => setOrganismInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOrganismTag(organismInput); } }}
                    placeholder="Type organism and press Enter..."
                    className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                  />
                  {organismSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="text-xs text-neutral-500">Suggestions:</span>
                      {organismSuggestions.filter(s => !infectionTags.includes(s)).map(sugg => (
                        <button key={sugg} onClick={() => addOrganismTag(sugg)} className="text-xs text-amber-600 hover:text-amber-800 hover:underline">
                          +{sugg}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-neutral-700 mb-2">Source of Infection</label>
                <div className="flex flex-wrap gap-3">
                  {SOURCE_OPTIONS.map(source => (
                    <label key={source} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer bg-neutral-50 px-3 py-1.5 rounded border border-neutral-200 hover:bg-neutral-100">
                      <input 
                        type="checkbox" 
                        checked={sourceTags.includes(source)}
                        onChange={() => toggleSourceTag(source)}
                        className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                      />
                      {source}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Timelines & Labs */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <TestTube className="w-4 h-4 text-neutral-500" />
              Timeline & Laboratory
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Onset Date</label>
                <input 
                  type="date" 
                  value={onsetDate}
                  onChange={e => setOnsetDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Detected Date</label>
                <input 
                  type="date" 
                  value={eventDetectedDate}
                  onChange={e => setEventDetectedDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Precaution Start</label>
                <input 
                  type="date" 
                  value={precautionStartDate}
                  onChange={e => setPrecautionStartDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Specimen Collected</label>
                <input 
                  type="date" 
                  value={specimenCollectedDate}
                  onChange={e => setSpecimenCollectedDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Lab Result Date</label>
                <input 
                  type="date" 
                  value={labResultDate}
                  onChange={e => setLabResultDate(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </section>

          {/* Linkages */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <AlertCircle className="w-4 h-4 text-neutral-500" />
              Linkages
            </h3>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Link to Active Outbreak</label>
              <select
                value={outbreakId}
                onChange={e => setOutbreakId(e.target.value)}
                className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">None</option>
                {activeOutbreaks.map(o => (
                    <option key={o.id} value={o.id}>
                        {o.title} ({o.pathogen || 'Unknown'}) - Started {new Date(o.startDate).toLocaleDateString()}
                    </option>
                ))}
              </select>
            </div>
          </section>

          {/* Notes */}
          <section>
            <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2 border-b pb-1">
              <FileText className="w-4 h-4 text-neutral-500" />
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any additional narrative notes..."
              className="w-full min-h-[100px] border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500 resize-y"
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
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium"
          >
            <Save className="w-4 h-4" />
            Save IP Event
          </button>
        </div>
      </div>
    </div>
  );
};

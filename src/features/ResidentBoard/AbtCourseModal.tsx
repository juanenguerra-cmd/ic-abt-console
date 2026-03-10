import React, { useState, useEffect, useMemo } from "react";
import { X, Save, Activity, TestTube, FileText, Link, Shield, AlertTriangle, Trash2 } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { ABTCourse, IPEvent } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import { detectMedicationClass, MEDICATION_CLASS_OPTIONS } from "../../utils/medicationClassMap";
import { resolveMedication, MedicationMatch, MEDICATION_LIBRARY } from "../../utils/medicationLibrary";
import { parseAbtString, ParsedABT } from "../../utils/abtParser";
import { todayLocalDateInputValue } from '../../lib/dateUtils';

interface Props {
  residentId: string;
  existingAbt?: ABTCourse;
  onClose: () => void;
  onDelete?: () => void;
}

// Dropdown options
const ROUTE_OPTIONS = ["PO", "IV", "IM", "Topical", "Inhaled", "Other"];
const FREQUENCY_OPTIONS = ["Daily", "BID", "TID", "QID", "Q4h", "Q6h", "Q8h", "Q12h", "Weekly", "Other"];
const SYNDROME_CATEGORY_OPTIONS = ["Respiratory", "Urinary", "Skin/Soft Tissue", "GI", "Bloodstream", "Other"];
const INFECTION_SOURCE_OPTIONS = ["Community-Acquired", "Hospital-Acquired", "Facility-Acquired", "Device-Associated", "Prior Admission", "Unknown"];
const TREATMENT_TYPE_OPTIONS = ["Empiric", "Targeted", "Prophylaxis", "Suppression"];

export const AbtCourseModal: React.FC<Props> = ({ residentId, existingAbt, onClose, onDelete }) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const navigate = useNavigate();
  
  const resident = residentId.startsWith("Q:") ? store.quarantine[residentId] : store.residents[residentId];
  const activeIpEvents = (Object.values(store.infections) as IPEvent[]).filter(ip => ip.residentRef.id === residentId && ip.status === 'active');

  // Core Schema Fields
  const [status, setStatus] = useState<ABTCourse["status"]>(existingAbt?.status || "active");
  const [medication, setMedication] = useState(existingAbt?.medication || "");
  const [medicationId, setMedicationId] = useState(existingAbt?.medicationId || "");
  const [enteredMedicationText, setEnteredMedicationText] = useState(existingAbt?.enteredMedicationText || "");
  const [dose, setDose] = useState(existingAbt?.dose || "");
  const [doseUnit, setDoseUnit] = useState(existingAbt?.doseUnit || "");
  const [route, setRoute] = useState(
    existingAbt?.route && !ROUTE_OPTIONS.includes(existingAbt.route) ? "Other" : (existingAbt?.route || "")
  );
  const [routeOther, setRouteOther] = useState(
    existingAbt?.route && !ROUTE_OPTIONS.includes(existingAbt.route) ? existingAbt.route : ""
  );
  const [frequency, setFrequency] = useState(
    existingAbt?.frequency && !FREQUENCY_OPTIONS.includes(existingAbt.frequency) ? "Other" : (existingAbt?.frequency || "")
  );
  const [frequencyOther, setFrequencyOther] = useState(
    existingAbt?.frequency && !FREQUENCY_OPTIONS.includes(existingAbt.frequency) ? existingAbt.frequency : ""
  );
  const [indication, setIndication] = useState(existingAbt?.indication || "");
  const [startDate, setStartDate] = useState(existingAbt?.startDate || todayLocalDateInputValue());
  const [endDate, setEndDate] = useState(existingAbt?.endDate || "");
  const [medicationClass, setMedicationClass] = useState(existingAbt?.medicationClass || "");
  const [syndromeCategory, setSyndromeCategory] = useState(existingAbt?.syndromeCategory || "");
  const [infectionSource, setInfectionSource] = useState(existingAbt?.infectionSource || "");
  const [notes, setNotes] = useState(existingAbt?.notes || "");

  // Parsing state
  const [parseConfidence, setParseConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  const [parseIssues, setParseIssues] = useState<string[]>([]);
  const [showParseWarning, setShowParseWarning] = useState(false);

  // Handle medication change with parsing
  const handleMedicationChange = (text: string) => {
    setMedication(text);
    setEnteredMedicationText(text);
    
    // Auto-resolve if user types enough
    if (text.length > 2) {
      const match = resolveMedication(text);
      if (match) {
        setMedicationId(match.medication.id);
        // Maybe auto-fill class?
        if (!medicationClass) {
          setMedicationClass(match.medication.class);
          setClassAutoDetected(true);
        }
      } else {
        setMedicationId("");
      }
    }
  };

  // Handle paste/import
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    const parsed = parseAbtString(text);
    
    setMedication(parsed.medicationName);
    setEnteredMedicationText(parsed.enteredText);
    if (parsed.medicationId) setMedicationId(parsed.medicationId);
    if (parsed.dose) setDose(parsed.dose);
    if (parsed.doseUnit) setDoseUnit(parsed.doseUnit);
    if (parsed.route) {
        if (ROUTE_OPTIONS.includes(parsed.route)) {
            setRoute(parsed.route);
        } else {
            setRoute("Other");
            setRouteOther(parsed.route);
        }
    }
    if (parsed.frequency) {
        if (FREQUENCY_OPTIONS.includes(parsed.frequency)) {
            setFrequency(parsed.frequency);
        } else {
            setFrequency("Other");
            setFrequencyOther(parsed.frequency);
        }
    }

    setParseConfidence(parsed.confidence);
    setParseIssues(parsed.issues);
    setShowParseWarning(parsed.confidence !== 'high');
    
    // Auto-detect class based on parsed name
    const detectedClass = detectMedicationClass(parsed.medicationName);
    if (detectedClass) {
        setMedicationClass(detectedClass);
        setClassAutoDetected(true);
    }
  };

  // Legacy Migration: Auto-parse existing records if they lack structured data
  useEffect(() => {
    if (existingAbt && !existingAbt.medicationId && existingAbt.medication) {
      // This is a legacy record
      const parsed = parseAbtString(existingAbt.medication);
      
      // Only auto-fill if we haven't already modified the state (simple check: medication state matches existing)
      if (medication === existingAbt.medication) {
         setMedication(parsed.medicationName);
         setEnteredMedicationText(existingAbt.medication); // Preserve original
         if (parsed.medicationId) setMedicationId(parsed.medicationId);
         if (parsed.dose) setDose(parsed.dose);
         if (parsed.doseUnit) setDoseUnit(parsed.doseUnit);
         
         // Only override route/freq if they were empty or "Other" in legacy
         if (!route || route === "Other") {
            if (parsed.route && ROUTE_OPTIONS.includes(parsed.route)) setRoute(parsed.route);
            else if (parsed.route) { setRoute("Other"); setRouteOther(parsed.route); }
         }
         
         if (!frequency || frequency === "Other") {
            if (parsed.frequency && FREQUENCY_OPTIONS.includes(parsed.frequency)) setFrequency(parsed.frequency);
            else if (parsed.frequency) { setFrequency("Other"); setFrequencyOther(parsed.frequency); }
         }

         setParseConfidence(parsed.confidence);
         setParseIssues(parsed.issues);
         setShowParseWarning(true); // Always show warning for legacy migration so user reviews it
         
         const detectedClass = detectMedicationClass(parsed.medicationName);
         if (detectedClass && !medicationClass) {
             setMedicationClass(detectedClass);
             setClassAutoDetected(true);
         }
      }
    }
  }, [existingAbt]);

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

  // Guard-rail override acknowledgements
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [duplicateOverrideReason, setDuplicateOverrideReason] = useState("");
  const [allergyAcknowledged, setAllergyAcknowledged] = useState(false);
  const [noIndicationAcknowledged, setNoIndicationAcknowledged] = useState(false);

  // G1: Duplicate active ABT detection
  const duplicateWarning = useMemo(() => {
    if (!medication.trim()) return null;
    const medLower = medication.trim().toLowerCase();
    const duplicate = Object.values(store.abts as Record<string, ABTCourse>).find(
      (a) =>
        a.id !== existingAbt?.id &&
        a.residentRef.id === residentId &&
        a.status === "active" &&
        // Check medicationId first if available, otherwise fallback to name
        ((medicationId && a.medicationId === medicationId) || 
         (!medicationId && a.medication.toLowerCase() === medLower))
    );
    return duplicate
      ? `An active course of "${duplicate.medication}" already exists for this resident (started ${duplicate.startDate || "unknown date"}). Confirm this is intentional.`
      : null;
  }, [medication, medicationId, store.abts, residentId, existingAbt]);

  // G2: Allergy conflict check
  const allergyWarning = useMemo(() => {
    const res = store.residents[residentId];
    if (!res?.allergies?.length || !medication.trim()) return null;
    const medTokens = medication.trim().toLowerCase().split(/[\s/,]+/);
    const classTokens = medicationClass ? medicationClass.toLowerCase().split(/[\s/,]+/) : [];
    const match = res.allergies.find((allergen) => {
      const aLower = allergen.toLowerCase();
      return medTokens.some((t) => aLower.includes(t) || t.includes(aLower)) ||
        classTokens.some((t) => aLower.includes(t) || t.includes(aLower));
    });
    return match
      ? `Possible allergy conflict: resident has a documented allergy to "${match}". Verify with prescriber before saving.`
      : null;
  }, [medication, medicationClass, store.residents, residentId]);

  // G3: Missing indication / syndrome category
  const noIndicationWarning = useMemo(() => {
    if (indication.trim() || syndromeCategory) return null;
    return "No indication or syndrome category is documented. Antibiotic stewardship requires a clinical rationale for every course.";
  }, [indication, syndromeCategory]);

  // Auto-detect medication class from medication name when the field is blank or was auto-set
  const [classAutoDetected, setClassAutoDetected] = useState(!existingAbt?.medicationClass);
  useEffect(() => {
    if (!classAutoDetected) return;
    const detected = detectMedicationClass(medication);
    if (detected) setMedicationClass(detected);
  }, [medication, classAutoDetected]);

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

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!medication.trim()) {
      alert("Medication name is required.");
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      alert("End date cannot be before start date.");
      return;
    }
    
    // G4: Low confidence parse / missing library match check
    if (showParseWarning && !medicationId) {
        if (!confirm("The medication could not be confidently matched to the library. Are you sure you want to save this as a custom medication?")) {
            return;
        }
    }

    if (duplicateWarning && (!duplicateAcknowledged || !duplicateOverrideReason.trim())) {
      alert("Please acknowledge the duplicate ABT warning and provide an override reason before saving.");
      return;
    }
    if (allergyWarning && !allergyAcknowledged) {
      alert("Please acknowledge the allergy conflict warning before saving.");
      return;
    }
    if (noIndicationWarning && !noIndicationAcknowledged) {
      alert("Please acknowledge the missing indication warning before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const newAbtId = uuidv4();
      await updateDB((draft) => {
        const facility = draft.data.facilityData[activeFacilityId];
        const now = new Date().toISOString();
        const abtId = existingAbt?.id || newAbtId;

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

        const canonicalName = medicationId 
            ? MEDICATION_LIBRARY.find(m => m.id === medicationId)?.name || medication.trim()
            : medication.trim();

        facility.abts[abtId] = {
          id: abtId,
          residentRef,
          status,
          medication: canonicalName,
          medicationId: medicationId || undefined,
          enteredMedicationText: enteredMedicationText || (existingAbt ? existingAbt.medication : medication.trim()),
          dose: dose || undefined,
          doseUnit: doseUnit || undefined,
          route: (route === "Other" ? routeOther.trim() || "Other" : route) || undefined,
          frequency: (frequency === "Other" ? frequencyOther.trim() || "Other" : frequency) || undefined,
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
      }, { action: existingAbt ? 'update' : 'create', entityType: 'ABTCourse', entityId: existingAbt?.id || newAbtId });

      onClose();
    } catch (err) {
      // Error handled by updateDB
    } finally {
      setIsSaving(false);
    }
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
          {existingAbt && !existingAbt.medicationId && showParseWarning && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-blue-900">Legacy Record Migration</h4>
                  <p className="text-sm text-blue-800 mt-1">
                    This record has been automatically parsed into the new structured format. 
                    Please review the fields below, especially <strong>Dose</strong> and <strong>Frequency</strong>, before saving.
                  </p>
                  <div className="mt-2 text-xs text-blue-700 font-mono bg-blue-100 p-2 rounded">
                    Original: {existingAbt.medication}
                  </div>
                </div>
              </div>
            </div>
          )}

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
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Medication Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={medication}
                    onChange={(e) => handleMedicationChange(e.target.value)}
                    onPaste={handlePaste}
                    placeholder="e.g. Amoxicillin (Paste full order to auto-parse)"
                    className={`w-full border rounded-md p-2 text-sm pr-20 focus:ring-emerald-500 focus:border-emerald-500 ${
                      medicationId ? "border-emerald-500 bg-emerald-50" : "border-neutral-300"
                    }`}
                  />
                  <div className="absolute right-2 top-1.5 flex items-center gap-1">
                    {medicationId && (
                        <Shield className="w-4 h-4 text-emerald-600" />
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            const parsed = parseAbtString(medication);
                            setMedication(parsed.medicationName);
                            setEnteredMedicationText(parsed.enteredText);
                            if (parsed.medicationId) setMedicationId(parsed.medicationId);
                            if (parsed.dose) setDose(parsed.dose);
                            if (parsed.doseUnit) setDoseUnit(parsed.doseUnit);
                            
                            if (parsed.route) {
                                if (ROUTE_OPTIONS.includes(parsed.route)) {
                                    setRoute(parsed.route);
                                } else {
                                    setRoute("Other");
                                    setRouteOther(parsed.route);
                                }
                            }
                            
                            if (parsed.frequency) {
                                if (FREQUENCY_OPTIONS.includes(parsed.frequency)) {
                                    setFrequency(parsed.frequency);
                                } else {
                                    setFrequency("Other");
                                    setFrequencyOther(parsed.frequency);
                                }
                            }
                            
                            setParseConfidence(parsed.confidence);
                            setParseIssues(parsed.issues);
                            setShowParseWarning(parsed.confidence !== 'high');

                            const detectedClass = detectMedicationClass(parsed.medicationName);
                            if (detectedClass) {
                                setMedicationClass(detectedClass);
                                setClassAutoDetected(true);
                            }
                        }}
                        className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-2 py-1 rounded border border-neutral-300"
                        title="Attempt to parse medication string"
                    >
                        Parse
                    </button>
                  </div>
                </div>
                {medicationId && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center">
                    Matched: {MEDICATION_LIBRARY.find(m => m.id === medicationId)?.name || medicationId}
                  </p>
                )}
                {showParseWarning && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    <p className="font-semibold flex items-center">
                      <AlertTriangle className="w-3 h-3 mr-1" /> Low Confidence Parse
                    </p>
                    <ul className="list-disc list-inside pl-1 mt-1">
                      {parseIssues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Drug Class
                  {classAutoDetected && medicationClass && (
                    <span className="ml-1.5 text-xs font-normal text-emerald-600">(auto-detected)</span>
                  )}
                </label>
                <select
                  value={medicationClass}
                  onChange={(e) => {
                    setClassAutoDetected(false);
                    setMedicationClass(e.target.value);
                  }}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select...</option>
                  {MEDICATION_CLASS_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Dose</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-2/3 border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    value={doseUnit}
                    onChange={(e) => setDoseUnit(e.target.value)}
                    placeholder="Unit"
                    className="w-1/3 border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Route</label>
                <select
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select...</option>
                  {ROUTE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {route === "Other" && (
                  <input
                    type="text"
                    value={routeOther}
                    onChange={(e) => setRouteOther(e.target.value)}
                    placeholder="Specify route..."
                    className="mt-1.5 w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select...</option>
                  {FREQUENCY_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {frequency === "Other" && (
                  <input
                    type="text"
                    value={frequencyOther}
                    onChange={(e) => setFrequencyOther(e.target.value)}
                    placeholder="Specify frequency..."
                    className="mt-1.5 w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                  />
                )}
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
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/', { state: { openModal: 'precautions' } });
                  }}
                  className="mt-2 text-sm text-emerald-700 hover:text-emerald-900 underline"
                >
                  View Active Precautions List
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-emerald-500 focus:border-emerald-500 resize-y" />
              </div>
            </div>
          </section>

        </div>

        {/* Guard-Rail Warnings */}
        {(allergyWarning || duplicateWarning || noIndicationWarning) && (
          <div className="px-6 pb-4 space-y-2 shrink-0">
            {allergyWarning && (
              <div className="rounded-lg border border-red-700 bg-red-600 p-4 text-white shadow-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-white mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-lg font-bold">CRITICAL SAFETY ALERT: Allergy Conflict</p>
                    <p className="text-sm opacity-90 font-medium leading-relaxed">{allergyWarning}</p>
                    <label className="mt-3 flex items-center gap-2 text-sm font-bold cursor-pointer bg-white/10 p-2 rounded hover:bg-white/20 transition-colors">
                      <input type="checkbox" checked={allergyAcknowledged} onChange={e => setAllergyAcknowledged(e.target.checked)} className="w-4 h-4 rounded border-white/30 text-red-600 focus:ring-white" />
                      I HAVE VERIFIED THIS WITH THE PRESCRIBER AND CONFIRM THE ORDER IS INTENTIONAL
                    </label>
                  </div>
                </div>
              </div>
            )}
            {duplicateWarning && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">Duplicate Active ABT</p>
                    <p className="text-sm text-amber-700">{duplicateWarning}</p>
                    <div className="mt-2 space-y-2">
                      <label className="flex items-center gap-2 text-sm text-amber-800 cursor-pointer">
                        <input type="checkbox" checked={duplicateAcknowledged} onChange={e => setDuplicateAcknowledged(e.target.checked)} className="rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
                        I confirm this is a separate, intentional course.
                      </label>
                      {duplicateAcknowledged && (
                        <div className="animate-in fade-in slide-in-from-top-1">
                          <label className="block text-xs font-bold text-amber-700 mb-1 uppercase tracking-wider">Clinical Justification / Override Reason *</label>
                          <textarea
                            value={duplicateOverrideReason}
                            onChange={e => setDuplicateOverrideReason(e.target.value)}
                            placeholder="Explain why a second course of the same medication is required..."
                            className="w-full border border-amber-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500 bg-white"
                            rows={2}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {noIndicationWarning && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800">Missing Clinical Indication</p>
                    <p className="text-sm text-amber-700">{noIndicationWarning}</p>
                    <label className="mt-2 flex items-center gap-2 text-sm text-amber-800 cursor-pointer">
                      <input type="checkbox" checked={noIndicationAcknowledged} onChange={e => setNoIndicationAcknowledged(e.target.checked)} className="rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
                      I acknowledge the indication is not yet documented and will update the record.
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-between items-center shrink-0">
          {existingAbt && onDelete && (
            <button 
              onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 bg-red-50 rounded-md hover:bg-red-100 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onClose} className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-100 text-sm font-medium">
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 text-sm font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save ABT Course"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

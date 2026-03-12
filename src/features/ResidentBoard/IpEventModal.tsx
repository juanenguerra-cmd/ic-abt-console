import React, { useState, useEffect, useMemo } from "react";
import { X, Save, Shield, TestTube, FileText, Activity, AlertCircle, Sparkles, Plus } from "lucide-react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { IPEvent, IPEventIndication, IndicationCategory, ABTCourse, Outbreak, ShiftLogEntry } from "../../domain/models";
import { v4 as uuidv4 } from "uuid";
import { checkCauti, checkCdiffLabId, NhsnResult } from "../../utils/nhsnCriteria";
import { NhsnCriteriaPanel } from "../../components/NhsnCriteriaPanel";
import { useHashtagShiftLogSync } from "../../hooks/useHashtagShiftLogSync";
import { useNavigate } from "react-router-dom";
import { extractIpEventFromText } from "../../services/geminiService";
import { todayLocalDateInputValue } from '../../lib/dateUtils';

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
  "Airborne": ["Tuberculosis", "Varicella (Chickenpox)", "Measles", "COVID-19"]
};

export const IpEventModal: React.FC<Props> = ({ residentId, existingIp, onClose }) => {
  const { updateDB } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const navigate = useNavigate();
  
  const resident = residentId.startsWith("Q:") ? store.quarantine[residentId] : store.residents[residentId];
  const activeOutbreaks = (Object.values(store.outbreaks) as Outbreak[]).filter(o => o.status !== 'closed');

  const residentForSync = {
    id: residentId,
    mrn: residentId.startsWith("Q:") ? residentId : residentId,
    displayName: (resident as any)?.displayName ?? '',
    currentUnit: (resident as any)?.currentUnit ?? (resident as any)?.unitSnapshot,
  };

  const currentShift: ShiftLogEntry['shift'] =
    new Date().getHours() >= 7 && new Date().getHours() < 19 ? 'Day' : 'Night';

  const [showLineListPrompt, setShowLineListPrompt] = useState<{ symptomClass: 'resp' | 'gi' } | null>(null);

  const { syncHashtagToShiftLog } = useHashtagShiftLogSync({
    resident: residentForSync,
    currentShift,
  });

  // Core Identity & Status
  const [status, setStatus] = useState<IPEvent["status"]>(existingIp?.status || "active");

  // Extended State (Serialized to Notes)
  const [protocol, setProtocol] = useState<"isolation" | "ebp">(existingIp?.ebp ? "ebp" : "isolation");
  const [isolationTypes, setIsolationTypes] = useState<string[]>([]);
  /** Structured indications / risk factors for EBP events (replaces old flat deviceTypes). */
  const [indications, setIndications] = useState<IPEventIndication[]>([]);
  const [sourceOther, setSourceOther] = useState("");
  const [labOutcomeNote, setLabOutcomeNote] = useState("");
  const [onsetDate, setOnsetDate] = useState(todayLocalDateInputValue());
  const [eventDetectedDate, setEventDetectedDate] = useState(todayLocalDateInputValue());
  const [precautionStartDate, setPrecautionStartDate] = useState(todayLocalDateInputValue());

  // --- Indication helpers ---
  const addIndication = () => {
    setIndications(prev => [...prev, { id: uuidv4(), category: 'Catheter' as IndicationCategory }]);
  };

  const removeIndication = (id: string) => {
    setIndications(prev => prev.filter(ind => ind.id !== id));
  };

  const updateIndication = (id: string, patch: Partial<IPEventIndication>) => {
    setIndications(prev => prev.map(ind => ind.id === id ? { ...ind, ...patch } : ind));
  };

  /**
   * Derives a flat `deviceTypes` string array from the structured indications array.
   * Catheter indications are mapped to legacy NHSN-compatible device type strings.
   * MDRO indications that include a catheter type are also included.
   */
  const deriveDeviceTypes = (inds: IPEventIndication[]): string[] => {
    const devices: string[] = [];
    inds.forEach(ind => {
      const mapCatheterType = (ct: string | undefined, otherText: string | undefined): string => {
        if (!ct) return 'Other Catheter';
        if (ct === 'Other') return otherText?.trim() || 'Other Catheter';
        if (/indwelling|urinary/i.test(ct)) return 'Urinary Catheter';
        if (/picc/i.test(ct)) return 'PICC';
        if (/central/i.test(ct)) return 'Central Line';
        if (/midline/i.test(ct)) return 'Midline';
        return ct;
      };
      if (ind.category === 'Catheter') {
        devices.push(mapCatheterType(ind.catheterType, ind.catheterOtherText));
      }
      if (ind.category === 'MDRO' && ind.catheterType) {
        devices.push(mapCatheterType(ind.catheterType, ind.catheterOtherText));
      }
    });
    return devices;
  };

  // Clinical Fields
  const [infectionCategory, setInfectionCategory] = useState(
    existingIp?.infectionCategory && !INFECTION_CATEGORY_OPTIONS.includes(existingIp.infectionCategory) && existingIp.infectionCategory !== "Other"
      ? "Other"
      : (existingIp?.infectionCategory || "")
  );
  const [infectionCategoryOther, setInfectionCategoryOther] = useState(
    existingIp?.infectionCategory && !INFECTION_CATEGORY_OPTIONS.includes(existingIp.infectionCategory)
      ? existingIp.infectionCategory
      : ""
  );
  const [infectionSite, setInfectionSite] = useState(
    existingIp?.infectionSite && !INFECTION_SITE_OPTIONS.includes(existingIp.infectionSite) && existingIp.infectionSite !== "Other"
      ? "Other"
      : (existingIp?.infectionSite || "")
  );
  const [infectionSiteOther, setInfectionSiteOther] = useState(
    existingIp?.infectionSite && !INFECTION_SITE_OPTIONS.includes(existingIp.infectionSite)
      ? existingIp.infectionSite
      : ""
  );
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
      if (existingIp.sourceOfInfection) {
        const parsedSources = existingIp.sourceOfInfection.split(",").map(s => s.trim()).filter(Boolean);
        const hasOther = parsedSources.find(s => s.toLowerCase().startsWith("other:"));
        setSourceTags(parsedSources.map(s => s.toLowerCase().startsWith("other:") ? "Other" : s));
        if (hasOther) setSourceOther(hasOther.replace(/^other:\s*/i, ""));
      }
      if (existingIp.outbreakId) setOutbreakId(existingIp.outbreakId);
      
      if (existingIp.ebp) setProtocol("ebp");
      else setProtocol("isolation");

      if (existingIp.notes) {
        try {
          const parts = existingIp.notes.split('--- EXTENDED DATA ---\n');
          if (parts.length > 1) {
            let ext = null;
            for (let i = parts.length - 1; i > 0; i--) {
              try {
                ext = JSON.parse(parts[i]);
                break;
              } catch (e) {}
            }
            if (ext) {
              if (ext.protocol === "ebp" || ext.protocol === "isolation") setProtocol(ext.protocol);

              // New format: structured indications array
              if (ext.indications && ext.indications.length > 0) {
                setIndications(ext.indications);
              } else if (existingIp.ebp) {
                // Legacy migration: reconstruct indications from old flat fields
                const legacyIsolations = (existingIp.isolationType ?? '').split(',').map((s: string) => s.trim());
                const migrated: IPEventIndication[] = [];
                if (legacyIsolations.includes('Indwelling Catheter')) {
                  const oldDevTypes: string[] = ext.deviceTypes ?? [];
                  if (oldDevTypes.length > 0) {
                    oldDevTypes.forEach((dt: string) => {
                      let catheterType: string | undefined;
                      if (/urinary/i.test(dt)) catheterType = 'Indwelling';
                      else if (/central/i.test(dt)) catheterType = 'Central Line';
                      else if (/picc/i.test(dt)) catheterType = 'PICC Line';
                      else if (/midline/i.test(dt)) catheterType = 'Midline';
                      else catheterType = 'Other';
                      migrated.push({ id: uuidv4(), category: 'Catheter', catheterType });
                    });
                  } else {
                    migrated.push({ id: uuidv4(), category: 'Catheter' });
                  }
                }
                if (legacyIsolations.includes('Wound')) {
                  migrated.push({ id: uuidv4(), category: 'Wound', woundSite: ext.woundLocation ?? '' });
                }
                if (legacyIsolations.includes('MDRO')) {
                  migrated.push({ id: uuidv4(), category: 'Other', notes: ext.mdroType ?? '' });
                }
                if (legacyIsolations.includes('Other')) {
                  migrated.push({ id: uuidv4(), category: 'Other', notes: ext.ebpDetailOther ?? '' });
                }
                if (migrated.length > 0) setIndications(migrated);
              }

              if (ext.sourceOther) setSourceOther(ext.sourceOther);
              if (ext.labOutcomeNote) setLabOutcomeNote(ext.labOutcomeNote);
              if (ext.onsetDate) setOnsetDate(ext.onsetDate);
              if (ext.eventDetectedDate) setEventDetectedDate(ext.eventDetectedDate);
              if (ext.precautionStartDate) setPrecautionStartDate(ext.precautionStartDate);
              setNotes(parts[0].trim());
            } else {
              setNotes(existingIp.notes);
            }
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
  const updateIpProtocol = (newProtocol: "isolation" | "ebp") => {
    setProtocol(newProtocol);
    if (newProtocol === "isolation") {
      setIsolationTypes(["Contact"]);
      setInfectionCategory("");
      setIndications([]);
    } else if (newProtocol === "ebp") {
      setIsolationTypes([]);
      setInfectionCategory("");
      setIndications([]);
    }
  };

  // Cascading Logic 2: Category Change (Auto-population)
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

  const toggleSourceTag = (source: string) => {
    setSourceTags(prev => prev.includes(source) ? prev.filter(t => t !== source) : [...prev, source]);
  };

  useEffect(() => {
    if (protocol !== "ebp" || indications.length === 0) return;
    const categories = indications.map(i => i.category);
    if (categories.includes('Catheter')) setInfectionCategory("Device-associated");
    else if (categories.includes('MDRO')) setInfectionCategory("MDRO");
    else if (categories.includes('Wound')) setInfectionCategory("Wound infection");
    else setInfectionCategory("");
  }, [protocol, indications]);

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

  const organismSuggestions = protocol === "ebp" 
    ? EBP_ORGANISM_SUGGESTIONS 
    : (protocol === "isolation" && infectionCategory && ["MRSA", "VRE", "ESBL", "CRE", "C. diff"].includes(infectionCategory) ? [infectionCategory] : []);

  // NHSN live evaluation
  const nhsnResult = useMemo((): NhsnResult | null => {
    const effectiveCategory = infectionCategory === "Other" ? infectionCategoryOther : infectionCategory;
    const isUti = /uti|cauti/i.test(effectiveCategory);
    const isGi = /\bgi\b|c\.?\s*diff/i.test(effectiveCategory);
    const hasCdiffOrganism = infectionTags.some(t => /diff/i.test(t));

    if (!isUti && !(isGi && hasCdiffOrganism)) return null;

    const allIpEvents = Object.values(store.infections) as IPEvent[];
    const residentObj = residentId.startsWith("Q:") ? null : store.residents[residentId];
    const abts = Object.values(store.abts) as ABTCourse[];

    const syntheticIp: IPEvent = {
      id: existingIp?.id ?? '__preview__',
      residentRef: residentId.startsWith("Q:")
        ? { kind: 'quarantine', id: residentId }
        : { kind: 'mrn', id: residentId },
      status,
      onsetDate: onsetDate || undefined,
      infectionCategory: effectiveCategory || undefined,
      organism: infectionTags.join(', ') || undefined,
      specimenCollectedDate: specimenCollectedDate || undefined,
      labResultDate: labResultDate || undefined,
      deviceTypes: deriveDeviceTypes(indications),
      indications: indications.length > 0 ? indications : undefined,
      notes,
      isolationType: isolationTypes.join(', ') || undefined,
      createdAt: existingIp?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isUti) {
      return checkCauti(syntheticIp, abts, residentObj ?? { mrn: residentId, displayName: '', createdAt: '', updatedAt: '' });
    }
    return checkCdiffLabId(syntheticIp, allIpEvents);
  }, [infectionCategory, infectionCategoryOther, infectionTags, onsetDate, specimenCollectedDate,
      labResultDate, indications, notes, isolationTypes, status, store, residentId, existingIp]);

  const [isSaving, setIsSaving] = useState(false);
  const [showMagicFill, setShowMagicFill] = useState(false);
  const [magicFillText, setMagicFillText] = useState("");
  const [isMagicFilling, setIsMagicFilling] = useState(false);

  const handleMagicFill = async () => {
    if (!magicFillText.trim()) return;
    setIsMagicFilling(true);
    try {
      const extracted = await extractIpEventFromText(magicFillText);
      if (extracted) {
        if (extracted.infectionCategory) setInfectionCategory(extracted.infectionCategory);
        if (extracted.infectionSite) setInfectionSite(extracted.infectionSite || "");
        if (extracted.onsetDate) setOnsetDate(extracted.onsetDate);
        if (extracted.organism) {
          const orgs = extracted.organism.split(",").map(s => s.trim());
          setInfectionTags(prev => Array.from(new Set([...prev, ...orgs])));
        }
        if (extracted.notes) {
          setNotes(prev => prev ? `${prev}\n\n[AI Note]: ${extracted.notes}` : `[AI Note]: ${extracted.notes}`);
        }
        if (extracted.status) setStatus(extracted.status);
        if (extracted.isolationType && extracted.isolationType.length > 0) {
          setIsolationTypes(extracted.isolationType);
          setProtocol("isolation");
        }
        
        setShowMagicFill(false);
        setMagicFillText("");
      } else {
        alert("Could not extract information. Please try again with more details.");
      }
    } catch (err) {
      console.error(err);
      alert("AI extraction failed.");
    } finally {
      setIsMagicFilling(false);
    }
  };

  const handleSave = async () => {
    if (specimenCollectedDate && labResultDate && labResultDate < specimenCollectedDate) {
      alert("Lab result date cannot be before specimen collected date.");
      return;
    }
    if (onsetDate && precautionStartDate && precautionStartDate < onsetDate) {
      alert("Precaution start date cannot be before onset date.");
      return;
    }
    
    setIsSaving(true);
    try {
      const newIpId = uuidv4();
      await updateDB((draft) => {
        const facility = draft.data.facilityData[activeFacilityId];
        const now = new Date().toISOString();
        const ipId = existingIp?.id || newIpId;

        const residentRef = residentId.startsWith("Q:") 
          ? { kind: "quarantine" as const, id: residentId }
          : { kind: "mrn" as const, id: residentId };

        const locationSnapshot = existingIp?.locationSnapshot || {
          unit: (resident as any).currentUnit || (resident as any).unitSnapshot,
          room: (resident as any).currentRoom || (resident as any).roomSnapshot
        };

        const extData = {
          protocol,
          indications,
          sourceOther,
          labOutcomeNote,
          onsetDate,
          eventDetectedDate,
          precautionStartDate
        };
        
        const finalNotes = notes.trim() 
          ? notes.trim() + `\n\n--- EXTENDED DATA ---\n${JSON.stringify(extData)}`
          : `--- EXTENDED DATA ---\n${JSON.stringify(extData)}`;

        const effectiveCat = infectionCategory === "Other" ? infectionCategoryOther : infectionCategory;
        const verdictToBoolean = (v: string | undefined): boolean | null | undefined => {
          if (!v) return undefined;
          if (v === 'meets') return true;
          if (v === 'does_not_meet') return false;
          return null;
        };

        // Derive legacy fields from structured indications for NHSN backward-compat
        const derivedDeviceTypes = deriveDeviceTypes(indications);
        const derivedIsolationTypes = protocol === "ebp"
          ? Array.from(new Set(indications.map(ind => {
              if (ind.category === 'Catheter') return 'Indwelling Catheter';
              if (ind.category === 'Wound') return 'Wound';
              if (ind.category === 'Respiratory') return 'Respiratory';
              return 'Other';
            })))
          : isolationTypes;

        facility.infections[ipId] = {
          id: ipId,
          residentRef,
          status,
          onsetDate: onsetDate || undefined,
          infectionCategory: (infectionCategory === "Other" ? infectionCategoryOther.trim() || "Other" : infectionCategory.trim()) || undefined,
          infectionSite: (infectionSite === "Other" ? infectionSiteOther.trim() || "Other" : infectionSite.trim()) || undefined,
          sourceOfInfection: [...sourceTags.filter(s => s !== "Other"), ...(sourceTags.includes("Other") ? [`Other: ${sourceOther.trim() || "Unspecified"}`] : [])].join(", ") || undefined,
          protocolType: protocol === "ebp" ? "EBP" : "Isolation",
          isolationType: derivedIsolationTypes.join(", ") || undefined,
          deviceTypes: derivedDeviceTypes.length > 0 ? derivedDeviceTypes : undefined,
          indications: indications.length > 0 ? indications : undefined,
          ebp: protocol === "ebp",
          organism: infectionTags.join(", ") || undefined,
          specimenCollectedDate: specimenCollectedDate || undefined,
          labResultDate: labResultDate || undefined,
          outbreakId: outbreakId || undefined,
          locationSnapshot,
          notes: finalNotes,
          nhsnCautiMet: (nhsnResult && /uti|cauti/i.test(effectiveCat))
            ? verdictToBoolean(nhsnResult.verdict)
            : undefined,
          nhsnCdiffLabIdMet: (nhsnResult && /\bgi\b|c\.?\s*diff/i.test(effectiveCat))
            ? verdictToBoolean(nhsnResult.verdict)
            : undefined,
          createdAt: existingIp?.createdAt || now,
          updatedAt: now,
        };
      }, { action: existingIp ? 'update' : 'create', entityType: 'IPEvent', entityId: existingIp?.id || newIpId });

      // Determine symptom class for GI-related categories
      const effectiveCatForSync = infectionCategory === "Other" ? infectionCategoryOther : infectionCategory;
      const isGiCategory = /\bgi\b|c\.?\s*diff|norovirus/i.test(effectiveCatForSync);
      const detectedSymptomClass: 'resp' | 'gi' = isGiCategory ? 'gi' : 'resp';

      // Trigger shift log sync for each applicable hashtag
      let lineListResult: { suggestsLineList: boolean; symptomClass?: 'resp' | 'gi' } = { suggestsLineList: false };

      if (status === 'active' && protocol === 'isolation' && isolationTypes.length > 0) {
        lineListResult = syncHashtagToShiftLog('Isolation');
      }
      if (status === 'active' && outbreakId) {
        lineListResult = syncHashtagToShiftLog('Outbreak', {
          symptomClassOverride: detectedSymptomClass,
        });
      }
      if (specimenCollectedDate) {
        const labResult = syncHashtagToShiftLog('LabPending');
        if (labResult.suggestsLineList) lineListResult = labResult;
      }

      if (lineListResult.suggestsLineList) {
        setShowLineListPrompt({ symptomClass: lineListResult.symptomClass ?? 'resp' });
      } else {
        onClose();
      }
    } catch (err) {
      // Error is handled by updateDB (toast/error state)
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${nhsnResult ? 'max-w-5xl' : 'max-w-3xl'} max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300`}>
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            {existingIp ? "Edit Infection Event" : "New Infection Event"}
          </h2>
          <div className="flex items-center">
            <button
              onClick={() => setShowMagicFill(!showMagicFill)}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 text-sm font-medium mr-2"
            >
              <Sparkles className="w-4 h-4" />
              Magic Fill
            </button>
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        {showMagicFill && (
          <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100">
            <label className="block text-sm font-medium text-indigo-900 mb-2">
              Paste Clinical Note (Gemini AI)
            </label>
            <div className="flex gap-2">
              <textarea
                value={magicFillText}
                onChange={(e) => setMagicFillText(e.target.value)}
                placeholder="e.g., Resident started showing signs of UTI on Monday. Urine culture collected today grew E. coli."
                className="flex-1 border border-indigo-200 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                rows={3}
              />
              <button
                onClick={handleMagicFill}
                disabled={isMagicFilling || !magicFillText.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 flex flex-col items-center justify-center min-w-[80px]"
              >
                {isMagicFilling ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mb-1"></div>
                ) : (
                  <Sparkles className="w-4 h-4 mb-1" />
                )}
                {isMagicFilling ? "..." : "Fill"}
              </button>
            </div>
            <p className="text-xs text-indigo-600 mt-2">
              AI will extract: Category, Site, Onset Date, Organism, and Notes.
            </p>
          </div>
        )}
        
        <div className="flex flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-8 border-r border-neutral-200">
            
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
                    <input type="radio" checked={protocol === "isolation"} onChange={() => updateIpProtocol("isolation")} className="text-amber-600 focus:ring-amber-500" />
                    Isolation (Transmission-based)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
                    <input type="radio" checked={protocol === "ebp"} onChange={() => updateIpProtocol("ebp")} className="text-amber-600 focus:ring-amber-500" />
                    Enhanced Barrier Precaution (EBP)
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

          {/* Dynamic Isolation Types / EBP Indications */}
          {protocol === "isolation" && (
            <section className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
              <h3 className="text-sm font-bold text-neutral-900 mb-3">Isolation Type</h3>
              <div className="flex flex-wrap gap-3">
                {["Contact", "Droplet", "Airborne", "Contact/Droplet"].map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer bg-white px-3 py-1.5 rounded border border-neutral-200 shadow-sm hover:border-amber-300">
                    <input 
                      type="radio"
                      name="isolation-selection"
                      checked={isolationTypes[0] === type}
                      onChange={() => setIsolationTypes([type])}
                      className="rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
                    />
                    {type}
                  </label>
                ))}
              </div>
            </section>
          )}

          {protocol === "ebp" && (
            <section className="bg-amber-50/50 p-4 rounded-lg border border-amber-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-neutral-900">Indications / Risk Factors</h3>
                <button
                  type="button"
                  onClick={addIndication}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  + Add Additional Indication
                </button>
              </div>

              {indications.length === 0 && (
                <p className="text-sm text-neutral-400 italic">No indications added yet. Click "+ Add Additional Indication" to begin.</p>
              )}

              <div className="space-y-3">
                {indications.map((ind) => (
                  <div key={ind.id} className="bg-white border border-neutral-200 rounded-lg p-4 relative">
                    <button
                      type="button"
                      onClick={() => removeIndication(ind.id)}
                      className="absolute top-2 right-2 text-neutral-400 hover:text-red-500"
                      aria-label="Remove indication"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-6">
                      {/* Category */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
                        <select
                          value={ind.category}
                          onChange={e => updateIndication(ind.id, {
                            category: e.target.value as IndicationCategory,
                            catheterType: undefined,
                            catheterOtherText: undefined,
                            woundSite: undefined,
                            woundType: undefined,
                            mdroType: undefined,
                            mdroOtherText: undefined,
                          })}
                          className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                        >
                          <option value="Catheter">Catheter</option>
                          <option value="Wound">Wound</option>
                          <option value="MDRO">MDRO</option>
                          <option value="Respiratory">Respiratory</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {/* Catheter Type */}
                      {ind.category === 'Catheter' && (
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">Catheter Type</label>
                          <select
                            value={ind.catheterType ?? ''}
                            onChange={e => updateIndication(ind.id, { catheterType: e.target.value || undefined, catheterOtherText: undefined })}
                            className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                          >
                            <option value="">Select type...</option>
                            <option value="Indwelling">Indwelling</option>
                            <option value="Suprapubic">Suprapubic</option>
                            <option value="PICC Line">PICC Line</option>
                            <option value="Central Line">Central Line</option>
                            <option value="Midline">Midline</option>
                            <option value="Other">Other</option>
                          </select>
                          {ind.catheterType === 'Other' && (
                            <input
                              type="text"
                              value={ind.catheterOtherText ?? ''}
                              onChange={e => updateIndication(ind.id, { catheterOtherText: e.target.value })}
                              placeholder="Specify catheter type..."
                              className="mt-1.5 w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                            />
                          )}
                        </div>
                      )}

                      {/* Wound fields */}
                      {ind.category === 'Wound' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Wound Site</label>
                            <input
                              type="text"
                              value={ind.woundSite ?? ''}
                              onChange={e => updateIndication(ind.id, { woundSite: e.target.value })}
                              placeholder="e.g., Sacrum, Left Heel"
                              className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Wound Type</label>
                            <input
                              type="text"
                              value={ind.woundType ?? ''}
                              onChange={e => updateIndication(ind.id, { woundType: e.target.value })}
                              placeholder="e.g., Pressure Ulcer Stage IV, Surgical"
                              className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                            />
                          </div>
                        </>
                      )}

                      {/* MDRO fields */}
                      {ind.category === 'MDRO' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">MDRO Type</label>
                            <select
                              value={ind.mdroType ?? ''}
                              onChange={e => updateIndication(ind.id, { mdroType: (e.target.value || undefined) as IPEventIndication['mdroType'], mdroOtherText: undefined })}
                              className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                            >
                              <option value="">Select organism...</option>
                              <option value="MRSA">MRSA</option>
                              <option value="VRE">VRE</option>
                              <option value="ESBL">ESBL</option>
                              <option value="CRE">CRE</option>
                              <option value="CRAB/CRPA">CRAB/CRPA</option>
                              <option value="Other">Other</option>
                            </select>
                            {ind.mdroType === 'Other' && (
                              <input
                                type="text"
                                value={ind.mdroOtherText ?? ''}
                                onChange={e => updateIndication(ind.id, { mdroOtherText: e.target.value })}
                                placeholder="Specify organism..."
                                className="mt-1.5 w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Catheter Type (if applicable)</label>
                            <select
                              value={ind.catheterType ?? ''}
                              onChange={e => updateIndication(ind.id, { catheterType: e.target.value || undefined, catheterOtherText: undefined })}
                              className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                            >
                              <option value="">None / Not applicable</option>
                              <option value="Indwelling">Indwelling</option>
                              <option value="Suprapubic">Suprapubic</option>
                              <option value="PICC Line">PICC Line</option>
                              <option value="Central Line">Central Line</option>
                              <option value="Other">Other</option>
                            </select>
                            {ind.catheterType === 'Other' && (
                              <input
                                type="text"
                                value={ind.catheterOtherText ?? ''}
                                onChange={e => updateIndication(ind.id, { catheterOtherText: e.target.value })}
                                placeholder="Specify catheter type..."
                                className="mt-1.5 w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                              />
                            )}
                          </div>
                        </>
                      )}

                      {/* Date Identified */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Date Identified</label>
                        <input
                          type="date"
                          value={ind.dateIdentified ?? ''}
                          onChange={e => updateIndication(ind.id, { dateIdentified: e.target.value })}
                          className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>

                      {/* Notes */}
                      <div className={ind.category === 'Wound' ? 'md:col-span-2' : ''}>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">Notes</label>
                        <input
                          type="text"
                          value={ind.notes ?? ''}
                          onChange={e => updateIndication(ind.id, { notes: e.target.value })}
                          placeholder="Additional notes..."
                          className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                {infectionCategory === "Other" && (
                  <input
                    type="text"
                    value={infectionCategoryOther}
                    onChange={e => setInfectionCategoryOther(e.target.value)}
                    placeholder="Specify category..."
                    className="mt-1.5 w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                  />
                )}
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
                {infectionSite === "Other" && (
                  <input
                    type="text"
                    value={infectionSiteOther}
                    onChange={e => setInfectionSiteOther(e.target.value)}
                    placeholder="Specify site..."
                    className="mt-1.5 w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                  />
                )}
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
                {sourceTags.includes("Other") && (
                  <input
                    type="text"
                    value={sourceOther}
                    onChange={e => setSourceOther(e.target.value)}
                    placeholder="Specify other source..."
                    className="mt-2 w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500"
                  />
                )}
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
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-neutral-700 mb-1">Lab Result / Outcome Note</label>
                <textarea value={labOutcomeNote} onChange={e => setLabOutcomeNote(e.target.value)} rows={2} className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-amber-500 focus:border-amber-500 resize-y" />
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

          {/* NHSN Surveillance Criteria Side Panel */}
          {nhsnResult && (
            <div className="w-80 bg-slate-50 p-6 overflow-y-auto shrink-0">
              <h3 className="text-sm font-bold text-neutral-900 mb-4 flex items-center gap-2 border-b pb-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                NHSN Criteria
              </h3>
              <NhsnCriteriaPanel
                result={nhsnResult}
                title={/uti|cauti/i.test(infectionCategory === "Other" ? infectionCategoryOther : infectionCategory) ? "CAUTI Checklist" : "C. diff LabID Checklist"}
              />
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex flex-col gap-3 shrink-0">
          {showLineListPrompt && (
            <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-900">
              <span className="font-medium">📋 This resident may need a line list entry ({showLineListPrompt.symptomClass === 'gi' ? 'GI' : 'Respiratory'}).</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate('/linelist-report', { state: { symptomClass: showLineListPrompt.symptomClass } })}
                  className="px-3 py-1 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700"
                >
                  Open Line List →
                </button>
                <button
                  onClick={onClose}
                  className="px-3 py-1 border border-amber-300 text-amber-800 rounded-md text-xs font-medium hover:bg-amber-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-100 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Saving..." : "Save IP Event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

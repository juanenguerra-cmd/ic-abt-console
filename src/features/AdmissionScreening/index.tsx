import React, { useState, useMemo } from 'react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { AdmissionScreeningRecord, Resident } from '../../domain/models';
import AdmissionScreeningList from './AdmissionScreeningList';
import AdmissionScreeningForm from './AdmissionScreeningForm';
import { ClipboardCheck } from 'lucide-react';
import { isActiveCensusResident } from '../../utils/countCardDataHelpers';

/** Generate a simple unique ID */
function generateId(): string {
  return `asrn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Normalize a raw / partial screening record from restored JSON */
export function normalizeAdmissionScreening(raw: Partial<AdmissionScreeningRecord>): AdmissionScreeningRecord {
  const now = new Date().toISOString();
  return {
    id: raw.id ?? generateId(),
    residentId: raw.residentId ?? null,
    mrn: raw.mrn ?? null,
    name: raw.name ?? null,
    room: raw.room ?? null,
    unit: raw.unit ?? null,
    admitDate: raw.admitDate ?? null,
    screeningDate: raw.screeningDate ?? null,
    daysSinceAdmit: raw.daysSinceAdmit ?? null,
    screeningStatus: raw.screeningStatus === 'completed' ? 'completed' : 'draft',
    completedBy: raw.completedBy ?? null,
    completedByTitle: raw.completedByTitle ?? null,
    notes: raw.notes ?? null,
    createdAt: raw.createdAt ?? now,
    updatedAt: raw.updatedAt ?? now,
    admissionSource: raw.admissionSource ?? null,
    recentHospitalization: raw.recentHospitalization ?? null,
    transferFromFacility: raw.transferFromFacility ?? null,
    currentSymptoms: Array.isArray(raw.currentSymptoms) ? raw.currentSymptoms : [],
    currentDiagnosis: raw.currentDiagnosis ?? null,
    isolationStatus: raw.isolationStatus ?? null,
    precautionType: raw.precautionType ?? null,
    mdroHistory: raw.mdroHistory ?? null,
    mdroOrganism: raw.mdroOrganism ?? null,
    recentAntibiotics: raw.recentAntibiotics ?? null,
    antibioticDetails: raw.antibioticDetails ?? null,
    devicesPresent: Array.isArray(raw.devicesPresent) ? raw.devicesPresent : [],
    vaccinationReviewed: raw.vaccinationReviewed ?? null,
    vaccinationNotes: raw.vaccinationNotes ?? null,
    followUpActions: raw.followUpActions ?? null,
    recommendations: raw.recommendations ?? null,
  };
}

/** Returns true if the resident was admitted within the last `maxDays` days (default 3 = 72 h). */
function admittedWithinDays(admissionDate: string | null | undefined, maxDays = 3): boolean {
  if (!admissionDate) return false;
  const admit = new Date(admissionDate);
  if (isNaN(admit.getTime())) return false;
  const diffDays = (Date.now() - admit.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= maxDays;
}

/**
 * Build a virtual "pending" screening record for a resident admitted within 72 hours
 * who does not yet have a screening.  These records are **never persisted to the DB**.
 */
function makePendingRecord(resident: Resident): AdmissionScreeningRecord {
  const now = new Date().toISOString();
  return {
    id: `pending_${resident.mrn}`,
    residentId: resident.mrn ?? null,
    mrn: resident.mrn ?? null,
    name: resident.displayName ?? null,
    room: resident.currentRoom ?? null,
    unit: resident.currentUnit ?? null,
    admitDate: resident.admissionDate ?? null,
    screeningDate: null,
    daysSinceAdmit: null,
    screeningStatus: 'pending',
    completedBy: null,
    completedByTitle: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    admissionSource: null,
    recentHospitalization: null,
    transferFromFacility: null,
    currentSymptoms: [],
    currentDiagnosis: null,
    isolationStatus: null,
    precautionType: null,
    mdroHistory: null,
    mdroOrganism: null,
    recentAntibiotics: null,
    antibioticDetails: null,
    devicesPresent: [],
    vaccinationReviewed: null,
    vaccinationNotes: null,
    followUpActions: null,
    recommendations: null,
  };
}

/**
 * Maps device names from the screening form's `devicesPresent` array to the
 * corresponding key in `Resident.clinicalDevices`.
 */
const DEVICE_FIELD_MAP: Record<string, keyof NonNullable<Resident['clinicalDevices']>> = {
  'Urinary catheter': 'urinaryCatheter',
  'PICC': 'picc',
  'Central venous catheter': 'centralLine',
  'Peripheral IV': 'piv',
  'Feeding tube': 'peg',
  'Tracheostomy': 'trach',
  'Wound VAC': 'woundVac',
};

/**
 * Activates the clinical devices identified during screening on the resident's
 * core profile.  Only activates devices present — does not deactivate others.
 * Sets `insertedDate` to `admitDateISO` if the device wasn't already active.
 */
function applyDevicesToResident(resident: Resident, devicesPresent: string[], admitDateISO: string): void {
  if (!devicesPresent.length) return;
  if (!resident.clinicalDevices) {
    resident.clinicalDevices = {
      oxygen: { enabled: false, mode: null },
      urinaryCatheter: { active: false, insertedDate: null },
      indwellingCatheter: { active: false, insertedDate: null },
      midline: { active: false, insertedDate: null },
      picc: { active: false, insertedDate: null },
      piv: { active: false, insertedDate: null },
      centralLine: { active: false, insertedDate: null },
      trach: { active: false, insertedDate: null },
      peg: { active: false, insertedDate: null },
      woundVac: { active: false, insertedDate: null },
      dialysisAccess: { active: false, insertedDate: null },
      ostomy: { active: false, insertedDate: null },
    };
  }
  for (const device of devicesPresent) {
    const fieldKey = DEVICE_FIELD_MAP[device];
    // DEVICE_FIELD_MAP only maps devices with { active, insertedDate } shape; skip unknown entries.
    if (!fieldKey) continue;
    const entry = resident.clinicalDevices[fieldKey] as { active: boolean; insertedDate: string | null } | undefined;
    if (entry && 'active' in entry) {
      if (!entry.active) {
        entry.active = true;
        // Record when the device was placed (admission date is the best available proxy).
        entry.insertedDate = admitDateISO;
      }
    }
  }
}

const AdmissionScreeningPage: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  const [editingRecord, setEditingRecord] = useState<AdmissionScreeningRecord | null | undefined>(undefined);
  // undefined = list view, null = new (empty) form, record = edit / pending pre-fill

  /** All normalized, persisted screening records for the current facility. */
  const screenings = useMemo((): AdmissionScreeningRecord[] => {
    try {
      const raw = store.admissionScreenings;
      if (!raw) return [];
      return Object.values(raw).map(r => {
        try {
          return normalizeAdmissionScreening(r as Partial<AdmissionScreeningRecord>);
        } catch {
          return null;
        }
      }).filter((r): r is AdmissionScreeningRecord => r !== null);
    } catch {
      return [];
    }
  }, [store.admissionScreenings]);

  /**
   * Virtual "pending" entries — active residents admitted within 72 hours that
   * do not yet have any screening record (matched by MRN).
   */
  const pendingEntries = useMemo((): AdmissionScreeningRecord[] => {
    try {
      const screened = new Set(
        screenings.map(s => s.mrn).filter((m): m is string => !!m),
      );
      return (Object.values(store.residents || {}) as Resident[])
        .filter((r): r is Resident => {
          if (!r || !isActiveCensusResident(r)) return false;
          if (!r.admissionDate) return false;
          if (r.mrn && screened.has(r.mrn)) return false;
          return admittedWithinDays(r.admissionDate, 3);
        })
        .sort((a, b) => {
          const ta = a.admissionDate ? new Date(a.admissionDate).getTime() : 0;
          const tb = b.admissionDate ? new Date(b.admissionDate).getTime() : 0;
          return tb - ta;
        })
        .map(makePendingRecord);
    } catch {
      return [];
    }
  }, [store.residents, screenings]);

  /** Combined list: pending entries first (most-recently admitted), then stored records. */
  const allItems = useMemo(
    (): AdmissionScreeningRecord[] => [...pendingEntries, ...screenings],
    [pendingEntries, screenings],
  );

  const handleNew = () => setEditingRecord(null);

  /** Open a record for editing.  Virtual pending records open pre-filled as a new record. */
  const handleOpen = (r: AdmissionScreeningRecord) => setEditingRecord(r);

  const handleClose = () => setEditingRecord(undefined);

  const handleSave = (draft: Omit<AdmissionScreeningRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();

    /** When starting from a virtual pending entry, always create a new persisted record. */
    const isFromPending = editingRecord?.screeningStatus === 'pending';
    const isNew = editingRecord === null || isFromPending;

    const savedRecord: AdmissionScreeningRecord = {
      ...draft,
      id: isNew ? generateId() : editingRecord!.id,
      createdAt: isNew ? now : editingRecord!.createdAt,
      updatedAt: now,
    };

    updateDB(db => {
      const facilityData = db.data.facilityData[activeFacilityId];
      if (!facilityData.admissionScreenings) {
        facilityData.admissionScreenings = {};
      }
      facilityData.admissionScreenings[savedRecord.id] = savedRecord;

      // ── Data encoding on completion ─────────────────────────────────────────
      // When a screening is marked complete, encode the clinical findings back
      // into the resident's core profile for cross-module consistency.
      if (draft.screeningStatus === 'completed' && draft.mrn) {
        const resident = facilityData.residents[draft.mrn];
        if (resident) {
          // 1. Update primaryDiagnosis if a current diagnosis was captured.
          //    The screening diagnosis takes precedence over any previously set value,
          //    reflecting the clinician's assessment at the time of admission.
          if (draft.currentDiagnosis?.trim()) {
            resident.primaryDiagnosis = draft.currentDiagnosis.trim();
          }
          // 2. Activate clinicalDevices identified during the screening.
          //    insertedDate is set to the admission date as the best available proxy.
          if (Array.isArray(draft.devicesPresent) && draft.devicesPresent.length) {
            applyDevicesToResident(resident, draft.devicesPresent, draft.admitDate ?? now);
          }
          resident.updatedAt = now;
        }
      }
    });

    setEditingRecord(undefined);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">IP Admission Screening</h1>
          <p className="text-sm text-neutral-500">Infection prevention assessments for new admissions (within 72 hours)</p>
        </div>
      </div>

      {/* List view */}
      {editingRecord === undefined && (
        <AdmissionScreeningList
          screenings={allItems}
          onNew={handleNew}
          onOpen={handleOpen}
        />
      )}

      {/* Form modal */}
      {editingRecord !== undefined && (
        <AdmissionScreeningForm
          record={editingRecord}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </div>
  );
};

export default AdmissionScreeningPage;

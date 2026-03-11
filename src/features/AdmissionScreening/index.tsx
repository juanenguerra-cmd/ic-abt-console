import React, { useState, useMemo } from 'react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { AdmissionScreeningRecord } from '../../domain/models';
import AdmissionScreeningList from './AdmissionScreeningList';
import AdmissionScreeningForm from './AdmissionScreeningForm';
import { ClipboardCheck } from 'lucide-react';

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

const AdmissionScreeningPage: React.FC = () => {
  const { store, activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();

  const [editingRecord, setEditingRecord] = useState<AdmissionScreeningRecord | null | undefined>(undefined);
  // undefined = list view, null = new form, record = edit form

  /** All normalized screening records for current facility */
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

  const handleNew = () => setEditingRecord(null);
  const handleOpen = (r: AdmissionScreeningRecord) => setEditingRecord(r);
  const handleClose = () => setEditingRecord(undefined);

  const handleSave = (draft: Omit<AdmissionScreeningRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();

    if (editingRecord === null) {
      // create new
      const newRecord: AdmissionScreeningRecord = {
        ...draft,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      updateDB(db => {
        const facilityData = db.data.facilityData[activeFacilityId];
        if (!facilityData.admissionScreenings) {
          facilityData.admissionScreenings = {};
        }
        facilityData.admissionScreenings[newRecord.id] = newRecord;
      });
    } else if (editingRecord) {
      // update existing
      const updatedRecord: AdmissionScreeningRecord = {
        ...draft,
        id: editingRecord.id,
        createdAt: editingRecord.createdAt,
        updatedAt: now,
      };
      updateDB(db => {
        const facilityData = db.data.facilityData[activeFacilityId];
        if (!facilityData.admissionScreenings) {
          facilityData.admissionScreenings = {};
        }
        facilityData.admissionScreenings[editingRecord.id] = updatedRecord;
      });
    }

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
          screenings={screenings}
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

import React, { useState } from 'react';
import { X, Save, Plus, Trash2, GripVertical } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSave: (report: any) => void;
}

const DATA_SOURCES = ['Residents', 'Notes', 'ABT', 'IP', 'Vax'];

const ALL_FIELDS: Record<string, { label: string; path: string }[]> = {
  Residents: [
    { label: 'Resident Name', path: 'displayName' },
    { label: 'MRN', path: 'mrn' },
    { label: 'DOB', path: 'dob' },
    { label: 'Sex', path: 'sex' },
    { label: 'Unit', path: 'currentUnit' },
    { label: 'Room', path: 'currentRoom' },
    { label: 'Admission Date', path: 'admissionDate' },
    { label: 'Attending MD', path: 'attendingMD' },
    { label: 'Status', path: 'status' },
    { label: 'Payor', path: 'payor' },
    { label: 'Primary Diagnosis', path: 'primaryDiagnosisText' },
    { label: 'Cognitive Status', path: 'cognitiveStatus' },
  ],
  Notes: [
    { label: 'Resident Name', path: 'resident.displayName' },
    { label: 'Note Type', path: 'noteType' },
    { label: 'Title', path: 'title' },
    { label: 'Note Body', path: 'body' },
    { label: 'Created At', path: 'createdAt' },
  ],
  ABT: [
    { label: 'Resident Name', path: 'resident.displayName' },
    { label: 'MRN', path: 'resident.mrn' },
    { label: 'Unit', path: 'resident.currentUnit' },
    { label: 'Room', path: 'resident.currentRoom' },
    { label: 'Attending MD', path: 'resident.attendingMD' },
    { label: 'Medication Name', path: 'medication' },
    { label: 'Medication ID', path: 'medicationId' },
    { label: 'Original Order Text', path: 'enteredMedicationText' },
    { label: 'Class', path: 'medicationClass' },
    { label: 'Dose', path: 'dose' },
    { label: 'Dose Unit', path: 'doseUnit' },
    { label: 'Route', path: 'route' },
    { label: 'Frequency', path: 'frequency' },
    { label: 'Status', path: 'status' },
    { label: 'Indication', path: 'indication' },
    { label: 'Syndrome Category', path: 'syndromeCategory' },
    { label: 'Infection Source', path: 'infectionSource' },
    { label: 'Broad Spectrum', path: 'isBroadSpectrum' },
    { label: 'Start Date', path: 'startDate' },
    { label: 'End Date', path: 'endDate' },
    { label: 'Culture Collected', path: 'cultureCollected' },
    { label: 'Culture Collection Date', path: 'cultureCollectionDate' },
    { label: 'Culture Source', path: 'cultureSource' },
    { label: 'Organism Identified', path: 'organismIdentified' },
    { label: 'Sensitivity Summary', path: 'sensitivitySummary' },
    { label: 'Prescriber', path: 'prescriber' },
    { label: 'Timeout Review Date', path: 'timeoutReviewDate' },
  ],
  IP: [
    { label: 'Resident Name', path: 'resident.displayName' },
    { label: 'MRN', path: 'resident.mrn' },
    { label: 'Unit', path: 'resident.currentUnit' },
    { label: 'Room', path: 'resident.currentRoom' },
    { label: 'Infection Category', path: 'infectionCategory' },
    { label: 'Infection Site', path: 'infectionSite' },
    { label: 'Source of Infection', path: 'sourceOfInfection' },
    { label: 'Protocol Type', path: 'protocolType' },
    { label: 'Status', path: 'status' },
    { label: 'Onset Date', path: 'onsetDate' },
    { label: 'Specimen Collected Date', path: 'specimenCollectedDate' },
    { label: 'Lab Result Date', path: 'labResultDate' },
    { label: 'Isolation Type', path: 'isolationType' },
    { label: 'EBP', path: 'ebp' },
    { label: 'Organism', path: 'organism' },
    { label: 'NHSN CAUTI Met', path: 'nhsnCautiMet' },
    { label: 'NHSN C. diff LabID Met', path: 'nhsnCdiffLabIdMet' },
    { label: 'Created At', path: 'createdAt' },
  ],
  Vax: [
    { label: 'Resident Name', path: 'resident.displayName' },
    { label: 'MRN', path: 'resident.mrn' },
    { label: 'Unit', path: 'resident.currentUnit' },
    { label: 'Room', path: 'resident.currentRoom' },
    { label: 'Vaccine', path: 'vaccine' },
    { label: 'Status', path: 'status' },
    { label: 'Date Given', path: 'dateGiven' },
    { label: 'Dose Number', path: 'dose' },
    { label: 'Lot Number', path: 'lotNumber' },
    { label: 'Administered By', path: 'administeredBy' },
    { label: 'Administration Site', path: 'administrationSite' },
    { label: 'Decline Reason', path: 'declineReason' },
    { label: 'Due Date', path: 'dueDate' },
    { label: 'Offer Date', path: 'offerDate' },
  ],
};

export const ReportBuilderModal: React.FC<Props> = ({ onClose, onSave }) => {
  const [reportName, setReportName] = useState('');
  const [dataSource, setDataSource] = useState('Notes');
  const [selectedFields, setSelectedFields] = useState<{ label: string; path: string }[]>([]);

  const handleSave = () => {
    onSave({ name: reportName, dataSource, fields: selectedFields });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Report Builder</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Left Panel: Configuration */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-bold text-neutral-900 mb-1 block">Report Name</label>
              <input
                type="text"
                value={reportName}
                onChange={e => setReportName(e.target.value)}
                placeholder="e.g., Weekly Infection Report"
                className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-neutral-900 mb-1 block">Data Source</label>
              <select
                value={dataSource}
                onChange={e => {
                  setDataSource(e.target.value);
                  setSelectedFields([]);
                }}
                className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                {DATA_SOURCES.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-bold text-neutral-900 mb-1 block">Available Fields</label>
              <div className="border border-neutral-200 rounded-md max-h-60 overflow-y-auto">
                {ALL_FIELDS[dataSource].map(field => (
                  <button 
                    key={field.path}
                    onClick={() => setSelectedFields([...selectedFields, field])}
                    className="w-full text-left p-2 text-sm hover:bg-indigo-50 border-b border-neutral-200 last:border-b-0"
                  >
                    {field.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Selected Fields */}
          <div className="flex flex-col">
            <label className="text-sm font-bold text-neutral-900 mb-1 block">Report Columns (Drag to reorder)</label>
            <div className="border border-neutral-200 rounded-md p-2 flex-1 bg-neutral-50/50 min-h-[200px]">
              {selectedFields.map((field, index) => (
                <div key={`${field.path}-${index}`} className="flex items-center justify-between bg-white p-2 rounded-md shadow-sm mb-2">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-neutral-400 cursor-grab" />
                    <span className="text-sm font-medium text-neutral-800">{field.label}</span>
                  </div>
                  <button onClick={() => setSelectedFields(selectedFields.filter((_, i) => i !== index))} className="text-neutral-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {selectedFields.length === 0 && (
                <div className="text-center text-neutral-400 pt-16 text-sm italic">
                  Select fields to add them here.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-100 text-sm font-medium">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center gap-1">
            <Save className="w-4 h-4" /> Save Report
          </button>
        </div>
      </div>
    </div>
  );
};

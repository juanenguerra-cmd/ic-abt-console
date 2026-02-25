import React, { useState } from 'react';
import { X, Save, Plus, Trash2, GripVertical } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const DATA_SOURCES = ['Notes', 'ABT', 'IP', 'Vax'];

const ALL_FIELDS: Record<string, { label: string; path: string }[]> = {
  Notes: [
    { label: 'Resident Name', path: 'resident.displayName' },
    { label: 'Note Body', path: 'body' },
    { label: 'Created At', path: 'createdAt' },
  ],
  ABT: [
    { label: 'Resident Name', path: 'resident.displayName' },
    { label: 'Medication', path: 'medication' },
    { label: 'Start Date', path: 'startDate' },
    { label: 'End Date', path: 'endDate' },
    { label: 'Status', path: 'status' },
  ],
  IP: [
    { label: 'Resident Name', path: 'resident.displayName' },
    { label: 'Infection Category', path: 'infectionCategory' },
    { label: 'Status', path: 'status' },
    { label: 'Created At', path: 'createdAt' },
  ],
  Vax: [
    { label: 'Resident Name', path: 'resident.displayName' },
    { label: 'Vaccine', path: 'vaccine' },
    { label: 'Status', path: 'status' },
    { label: 'Date Given', path: 'dateGiven' },
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
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-2 gap-6">
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

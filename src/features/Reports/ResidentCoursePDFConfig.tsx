import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ResidentCoursePDFConfig } from '../../types/reportTypes';
import { todayLocalDateInputValue } from '../../lib/dateUtils';

interface Props {
  residentName: string;
  onGenerate: (config: ResidentCoursePDFConfig) => void;
  onCancel: () => void;
}

const SECTIONS: { key: keyof ResidentCoursePDFConfig; label: string; description: string }[] = [
  { key: 'includeResidentInfo', label: 'Resident Demographics & Information', description: 'Name, MRN, DOB, unit/room, allergies, attending MD' },
  { key: 'includeClinicalNarrative', label: 'SNF/LTC Course / Clinical Narrative', description: 'Prose summary of infections, treatments, and outcomes' },
  { key: 'includeAntibioticTimeline', label: 'Antibiotic Therapy Timeline', description: 'Table of all antibiotic courses with dates, indications, organisms' },
  { key: 'includeInfectionEvents', label: 'Infection Prevention Events Log', description: 'All documented infections with syndromes, diagnostics, status' },
  { key: 'includeIsolationPrecautions', label: 'Isolation / EBP Precautions History', description: 'Contact, droplet, airborne and EBP precautions with dates' },
  { key: 'includeVaccinations', label: 'Vaccination History', description: 'Immunizations received during stay with dates and lot numbers' },
  { key: 'includeStewardshipAnalytics', label: 'Antibiotic Stewardship Analytics', description: 'DOT, LOT, culture rates, de-escalation metrics' },
  { key: 'includeStewardshipInterventions', label: 'Stewardship Interventions & Outcomes', description: 'Logged interventions with type and clinical details' },
  { key: 'includeMDROStatus', label: 'MDRO Status Summary', description: 'Current colonization status, clearance dates, precaution status' },
  { key: 'includeRecommendations', label: 'Plan of Care Continuity', description: 'Active treatment, current precautions, monitoring focus, and reassessment items' },
];

const DEFAULT_CONFIG: ResidentCoursePDFConfig = {
  includeResidentInfo: true,
  includeClinicalNarrative: true,
  includeAntibioticTimeline: true,
  includeInfectionEvents: true,
  includeIsolationPrecautions: true,
  includeVaccinations: true,
  includeStewardshipAnalytics: true,
  includeStewardshipInterventions: true,
  includeMDROStatus: true,
  includeRecommendations: true,
};

export const ResidentCoursePDFConfigModal: React.FC<Props> = ({
  residentName,
  onGenerate,
  onCancel,
}) => {
  const [config, setConfig] = useState<ResidentCoursePDFConfig>(DEFAULT_CONFIG);
  const [dateRangeEnabled, setDateRangeEnabled] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(todayLocalDateInputValue());

  const handleToggle = (field: keyof ResidentCoursePDFConfig) => {
    setConfig(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSelectAll = () => {
    setConfig(DEFAULT_CONFIG);
  };

  const handleClearAll = () => {
    const cleared = Object.fromEntries(
      SECTIONS.map(s => [s.key, false])
    ) as unknown as ResidentCoursePDFConfig;
    setConfig(cleared);
  };

  const handleGenerate = () => {
    onGenerate({
      ...config,
      dateRange: dateRangeEnabled && startDate ? { startDate, endDate } : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Treatment Course Summary Report</h2>
            <p className="text-sm text-neutral-500 mt-0.5">{residentName}</p>
          </div>
          <button onClick={onCancel} className="p-1 rounded hover:bg-neutral-100 text-neutral-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* Section selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-neutral-700">Select report sections to include:</p>
              <div className="flex gap-2">
                <button onClick={handleSelectAll} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  Select All
                </button>
                <span className="text-xs text-neutral-300">|</span>
                <button onClick={handleClearAll} className="text-xs text-neutral-500 hover:text-neutral-700 font-medium">
                  Clear All
                </button>
              </div>
            </div>
            <div className="space-y-2 border border-neutral-200 rounded-lg p-3 bg-neutral-50">
              {SECTIONS.map(section => (
                <label key={section.key} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!config[section.key]}
                    onChange={() => handleToggle(section.key)}
                    className="mt-0.5 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-800 group-hover:text-indigo-700">
                      {section.label}
                    </span>
                    <p className="text-xs text-neutral-500 mt-0.5">{section.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dateRangeEnabled}
                onChange={() => setDateRangeEnabled(v => !v)}
                className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-neutral-700">Filter events by date range (optional)</span>
            </label>

            {dateRangeEnabled && (
              <div className="mt-3 grid grid-cols-2 gap-4 pl-6">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50 rounded-b-xl">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-neutral-700 border border-neutral-300 rounded-md hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            disabled={!SECTIONS.some(s => !!config[s.key])}
          >
            Generate PDF
          </button>
        </div>
      </div>
    </div>
  );
};

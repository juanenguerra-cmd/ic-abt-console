import React, { useState } from 'react';
import { useDatabase, useFacilityData } from '../../app/providers';
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Save, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ColumnDef {
  id: string;
  label: string;
  fieldPath: string;
}

const AVAILABLE_COLUMNS: ColumnDef[] = [
  { id: 'res_name', label: 'Resident Name', fieldPath: 'resident.displayName' },
  { id: 'res_mrn', label: 'MRN', fieldPath: 'resident.mrn' },
  { id: 'res_dob', label: 'DOB', fieldPath: 'resident.dob' },
  { id: 'res_unit', label: 'Unit', fieldPath: 'resident.currentUnit' },
  { id: 'res_room', label: 'Room', fieldPath: 'resident.currentRoom' },
  { id: 'res_admission', label: 'Admission Date', fieldPath: 'resident.admissionDate' },
  { id: 'res_md', label: 'Attending MD', fieldPath: 'resident.attendingMD' },
  
  { id: 'abt_med', label: 'ABT Medication', fieldPath: 'abt.medication' },
  { id: 'abt_start', label: 'ABT Start Date', fieldPath: 'abt.startDate' },
  { id: 'abt_end', label: 'ABT End Date', fieldPath: 'abt.endDate' },
  { id: 'abt_status', label: 'ABT Status', fieldPath: 'abt.status' },
  { id: 'abt_indication', label: 'ABT Indication', fieldPath: 'abt.indication' },
  { id: 'abt_syndrome', label: 'ABT Syndrome Category', fieldPath: 'abt.syndromeCategory' },
  { id: 'abt_culture', label: 'Culture Collected', fieldPath: 'abt.cultureCollected' },
  { id: 'abt_culture_date', label: 'Culture Collection Date', fieldPath: 'abt.cultureCollectionDate' },
  { id: 'abt_prescriber', label: 'Prescriber (Attending MD)', fieldPath: 'resident.attendingMD' },
  
  { id: 'ip_category', label: 'IP Category', fieldPath: 'ip.infectionCategory' },
  { id: 'ip_site', label: 'IP Infection Site', fieldPath: 'ip.infectionSite' },
  { id: 'ip_status', label: 'IP Status', fieldPath: 'ip.status' },
  { id: 'ip_date', label: 'IP Onset Date', fieldPath: 'ip.createdAt' },
  { id: 'ip_isolation', label: 'Isolation Type', fieldPath: 'ip.isolationType' },
  { id: 'ip_ebp', label: 'EBP', fieldPath: 'ip.ebp' },
  { id: 'ip_organism', label: 'Organism', fieldPath: 'ip.organism' },
  
  { id: 'vax_name', label: 'Vaccine', fieldPath: 'vax.vaccine' },
  { id: 'vax_status', label: 'Vax Status', fieldPath: 'vax.status' },
  { id: 'vax_date', label: 'Date Given', fieldPath: 'vax.dateGiven' },
  { id: 'vax_decline', label: 'Decline Reason', fieldPath: 'vax.declineReason' },
  { id: 'vax_due', label: 'Due Date', fieldPath: 'vax.dueDate' },
  { id: 'vax_offer_again', label: 'Offer Again Date', fieldPath: 'vax.offerAgainDate' },
];

export const ReportBuilder: React.FC = () => {
  const { activeFacilityId } = useFacilityData();
  const { updateDB } = useDatabase();
  
  const [reportName, setReportName] = useState('');
  const [availableCols, setAvailableCols] = useState<ColumnDef[]>(AVAILABLE_COLUMNS);
  const [selectedCols, setSelectedCols] = useState<ColumnDef[]>([]);
  const [displayHeaders, setDisplayHeaders] = useState<Record<string, string>>({});
  
  const [selectedAvailableIds, setSelectedAvailableIds] = useState<Set<string>>(new Set());
  const [selectedSelectedIds, setSelectedSelectedIds] = useState<Set<string>>(new Set());

  const toggleAvailable = (id: string) => {
    const newSet = new Set(selectedAvailableIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedAvailableIds(newSet);
  };

  const toggleSelected = (id: string) => {
    const newSet = new Set(selectedSelectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedSelectedIds(newSet);
  };

  const moveRight = () => {
    const toMove = availableCols.filter(c => selectedAvailableIds.has(c.id));
    setSelectedCols([...selectedCols, ...toMove]);
    setAvailableCols(availableCols.filter(c => !selectedAvailableIds.has(c.id)));
    setSelectedAvailableIds(new Set());
  };

  const moveLeft = () => {
    const toMove = selectedCols.filter(c => selectedSelectedIds.has(c.id));
    setAvailableCols([...availableCols, ...toMove]);
    setSelectedCols(selectedCols.filter(c => !selectedSelectedIds.has(c.id)));
    setSelectedSelectedIds(new Set());
  };

  const moveAllRight = () => {
    setSelectedCols([...selectedCols, ...availableCols]);
    setAvailableCols([]);
    setSelectedAvailableIds(new Set());
  };

  const moveAllLeft = () => {
    setAvailableCols([...availableCols, ...selectedCols]);
    setSelectedCols([]);
    setSelectedSelectedIds(new Set());
  };

  const handleSave = () => {
    if (!reportName.trim()) {
      alert("Please enter a report name");
      return;
    }
    if (selectedCols.length === 0) {
      alert("Please select at least one column");
      return;
    }

    const id = uuidv4();
    const colsWithHeaders = selectedCols.map(col => ({
      ...col,
      displayHeader: displayHeaders[col.id]?.trim() || col.label,
    }));

    updateDB(draft => {
      const facilityData = draft.data.facilityData[activeFacilityId] as any;
      if (!facilityData.reportTemplates) {
        facilityData.reportTemplates = {};
      }
      facilityData.reportTemplates[id] = {
        id,
        name: reportName,
        columns: colsWithHeaders,
        createdAt: new Date().toISOString()
      };
    });

    // Also persist to ltc_report_templates for On Demand picker
    try {
      const existing = JSON.parse(localStorage.getItem('ltc_report_templates') || '[]');
      existing.push({ id, name: reportName, columns: colsWithHeaders, createdAt: new Date().toISOString() });
      localStorage.setItem('ltc_report_templates', JSON.stringify(existing));
    } catch {}
    
    alert("Report template saved successfully!");
    setReportName('');
    setAvailableCols(AVAILABLE_COLUMNS);
    setSelectedCols([]);
    setDisplayHeaders({});
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 flex flex-col h-full overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900">General Report Builder</h2>
          <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium">
            <Save className="w-4 h-4" />
            Save Template
          </button>
        </div>
        
        <div className="p-6 flex-1 flex flex-col min-h-0">
          <div className="mb-6 shrink-0">
            <label className="block text-sm font-medium text-neutral-700 mb-1">Report Name</label>
            <input 
              type="text" 
              value={reportName}
              onChange={e => setReportName(e.target.value)}
              placeholder="e.g., Active Infections Report"
              className="w-full max-w-md border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-6 flex-1 min-h-0">
            {/* Available Columns */}
            <div className="flex-1 flex flex-col border border-neutral-200 rounded-lg overflow-hidden bg-white">
              <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200 font-medium text-sm text-neutral-700 shrink-0">
                Available Columns ({availableCols.length})
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {availableCols.map(col => (
                  <div 
                    key={col.id}
                    onClick={() => toggleAvailable(col.id)}
                    className={`px-3 py-2 text-sm cursor-pointer rounded-md mb-1 ${
                      selectedAvailableIds.has(col.id) 
                        ? 'bg-indigo-100 text-indigo-900 font-medium' 
                        : 'hover:bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {col.label}
                  </div>
                ))}
                {availableCols.length === 0 && (
                  <div className="text-center text-neutral-400 py-8 text-sm">No more columns available</div>
                )}
              </div>
            </div>

            {/* Shuttle Controls */}
            <div className="flex flex-col justify-center gap-2 shrink-0">
              <button 
                onClick={moveAllRight}
                disabled={availableCols.length === 0}
                className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md disabled:opacity-50"
                title="Move all right"
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
              <button 
                onClick={moveRight}
                disabled={selectedAvailableIds.size === 0}
                className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md disabled:opacity-50"
                title="Move selected right"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button 
                onClick={moveLeft}
                disabled={selectedSelectedIds.size === 0}
                className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md disabled:opacity-50 mt-4"
                title="Move selected left"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={moveAllLeft}
                disabled={selectedCols.length === 0}
                className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md disabled:opacity-50"
                title="Move all left"
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Columns */}
            <div className="flex-1 flex flex-col border border-neutral-200 rounded-lg overflow-hidden bg-white">
              <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200 font-medium text-sm text-neutral-700 shrink-0">
                Selected Columns ({selectedCols.length})
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {selectedCols.map(col => (
                  <div 
                    key={col.id}
                    className={`px-3 py-1.5 text-sm rounded-md mb-1 flex items-center gap-2 ${
                      selectedSelectedIds.has(col.id) 
                        ? 'bg-indigo-100 text-indigo-900 font-medium' 
                        : 'hover:bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    <span onClick={() => toggleSelected(col.id)} className="flex-shrink-0 cursor-pointer min-w-[120px]">{col.label}</span>
                    <input
                      type="text"
                      value={displayHeaders[col.id] ?? ''}
                      onChange={e => setDisplayHeaders(prev => ({ ...prev, [col.id]: e.target.value }))}
                      placeholder={col.label}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 border border-neutral-300 rounded px-2 py-0.5 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                ))}
                {selectedCols.length === 0 && (
                  <div className="text-center text-neutral-400 py-8 text-sm">Select columns from the left</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

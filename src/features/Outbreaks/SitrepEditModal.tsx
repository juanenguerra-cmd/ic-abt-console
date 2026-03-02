import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useDatabase } from '../../app/providers';
import { OutbreakDailyStatus } from '../../domain/models';

interface Props {
  sitrep: OutbreakDailyStatus;
  activeFacilityId: string;
  onClose: () => void;
}

export const SitrepEditModal: React.FC<Props> = ({ sitrep, activeFacilityId, onClose }) => {
  const { updateDB } = useDatabase();

  const [newCases, setNewCases] = useState(sitrep.newCases);
  const [totalCases, setTotalCases] = useState(sitrep.totalCases);
  const [newExposures, setNewExposures] = useState(sitrep.newExposures);
  const [isolationCount, setIsolationCount] = useState(sitrep.isolationCount ?? 0);
  const [narrative, setNarrative] = useState(sitrep.narrative ?? '');
  const [staffingIssues, setStaffingIssues] = useState(sitrep.staffingIssues ?? '');
  const [suppliesIssues, setSuppliesIssues] = useState(sitrep.suppliesIssues ?? '');

  const handleSave = () => {
    updateDB(draft => {
      const fd = draft.data.facilityData[activeFacilityId];
      const existing = fd.outbreakDailyStatuses[sitrep.id];
      if (existing) {
        existing.newCases = newCases;
        existing.totalCases = totalCases;
        existing.newExposures = newExposures;
        existing.isolationCount = isolationCount;
        existing.narrative = narrative || undefined;
        existing.staffingIssues = staffingIssues || undefined;
        existing.suppliesIssues = suppliesIssues || undefined;
        existing.updatedAt = new Date().toISOString();
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-bold text-neutral-900">Edit Daily Report</h2>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">New Cases</label>
              <input
                type="number"
                min={0}
                value={newCases}
                onChange={e => setNewCases(Number(e.target.value))}
                className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Total Cases</label>
              <input
                type="number"
                min={0}
                value={totalCases}
                onChange={e => setTotalCases(Number(e.target.value))}
                className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">New Exposures</label>
              <input
                type="number"
                min={0}
                value={newExposures}
                onChange={e => setNewExposures(Number(e.target.value))}
                className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Isolations</label>
              <input
                type="number"
                min={0}
                value={isolationCount}
                onChange={e => setIsolationCount(Number(e.target.value))}
                className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Narrative</label>
            <textarea
              value={narrative}
              onChange={e => setNarrative(e.target.value)}
              rows={3}
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Staffing Issues</label>
            <input
              type="text"
              value={staffingIssues}
              onChange={e => setStaffingIssues(e.target.value)}
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Supplies Issues</label>
            <input
              type="text"
              value={suppliesIssues}
              onChange={e => setSuppliesIssues(e.target.value)}
              className="w-full border border-neutral-300 rounded-md text-sm px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
          >
            <Save className="w-4 h-4" />
            Save Report
          </button>
        </div>
      </div>
    </div>
  );
};

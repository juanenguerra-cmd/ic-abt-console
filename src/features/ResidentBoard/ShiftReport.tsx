import React, { useState } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { ResidentNote } from '../../domain/models';
import { ArrowLeft, Tag, Printer, Plus } from 'lucide-react';

import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { ReportBuilderModal } from './ReportBuilderModal';
import { DailyPrecautionList } from './PrintableForms/DailyPrecautionList';

interface Props {
  onBack: () => void;
}

export const ShiftReport: React.FC<Props> = ({ onBack }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { db, updateDB } = useDatabase();
  const facility = db.data.facilities.byId[activeFacilityId];
  const hashtagCategories = facility?.hashtagCategories || [];

  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [filterType, setFilterType] = useState<'initiated' | 'active'>('initiated');
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [showPrecautionList, setShowPrecautionList] = useState(false);

  const [customReports, setCustomReports] = useState<any[]>([]);

  const categorizedNotes: Record<string, (ResidentNote & { residentName: string })[]> = {};

  const allNotes = Object.values(store.notes) as ResidentNote[];
  const residents = store.residents;

  for (const note of allNotes) {
    const resident = residents[note.residentRef.id];
    if (!resident) continue;

    for (const category of hashtagCategories) {
      if (note.body.toLowerCase().includes(category.toLowerCase())) {
        if (!categorizedNotes[category]) {
          categorizedNotes[category] = [];
        }
        categorizedNotes[category].push({ ...note, residentName: resident.displayName });
      }
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100">
      <div className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-neutral-900">Shift Report by Category</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              className="w-32 border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="text-neutral-500">to</span>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              className="w-32 border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center rounded-md border border-neutral-300 bg-white">
            <button 
              onClick={() => setFilterType('initiated')}
              className={`px-3 py-2 text-sm font-medium rounded-l-md ${filterType === 'initiated' ? 'bg-indigo-600 text-white' : 'text-neutral-700 hover:bg-neutral-50'}`}
            >
              Initiated
            </button>
            <button 
              onClick={() => setFilterType('active')}
              className={`px-3 py-2 text-sm font-medium rounded-r-md ${filterType === 'active' ? 'bg-indigo-600 text-white' : 'text-neutral-700 hover:bg-neutral-50'}`}
            >
              Active
            </button>
          </div>
          <button 
            onClick={() => setShowPrecautionList(true)}
            className="px-4 py-2 bg-neutral-600 text-white rounded-md hover:bg-neutral-700 text-sm font-medium flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Precaution List
          </button>
          <button 
            onClick={() => setShowReportBuilder(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Build Report
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {Object.keys(categorizedNotes).length > 0 ? (
          Object.entries(categorizedNotes).map(([category, notes]) => (
            <section key={category}>
              <h2 className="text-lg font-bold text-neutral-800 mb-3 flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-600" />
                {category.substring(1)}
              </h2>
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <table className="min-w-full divide-y divide-neutral-200">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider w-1/4">Resident</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider w-1/4">Date/Time</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-bold text-neutral-600 uppercase tracking-wider w-1/2">Note</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-200">
                    {notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(note => (
                      <tr key={note.id}>
                        <td className="px-4 py-3 text-sm font-medium text-neutral-900 align-top">{note.residentName}</td>
                        <td className="px-4 py-3 text-sm text-neutral-600 align-top whitespace-nowrap">{new Date(note.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-neutral-700 align-top whitespace-pre-wrap">{note.body}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        ) : (
          <div className="text-center py-16">
            <p className="text-neutral-500">No categorized notes found for the selected period.</p>
            <p className="text-xs text-neutral-400 mt-2">Add notes with hashtags like #Symptom or #Fall to see them here.</p>
          </div>
        )}
      </div>

      {showPrecautionList && startDate && (
        <DailyPrecautionList date={startDate} onClose={() => setShowPrecautionList(false)} />
      )}

      {showReportBuilder && (
        <ReportBuilderModal 
          onClose={() => setShowReportBuilder(false)} 
          onSave={(report) => {
            updateDB(draft => {
              const facility = draft.data.facilities.byId[activeFacilityId];
              if (facility) {
                if (!facility.customReports) {
                  facility.customReports = [];
                }
                facility.customReports.push(report);
              }
            });
          }}
        />
      )}
    </div>
  );
};

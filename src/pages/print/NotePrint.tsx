import React, { useMemo } from "react";
import { loadDB } from "../../storage/engine";
import { PrintLayout } from "./PrintLayout";
import { ShiftLogEntry } from "../../domain/models";

const NotePrint: React.FC = () => {
  const db = useMemo(() => loadDB(), []);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const noteId = params.get("noteId");
  const facilityId = db.data.facilities.activeFacilityId;
  const facility = db.data.facilities.byId[facilityId];
  const store = db.data.facilityData[facilityId];
  
  const note = useMemo(() => {
    return store.shiftLog?.[noteId || ""];
  }, [store.shiftLog, noteId]);

  React.useEffect(() => {
    const timer = setTimeout(() => window.print(), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!note) return <div className="p-8 text-red-600">Note not found</div>;

  return (
    <PrintLayout
      title="Shift Log Entry"
      facilityName={facility.name}
      facilityAddress={facility.address}
      dohId={facility.dohId}
    >
      <div className="border border-neutral-200 rounded-lg p-6 bg-white">
        <div className="flex justify-between items-start mb-4 border-b border-neutral-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg text-neutral-900">{note.shift} Shift</span>
              {note.unit && (
                <span className="px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-sm font-medium">
                  {note.unit}
                </span>
              )}
            </div>
            <div className="text-sm text-neutral-500">
              {new Date(note.createdAtISO).toLocaleString()}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
             <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${
                note.priority === 'Action Needed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-neutral-50 text-neutral-600 border-neutral-200'
             }`}>
               {note.priority}
             </span>
             <div className="flex gap-1">
               {note.tags.map(tag => (
                 <span key={tag} className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 rounded text-[10px] border border-neutral-200">
                   {tag}
                 </span>
               ))}
             </div>
          </div>
        </div>

        <div className="text-base text-neutral-900 whitespace-pre-wrap leading-relaxed mb-6">
          {note.body}
        </div>

        {(note.residentRefs?.length ?? 0) > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Linked Residents</h4>
            <div className="flex flex-wrap gap-2">
              {note.residentRefs?.map(ref => (
                <div key={ref.mrn} className="px-2 py-1 bg-indigo-50 text-indigo-800 border border-indigo-100 rounded text-sm">
                  {ref.name} ({ref.mrn})
                </div>
              ))}
            </div>
          </div>
        )}

        {note.outbreakRef && (
          <div>
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Linked Outbreak</h4>
            <div className="px-2 py-1 bg-red-50 text-red-800 border border-red-100 rounded text-sm inline-block">
              {note.outbreakRef.name}
            </div>
          </div>
        )}
      </div>
    </PrintLayout>
  );
};

export default NotePrint;

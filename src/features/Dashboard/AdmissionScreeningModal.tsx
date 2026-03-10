import React from 'react';
import { X } from 'lucide-react';
import { useFacilityData } from '../../app/providers';
import { Resident, ResidentNote } from '../../domain/models';
import { formatDateLikeForDisplay } from '../../lib/dateUtils';
import { useNavigate } from 'react-router-dom';

interface Props {
  onClose: () => void;
}

export const AdmissionScreeningModal: React.FC<Props> = ({ onClose }) => {
  const { store } = useFacilityData();
  const navigate = useNavigate();

  const residents = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly);
  const notes = Object.values(store.notes) as ResidentNote[];

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recentAdmissions = residents.filter(r => r.admissionDate && new Date(r.admissionDate) > threeDaysAgo);

  const residentsNeedingScreening = recentAdmissions.filter(r => {
    const hasScreeningNote = notes.some(n => 
      n.residentRef.kind === 'mrn' && 
      n.residentRef.id === r.mrn && 
      n.title?.includes('Admission Screening')
    );
    return !hasScreeningNote;
  });

  const handleGenerateNote = (mrn: string) => {
    onClose();
    navigate(`/note-generator?mrn=${encodeURIComponent(mrn)}&noteType=ADMISSION_SCREENING`);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Admission Screening Status (Last 72 Hours)</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm mb-4">
            <strong>{residentsNeedingScreening.length}</strong> resident(s) require an admission screening note.
          </div>
          <ul className="divide-y divide-neutral-100">
            {residentsNeedingScreening.map(r => (
              <li key={r.mrn} className="py-2 flex justify-between items-center text-sm">
                <div>
                  <p className="font-medium text-neutral-800">{r.displayName}</p>
                  <p className="text-neutral-500">Admitted: {formatDateLikeForDisplay(r.admissionDate) || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-red-600 font-semibold">Screening Due</span>
                  <button
                    onClick={() => handleGenerateNote(r.mrn)}
                    className="px-3 py-1 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Generate Note
                  </button>
                </div>
              </li>
            ))}
            {residentsNeedingScreening.length === 0 && (
              <div className="text-center py-12 text-neutral-500">
                <p>All recent admissions have been screened.</p>
              </div>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { X } from 'lucide-react';
import { useFacilityData } from '../../app/providers';
import { ABTCourse, Resident } from '../../domain/models';

interface Props {
  onClose: () => void;
}

export const ActiveAbtModal: React.FC<Props> = ({ onClose }) => {
  const { store } = useFacilityData();

  const abtCourses = Object.values(store.abts) as ABTCourse[];

  const activeAbts = abtCourses.filter(a => a.status === 'active');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const postAbtReview = abtCourses.filter(a => {
    if (!a.endDate) return false;
    const endDate = new Date(a.endDate);
    endDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - endDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 1 && diffDays <= 3;
  });

  const getResident = (ref: { kind: string, id: string }): Resident | undefined => {
    if (ref.kind === 'mrn') {
      return store.residents[ref.id];
    }
    return undefined;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Antibiotic Stewardship</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div>
            <h3 className="font-bold text-lg text-neutral-800 mb-2 pb-1 border-b border-neutral-200">Active Antibiotic Courses ({activeAbts.length})</h3>
            {activeAbts.length > 0 ? (
              <table className="w-full text-sm text-left text-neutral-500">
                <thead className="text-xs text-neutral-700 uppercase bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-6 py-3">Resident</th>
                    <th scope="col" className="px-6 py-3">Medication</th>
                    <th scope="col" className="px-6 py-3">Start Date</th>
                    <th scope="col" className="px-6 py-3">Indication</th>
                  </tr>
                </thead>
                <tbody>
                  {activeAbts.map(abt => {
                    const resident = getResident(abt.residentRef);
                    return (
                      <tr key={abt.id} className="bg-white border-b hover:bg-neutral-50">
                        <td className="px-6 py-4 font-medium text-neutral-900">{resident?.displayName || 'Unknown'}</td>
                        <td className="px-6 py-4">{abt.medication}</td>
                        <td className="px-6 py-4">{abt.startDate ? new Date(abt.startDate).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-6 py-4">{abt.indication || 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-center py-8 text-neutral-500">No active antibiotic courses.</p>
            )}
          </div>

          <div className="mt-8">
            <h3 className="font-bold text-lg text-neutral-800 mb-2 pb-1 border-b border-neutral-200">Post-ABT Review ({postAbtReview.length})</h3>
            {postAbtReview.length > 0 ? (
              <table className="w-full text-sm text-left text-neutral-500">
                <thead className="text-xs text-neutral-700 uppercase bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-6 py-3">Resident</th>
                    <th scope="col" className="px-6 py-3">Medication</th>
                    <th scope="col" className="px-6 py-3">End Date</th>
                    <th scope="col" className="px-6 py-3">Days Since End</th>
                  </tr>
                </thead>
                <tbody>
                  {postAbtReview.map(abt => {
                    const resident = getResident(abt.residentRef);
                    const endDate = new Date(abt.endDate!)
                    const diffTime = today.getTime() - endDate.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return (
                      <tr key={abt.id} className="bg-white border-b hover:bg-neutral-50">
                        <td className="px-6 py-4 font-medium text-neutral-900">{resident?.displayName || 'Unknown'}</td>
                        <td className="px-6 py-4">{abt.medication}</td>
                        <td className="px-6 py-4">{endDate.toLocaleDateString()}</td>
                        <td className="px-6 py-4">{diffDays}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-center py-8 text-neutral-500">No residents require post-antibiotic review.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
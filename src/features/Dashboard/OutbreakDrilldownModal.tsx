import React from 'react';
import { X } from 'lucide-react';
import { useFacilityData } from '../../app/providers';
import { Outbreak, OutbreakCase, Resident } from '../../domain/models';

interface Props {
  onClose: () => void;
}

export const OutbreakDrilldownModal: React.FC<Props> = ({ onClose }) => {
  const { store } = useFacilityData();

  const activeOutbreaks = (Object.values(store.outbreaks) as Outbreak[]).filter(o => o.status !== 'closed');

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
          <h2 className="text-xl font-bold text-neutral-900">Active Outbreaks</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          {activeOutbreaks.map(outbreak => (
            <div key={outbreak.id} className="mb-8">
              <h3 className="font-bold text-lg text-neutral-800 mb-2 pb-1 border-b border-neutral-200">{outbreak.title}</h3>
              <table className="w-full text-sm text-left text-neutral-500">
                <thead className="text-xs text-neutral-700 uppercase bg-neutral-50">
                  <tr>
                    <th scope="col" className="px-6 py-3">Resident</th>
                    <th scope="col" className="px-6 py-3">Status</th>
                    <th scope="col" className="px-6 py-3">Symptom Onset</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.values(store.outbreakCases) as OutbreakCase[]).filter(c => c.outbreakId === outbreak.id).map(caseItem => {
                    const resident = getResident(caseItem.residentRef);
                    return (
                      <tr key={caseItem.id} className="bg-white border-b hover:bg-neutral-50">
                        <td className="px-6 py-4 font-medium text-neutral-900">{resident?.displayName || 'Unknown'}</td>
                        <td className="px-6 py-4">{caseItem.caseStatus}</td>
                        <td className="px-6 py-4">{caseItem.symptomOnsetDate ? new Date(caseItem.symptomOnsetDate).toLocaleDateString() : 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {activeOutbreaks.length === 0 && (
            <div className="text-center py-12 text-neutral-500">
              <p>No active outbreaks.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

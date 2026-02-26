import React from 'react';
import { X, Printer } from 'lucide-react';
import { useFacilityData } from '../../app/providers';
import { IPEvent, Resident } from '../../domain/models';

interface Props {
  onClose: () => void;
}

export const ActivePrecautionsModal: React.FC<Props> = ({ onClose }) => {
  const { store } = useFacilityData();
  const [printView, setPrintView] = React.useState(false);

  const activePrecautions = (Object.values(store.infections) as IPEvent[]).filter(ip => ip.status === 'active' && ip.isolationType);

  const getResident = (ref: { kind: string, id: string }): Resident | undefined => {
    if (ref.kind === 'mrn') {
      return store.residents[ref.id];
    }
    return undefined; // Or handle quarantine residents if needed
  };

  const calculateDuration = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return `${diffDays} day(s)`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Active Precautions</h2>
          <div className="flex items-center gap-4">
            <button onClick={() => setPrintView(!printView)} className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-800">
              <Printer className="w-4 h-4" />
              {printView ? 'Exit Print View' : 'Print by Unit'}
            </button>
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div className={`p-6 overflow-y-auto flex-1 ${printView ? 'printable-area' : ''}`}>
          <table className="w-full text-sm text-left text-neutral-500">
            <thead className="text-xs text-neutral-700 uppercase bg-neutral-50">
              <tr>
                <th scope="col" className="px-6 py-3">Room</th>
                <th scope="col" className="px-6 py-3">Resident Name</th>
                <th scope="col" className="px-6 py-3">Precaution Type</th>
                <th scope="col" className="px-6 py-3">Infection Source</th>
                <th scope="col" className="px-6 py-3">Duration</th>
              </tr>
            </thead>
            <tbody>
              {activePrecautions.map(ip => {
                const resident = getResident(ip.residentRef);
                return (
                  <tr key={ip.id} className="bg-white border-b hover:bg-neutral-50">
                    <td className="px-6 py-4 font-medium text-neutral-900">{resident?.currentRoom || 'N/A'}</td>
                    <td className="px-6 py-4">{resident?.displayName || 'Unknown'}</td>
                    <td className="px-6 py-4">{ip.ebp ? 'EBP' : 'Isolation'} - {ip.isolationType}</td>
                    <td className="px-6 py-4">{ip.sourceOfInfection || 'N/A'}</td>
                    <td className="px-6 py-4">{calculateDuration(ip.createdAt)}</td>
                  </tr>
                );
              })}
              {activePrecautions.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-neutral-500">No residents on active precautions.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
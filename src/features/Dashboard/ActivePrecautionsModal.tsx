import React from 'react';
import { X } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { IPEvent, Resident } from '../../domain/models';
import { ExportPdfButton } from '../../components/ExportPdfButton';
import { DrilldownHeader } from '../../components/DrilldownHeader';

interface Props {
  onClose: () => void;
}

export const ActivePrecautionsModal: React.FC<Props> = ({ onClose }) => {
  const { store } = useFacilityData();
  const { db } = useDatabase();
  const [selectedUnit, setSelectedUnit] = React.useState('all');

  const facilityId = db.data.facilities.activeFacilityId;
  const facilityName = db.data.facilities.byId[facilityId]?.name || 'Facility';

  const activePrecautions = (Object.values(store.infections || {}) as IPEvent[]).filter(ip => ip && ip.status === 'active' && (ip.isolationType || ip.ebp));

  const getResident = (ref: { kind: string, id: string }): Resident | undefined => {
    if (ref.kind === 'mrn') {
      return store.residents[ref.id];
    }
    return undefined;
  };

  const units = React.useMemo(() => {
    const unitSet = new Set<string>();
    activePrecautions.forEach((ip) => {
      const resident = getResident(ip.residentRef);
      const unit = resident?.currentUnit?.trim() || 'Unknown';
      unitSet.add(unit);
    });
    return Array.from(unitSet).sort();
  }, [activePrecautions]);

  const filteredPrecautions = activePrecautions.filter((ip) => {
    if (selectedUnit === 'all') return true;
    const resident = getResident(ip.residentRef);
    return (resident?.currentUnit?.trim() || 'Unknown') === selectedUnit;
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh]">
          <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50 space-y-3">
            <DrilldownHeader
              title="Active Precautions"
              subtitle="Filtered view"
              right={
                <ExportPdfButton
                  label="Export PDF"
                  filename="active-precautions"
                  buildSpec={() => ({
                    title: 'Residents on Precautions or Isolation',
                    orientation: 'landscape',
                    template: 'ACTIVE_PRECAUTIONS_TEMPLATE_V1',
                    facilityName,
                    subtitleLines: [
                      `UNIT: ${selectedUnit === 'all' ? 'All Units' : selectedUnit}`,
                      `DATE: ${new Date().toLocaleDateString()}`,
                      'SHIFT: Day',
                      'PREPARED BY: ',
                    ],
                    sections: [{
                      type: 'table',
                      columns: ['RM. #', "RESIDENT’S NAME", 'PRECAUTION/ISOLATION', 'INFECTED SOURCE', 'DURATION'],
                      rows: filteredPrecautions.map((ip) => {
                        const resident = getResident(ip.residentRef);
                        const startDate = ip.onsetDate || ip.createdAt;
                        const days = Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
                        const residentWithMrn = resident?.displayName
                          ? `${resident.displayName}${resident.mrn ? ` (${resident.mrn})` : ''}`
                          : 'Unknown';
                        return [
                          resident?.currentRoom || 'N/A',
                          residentWithMrn,
                          ip.ebp ? 'EBP' : `ISOLATION / ${ip.isolationType || 'N/A'}`,
                          ip.sourceOfInfection || ip.organism || 'N/A',
                          `${days} days and ongoing`,
                        ];
                      }),
                    }],
                  })}
                />
              }
            />
            <div className="flex items-center justify-between gap-4">
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="border border-neutral-300 rounded-md p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Units</option>
                {units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
              <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto flex-1">
            <table className="w-full text-sm text-left text-neutral-500">
              <thead className="text-xs text-neutral-700 uppercase bg-neutral-50">
                <tr>
                  <th scope="col" className="px-4 py-3">Resident Name</th>
                  <th scope="col" className="px-4 py-3">Room/Unit</th>
                  <th scope="col" className="px-4 py-3">Precaution Type</th>
                  <th scope="col" className="px-4 py-3">Isolation/EBP Indication</th>
                  <th scope="col" className="px-4 py-3">Start Date</th>
                  <th scope="col" className="px-4 py-3">Organism</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPrecautions.map(ip => {
                  const resident = getResident(ip.residentRef);
                  return (
                    <tr key={ip.id} className="bg-white border-b hover:bg-neutral-50">
                      <td className="px-4 py-4 font-medium text-neutral-900">{resident?.displayName || 'Unknown'}</td>
                      <td className="px-4 py-4">{resident?.currentRoom || 'N/A'} / {resident?.currentUnit || 'N/A'}</td>
                      <td className="px-4 py-4">{ip.ebp ? 'EBP' : 'Isolation'}</td>
                      <td className="px-4 py-4">{ip.isolationType || ip.sourceOfInfection || 'N/A'}</td>
                      <td className="px-4 py-4">{new Date(ip.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-4">{ip.organism || 'N/A'}</td>
                      <td className="px-4 py-4">{ip.status}</td>
                    </tr>
                  );
                })}
                {filteredPrecautions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-neutral-500">No residents on active precautions.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

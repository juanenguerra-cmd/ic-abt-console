import React from 'react';
import { X, Printer } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { IPEvent, Resident } from '../../domain/models';

interface Props {
  onClose: () => void;
}

export const ActivePrecautionsModal: React.FC<Props> = ({ onClose }) => {
  const { store } = useFacilityData();
  const { db } = useDatabase();
  const [selectedUnit, setSelectedUnit] = React.useState('all');

  const facilityId = db.data.facilities.activeFacilityId;
  const facilityName = db.data.facilities.byId[facilityId]?.name || 'Facility';

  const activePrecautions = (Object.values(store.infections) as IPEvent[]).filter(ip => ip.status === 'active' && (ip.isolationType || ip.ebp));

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

  const handlePrint = () => {
    window.print();
  };

  const printedDate = new Date().toLocaleDateString();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .precaution-print-area, .precaution-print-area * { visibility: visible; }
          .precaution-print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; display: block !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 no-print">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col h-[90vh]">
          <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
            <h2 className="text-xl font-bold text-neutral-900">Active Precautions</h2>
            <div className="flex items-center gap-4">
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="border border-neutral-300 rounded-md p-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Units</option>
                {units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
              <button onClick={handlePrint} className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-800">
                <Printer className="w-4 h-4" />
                Print Precaution List
              </button>
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

      {/* Printable area */}
      <div className="precaution-print-area" style={{ display: 'none' }}>
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{facilityName}</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Active Precaution List</div>
            <div style={{ fontSize: '11px' }}>Printed: {printedDate} | Unit: {selectedUnit === 'all' ? 'All Units' : selectedUnit}</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>Resident Name</th>
                <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>Room/Unit</th>
                <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>Precaution Type</th>
                <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>Isolation Type / EBP Indication</th>
                <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>Start Date</th>
                <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>Organism</th>
                <th style={{ border: '1px solid #000', padding: '4px 6px', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPrecautions.map(ip => {
                const resident = getResident(ip.residentRef);
                return (
                  <tr key={ip.id}>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{resident?.displayName || 'Unknown'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{resident?.currentRoom || 'N/A'} / {resident?.currentUnit || 'N/A'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{ip.ebp ? 'EBP' : 'Isolation'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{ip.isolationType || ip.sourceOfInfection || 'N/A'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{new Date(ip.createdAt).toLocaleDateString()}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{ip.organism || 'N/A'}</td>
                    <td style={{ border: '1px solid #000', padding: '4px 6px' }}>{ip.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

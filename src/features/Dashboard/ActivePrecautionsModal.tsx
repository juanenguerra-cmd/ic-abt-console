import React from 'react';
import { X, Printer } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { IPEvent, Resident } from '../../domain/models';
import { printPrecautionsNode } from '../../print/precautionsPrint';

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

  const printedDate = new Date().toLocaleDateString();

  const handlePrint = () => {
    const now = new Date();
    
    // Calculate empty rows to fill the page
    const emptyRowsCount = Math.max(0, 12 - filteredPrecautions.length);
    const emptyRows = Array(emptyRowsCount).fill(0).map((_, i) => (
      <tr key={`empty-${i}`} style={{ height: '32px' }}>
        <td style={{ border: '2px solid #000', padding: '4px 8px' }}>&nbsp;</td>
        <td style={{ border: '2px solid #000', padding: '4px 8px' }}>&nbsp;</td>
        <td style={{ border: '2px solid #000', padding: '4px 8px' }}>&nbsp;</td>
        <td style={{ border: '2px solid #000', padding: '4px 8px' }}>&nbsp;</td>
        <td style={{ border: '2px solid #000', padding: '4px 8px' }}>&nbsp;</td>
      </tr>
    ));

    printPrecautionsNode(
      <div style={{ fontFamily: '"Arial", sans-serif', color: '#000', margin: 0, padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{facilityName}</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '16px' }}>RESIDENTS ON PRECAUTIONS OR ISOLATION</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '20px', fontWeight: 'bold', fontSize: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            UNIT: <span style={{ borderBottom: '2px solid #000', minWidth: '120px', textAlign: 'center', padding: '0 10px' }}>{selectedUnit === 'all' ? 'All Units' : selectedUnit}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            DATE: <span style={{ borderBottom: '2px solid #000', minWidth: '120px', textAlign: 'center', padding: '0 10px' }}>{printedDate}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            SHIFT: <span style={{ borderBottom: '2px solid #000', minWidth: '120px', textAlign: 'center', padding: '0 10px' }}>Day</span>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px', width: '10%' }}>RM. #</th>
              <th style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px', width: '25%' }}>RESIDENT'S NAME</th>
              <th style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px', width: '25%' }}>PRECAUTION/ISOLATION</th>
              <th style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px', width: '20%' }}>INFECTED SOURCE</th>
              <th style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '13px', width: '20%' }}>DURATION</th>
            </tr>
          </thead>
          <tbody>
            {filteredPrecautions.map(ip => {
              const resident = getResident(ip.residentRef);
              const days = Math.floor((now.getTime() - new Date(ip.createdAt).getTime()) / (1000 * 60 * 60 * 24));
              const duration = `${days} days and ongoing`;
              
              let precautionDisplay = '';
              if (ip.ebp) {
                precautionDisplay = 'EBP';
              } else {
                precautionDisplay = `ISOLATION / ${ip.isolationType || ''}`;
              }

              return (
                <tr key={ip.id} style={{ height: '32px' }}>
                  <td style={{ border: '2px solid #000', padding: '4px 8px', textAlign: 'left', fontSize: '12px' }}>{resident?.currentRoom || 'N/A'}</td>
                  <td style={{ border: '2px solid #000', padding: '4px 8px', textAlign: 'left', fontSize: '12px' }}>{resident?.displayName || 'Unknown'} ({resident?.mrn || ''})</td>
                  <td style={{ border: '2px solid #000', padding: '4px 8px', textAlign: 'left', fontSize: '12px' }}>{precautionDisplay}</td>
                  <td style={{ border: '2px solid #000', padding: '4px 8px', textAlign: 'left', fontSize: '12px' }}>{ip.organism || ip.sourceOfInfection || 'N/A'}</td>
                  <td style={{ border: '2px solid #000', padding: '4px 8px', textAlign: 'left', fontSize: '12px' }}>{duration}</td>
                </tr>
              );
            })}
            {emptyRows}
          </tbody>
        </table>

        <div style={{ marginTop: '30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontWeight: 'bold', fontSize: '13px' }}>
              Prepared by: <span style={{ borderBottom: '2px solid #000', flex: 1, minHeight: '1.2em' }}>Juan Enguerra RN</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontWeight: 'bold', fontSize: '13px' }}>
              Title: <span style={{ borderBottom: '2px solid #000', flex: 1, minHeight: '1.2em' }}></span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontWeight: 'bold', fontSize: '13px' }}>
              Signature: <span style={{ borderBottom: '2px solid #000', flex: 1, minHeight: '1.2em' }}></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontWeight: 'bold', fontSize: '13px' }}>
              Date/Time: <span style={{ borderBottom: '2px solid #000', flex: 1, minHeight: '1.2em' }}></span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '10px', fontStyle: 'italic', marginTop: '20px', lineHeight: 1.4 }}>
          * If the patient is known to have an MRSA, VRE or any Multidrug resistant infection or colonization, the health care worker should wear disposable gloves. Depending on the type of contact, a gown should also be worn. Patients must also wash their hands to avoid spreading the bacteria to others.
        </div>
      </div>,
      { extraCss: '@page { size: landscape; margin: 0.5in; }' }
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
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
    </>
  );
};

import React, { useMemo, useRef } from 'react';
import { useFacilityData } from '../../../app/providers';
import { IPEvent } from '../../../domain/models';
import { openPrecautionsPrintWindow } from '../../../print/precautionsPrint';

interface Props {
  date: Date;
  onClose: () => void;
  facilityName?: string;
  unit?: string;
  shift?: string;
}

interface PrecautionRow {
  room: string;
  residentName: string;
  precautionType: string;
  infectedSource: string;
  duration: string;
}

const formatDate = (d: Date) => {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

export const DailyPrecautionList: React.FC<Props> = ({ date, onClose, facilityName, unit, shift }) => {
  const { store } = useFacilityData();
  const printRef = useRef<HTMLDivElement>(null);


  const handlePrint = () => {
    const html = printRef.current?.innerHTML;
    if (!html) return;

    openPrecautionsPrintWindow({
      title: 'Daily Precaution List',
      html,
      pageStyle: '@page { size: letter; margin: 0.75in; }',
    });
  };

  const precautionList = useMemo(() => {
    const activePrecautions: PrecautionRow[] = [];
    const targetDate = new Date(date);
    targetDate.setHours(23, 59, 59, 999); // End of the selected day

    const activeIpEvents = (Object.values(store.infections) as IPEvent[]).filter(event => {
      const eventIsActive = event.status === 'active';
      const eventStarted = new Date(event.createdAt) <= targetDate;
      if (!eventIsActive || !eventStarted) return false;
      // Filter by unit if one is specified
      if (unit && unit !== 'All Units') {
        const eventUnit = event.locationSnapshot?.unit || store.residents[event.residentRef.id]?.currentUnit;
        if (eventUnit !== unit) return false;
      }
      return true;
    });

    for (const event of activeIpEvents) {
      const resident = store.residents[event.residentRef.id];
      if (!resident) continue;

      let precautionType = 'Standard';
      let infectedSource = 'N/A';

      if (event.isolationType) {
        precautionType = `Isolation: ${event.isolationType}`;
        infectedSource = event.organism || 'Unknown';
      } else if (event.ebp) {
        precautionType = `EBP: ${event.sourceOfInfection || 'Unknown'}`;
        infectedSource = event.sourceOfInfection || 'Device not specified';
      }

      activePrecautions.push({
        room: event.locationSnapshot?.room || resident.currentRoom || 'N/A',
        residentName: resident.displayName,
        precautionType,
        infectedSource,
        duration: `Onset: ${formatDate(new Date(event.createdAt))}`,
      });
    }
    
    // Sort by room number
    return activePrecautions.sort((a, b) => a.room.localeCompare(b.room));

  }, [store.residents, store.infections, date, unit]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 no-print">
          <h2 className="text-lg font-bold">Daily Precaution List</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md text-sm font-medium hover:bg-neutral-50 transition-colors">Print</button>
            <button onClick={onClose} className="px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-md">Close</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8">
          <div ref={printRef} className="bg-white text-black font-serif">
            <style>{`@page { size: letter; margin: 0.75in; }`}</style>
            <div className="flex flex-col min-h-[100vh]">
              <header className="text-center mb-4">
            <h1 className="text-xl font-bold">{facilityName || 'Facility'}</h1>
            <h2 className="text-lg font-bold uppercase">Residents on Precautions or Isolation</h2>
          </header>
          <div className="flex justify-between items-end mb-4 text-sm">
            <div className="flex items-end gap-2"><label className="font-bold">UNIT:</label><span className="border-b border-black min-w-[100px] inline-block">{unit || 'All Units'}</span></div>
            <div className="flex items-end gap-2"><label className="font-bold">DATE:</label><span className="border-b border-black min-w-[100px] inline-block">{formatDate(date)}</span></div>
            <div className="flex items-end gap-2"><label className="font-bold">SHIFT:</label><span className="border-b border-black min-w-[100px] inline-block">{shift || ''}</span></div>
          </div>
          <table className="w-full border-collapse border-2 border-black mb-4 text-sm">
            <thead>
              <tr>
                <th className="border border-black p-1 w-[10%] text-center">RM. #</th>
                <th className="border border-black p-1 w-[25%] text-center">RESIDENT'S NAME</th>
                <th className="border border-black p-1 w-[30%] text-center">PRECAUTION/ISOLATION</th>
                <th className="border border-black p-1 w-[20%] text-center">INFECTED SOURCE</th>
                <th className="border border-black p-1 w-[15%] text-center">DURATION</th>
              </tr>
            </thead>
            <tbody>
              {[...precautionList, ...Array(Math.max(0, 10 - precautionList.length)).fill(null)].map((item, index) => (
                <tr key={index} style={{ height: '40px' }}>
                  <td className="border border-black p-1 text-center">{item?.room}</td>
                  <td className="border border-black p-1">{item?.residentName}</td>
                  <td className="border border-black p-1">{item?.precautionType}</td>
                  <td className="border border-black p-1">{item?.infectedSource}</td>
                  <td className="border border-black p-1">{item?.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className="mt-auto">
            <div className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm mb-4">
              <div className="flex items-end gap-2"><label className="font-bold whitespace-nowrap">Prepared by:</label><span className="border-b border-black flex-1"></span></div>
              <div className="flex items-end gap-2"><label className="font-bold">Title:</label><span className="border-b border-black flex-1"></span></div>
              <div className="flex items-end gap-2"><label className="font-bold">Signature:</label><span className="border-b border-black flex-1"></span></div>
              <div className="flex items-end gap-2"><label className="font-bold whitespace-nowrap">Date/Time:</label><span className="border-b border-black flex-1"></span></div>
            </div>
            <p className="text-xs italic border-t border-black pt-2">
              * If the patient is known to have an MRSA, VRE or any Multidrug resistant infection or colonization, the health care worker should wear disposable gloves. Depending on the type of contact, a gown should also be worn. Patients must also wash their hands to avoid spreading the bacteria to others.
            </p>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

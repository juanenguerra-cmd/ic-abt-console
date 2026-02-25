import React, { useEffect, useMemo } from 'react';
import { useFacilityData } from '../../../app/providers';
import { IPEvent } from '../../../domain/models';

interface Props {
  date: Date;
  onClose: () => void;
}

interface PrecautionRow {
  room: string;
  residentName: string;
  precautionType: string;
  infectedSource: string;
  duration: string;
}

export const DailyPrecautionList: React.FC<Props> = ({ date, onClose }) => {
  const { store } = useFacilityData();

  useEffect(() => {
    setTimeout(() => {
      window.print();
      onClose();
    }, 100);
  }, []);

  const precautionList = useMemo(() => {
    const activePrecautions: PrecautionRow[] = [];
    const targetDate = new Date(date);
    targetDate.setHours(23, 59, 59, 999); // End of the selected day

    const activeIpEvents = (Object.values(store.infections) as IPEvent[]).filter(event => {
      const eventIsActive = event.status === 'active';
      const eventStarted = new Date(event.createdAt) <= targetDate;
      return eventIsActive && eventStarted;
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
        room: resident.currentRoom || 'N/A',
        residentName: resident.displayName,
        precautionType,
        infectedSource,
        duration: `Onset: ${new Date(event.createdAt).toLocaleDateString()}`,
      });
    }
    
    // Sort by room number
    return activePrecautions.sort((a, b) => a.room.localeCompare(b.room));

  }, [store.residents, store.infections, date]);

  return (
    <div className="printable-form-container bg-white text-black p-8 font-serif">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-form-container, .printable-form-container * { visibility: visible; }
          .printable-form-container { position: absolute; left: 0; top: 0; width: 100%; height: auto; }
        }
      `}</style>
      
      <div className="form-page flex flex-col h-[100vh]">
        <header className="text-center mb-4">
          <h1 className="text-xl font-bold">Long Beach Nursing & Rehabilitation Center</h1>
          <h2 className="text-lg font-bold">RESIDENTS ON PRECAUTIONS OR ISOLATION</h2>
        </header>

        <div className="flex justify-between items-end mb-4 text-sm">
          <div className="flex items-end gap-2"><label>UNIT:</label><span className="border-b border-black flex-1 min-w-[100px]">All Units</span></div>
          <div className="flex items-end gap-2"><label>DATE:</label><span className="border-b border-black flex-1 min-w-[100px]">{date.toLocaleDateString()}</span></div>
          <div className="flex items-end gap-2"><label>SHIFT:</label><span className="border-b border-black flex-1 min-w-[100px]"></span></div>
        </div>

        <table className="w-full border-collapse border-2 border-black mb-4 text-sm">
          <thead>
            <tr>
              <th className="border border-black p-1 w-[10%]">RM. #</th>
              <th className="border border-black p-1 w-[25%]">RESIDENT'S NAME</th>
              <th className="border border-black p-1 w-[30%]">PRECAUTION/ISOLATION</th>
              <th className="border border-black p-1 w-[20%]">INFECTED SOURCE</th>
              <th className="border border-black p-1 w-[15%]">DURATION</th>
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
            <div className="flex items-end gap-2"><label>Prepared by:</label><span className="border-b border-black flex-1"></span></div>
            <div className="flex items-end gap-2"><label>Title:</label><span className="border-b border-black flex-1"></span></div>
            <div className="flex items-end gap-2"><label>Signature:</label><span className="border-b border-black flex-1"></span></div>
            <div className="flex items-end gap-2"><label>Date/Time:</label><span className="border-b border-black flex-1"></span></div>
          </div>
          <p className="text-xs italic">
            * If the patient is known to have an MRSA, VRE or any Multidrug resistant infection or colonization, the health care worker should wear disposable gloves. Depending on the type of contact, a gown should also be worn. Patients must also wash their hands to avoid spreading the bacteria to others.
          </p>
        </footer>
      </div>
    </div>
  );
};

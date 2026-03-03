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
    const printWindow = window.open('', '_blank', 'width=900,height=1100');
    if (!printWindow) return;

    const now = new Date();
    const rows = filteredPrecautions.map(ip => {
      const resident = getResident(ip.residentRef);
      const days = Math.floor((now.getTime() - new Date(ip.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      const duration = `${days} days and ongoing`;
      
      let precautionDisplay = '';
      if (ip.ebp) {
        precautionDisplay = 'EBP';
      } else {
        precautionDisplay = `ISOLATION / ${ip.isolationType || ''}`;
      }

      return `
        <tr style="height: 32px;">
          <td style="border: 2px solid #000; padding: 4px 8px; text-align: left;">${resident?.currentRoom || 'N/A'}</td>
          <td style="border: 2px solid #000; padding: 4px 8px; text-align: left;">${resident?.displayName || 'Unknown'} (${resident?.mrn || ''})</td>
          <td style="border: 2px solid #000; padding: 4px 8px; text-align: left;">${precautionDisplay}</td>
          <td style="border: 2px solid #000; padding: 4px 8px; text-align: left;">${ip.organism || ip.sourceOfInfection || 'N/A'}</td>
          <td style="border: 2px solid #000; padding: 4px 8px; text-align: left;">${duration}</td>
        </tr>
      `;
    }).join('');

    // Add empty rows to fill the page if needed (like the template)
    const emptyRowsCount = Math.max(0, 12 - filteredPrecautions.length);
    const emptyRows = Array(emptyRowsCount).fill(0).map(() => `
      <tr style="height: 32px;">
        <td style="border: 2px solid #000; padding: 4px 8px;">&nbsp;</td>
        <td style="border: 2px solid #000; padding: 4px 8px;">&nbsp;</td>
        <td style="border: 2px solid #000; padding: 4px 8px;">&nbsp;</td>
        <td style="border: 2px solid #000; padding: 4px 8px;">&nbsp;</td>
        <td style="border: 2px solid #000; padding: 4px 8px;">&nbsp;</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Active Precaution List</title>
          <style>
            @page { size: landscape; margin: 0.5in; }
            body { font-family: "Arial", sans-serif; color: #000; margin: 0; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .facility-name { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
            .report-title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 16px; }
            
            .meta-row { display: flex; justify-content: center; gap: 40px; margin-bottom: 20px; font-weight: bold; font-size: 14px; }
            .meta-item { display: flex; align-items: baseline; gap: 8px; }
            .underline { border-bottom: 2px solid #000; min-width: 120px; text-align: center; padding: 0 10px; }

            table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 20px; }
            th { border: 2px solid #000; padding: 8px; text-align: center; font-weight: bold; text-transform: uppercase; font-size: 13px; }
            td { font-size: 12px; }

            .footer { margin-top: 30px; }
            .footer-row { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 15px; }
            .footer-item { display: flex; align-items: baseline; gap: 8px; font-weight: bold; font-size: 13px; }
            .footer-underline { border-bottom: 2px solid #000; flex: 1; min-height: 1.2em; }
            
            .disclaimer { font-size: 10px; font-style: italic; margin-top: 20px; line-height: 1.4; }
            
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="facility-name">${facilityName}</div>
            <div class="report-title">RESIDENTS ON PRECAUTIONS OR ISOLATION</div>
          </div>

          <div class="meta-row">
            <div class="meta-item">UNIT: <span class="underline">${selectedUnit === 'all' ? 'All Units' : selectedUnit}</span></div>
            <div class="meta-item">DATE: <span class="underline">${printedDate}</span></div>
            <div class="meta-item">SHIFT: <span class="underline">Day</span></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 10%;">RM. #</th>
                <th style="width: 25%;">RESIDENT'S NAME</th>
                <th style="width: 25%;">PRECAUTION/ISOLATION</th>
                <th style="width: 20%;">INFECTED SOURCE</th>
                <th style="width: 20%;">DURATION</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
              ${emptyRows}
            </tbody>
          </table>

          <div class="footer">
            <div class="footer-row">
              <div class="footer-item">Prepared by: <span class="footer-underline">Juan Enguerra RN</span></div>
              <div class="footer-item">Title: <span class="footer-underline"></span></div>
            </div>
            <div class="footer-row">
              <div class="footer-item">Signature: <span class="footer-underline"></span></div>
              <div class="footer-item">Date/Time: <span class="footer-underline"></span></div>
            </div>
          </div>

          <div class="disclaimer">
            * If the patient is known to have an MRSA, VRE or any Multidrug resistant infection or colonization, the health care worker should wear disposable gloves. Depending on the type of contact, a gown should also be worn. Patients must also wash their hands to avoid spreading the bacteria to others.
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
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

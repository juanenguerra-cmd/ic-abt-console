import React from 'react';
import { X } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { IPEvent, IPEventIndication, Resident } from '../../domain/models';
import { normalizeClinicalDevices } from '../../utils/clinicalDevices';
import { ExportPdfButton } from '../../components/ExportPdfButton';
import { DrilldownHeader } from '../../components/DrilldownHeader';

interface Props {
  onClose: () => void;
}

/**
 * Formats the "Precaution/Isolation" column value.
 * - Isolation: "Isolation / [Type]"
 * - EBP: "EBP/ [Indication Details]" (e.g. "EBP/ Wound")
 */
const getPrecautionColumnText = (ip: IPEvent): string => {
  if (ip.ebp) {
    const details = formatIndicationDetails(ip);
    return `EBP/ ${details}`;
  }
  return `Isolation / ${ip.isolationType || 'N/A'}`;
};

/**
 * Returns a short summary of EBP indications (used in the Precaution column).
 * e.g. "Indwelling, Wound"
 */
const formatIndicationDetails = (ip: IPEvent): string => {
  if (!ip.indications || ip.indications.length === 0) {
    return ip.isolationType || 'N/A';
  }
  return ip.indications.map(ind => formatIndicationShort(ind)).join(', ');
};

const formatIndicationShort = (ind: IPEventIndication): string => {
  if (ind.category === 'Catheter') {
    const ct = ind.catheterType === 'Other' ? (ind.catheterOtherText || 'Other') : ind.catheterType;
    return ct || 'Catheter';
  }
  if (ind.category === 'MDRO') {
    const mdroText = ind.mdroType === 'Other' ? (ind.mdroOtherText || 'Other MDRO') : ind.mdroType;
    return mdroText || 'MDRO';
  }
  if (ind.category === 'Wound') return 'Wound';
  return ind.category;
};

/**
 * Formats the "Infection Source" column value.
 * - Isolation: Infection Category or Organism
 * - EBP: Full breakdown of all indications
 *   e.g. "Left Thigh / Squamous Cell Carcinoma; MRSA (Indwelling)"
 */
const getInfectionSourceText = (ip: IPEvent): string => {
  if (ip.ebp) {
    if (!ip.indications || ip.indications.length === 0) {
      return ip.sourceOfInfection || ip.organism || 'N/A';
    }
    return ip.indications.map(ind => formatIndicationFull(ind)).join('; ') || 'N/A';
  }
  // Isolation: show infection category or organism
  return ip.infectionCategory || ip.organism || ip.sourceOfInfection || 'N/A';
};

const formatIndicationFull = (ind: IPEventIndication): string => {
  if (ind.category === 'Wound') {
    const parts = [ind.woundSite, ind.woundType].filter(Boolean).join(' / ');
    return parts || 'N/A';
  }
  if (ind.category === 'MDRO') {
    const mdroText = ind.mdroType === 'Other' ? (ind.mdroOtherText || 'Other MDRO') : (ind.mdroType || 'N/A');
    const catheter = ind.catheterType === 'Other' ? (ind.catheterOtherText || 'Other') : ind.catheterType;
    return catheter ? `MDRO: ${mdroText} (${catheter})` : `MDRO: ${mdroText}`;
  }
  if (ind.category === 'Catheter') {
    const ct = ind.catheterType === 'Other' ? (ind.catheterOtherText || 'Other') : ind.catheterType;
    return `Catheter: ${ct || 'N/A'}`;
  }
  return ind.category;
};

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
                    showSignatureLines: true,
                      subtitleLines: [
                        `UNIT: ${selectedUnit === 'all' ? 'All Units' : selectedUnit}`,
                        `DATE: ${new Date().toLocaleDateString()}`,
                        'SHIFT: Day',
                        'PREPARED BY: Juan Enguerra RN',
                      ],
                    sections: [{
                      type: 'table',
                      columns: ['RM. #', "RESIDENT'S NAME", 'PRECAUTION/ISOLATION', 'INFECTED SOURCE', 'DURATION'],
                      rows: filteredPrecautions.map((ip) => {
                        const resident = getResident(ip.residentRef);
                        const startDate = ip.onsetDate || ip.createdAt;
                        const days = Math.max(1, Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)));
                        const residentWithMrn = resident?.displayName
                          ? `${resident.displayName}${resident.mrn ? ` (${resident.mrn})` : ''}`
                          : 'Unknown';
                        
                        let duration = `${days} days and ongoing`;
                        
                        // Check for catheter change date if relevant
                        if (resident?.clinicalDevices) {
                          const source = (ip.sourceOfInfection || ip.organism || '').toLowerCase();
                          const isCatheterRelated = source.includes('catheter') || source.includes('foley');
                          
                          if (isCatheterRelated) {
                            const devices = normalizeClinicalDevices(resident);
                            const catheterDate = devices.indwellingCatheter.active 
                              ? devices.indwellingCatheter.insertedDate 
                              : devices.urinaryCatheter.active 
                                ? devices.urinaryCatheter.insertedDate 
                                : null;
                            
                            if (catheterDate) {
                              duration += `\n(Changed: ${new Date(catheterDate).toLocaleDateString()})`;
                            }
                          }
                        }

                        return [
                          resident?.currentRoom || 'N/A',
                          residentWithMrn,
                          getPrecautionColumnText(ip),
                          getInfectionSourceText(ip),
                          duration,
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
                  <th scope="col" className="px-4 py-3">Precaution/Isolation</th>
                  <th scope="col" className="px-4 py-3">Infection Source</th>
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
                      <td className="px-4 py-4">{getPrecautionColumnText(ip)}</td>
                      <td className="px-4 py-4">{getInfectionSourceText(ip)}</td>
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

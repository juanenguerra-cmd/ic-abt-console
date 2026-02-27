import React from 'react';
import { X } from 'lucide-react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Resident } from '../../domain/models';
import { useNavigate } from 'react-router-dom';

interface Props {
  onClose: () => void;
}

export const CensusModal: React.FC<Props> = ({ onClose }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { db } = useDatabase();
  const navigate = useNavigate();
  const facility = db.data.facilities.byId[activeFacilityId];

  const residents = Object.values(store.residents) as Resident[];
  const censusByUnit: Record<string, { total: number; male: number; female: number }> = {};

  residents.forEach((resident) => {
    const trimmedUnit = resident.currentUnit?.trim();
    const unit = trimmedUnit || 'Unknown';
    const sex = resident.sex?.trim().toLowerCase() || '';
    if (!censusByUnit[unit]) {
      censusByUnit[unit] = { total: 0, male: 0, female: 0 };
    }
    censusByUnit[unit].total += 1;
    if (sex === 'm' || sex === 'male') censusByUnit[unit].male += 1;
    else if (sex === 'f' || sex === 'female') censusByUnit[unit].female += 1;
  });

  const residentCount = residents.length;
  const capacityRate = facility.bedCapacity ? ((residentCount / facility.bedCapacity) * 100).toFixed(1) : null;

  const handleUnitClick = (unit: string) => {
    onClose();
    navigate('/resident-board', { state: { filterUnit: unit } });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[90vh]">
        <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
          <h2 className="text-xl font-bold text-neutral-900">Census Details</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-4 text-sm">
            Total Residents: <strong>{residentCount}</strong>
            {capacityRate && <> | Occupancy: <strong>{capacityRate}%</strong></>}
          </div>
          <p className="text-xs text-neutral-500 mb-2">Click a row count to view residents filtered by that unit.</p>
          <table className="w-full text-sm text-left text-neutral-600">
            <thead className="text-xs text-neutral-700 uppercase bg-neutral-50">
              <tr>
                <th className="px-4 py-2">Unit</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">M</th>
                <th className="px-4 py-2">F</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(censusByUnit).sort(([a], [b]) => a.localeCompare(b)).map(([unit, counts]) => (
                <tr key={unit} className="bg-white border-b hover:bg-neutral-50">
                  <td className="px-4 py-2 font-medium text-neutral-900">{unit}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleUnitClick(unit)}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold underline"
                    >
                      {counts.total}
                    </button>
                  </td>
                  <td className="px-4 py-2">{counts.male}</td>
                  <td className="px-4 py-2">{counts.female}</td>
                </tr>
              ))}
              {Object.keys(censusByUnit).length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-neutral-500">No residents available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

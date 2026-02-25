import React, { useState, useMemo } from 'react';
import { useFacilityData } from '../../app/providers';
import { floorplanLayout } from './floorplanLayout';
import { ArrowLeft, User } from 'lucide-react';

interface Props {
  onBack: () => void;
}

const CELL_WIDTH = 80;
const CELL_HEIGHT = 36;
const GAP = 8;

export const Floorplan: React.FC<Props> = ({ onBack }) => {
  const { store } = useFacilityData();
  const facility = store.facilities[store.activeFacilityId];
  const units = facility?.units || [];
  const [selectedUnitId, setSelectedUnitId] = useState(units[0]?.id || '');

  const residentsByRoom = useMemo(() => {
    const map: Record<string, any[]> = {};
    Object.values(store.residents).forEach(res => {
      if (res.currentUnit === selectedUnitId && res.currentRoom) {
        if (!map[res.currentRoom]) {
          map[res.currentRoom] = [];
        }
        map[res.currentRoom].push(res);
      }
    });
    return map;
  }, [store.residents, selectedUnitId]);

  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const unitNumberPrefix = selectedUnit?.name.match(/\d+/)?.[0] || '';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100">
      <div className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-1.5 text-neutral-600 hover:bg-neutral-100 rounded-md">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-neutral-900">Floor Plan</h1>
        </div>
        <div className="flex items-center gap-4">
          <label htmlFor="unit-select" className="text-sm font-medium text-neutral-700">Unit:</label>
          <select
            id="unit-select"
            value={selectedUnitId}
            onChange={e => setSelectedUnitId(e.target.value)}
            className="border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
          >
            {units.map(unit => (
              <option key={unit.id} value={unit.id}>{unit.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="relative bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
          {floorplanLayout.map(room => {
            const roomLabel = room.label.replace('{{num}}', unitNumberPrefix);
            const occupants = residentsByRoom[roomLabel] || [];
            const isOccupied = occupants.length > 0;

            // This is a placeholder for more complex status logic (e.g., isolation)
            const isSpecialStatus = roomLabel.includes('279-A') || roomLabel.includes('281-A');

            return (
              <div
                key={room.id}
                className={`absolute flex flex-col items-center justify-center rounded border-2 text-xs font-bold transition-colors ${isSpecialStatus ? 'bg-red-100 border-red-500 text-red-800' : isOccupied ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-neutral-100 border-neutral-300 text-neutral-500'}`}
                style={{
                  left: room.x * (CELL_WIDTH + GAP),
                  top: room.y * (CELL_HEIGHT + GAP),
                  width: room.w * CELL_WIDTH + (room.w - 1) * GAP,
                  height: room.h * CELL_HEIGHT + (room.h - 1) * GAP,
                }}
              >
                <span>{roomLabel}</span>
                {isOccupied && (
                  <div className="flex items-center gap-1 mt-1" title={occupants.map(o => o.displayName).join(', ')}>
                    <User className="w-3 h-3" />
                    <span className="text-[10px]">{occupants.length}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

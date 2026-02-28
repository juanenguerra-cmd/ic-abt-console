import React, { useState, useMemo } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { ArrowLeft } from 'lucide-react';
import { FloorMap, RoomStatus } from '../Heatmap/FloorMap';
import { FloorLayout, Resident } from '../../domain/models';

interface Props {
  onBack: () => void;
}

const CELL_WIDTH = 100;
const CELL_HEIGHT = 52;
const GAP = 16;

export const Floorplan: React.FC<Props> = ({ onBack }) => {
  const { store, activeFacilityId } = useFacilityData();
  const { db } = useDatabase();
  const facility = db.data.facilities.byId[activeFacilityId];
  const units = facility?.units || [];
  const [selectedUnitId, setSelectedUnitId] = useState(() => {
    const unit2 = units.find(u => u.name === 'Unit 2');
    if (unit2) return unit2.id;
    return units[0]?.id || '';
  });

  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const unitNumberPrefix = selectedUnit?.name.match(/\d+/)?.[0] || '';

  const layout: FloorLayout = useMemo(() => {
    if (facility.floorLayouts && facility.floorLayouts.length > 0) {
      return facility.floorLayouts[0];
    }

    let roomLabels: string[] = [];
    try {
      const storedMapping = localStorage.getItem('ltc_facility_rooms_config');
      if (storedMapping) {
        const mapping = JSON.parse(storedMapping);
        if (mapping[selectedUnitId]) {
          roomLabels = mapping[selectedUnitId].split(',').map((s: string) => s.trim()).filter(Boolean);
          roomLabels = Array.from(new Set(roomLabels)).sort();
        }
      }
    } catch (e) {}

    if (roomLabels.length === 0) {
      // Fallback to residents' rooms in this unit
      const residentsInUnit = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).filter(r => r.currentUnit === selectedUnitId);
      const uniqueRooms = new Set<string>();
      residentsInUnit.forEach(r => {
        if (r.currentRoom) uniqueRooms.add(r.currentRoom);
      });
      roomLabels = Array.from(uniqueRooms).sort();
    }

    if (roomLabels.length === 0) {
      return {
        id: 'empty',
        facilityId: activeFacilityId,
        name: 'Empty Layout',
        version: 1,
        updatedAt: new Date().toISOString(),
        rooms: []
      };
    }

    // Generate generic grid layout
    const cols = Math.max(Math.ceil(Math.sqrt(roomLabels.length)), 4);
    const rooms = roomLabels.map((label, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        roomId: `room-${label}`,
        x: col * (CELL_WIDTH + GAP),
        y: row * (CELL_HEIGHT + GAP),
        w: CELL_WIDTH,
        h: CELL_HEIGHT,
        label: label,
      };
    });

    return {
      id: 'generic',
      facilityId: activeFacilityId,
      name: 'Generic Layout',
      version: 1,
      updatedAt: new Date().toISOString(),
      rooms: rooms
    };
  }, [activeFacilityId, unitNumberPrefix, facility.floorLayouts, selectedUnitId, store.residents]);

  const roomStatuses = useMemo(() => {
    const statuses: Record<string, RoomStatus> = {};
    
    // Check for active IP events for these residents
    const activeInfections = Object.values(store.infections).filter(ip => ip.status === 'active');
    
    (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).forEach(res => {
      if (res.currentRoom) {
        const room = layout.rooms.find(r => r.label === res.currentRoom || r.label === res.currentRoom.replace(/^\d/, ''));
        if (room) {
          const infection = activeInfections.find(ip => ip.residentRef.kind === 'mrn' && ip.residentRef.id === res.mrn);
          if (infection) {
            if (infection.outbreakId) {
              statuses[room.roomId] = 'outbreak';
            } else if (infection.ebp) {
              statuses[room.roomId] = 'ebp';
            } else if (infection.isolationType) {
              statuses[room.roomId] = 'isolation';
            }
          }
        }
      }
    });
    
    return statuses;
  }, [store.residents, store.infections, layout.rooms]);

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
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <FloorMap 
            layout={layout} 
            facilityId={activeFacilityId}
            unitId={selectedUnitId || 'all'}
            roomStatuses={roomStatuses}
          />
        </div>
      </div>
    </div>
  );
};

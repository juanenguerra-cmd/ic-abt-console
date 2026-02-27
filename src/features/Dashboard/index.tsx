import React, { useState, useMemo } from 'react';
import { useFacilityData, useDatabase } from '../../app/providers';
import { Users, AlertCircle, FileText, Inbox, Building2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { FloorMap, RoomStatus } from '../Heatmap/FloorMap';
import { CensusModal } from './CensusModal';
import { ActivePrecautionsModal } from './ActivePrecautionsModal';
import { AdmissionScreeningModal } from './AdmissionScreeningModal';
import { ActiveAbtModal } from './ActiveAbtModal';
import { OutbreakDrilldownModal } from './OutbreakDrilldownModal';
import { FloorLayout } from '../../domain/models';

const CELL_WIDTH = 100;
const CELL_HEIGHT = 52;
const GAP = 16;

export const Dashboard: React.FC = () => {
  const { db } = useDatabase();
  const { activeFacilityId, store } = useFacilityData();
  const location = useLocation();
  const facility = db.data.facilities.byId[activeFacilityId];
  
  const layout: FloorLayout = useMemo(() => {
    if (facility.floorLayouts && facility.floorLayouts.length > 0) {
      return facility.floorLayouts[0];
    }

    let roomLabels: string[] = [];
    try {
      const storedMapping = localStorage.getItem('ltc_facility_rooms_config');
      if (storedMapping) {
        const mapping = JSON.parse(storedMapping);
        Object.values(mapping).forEach((roomsStr: any) => {
          const rooms = roomsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
          roomLabels.push(...rooms);
        });
        roomLabels = Array.from(new Set(roomLabels)).sort();
      }
    } catch (e) {}

    if (roomLabels.length === 0) {
      // Fallback to all residents' rooms
      const uniqueRooms = new Set<string>();
      Object.values(store.residents).forEach(r => {
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
  }, [activeFacilityId, facility.floorLayouts, store.residents]);

  const roomStatuses = useMemo(() => {
    const statuses: Record<string, RoomStatus> = {};
    const activeInfections = Object.values(store.infections).filter(ip => ip.status === 'active');
    
    Object.values(store.residents).forEach(res => {
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

  const [showCensusModal, setShowCensusModal] = useState(false);
  const [showPrecautionsModal, setShowPrecautionsModal] = useState(false);
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [showAbtModal, setShowAbtModal] = useState(false);
  const [showOutbreakModal, setShowOutbreakModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>("all");

  React.useEffect(() => {
    if ((location.state as { openModal?: string } | null)?.openModal === 'precautions') {
      setShowPrecautionsModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const units = useMemo(() => {
    const unitSet = new Set<string>();
    Object.values(store.residents).forEach(r => {
      if (r.currentUnit?.trim()) unitSet.add(r.currentUnit.trim());
    });
    return Array.from(unitSet).sort();
  }, [store.residents]);

  const filteredLayout = useMemo(() => {
    if (selectedUnit === "all") return layout;
    const roomsInUnit = new Set(
      Object.values(store.residents)
        .filter(r => r.currentUnit === selectedUnit && r.currentRoom)
        .map(r => r.currentRoom!)
    );
    return { ...layout, rooms: layout.rooms.filter(r => roomsInUnit.has(r.label || "")) };
  }, [layout, selectedUnit, store.residents]);

  // Calculate stats
  const activeResidents = Object.values(store.residents).filter(r => r.currentUnit && r.currentUnit.trim() !== "" && r.currentUnit.toLowerCase() !== "unassigned");
  const residentCount = activeResidents.length;
  const activePrecautionsCount = (Object.values(store.infections) as any[]).filter(ip => ip.status === 'active' && (ip.isolationType || ip.ebp)).length;
  const outbreakCount = (Object.values(store.outbreaks) as any[]).filter(o => o.status !== 'closed').length;
  const abtCount = (Object.values(store.abts) as any[]).filter(a => a.status === 'active').length;
  const qCount = Object.keys(store.quarantine).length;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const recentAdmissions = Object.values(store.residents).filter(r => r.admissionDate && new Date(r.admissionDate) > threeDaysAgo);

  const residentsNeedingScreeningCount = recentAdmissions.filter(r => {
    const hasScreeningNote = Object.values(store.notes).some(n => 
      n.residentRef.kind === 'mrn' && 
      n.residentRef.id === r.mrn && 
      n.title?.includes('Admission Screening')
    );
    return !hasScreeningNote;
  }).length;
  
  const capacityRate = facility.bedCapacity ? ((residentCount / facility.bedCapacity) * 100).toFixed(1) : null;

  return (
    <>
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div onClick={() => setShowCensusModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Census</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-neutral-900">{residentCount}</p>
                  {capacityRate && (
                    <span className="text-xs font-medium text-neutral-500">
                      ({capacityRate}% capacity)
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowPrecautionsModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active Precautions</p>
                <p className="text-2xl font-bold text-neutral-900">{activePrecautionsCount}</p>
              </div>
              <div className="p-2 bg-red-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowOutbreakModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active Outbreaks</p>
                <p className="text-2xl font-bold text-neutral-900">{outbreakCount}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded-lg">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowScreeningModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Admission Screening</p>
                <p className="text-2xl font-bold text-neutral-900">{residentsNeedingScreeningCount}</p>
              </div>
              <div className="p-2 bg-emerald-50 rounded-lg">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div onClick={() => setShowAbtModal(true)} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 cursor-pointer hover:bg-neutral-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-500">Active ABTs</p>
                <p className="text-2xl font-bold text-neutral-900">{abtCount}</p>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <Inbox className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-neutral-900">Live Floor Map</h2>
            {units.length > 0 && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-neutral-500" />
                <select
                  value={selectedUnit}
                  onChange={e => setSelectedUnit(e.target.value)}
                  className="border border-neutral-300 rounded-md px-2 py-1 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Units</option>
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}
          </div>
          <FloorMap 
            layout={filteredLayout} 
            roomStatuses={roomStatuses}
          />
        </div>
      </div>
      {showCensusModal && <CensusModal onClose={() => setShowCensusModal(false)} />}
      {showPrecautionsModal && <ActivePrecautionsModal onClose={() => setShowPrecautionsModal(false)} />}
      {showScreeningModal && <AdmissionScreeningModal onClose={() => setShowScreeningModal(false)} />}
      {showAbtModal && <ActiveAbtModal onClose={() => setShowAbtModal(false)} />}
      {showOutbreakModal && <OutbreakDrilldownModal onClose={() => setShowOutbreakModal(false)} />}
    </>
  );
};

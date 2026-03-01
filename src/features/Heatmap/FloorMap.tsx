import React from 'react';
import { useFacilityData } from '../../app/providers';
import { IPEvent, Resident, FloorLayout } from '../../domain/models';
import { GripVertical } from 'lucide-react';
import { loadLayout, mergeLayout, resetLayout, saveLayout } from '../../utils/floorMapLayout';
import { SymptomIndicator } from '../../utils/symptomIndicators';

export type RoomStatus = "normal" | "isolation" | "outbreak" | "ebp";

interface FloorMapProps {
  layout: FloorLayout;
  facilityId: string;
  unitId?: string;
  roomStatuses?: Record<string, RoomStatus>;
  /** Per-room symptom indicators computed from the rolling 96-hour window. Key is roomId. */
  symptomIndicators?: Record<string, SymptomIndicator>;
  onRoomClick?: (roomId: string) => void;
}

const STATUS_COLORS: Record<RoomStatus, string> = {
  normal: "bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50",
  isolation: "bg-yellow-100 border-yellow-400 text-yellow-800",
  outbreak: "bg-red-100 border-red-600 border-4 text-red-900 font-bold",
  ebp: "bg-blue-100 border-blue-400 text-blue-800",
};

export const FloorMap: React.FC<FloorMapProps> = ({
  layout,
  facilityId,
  unitId = 'all',
  roomStatuses = {},
  symptomIndicators = {},
  onRoomClick,
}) => {
  const { store } = useFacilityData();
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [draggingRoomId, setDraggingRoomId] = React.useState<string | null>(null);
  const [orderedRoomIds, setOrderedRoomIds] = React.useState<string[]>([]);
  const suppressNextClickRef = React.useRef(false);

  // Read global tile size from settings (1–10, default 5)
  const tileScale = React.useMemo(() => {
    try {
      const stored = localStorage.getItem(`ltc_floor_tile_size_global:${facilityId}`);
      const size = stored ? Number(stored) : 5;
      // width at size n = 40 + n*12; at size 5 (default) that is 100px → scale = (40 + n*12) / 100
      return (40 + size * 12) / 100;
    } catch { return 1; }
  }, [facilityId]);

  const sortedSlots = React.useMemo(
    () => [...layout.rooms].sort((a, b) => a.y - b.y || a.x - b.x),
    [layout.rooms]
  );
  const currentRoomIds = React.useMemo(() => sortedSlots.map(room => room.roomId), [sortedSlots]);

  React.useEffect(() => {
    const saved = loadLayout(facilityId, unitId);
    const merged = mergeLayout(saved, currentRoomIds);
    setOrderedRoomIds(merged);
  }, [facilityId, unitId, currentRoomIds]);

  // Calculate bounding box (scaled by tileScale)
  const maxX = Math.max(...layout.rooms.map(r => r.x * tileScale + r.w * tileScale), 0);
  const maxY = Math.max(...layout.rooms.map(r => r.y * tileScale + r.h * tileScale), 0);
  const canvasWidth = Math.max(maxX + 40, 800);
  const canvasHeight = Math.max(maxY + 40, 400);

  const getRoomTooltip = (roomLabel: string, roomId: string) => {
    const residents = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).filter(r => r.currentRoom === roomLabel || r.currentRoom?.replace(/^\d/, '') === roomLabel);
    if (residents.length === 0) return `Room ${roomLabel} (Unoccupied)`;

    return residents.map(res => {
      const precaution = (Object.values(store.infections) as IPEvent[]).find(ip => 
        ip.residentRef.kind === 'mrn' && 
        ip.residentRef.id === res.mrn && 
        ip.status === 'active' && 
        ip.isolationType
      );
      const precautionText = precaution ? `Precaution: ${precaution.isolationType}` : 'No Precautions';
      const indicator = symptomIndicators[roomId];
      const symptomParts: string[] = [];
      if (indicator?.respiratory) symptomParts.push('Respiratory (96h)');
      if (indicator?.gi) symptomParts.push('GI (96h)');
      const symptomText = symptomParts.length > 0 ? ` | ⚠ ${symptomParts.join(', ')}` : '';
      return `${res.displayName} - ${precautionText}${symptomText}`;
    }).join('\n');
  };

  const roomById = React.useMemo(
    () => Object.fromEntries(layout.rooms.map(room => [room.roomId, room])),
    [layout.rooms]
  );
  const displayRooms = orderedRoomIds.map(id => roomById[id]).filter((room): room is FloorLayout['rooms'][number] => !!room);

  const reorderRooms = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setOrderedRoomIds(prev => {
      const sourceIndex = prev.indexOf(sourceId);
      const targetIndex = prev.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      saveLayout(facilityId, unitId, next);
      return next;
    });
  };

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-neutral-500">
          {isEditMode ? 'Drag tiles to rearrange. Changes save automatically.' : ''}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditMode(prev => !prev)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border ${
              isEditMode
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
            }`}
          >
            {isEditMode ? 'Done' : 'Edit layout'}
          </button>
          {isEditMode && (
            <button
              onClick={() => {
                resetLayout(facilityId, unitId);
                const defaults = [...currentRoomIds];
                setOrderedRoomIds(defaults);
                saveLayout(facilityId, unitId, defaults);
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            >
              Reset layout
            </button>
          )}
        </div>
      </div>
      <div className="w-full overflow-auto bg-neutral-100 rounded-xl border border-neutral-200 p-4 min-h-[400px]">
        <div 
          className="relative bg-white shadow-inner rounded-lg border border-neutral-200"
          style={{ 
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            minWidth: `${canvasWidth}px`,
          }}
        >
            {displayRooms.map((room, index) => {
          const slot = sortedSlots[index];
          if (!slot) return null;
          const status = roomStatuses[room.roomId] || "normal";
          const colorClass = STATUS_COLORS[status];

          return (
            <div
              key={room.roomId}
              onClick={() => {
                if (suppressNextClickRef.current) {
                  suppressNextClickRef.current = false;
                  return;
                }
                onRoomClick?.(room.roomId);
              }}
              draggable={isEditMode}
              onDragStart={() => {
                if (!isEditMode) return;
                setDraggingRoomId(room.roomId);
              }}
              onDragOver={(e) => {
                if (!isEditMode) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!isEditMode || !draggingRoomId) return;
                e.preventDefault();
                reorderRooms(draggingRoomId, room.roomId);
                setDraggingRoomId(null);
                suppressNextClickRef.current = true;
              }}
              onDragEnd={() => setDraggingRoomId(null)}
              className={`absolute group flex flex-col items-center justify-center border-2 rounded transition-all shadow-sm ${colorClass} ${
                isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
              } ${draggingRoomId === room.roomId ? 'opacity-60' : ''}`}
              style={{
                left: `${slot.x * tileScale + 20}px`,
                top: `${slot.y * tileScale + 20}px`,
                width: `${slot.w * tileScale}px`,
                height: `${slot.h * tileScale}px`,
              }}
            >
              {isEditMode && (
                <div className="absolute left-1 top-1 opacity-70">
                  <GripVertical className="w-3 h-3 text-neutral-500" />
                </div>
              )}
              <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">
                Room
              </span>
              <span className="text-sm font-black leading-none">
                {room.label || "???"}
              </span>
              
              {status !== "normal" && (
                <div className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    status === 'isolation' ? 'bg-yellow-400' : status === 'outbreak' ? 'bg-red-400' : 'bg-blue-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    status === 'isolation' ? 'bg-yellow-500' : status === 'outbreak' ? 'bg-red-500' : 'bg-blue-500'
                  }`}></span>
                </div>
              )}

              {/* 96-hour Symptom Indicators */}
              {(() => {
                const indicator = symptomIndicators[room.roomId];
                if (!indicator?.respiratory && !indicator?.gi) return null;
                return (
                  <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5">
                    {indicator.respiratory && (
                      <span
                        title="Respiratory symptom signal within 96h"
                        className="text-[9px] font-bold leading-none bg-orange-500 text-white px-0.5 rounded"
                      >
                        R
                      </span>
                    )}
                    {indicator.gi && (
                      <span
                        title="GI symptom signal within 96h"
                        className="text-[9px] font-bold leading-none bg-purple-500 text-white px-0.5 rounded"
                      >
                        G
                      </span>
                    )}
                  </div>
                );
              })()}
              
              {/* Occupied Indicator */}
              {(() => {
                const occupants = (Object.values(store.residents) as Resident[]).filter(r => !r.isHistorical && !r.backOfficeOnly).filter(r => r.currentRoom === (room.label || room.roomId) || r.currentRoom?.replace(/^\d/, '') === (room.label || room.roomId));
                if (occupants.length > 0) {
                  return (
                    <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-[8px] font-bold px-1 rounded-sm shadow-sm">
                      {occupants.length}
                    </div>
                  );
                }
                return null;
              })()}
              <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-neutral-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-pre-wrap">
                {getRoomTooltip(room.label || room.roomId, room.roomId)}
              </div>
            </div>
          );
        })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 justify-center">
        {(Object.keys(STATUS_COLORS) as RoomStatus[]).map((status) => (
          <div key={status} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded border-2 ${STATUS_COLORS[status].split(' ')[0]} ${STATUS_COLORS[status].split(' ')[1]}`}></div>
            <span className="text-xs font-bold text-neutral-600 uppercase tracking-wide">
              {status}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold bg-orange-500 text-white px-1 rounded">R</span>
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wide">Respiratory (96h)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold bg-purple-500 text-white px-1 rounded">G</span>
          <span className="text-xs font-bold text-neutral-600 uppercase tracking-wide">GI (96h)</span>
        </div>
      </div>
    </div>
  );
};

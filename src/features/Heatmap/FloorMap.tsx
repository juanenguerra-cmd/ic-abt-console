import React from 'react';
import { useFacilityData } from '../../app/providers';
import { IPEvent, Resident, FloorLayout } from '../../domain/models';

export type RoomStatus = "normal" | "isolation" | "outbreak" | "ebp";

interface FloorMapProps {
  layout: FloorLayout;
  roomStatuses?: Record<string, RoomStatus>;
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
  roomStatuses = {},
  onRoomClick,
}) => {
  const { store } = useFacilityData();

  // Calculate bounding box
  const maxX = Math.max(...layout.rooms.map(r => r.x + r.w), 0);
  const maxY = Math.max(...layout.rooms.map(r => r.y + r.h), 0);
  const canvasWidth = Math.max(maxX + 40, 800);
  const canvasHeight = Math.max(maxY + 40, 400);

  const getRoomTooltip = (roomLabel: string) => {
    const residents = (Object.values(store.residents) as Resident[]).filter(r => r.currentRoom === roomLabel || r.currentRoom?.replace(/^\d/, '') === roomLabel);
    if (residents.length === 0) return `Room ${roomLabel} (Unoccupied)`;

    return residents.map(res => {
      const precaution = (Object.values(store.infections) as IPEvent[]).find(ip => 
        ip.residentRef.kind === 'mrn' && 
        ip.residentRef.id === res.mrn && 
        ip.status === 'active' && 
        ip.isolationType
      );
      const precautionText = precaution ? `Precaution: ${precaution.isolationType}` : 'No Precautions';
      return `${res.displayName} - ${precautionText}`;
    }).join('\n');
  };

  return (
    <div className="w-full flex flex-col">
      <div className="w-full overflow-hidden bg-neutral-100 rounded-xl border border-neutral-200 p-4 flex items-center justify-center min-h-[400px]">
        <div 
          style={{ 
            width: '100%',
            maxWidth: `${canvasWidth}px`,
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            position: 'relative',
          }}
        >
          <div 
            className="absolute top-0 left-0 bg-white shadow-inner rounded-lg border border-neutral-200 origin-top-left transition-transform duration-200"
            style={{ 
              width: '100%',
              height: '100%',
            }}
          >
            {layout.rooms.map((room) => {
          const status = roomStatuses[room.roomId] || "normal";
          const colorClass = STATUS_COLORS[status];

          return (
            <div
              key={room.roomId}
              onClick={() => onRoomClick?.(room.roomId)}
              className={`absolute group flex flex-col items-center justify-center border-2 rounded transition-all cursor-pointer shadow-sm ${colorClass}`}
              style={{
                left: `${((room.x + 20) / canvasWidth) * 100}%`,
                top: `${((room.y + 20) / canvasHeight) * 100}%`,
                width: `${(room.w / canvasWidth) * 100}%`,
                height: `${(room.h / canvasHeight) * 100}%`,
              }}
            >
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
              
              {/* Occupied Indicator */}
              {(() => {
                const occupants = Object.values(store.residents).filter(r => r.currentRoom === (room.label || room.roomId) || r.currentRoom?.replace(/^\d/, '') === (room.label || room.roomId));
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
                {getRoomTooltip(room.label || room.roomId)}
              </div>
            </div>
          );
        })}
          </div>
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
      </div>
    </div>
  );
};

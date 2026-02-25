import React from "react";
import { FloorLayout } from "../../domain/models";

export type RoomStatus = "normal" | "isolation" | "outbreak" | "ebp";

interface FloorMapProps {
  layout: FloorLayout;
  roomStatuses?: Record<string, RoomStatus>;
  onRoomClick?: (roomId: string) => void;
}

const STATUS_COLORS: Record<RoomStatus, string> = {
  normal: "bg-white border-neutral-300 text-neutral-600 hover:bg-neutral-50",
  isolation: "bg-red-50 border-red-300 text-red-700 hover:bg-red-100",
  outbreak: "bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100",
  ebp: "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100",
};

export const FloorMap: React.FC<FloorMapProps> = ({
  layout,
  roomStatuses = {},
  onRoomClick,
}) => {
  // Calculate bounding box for scaling if needed, 
  // but for now we'll assume a fixed coordinate system or container.
  // We'll use a relative container with overflow.

  return (
    <div className="w-full overflow-auto bg-neutral-100 rounded-xl border border-neutral-200 p-8 min-h-[600px]">
      <div 
        className="relative mx-auto bg-white shadow-inner rounded-lg border border-neutral-200"
        style={{ 
          width: "1000px", // Fixed virtual width for the map canvas
          height: "800px", // Fixed virtual height for the map canvas
        }}
      >
        {layout.rooms.map((room) => {
          const status = roomStatuses[room.roomId] || "normal";
          const colorClass = STATUS_COLORS[status];

          return (
            <div
              key={room.roomId}
              onClick={() => onRoomClick?.(room.roomId)}
              className={`absolute flex flex-col items-center justify-center border-2 rounded transition-all cursor-pointer shadow-sm ${colorClass}`}
              style={{
                left: `${room.x}px`,
                top: `${room.y}px`,
                width: `${room.w}px`,
                height: `${room.h}px`,
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
                    status === 'isolation' ? 'bg-red-400' : status === 'outbreak' ? 'bg-purple-400' : 'bg-amber-400'
                  }`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    status === 'isolation' ? 'bg-red-500' : status === 'outbreak' ? 'bg-purple-500' : 'bg-amber-500'
                  }`}></span>
                </div>
              )}
            </div>
          );
        })}
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

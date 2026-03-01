import React, { useState } from "react";
import { useDB } from "../context/DBContext";
import { FloorLayout, FloorRoom } from "../domain/models";
import { v4 as uuidv4 } from "uuid";
import { Plus, MapPin } from "lucide-react";

export function Heatmap() {
  const { db, activeFacilityId, updateDB } = useDB();
  const facility = db.data.facilities.byId[activeFacilityId];
  const layouts = facility?.floorLayouts || [];

  const [activeLayoutId, setActiveLayoutId] = useState<string | null>(
    layouts.length > 0 ? layouts[0].id : null
  );

  const handleAddLayout = () => {
    const name = prompt("Enter Layout Name:");
    if (!name) return;
    const newLayout: FloorLayout = {
      id: uuidv4(),
      facilityId: activeFacilityId,
      name,
      rooms: [],
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    updateDB((draft) => {
      const fac = draft.data.facilities.byId[activeFacilityId];
      if (!fac.floorLayouts) fac.floorLayouts = [];
      fac.floorLayouts.push(newLayout);
    });
    setActiveLayoutId(newLayout.id);
  };

  const activeLayout = layouts.find((l) => l.id === activeLayoutId);

  const handleAddRoom = () => {
    if (!activeLayout) return;
    const label = prompt("Enter Room Label:");
    if (!label) return;
    updateDB((draft) => {
      const fac = draft.data.facilities.byId[activeFacilityId];
      const layout = fac.floorLayouts?.find((l) => l.id === activeLayoutId);
      if (layout) {
        layout.rooms.push({
          roomId: uuidv4(),
          x: Math.random() * 400,
          y: Math.random() * 400,
          w: 80,
          h: 60,
          label,
        });
        layout.updatedAt = new Date().toISOString();
        layout.version++;
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-neutral-900 tracking-tight">Facility Heatmap</h2>
        <div className="flex space-x-3">
          <button
            onClick={handleAddLayout}
            className="inline-flex items-center px-4 py-2 border border-neutral-300 shadow-sm text-sm font-medium rounded-md text-neutral-700 bg-white hover:bg-neutral-50"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Layout
          </button>
          {activeLayout && (
            <button
              onClick={handleAddRoom}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
            >
              <MapPin className="mr-2 h-4 w-4" /> Add Room
            </button>
          )}
        </div>
      </div>

      {layouts.length > 0 && (
        <div className="flex space-x-4 border-b border-neutral-200 pb-2">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => setActiveLayoutId(layout.id)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                activeLayoutId === layout.id
                  ? "bg-emerald-100 text-emerald-800"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {layout.name}
            </button>
          ))}
        </div>
      )}

      {activeLayout ? (
        <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden relative h-[600px] w-full">
          {activeLayout.rooms.map((room) => (
            <div
              key={room.roomId}
              className="absolute border-2 border-neutral-400 bg-neutral-100 flex items-center justify-center text-xs font-medium text-neutral-700 shadow-sm hover:bg-emerald-50 hover:border-emerald-400 cursor-pointer transition-colors"
              style={{
                left: `${room.x}px`,
                top: `${room.y}px`,
                width: `${room.w}px`,
                height: `${room.h}px`,
              }}
            >
              {room.label}
            </div>
          ))}
          {activeLayout.rooms.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
              No rooms added to this layout yet.
            </div>
          )}
        </div>
      ) : (
        <div className="p-12 text-center border-2 border-dashed border-neutral-300 rounded-lg">
          <p className="text-neutral-500">No layouts configured. Add a layout to begin mapping.</p>
        </div>
      )}
    </div>
  );
}

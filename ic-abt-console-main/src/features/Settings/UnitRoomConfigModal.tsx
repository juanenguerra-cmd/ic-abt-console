import React, { useState, useEffect } from "react";
import { useDatabase, useFacilityData } from "../../app/providers";
import { X, Plus, Trash2, Save } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const UnitRoomConfigModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { db, updateDB } = useDatabase();
  const { activeFacilityId } = useFacilityData();
  const facility = db.data.facilities.byId[activeFacilityId];

  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [roomMapping, setRoomMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && facility) {
      setUnits(facility.units || []);
      
      try {
        const storedMapping = localStorage.getItem('ltc_facility_rooms_config');
        if (storedMapping) {
          setRoomMapping(JSON.parse(storedMapping));
        } else {
          setRoomMapping({});
        }
      } catch (e) {
        console.error("Failed to load room mapping", e);
        setRoomMapping({});
      }
    }
  }, [isOpen, facility]);

  if (!isOpen) return null;

  const handleAddUnit = () => {
    const newId = uuidv4();
    setUnits([...units, { id: newId, name: `New Unit ${units.length + 1}` }]);
    setRoomMapping(prev => ({ ...prev, [newId]: "" }));
  };

  const handleRemoveUnit = (id: string) => {
    setUnits(units.filter(u => u.id !== id));
    const newMapping = { ...roomMapping };
    delete newMapping[id];
    setRoomMapping(newMapping);
  };

  const handleUnitNameChange = (id: string, name: string) => {
    setUnits(units.map(u => u.id === id ? { ...u, name } : u));
  };

  const handleRoomMappingChange = (id: string, rooms: string) => {
    setRoomMapping(prev => ({ ...prev, [id]: rooms }));
  };

  const handleSave = () => {
    updateDB(draft => {
      const f = draft.data.facilities.byId[activeFacilityId];
      if (f) {
        f.units = units;
      }
    });
    
    localStorage.setItem('ltc_facility_rooms_config', JSON.stringify(roomMapping));
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-neutral-200 shrink-0">
          <h2 className="text-xl font-bold text-neutral-900">Unit & Room Mapping Configuration</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <p className="text-sm text-neutral-600">
            Define the available units for your facility and specify the comma-separated list of room numbers that belong to each unit.
          </p>

          <div className="space-y-4">
            {units.map((unit) => (
              <div key={unit.id} className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 flex gap-4 items-start">
                <div className="w-1/3">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Unit Name</label>
                  <input
                    type="text"
                    value={unit.name}
                    onChange={(e) => handleUnitNameChange(unit.id, e.target.value)}
                    className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Unit 2"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">Room Numbers (comma-separated)</label>
                  <textarea
                    value={roomMapping[unit.id] || ""}
                    onChange={(e) => handleRoomMappingChange(unit.id, e.target.value)}
                    className="w-full border border-neutral-300 rounded-md p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                    placeholder="e.g., 250-A, 250-B, 251-A"
                    rows={3}
                  />
                </div>
                <button
                  onClick={() => handleRemoveUnit(unit.id)}
                  className="mt-6 p-2 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                  title="Remove Unit"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleAddUnit}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Unit
          </button>
        </div>

        <div className="p-6 border-t border-neutral-200 flex justify-end gap-3 shrink-0 bg-neutral-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-md font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

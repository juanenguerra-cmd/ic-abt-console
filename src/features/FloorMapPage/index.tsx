// Dashboard mini floor map widget exists in src/features/Dashboard/index.tsx and is read-only.
// It renders FloorMap directly and does not use FloorMapPage.
// Both this page and Dashboard can share useFloorMapData for consistent data computation.

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFacilityData, useDatabase } from '../../app/providers';
import { useRole } from '../../context/RoleContext';
import { FloorMap } from '../Heatmap/FloorMap';
import { Floorplan } from '../Floorplan';
import { useFloorMapData } from './useFloorMapData';
import { Printer } from 'lucide-react';
import { startPrint } from '../../print/startPrint';

type FloorMapTab = 'live' | 'edit';

export const FloorMapPage: React.FC = () => {
  const { activeFacilityId } = useFacilityData();
  const { db } = useDatabase();
  const { can } = useRole();
  const navigate = useNavigate();

  // Persist last tab to sessionStorage so returning to the page keeps the last tab
  const [activeTab, setActiveTab] = React.useState<FloorMapTab>(() => {
    return (sessionStorage.getItem('floormap_tab') as FloorMapTab) ?? 'live';
  });

  const setTab = (tab: FloorMapTab) => {
    sessionStorage.setItem('floormap_tab', tab);
    setActiveTab(tab);
  };

  const facility = db.data.facilities.byId[activeFacilityId];
  const layout = facility?.floorLayouts?.[0] ?? {
    id: 'floor-map-default',
    facilityId: activeFacilityId,
    name: 'Floor Map',
    version: 1,
    updatedAt: new Date().toISOString(),
    rooms: [],
  };

  const { roomStatuses, symptomIndicators } = useFloorMapData(layout);

  // Only ICLead and Admin can access the Edit Layout tab
  const canEdit = can('write:audits');

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100">
      <div className="bg-white border-b border-neutral-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-neutral-900">Floor Map</h1>
          <div className="flex items-center gap-1 border border-neutral-200 rounded-lg p-1">
            <button
              onClick={() => setTab('live')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'live'
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Live View
            </button>
            {canEdit && (
              <button
                onClick={() => setTab('edit')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'edit'
                    ? 'bg-indigo-600 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                Edit Layout
              </button>
            )}
          </div>
        </div>
        {activeTab === 'live' && (
          <button
            onClick={() => void startPrint('floor-map', 'Floor Map', () => ({ facility, layout, roomStatuses, symptomIndicators }))}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-300 text-neutral-700 rounded-md hover:bg-neutral-50 text-sm font-medium active:scale-95"
          >
            <Printer className="w-4 h-4" />
            Print Map
          </button>
        )}
      </div>

      {activeTab === 'live' && (
        <div className="flex-1 overflow-auto p-8">
          <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
            <FloorMap
              layout={layout}
              facilityId={activeFacilityId}
              roomStatuses={roomStatuses}
              symptomIndicators={symptomIndicators}
            />
          </div>
        </div>
      )}

      {activeTab === 'edit' && canEdit && (
        <div className="flex-1 overflow-auto">
          <Floorplan onBack={() => navigate(-1)} />
        </div>
      )}
    </div>
  );
};

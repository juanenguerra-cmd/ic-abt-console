const FLOOR_MAP_LAYOUT_PREFIX = 'ltc_floor_map_layout_v1';

const getLayoutKey = (facilityId: string, unitId = 'all') =>
  `${FLOOR_MAP_LAYOUT_PREFIX}:${facilityId}:${unitId}`;

export const mergeLayout = (savedOrderIds: string[], currentRoomIds: string[]) => {
  const currentSet = new Set(currentRoomIds);
  const filteredSaved = savedOrderIds.filter(id => currentSet.has(id));
  const appendedNew = currentRoomIds.filter(id => !filteredSaved.includes(id));
  return [...filteredSaved, ...appendedNew];
};

export const loadLayout = (facilityId: string, unitId = 'all'): string[] => {
  try {
    const raw = localStorage.getItem(getLayoutKey(facilityId, unitId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

export const saveLayout = (facilityId: string, unitId = 'all', orderedRoomIds: string[]) => {
  localStorage.setItem(getLayoutKey(facilityId, unitId), JSON.stringify(orderedRoomIds));
};

export const resetLayout = (facilityId: string, unitId = 'all') => {
  localStorage.removeItem(getLayoutKey(facilityId, unitId));
};

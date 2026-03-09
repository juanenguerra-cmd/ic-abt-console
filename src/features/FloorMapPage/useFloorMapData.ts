import { useMemo, useState, useEffect } from 'react';
import { useFacilityData } from '../../app/providers';
import { FloorLayout, Resident } from '../../domain/models';
import { RoomStatus } from '../Heatmap/FloorMap';
import { computeSymptomIndicators, SymptomIndicator } from '../../utils/symptomIndicators';

export function useFloorMapData(layout: FloorLayout): {
  roomStatuses: Record<string, RoomStatus>;
  symptomIndicators: Record<string, SymptomIndicator>;
} {
  const { store } = useFacilityData();

  // Rolling clock for the 96-hour window — refreshes every 60 seconds so
  // stale indicators expire automatically without a manual page reload.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const roomStatuses = useMemo(() => {
    const statuses: Record<string, RoomStatus> = {};
    const activeInfections = Object.values(store.infections || {}).filter(ip => ip.status === 'active');
    
    (Object.values(store.residents || {}) as Resident[])
      .filter(r => !r.isHistorical && !r.backOfficeOnly)
      .forEach(res => {
        if (!res.currentRoom) return;
        const room = layout.rooms.find(
          r => r.label === res.currentRoom || r.label === res.currentRoom!.replace(/^\d/, '')
        );
        if (!room) return;
        
        const residentInfections = activeInfections.filter(
          ip => ip.residentRef.kind === 'mrn' && ip.residentRef.id === res.mrn
        );
        
        let resStatus: RoomStatus = 'normal';
        for (const infection of residentInfections) {
          if (infection.outbreakId) {
            resStatus = 'outbreak' as RoomStatus;
            break; // Highest priority
          } else if (infection.isolationType && resStatus !== 'outbreak') {
            resStatus = 'isolation' as RoomStatus;
          } else if (infection.ebp && resStatus === 'normal') {
            resStatus = 'ebp' as RoomStatus;
          }
        }

        // Update room status, keeping the highest priority status
        const currentRoomStatus = statuses[room.roomId] || 'normal';
        if (resStatus === 'outbreak' || currentRoomStatus === 'outbreak') {
          statuses[room.roomId] = 'outbreak';
        } else if (resStatus === 'isolation' || currentRoomStatus === 'isolation') {
          statuses[room.roomId] = 'isolation';
        } else if (resStatus === 'ebp' || currentRoomStatus === 'ebp') {
          statuses[room.roomId] = 'ebp';
        }
      });
    return statuses;
  }, [store.residents, store.infections, layout.rooms]);

  const symptomIndicators = useMemo((): Record<string, SymptomIndicator> => {
    const perResident = computeSymptomIndicators(store, nowMs);
    const perRoom: Record<string, SymptomIndicator> = {};
    (Object.values(store.residents || {}) as Resident[])
      .filter(r => !r.isHistorical && !r.backOfficeOnly)
      .forEach(res => {
        if (!res.currentRoom) return;
        const sig = perResident[res.mrn];
        if (!sig?.respiratory && !sig?.gi) return;
        const room = layout.rooms.find(
          r => r.label === res.currentRoom || r.label === res.currentRoom!.replace(/^\d/, '')
        );
        if (!room) return;
        const existing = perRoom[room.roomId];
        perRoom[room.roomId] = {
          respiratory: (existing?.respiratory || sig.respiratory),
          gi: (existing?.gi || sig.gi),
        };
      });
    return perRoom;
  }, [store, layout.rooms, nowMs]);

  return { roomStatuses, symptomIndicators };
}

import { useState } from 'react';
import { useDatabase, useFacilityData } from '../../../app/providers';
import { useToast } from '../../../hooks/useToast';

export function useCorrectOnsetDate() {
  const { updateDB } = useDatabase();
  const { activeFacilityId } = useFacilityData();
  const { toast } = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const correctOnset = async (eventId: string, newDateISO: string): Promise<void> => {
    setPending(eventId);
    setError(null);
    try {
      updateDB(
        (draft) => {
          const fd = draft.data.facilityData[activeFacilityId];
          if (fd?.lineListEvents?.[eventId]) {
            fd.lineListEvents[eventId].onsetDateISO = newDateISO;
            fd.lineListEvents[eventId].updatedAt = new Date().toISOString();
          }
        },
        {
          action: 'update',
          entityType: 'lineListEvent',
          entityId: eventId,
        }
      );
      toast({ title: 'Onset date updated — epi curve refreshed' });
    } catch (e) {
      setError('Failed to save onset date correction.');
      toast({ title: 'Save failed — original date restored', variant: 'destructive' });
      throw e;
    } finally {
      setPending(null);
    }
  };

  return { correctOnset, pending, error };
}

import { useState } from 'react';
import { generateSBARHandoff } from '../services/sbarEngine';
import type { SBARHandoff } from '../types/ai';
import type { ShiftLogEntry } from '../domain/models';

interface UseSBARHandoffResult {
  generate: (entries: ShiftLogEntry[], facilityName: string, shiftLabel: string) => void;
  sbar: SBARHandoff | null;
  isGenerating: boolean;
  error: string | null;
  reset: () => void;
}

export function useSBARHandoff(): UseSBARHandoffResult {
  const [sbar, setSbar] = useState<SBARHandoff | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = (entries: ShiftLogEntry[], facilityName: string, shiftLabel: string) => {
    setIsGenerating(true);
    setError(null);
    setTimeout(() => {
      try {
        const result = generateSBARHandoff(entries, facilityName, shiftLabel);
        setSbar(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate SBAR handoff.');
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  const reset = () => {
    setSbar(null);
    setError(null);
    setIsGenerating(false);
  };

  return { generate, sbar, isGenerating, error, reset };
}

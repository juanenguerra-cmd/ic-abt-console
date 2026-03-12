import { formatDateLikeForDisplay } from '../../../lib/dateUtils';

/** Format a date string (ISO or US) for display in PDF reports. */
export const formatDate = (value?: string): string => {
  if (!value) return 'N/A';
  return formatDateLikeForDisplay(value);
};

/** Calculate the number of days between two date strings. */
export const daysBetween = (start: string, end?: string): number => {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)));
};

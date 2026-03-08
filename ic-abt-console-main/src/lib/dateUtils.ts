const ISO_DATE_ONLY_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const US_DATE_RE = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/;

const isValidYmd = (year: number, month: number, day: number): boolean => {
  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);
  return (
    !Number.isNaN(candidate.getTime()) &&
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
};

export const normalizeForgivingDateInput = (value: string): string | null => {
  const raw = value.trim();
  if (!raw) return '';

  const isoMatch = ISO_DATE_ONLY_RE.exec(raw);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidYmd(year, month, day)) return null;
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  const usMatch = US_DATE_RE.exec(raw);
  if (usMatch) {
    const month = Number(usMatch[1]);
    const day = Number(usMatch[2]);
    const year = Number(usMatch[3]);
    if (!isValidYmd(year, month, day)) return null;
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  return null;
};

export const parseDateLikeToLocalDate = (value?: string): Date | null => {
  if (!value) return null;
  const normalized = normalizeForgivingDateInput(value);
  if (normalized) {
    const [year, month, day] = normalized.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const dateLikeToEpochMs = (value?: string): number => {
  const parsed = parseDateLikeToLocalDate(value);
  return parsed ? parsed.getTime() : 0;
};

export const formatDateLikeForDisplay = (value?: string, locale?: string): string => {
  const parsed = parseDateLikeToLocalDate(value);
  return parsed ? parsed.toLocaleDateString(locale) : 'Unknown';
};

export const toLocalDateInputValue = (value?: string): string => {
  const parsed = parseDateLikeToLocalDate(value);
  if (!parsed) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const todayLocalDateInputValue = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

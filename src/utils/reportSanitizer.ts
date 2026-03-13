/**
 * Report Sanitizer — unified display-layer text sanitization utilities.
 *
 * All sanitization here is DISPLAY ONLY. No stored data is mutated.
 *
 * Use `sanitizeReportText()` for multi-sentence freetext note fields (narrative,
 * clinical notes, intervention details, etc.).
 * Use `sanitizeReportCell()` for single table-cell values where a fallback em-dash
 * is preferred over null.
 */

import { sanitizeNoteText } from '../features/Reports/pdfSections/sanitizeNoteText';

/**
 * Sanitize a freetext note/narrative field for report rendering.
 * Strips EXTENDED DATA blocks, raw JSON payloads, junk placeholders, and
 * collapses whitespace. Returns `null` when the result is empty or meaningless.
 *
 * Alias for the core sanitizeNoteText implementation so callers can import from
 * a single consistent utility path.
 */
export const sanitizeReportText = (raw: string | undefined | null): string | null =>
  sanitizeNoteText(raw);

/**
 * Sanitize a table cell value.
 * Returns the clean string, or an em-dash (`—`) when the value is absent or
 * clinically meaningless (blank, "unknown", "N/A", "—", etc.).
 *
 * Suitable for any column accessor that needs a guaranteed non-null display value.
 */
export const sanitizeReportCell = (value: string | undefined | null): string =>
  sanitizeNoteText(value) ?? '—';

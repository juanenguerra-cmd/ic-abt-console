/**
 * Report Text Sanitization Utilities
 *
 * These helpers sanitize freetext content before it is rendered in visible
 * reports or exported PDFs. They strip internal metadata blocks, raw JSON
 * payloads, junk placeholders, and other artifacts that are clinically
 * meaningless and should never appear in survey-facing output.
 *
 * IMPORTANT: These helpers mutate display output only. They must never be
 * used to mutate stored source data.
 */

/** Patterns that represent noise/junk content with no clinical value. */
const JUNK_PATTERNS: RegExp[] = [
  // Remove EXTENDED DATA blocks (e.g. "--- EXTENDED DATA ---...--- END ---")
  /---\s*EXTENDED DATA\s*---[\s\S]*?---\s*END\s*---/gi,
  // Remove JSON-like {...} blocks — bounded to avoid catastrophic backtracking
  /\{[^{}]{0,500}\}/g,
  // Remove array-like [...] blocks — bounded
  /\[[^\[\]]{0,500}\]/g,
  // Remove &&& placeholder sequences
  /&&&+/g,
  // Remove "undefined", "null", "[object Object]" literals
  /\bundefined\b/gi,
  /\bnull\b/gi,
  /\[object Object\]/gi,
  // Remove leftover PDF/template tokens
  /\{TOTAL_PAGES\}/g,
  /\{[A-Z_]{2,}\}/g,
];

/**
 * Sanitize a single line of note or narrative text for report display.
 *
 * Strips EXTENDED DATA blocks, raw JSON/array payloads, junk placeholders,
 * and collapses excessive whitespace. Does NOT truncate — report fields
 * may be longer than prompt fields.
 *
 * @param raw  Raw text from a data field (may be undefined/null).
 * @returns    Sanitized plain-text string, or empty string if nothing remains.
 */
export function sanitizeReportText(raw: string | null | undefined): string {
  if (!raw) return '';

  let safe = raw;

  // 1. Strip EXTENDED DATA and other junk patterns
  for (const pattern of JUNK_PATTERNS) {
    safe = safe.replace(pattern, ' ');
  }

  // 2. Remove HTML/XML tags
  safe = safe.replace(/<[^>]*>/g, ' ');

  // 3. Collapse multiple whitespace / newlines into single spaces
  safe = safe.replace(/\s+/g, ' ').trim();

  return safe;
}

/**
 * Sanitize an array of text lines for report display, filtering out
 * lines that become empty or meaningless after sanitization.
 *
 * @param lines  Array of raw text lines.
 * @returns      Array of sanitized, non-empty lines.
 */
export function sanitizeReportLines(lines: string[]): string[] {
  return lines
    .map(sanitizeReportText)
    .filter(line => line.length > 0);
}

/**
 * Sanitize a field value for display in a report cell, replacing empty
 * values with an em dash rather than leaving cells blank.
 *
 * @param raw     Raw value.
 * @param fallback  Fallback text (default: em dash).
 * @returns         Sanitized string or fallback.
 */
export function sanitizeReportCell(
  raw: string | null | undefined,
  fallback = '—'
): string {
  const cleaned = sanitizeReportText(raw);
  return cleaned || fallback;
}

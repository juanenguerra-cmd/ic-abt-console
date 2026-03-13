/**
 * Sanitizes note-like text fields before they are rendered in the PDF.
 *
 * Strips technical metadata, raw JSON payloads, placeholder junk, and
 * collapsed whitespace so only clinically meaningful text reaches the report.
 *
 * Returns null when the cleaned text is empty or clinically meaningless.
 */
export const sanitizeNoteText = (raw: string | undefined | null): string | null => {
  if (!raw) return null;

  let text = raw;

  // Strip --- EXTENDED DATA --- blocks (everything from the marker to end, or to next section)
  text = text.replace(/---\s*EXTENDED DATA\s*---[\s\S]*/gi, '');

  // Strip raw JSON objects/arrays — run multiple passes to handle nested structures
  let previous = '';
  while (previous !== text) {
    previous = text;
    text = text.replace(/\{[^{}]*\}/g, '');
    text = text.replace(/\[[^\[\]]*\]/g, '');
  }

  // Remove &&&  placeholder junk
  text = text.replace(/&&&+/g, '');

  // Remove repeated commas (e.g. ",,,", ", , ,")
  text = text.replace(/(?:,\s*){2,}/g, '');

  // Remove repeated quotes (e.g. '""""', "''''")
  text = text.replace(/"{2,}/g, '');
  text = text.replace(/'{2,}/g, '');

  // Remove lone trailing/leading punctuation artifacts left after stripping
  text = text.replace(/^[\s,;:|]+|[\s,;:|]+$/g, '');

  // Collapse repeated whitespace and newlines into single spaces
  text = text.replace(/\s{2,}/g, ' ').trim();

  // Return null for effectively empty or meaningless strings
  if (!text || text.length < 3) return null;

  // Catch residual "Unknown", "N/A", "---", "None" placeholders that carry no value
  if (/^(unknown|n\/a|none|---|\s*)$/i.test(text)) return null;

  return text;
};

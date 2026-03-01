/**
 * G9 — AI Prompt Sanitization Utilities
 *
 * All freetext fields interpolated into LLM (Gemini) prompts MUST pass through
 * these helpers to prevent prompt injection and XSS via model output.
 *
 * Usage:
 *   import { sanitizeField, buildSafePrompt } from '../utils/sanitizePrompt';
 *   const safeNote = sanitizeField(noteBody, 500);
 */

/** Maximum number of characters allowed per interpolated field. */
const DEFAULT_MAX_LENGTH = 500;

/**
 * Strip HTML/script tags, collapse runs of whitespace, and truncate a freetext
 * field to `maxLength` characters before it is embedded in an AI prompt.
 *
 * @param raw       The raw user-supplied string (may be undefined/null).
 * @param maxLength Hard character limit (default 500).
 * @returns         Safe, truncated plain-text string.
 */
export function sanitizeField(raw: string | null | undefined, maxLength = DEFAULT_MAX_LENGTH): string {
  if (!raw) return '';

  // 1. Remove all HTML/XML tags including variations with whitespace before >.
  //    Using a generic tag-stripping pattern rather than script/style-specific ones
  //    to cover all injection vectors reliably.
  let safe = raw.replace(/<[^>]*>/g, ' ');

  // 2. Collapse multiple whitespace characters into a single space.
  safe = safe.replace(/\s+/g, ' ').trim();

  // 3. Remove characters that could act as prompt delimiters or injection vectors.
  //    Keep printable ASCII + common Unicode letters/punctuation; strip control chars.
  safe = safe.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 4. Truncate to the hard limit.
  if (safe.length > maxLength) {
    safe = safe.slice(0, maxLength) + '…';
  }

  return safe;
}

/**
 * Sanitize a record of named freetext values and produce a safe substitution
 * map for prompt template interpolation.
 *
 * @param fields    Key/value map of prompt variables to their raw values.
 * @param maxLength Per-field character limit (default 500).
 * @returns         Key/value map of sanitized strings.
 */
export function sanitizeFields(
  fields: Record<string, string | null | undefined>,
  maxLength = DEFAULT_MAX_LENGTH
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = sanitizeField(value, maxLength);
  }
  return result;
}

/**
 * Interpolate a prompt template, sanitizing every `{{variable}}` substitution.
 *
 * Template syntax: `{{variableName}}` where the variable name matches a key in
 * `fields`. Unrecognised variables are replaced with an empty string.
 *
 * @param template  Prompt template string containing `{{variable}}` tokens.
 * @param fields    Key/value map of variable values (raw freetext).
 * @param maxLength Per-field character limit (default 500).
 * @returns         Populated prompt string with all fields sanitized.
 */
export function buildSafePrompt(
  template: string,
  fields: Record<string, string | null | undefined>,
  maxLength = DEFAULT_MAX_LENGTH
): string {
  const safe = sanitizeFields(fields, maxLength);
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => safe[key] ?? '');
}

/**
 * Tests for sanitizeNoteText — PDF report display-layer sanitization.
 *
 * All rules here are DISPLAY ONLY. No stored data is mutated.
 */

import { describe, test, expect } from 'vitest';
import { sanitizeNoteText } from './sanitizeNoteText';

// ---------------------------------------------------------------------------
// Null / empty inputs
// ---------------------------------------------------------------------------

describe('sanitizeNoteText — null/empty inputs', () => {
  test('returns null for null input', () => {
    expect(sanitizeNoteText(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(sanitizeNoteText(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(sanitizeNoteText('')).toBeNull();
  });

  test('returns null for whitespace-only string', () => {
    expect(sanitizeNoteText('   ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EXTENDED DATA block stripping
// ---------------------------------------------------------------------------

describe('sanitizeNoteText — EXTENDED DATA blocks', () => {
  test('strips --- EXTENDED DATA --- block and everything after', () => {
    const input = 'Resident stable. --- EXTENDED DATA --- {"key":"value"}';
    expect(sanitizeNoteText(input)).toBe('Resident stable.');
  });

  test('strips EXTENDED DATA with varying whitespace in marker', () => {
    const input = 'Note text. ---EXTENDED DATA--- more junk';
    expect(sanitizeNoteText(input)).toBe('Note text.');
  });
});

// ---------------------------------------------------------------------------
// JSON / object payload stripping
// ---------------------------------------------------------------------------

describe('sanitizeNoteText — raw JSON/object payloads', () => {
  test('strips JSON object from note', () => {
    const input = 'Clinical note {"status":"active","organism":"MRSA"}';
    const result = sanitizeNoteText(input);
    expect(result).not.toContain('{');
    expect(result).not.toContain('}');
    expect(result).toContain('Clinical note');
  });

  test('strips JSON array from note', () => {
    const input = 'Vaccines given ["flu","covid"]';
    const result = sanitizeNoteText(input);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  test('handles note that is entirely a JSON blob — returns null', () => {
    expect(sanitizeNoteText('{"key":"val"}')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Ampersand (&) clutter
// ---------------------------------------------------------------------------

describe('sanitizeNoteText — ampersand clutter', () => {
  test('strips &&& placeholder', () => {
    const input = 'Infection noted &&&';
    const result = sanitizeNoteText(input);
    expect(result).not.toContain('&');
    expect(result).toContain('Infection noted');
  });

  test('strips && double ampersand', () => {
    const input = 'Note && clutter';
    const result = sanitizeNoteText(input);
    expect(result).not.toContain('&&');
  });

  test('strips standalone & token surrounded by spaces', () => {
    const input = 'before & after';
    const result = sanitizeNoteText(input);
    expect(result).not.toMatch(/\s&\s/);
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  test('strips leading & from note', () => {
    const input = '& fever documented since yesterday';
    const result = sanitizeNoteText(input);
    expect(result).not.toMatch(/^&/);
    expect(result).toContain('fever documented');
  });

  test('strips trailing & from note', () => {
    const input = 'fever documented since yesterday &';
    const result = sanitizeNoteText(input);
    expect(result).not.toMatch(/&$/);
    expect(result).toContain('fever documented');
  });

  test('note that is only & returns null', () => {
    expect(sanitizeNoteText('&')).toBeNull();
  });

  test('note that is only &&& returns null', () => {
    expect(sanitizeNoteText('&&&')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Question mark (?) clutter
// ---------------------------------------------------------------------------

describe('sanitizeNoteText — question mark clutter', () => {
  test('strips ??? repeated question marks', () => {
    const input = 'Resident status??? unknown';
    const result = sanitizeNoteText(input);
    expect(result).not.toContain('???');
  });

  test('strips ?? double question marks', () => {
    const input = 'Treatment outcome?? pending';
    const result = sanitizeNoteText(input);
    expect(result).not.toContain('??');
  });

  test('strips leading ? from note', () => {
    const input = '? fever since Monday';
    const result = sanitizeNoteText(input);
    expect(result).not.toMatch(/^\?/);
    expect(result).toContain('fever since Monday');
  });

  test('strips trailing ? from note', () => {
    const input = 'UTI possible?';
    // Single trailing ? — stripped from boundary
    const result = sanitizeNoteText(input);
    expect(result).not.toMatch(/\?$/);
    expect(result).toContain('UTI possible');
  });

  test('note that is only ? returns null', () => {
    expect(sanitizeNoteText('?')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Template placeholder fragments
// ---------------------------------------------------------------------------

describe('sanitizeNoteText — template placeholder fragments', () => {
  test('strips {{field}} template fragments', () => {
    const input = 'Note for {{residentName}} today';
    const result = sanitizeNoteText(input);
    expect(result).not.toContain('{{');
    expect(result).not.toContain('}}');
    expect(result).toContain('Note for');
    expect(result).toContain('today');
  });

  test('strips [PLACEHOLDER] uppercase bracket tokens', () => {
    const input = 'Treatment: [MEDICATION_NAME] administered';
    const result = sanitizeNoteText(input);
    expect(result).not.toContain('[MEDICATION_NAME]');
    expect(result).toContain('Treatment');
    expect(result).toContain('administered');
  });

  test('note that is only a template placeholder returns null', () => {
    expect(sanitizeNoteText('{{note}}')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Repeated punctuation
// ---------------------------------------------------------------------------

describe('sanitizeNoteText — repeated punctuation', () => {
  test('strips repeated commas (,,,)', () => {
    const input = 'fever,,, chills noted';
    const result = sanitizeNoteText(input);
    expect(result).not.toMatch(/,{2,}/);
  });

  test('strips repeated double-quotes ("""")', () => {
    const input = 'note """"text"""" end';
    const result = sanitizeNoteText(input);
    expect(result).not.toMatch(/"{2,}/);
  });

  test('strips repeated exclamation marks (!!!)', () => {
    const input = 'Alert!!! Contact precautions';
    const result = sanitizeNoteText(input);
    expect(result).not.toContain('!!!');
    expect(result).toContain('Contact precautions');
  });
});

// ---------------------------------------------------------------------------
// Meaningful strings pass through unchanged
// ---------------------------------------------------------------------------

describe('sanitizeNoteText — clean clinical notes pass through', () => {
  test('normal clinical note passes through unchanged', () => {
    const note = 'Resident reports dysuria x 2 days. UA positive for nitrites. Starting Bactrim DS PO BID x 5 days.';
    expect(sanitizeNoteText(note)).toBe(note);
  });

  test('note with single ? mid-sentence is preserved', () => {
    // A ? that is not at the string boundary should be kept
    const note = 'Possible UTI? Awaiting culture results';
    const result = sanitizeNoteText(note);
    expect(result).not.toBeNull();
    expect(result).toContain('Awaiting culture results');
    // The mid-sentence ? is not at the boundary, so it is not stripped
    expect(result).toContain('UTI?');
  });

  test('returns null for "Unknown" placeholder', () => {
    expect(sanitizeNoteText('Unknown')).toBeNull();
  });

  test('returns null for "N/A" placeholder', () => {
    expect(sanitizeNoteText('N/A')).toBeNull();
  });

  test('returns null for "None" placeholder', () => {
    expect(sanitizeNoteText('None')).toBeNull();
  });

  test('returns null for very short result after cleaning', () => {
    // After stripping junk, only 1–2 chars remain → null
    expect(sanitizeNoteText('{} &')).toBeNull();
  });
});

/**
 * Tests for sanitizePrompt utilities — G9 (AI prompt sanitization).
 */

import { describe, test, expect } from 'vitest';
import { sanitizeField, sanitizeFields, buildSafePrompt } from './sanitizePrompt';

// ---------------------------------------------------------------------------
// sanitizeField
// ---------------------------------------------------------------------------

describe('sanitizeField (G9)', () => {
  test('returns empty string for null input', () => {
    expect(sanitizeField(null)).toBe('');
  });

  test('returns empty string for undefined input', () => {
    expect(sanitizeField(undefined)).toBe('');
  });

  test('returns empty string for empty string input', () => {
    expect(sanitizeField('')).toBe('');
  });

  test('strips HTML script tags', () => {
    const result = sanitizeField('<script>alert("xss")</script>Hello');
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });

  test('strips arbitrary HTML tags', () => {
    const result = sanitizeField('<b>bold</b> and <em>italic</em>');
    expect(result).not.toContain('<b>');
    expect(result).not.toContain('<em>');
    expect(result).toContain('bold');
    expect(result).toContain('italic');
  });

  test('strips HTML tags with attributes', () => {
    const result = sanitizeField('<img src="evil.js" onerror="alert(1)">text');
    expect(result).not.toContain('<img');
    expect(result).toContain('text');
  });

  test('collapses multiple whitespace into a single space', () => {
    const result = sanitizeField('Hello   \t  world');
    expect(result).toBe('Hello world');
  });

  test('trims leading and trailing whitespace', () => {
    const result = sanitizeField('  hello  ');
    expect(result).toBe('hello');
  });

  test('removes control characters', () => {
    const result = sanitizeField('Hello\x01\x02\x1Fworld');
    expect(result).toBe('Helloworld');
  });

  test('truncates to default 500 characters with ellipsis', () => {
    const long = 'a'.repeat(600);
    const result = sanitizeField(long);
    // 500 chars + '…'
    expect(result.length).toBe(501);
    expect(result.endsWith('…')).toBe(true);
  });

  test('respects custom maxLength', () => {
    const result = sanitizeField('Hello World', 5);
    expect(result).toBe('Hello…');
  });

  test('does not truncate strings within the limit', () => {
    const short = 'short text';
    const result = sanitizeField(short, 500);
    expect(result).toBe('short text');
    expect(result.endsWith('…')).toBe(false);
  });

  test('normal clinical note passes through unchanged (within limit)', () => {
    const note = 'Resident complains of dysuria x 2 days. UA positive for nitrites. Starting Bactrim DS PO BID x 5 days.';
    const result = sanitizeField(note, 500);
    expect(result).toBe(note);
  });
});

// ---------------------------------------------------------------------------
// sanitizeFields
// ---------------------------------------------------------------------------

describe('sanitizeFields (G9)', () => {
  test('sanitizes all values in the map', () => {
    const result = sanitizeFields({
      name: '<b>Alice</b>',
      note: 'Normal note',
      empty: null,
    });
    expect(result.name).not.toContain('<b>');
    expect(result.name).toContain('Alice');
    expect(result.note).toBe('Normal note');
    expect(result.empty).toBe('');
  });

  test('returns empty object for empty input', () => {
    expect(sanitizeFields({})).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// buildSafePrompt
// ---------------------------------------------------------------------------

describe('buildSafePrompt (G9)', () => {
  test('interpolates sanitized values into template', () => {
    const template = 'Resident: {{name}}. Note: {{note}}';
    const result = buildSafePrompt(template, { name: 'Alice Smith', note: 'No complaints today.' });
    expect(result).toBe('Resident: Alice Smith. Note: No complaints today.');
  });

  test('strips HTML from interpolated values', () => {
    const template = 'Note: {{note}}';
    const result = buildSafePrompt(template, { note: '<script>bad()</script>clinical note' });
    expect(result).not.toContain('<script>');
    expect(result).toContain('clinical note');
  });

  test('replaces unknown template variables with empty string', () => {
    const template = 'Hello {{unknown}}!';
    const result = buildSafePrompt(template, {});
    expect(result).toBe('Hello !');
  });

  test('handles null variable values gracefully', () => {
    const template = 'Value: {{val}}';
    const result = buildSafePrompt(template, { val: null });
    expect(result).toBe('Value: ');
  });

  test('truncates injected values that exceed maxLength', () => {
    const template = '{{data}}';
    const result = buildSafePrompt(template, { data: 'a'.repeat(600) }, 500);
    // 500 + ellipsis
    expect(result.length).toBe(501);
    expect(result.endsWith('…')).toBe(true);
  });
});

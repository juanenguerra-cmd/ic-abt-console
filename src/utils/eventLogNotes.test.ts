import { test, expect, describe } from 'vitest';

/**
 * Tests for the "--- EXTENDED DATA ---" notes parsing logic used in IpEventModal and VaxEventModal.
 *
 * Bug: when the user notes field is empty on first save, the extended data block is stored
 * WITHOUT a leading "\n\n", i.e. "--- EXTENDED DATA ---\n{...}".
 * On subsequent edits the old cleanup regex (requiring "\n\n--- EXTENDED DATA ---")
 * would fail to strip the block, causing the notes state to contain the raw extended data.
 * On the next save the blob gets doubled ("--- EXTENDED DATA ---\n{old}\n\n--- EXTENDED DATA ---\n{new}"),
 * and on the following load JSON.parse throws, resetting all extended fields (MDRO, wound location, etc.).
 *
 * Fix: make the leading "\n\n" optional in the cleanup regex, so it matches both formats.
 * The cleanup is now applied inside handleSave (in IpEventModal and VaxEventModal) before
 * building finalNotes, so even if hydration fell through to a fallback setNotes(existingIp.notes)
 * the block will never be doubled.
 */

// Mirrors the save format used in IpEventModal / VaxEventModal
function buildFinalNotes(userNotes: string, extData: Record<string, unknown>): string {
  const ext = JSON.stringify(extData);
  return userNotes.trim()
    ? userNotes.trim() + `\n\n--- EXTENDED DATA ---\n${ext}`
    : `--- EXTENDED DATA ---\n${ext}`;
}

// Mirrors the in-save cleanup applied in IpEventModal / VaxEventModal handleSave
function cleanNotesForSave(rawNotes: string): string {
  return rawNotes.replace(/(\n\n)?--- EXTENDED DATA ---\n.*/s, '').trim();
}

// Fixed cleanup regex (makes the leading \n\n optional)
const FIXED_CLEANUP_RE = /(\n\n)?--- EXTENDED DATA ---\n.*/s;

// Broken cleanup regex (the old version that required \n\n)
const BROKEN_CLEANUP_RE = /\n\n--- EXTENDED DATA ---\n.*/s;

describe('event log notes: EXTENDED DATA round-trip', () => {
  test('save with no user notes produces notes without leading \\n\\n', () => {
    const saved = buildFinalNotes('', { mdroType: 'MRSA' });
    expect(saved).toBe('--- EXTENDED DATA ---\n{"mdroType":"MRSA"}');
    expect(saved.startsWith('\n\n')).toBe(false);
  });

  test('fixed regex strips extended data even without leading \\n\\n', () => {
    const saved = buildFinalNotes('', { mdroType: 'MRSA' });
    const cleaned = saved.replace(FIXED_CLEANUP_RE, '').trim();
    expect(cleaned).toBe('');
  });

  test('broken regex fails to strip extended data when there is no leading \\n\\n', () => {
    const saved = buildFinalNotes('', { mdroType: 'MRSA' });
    const cleaned = saved.replace(BROKEN_CLEANUP_RE, '');
    // old regex doesn't match → returns the full string unchanged
    expect(cleaned).toBe(saved);
    expect(cleaned).not.toBe('');
  });

  test('fixed regex still strips extended data when user notes are present (leading \\n\\n)', () => {
    const saved = buildFinalNotes('Patient has fever.', { mdroType: 'VRE' });
    expect(saved).toContain('\n\n--- EXTENDED DATA ---\n');
    const cleaned = saved.replace(FIXED_CLEANUP_RE, '').trim();
    expect(cleaned).toBe('Patient has fever.');
  });

  test('second save does not double the extended data block', () => {
    // Simulate: first save (no user notes) → load → bad cleanup (old bug) → second save
    const firstSaved = buildFinalNotes('', { mdroType: 'MRSA' });

    // Using the FIXED cleanup: notes state after loading should be ''
    const notesAfterFixedCleanup = firstSaved.replace(FIXED_CLEANUP_RE, '').trim();
    const secondSaved = buildFinalNotes(notesAfterFixedCleanup, { mdroType: 'MRSA' });

    // With the fix: only one extended data block
    const blockCount = (secondSaved.match(/--- EXTENDED DATA ---/g) || []).length;
    expect(blockCount).toBe(1);
  });

  test('doubled extended data block causes JSON.parse to throw (demonstrates old bug)', () => {
    // Simulate: first save (no notes) → load with BROKEN cleanup → notes polluted → second save
    const firstSaved = buildFinalNotes('', { mdroType: 'MRSA' });
    const pollutedNotes = firstSaved.replace(BROKEN_CLEANUP_RE, ''); // doesn't strip anything
    const secondSaved = buildFinalNotes(pollutedNotes, { mdroType: 'MRSA' });

    // Now two blocks exist — JSON.parse on the capture after first marker should throw
    const match = secondSaved.match(/--- EXTENDED DATA ---\n(.*)/s);
    expect(match).not.toBeNull();
    expect(() => JSON.parse(match![1])).toThrow();
  });

  test('fixed cleanup: JSON.parse succeeds after multiple saves', () => {
    let notesState = '';
    const extData = { mdroType: 'MRSA', woundLocation: 'Left leg' };

    // Simulate three save/load cycles
    for (let i = 0; i < 3; i++) {
      const saved = buildFinalNotes(notesState, extData);
      // Load: parse extended data
      const match = saved.match(/--- EXTENDED DATA ---\n(.*)/s);
      expect(match).not.toBeNull();
      const parsed = JSON.parse(match![1]);
      expect(parsed.mdroType).toBe('MRSA');
      expect(parsed.woundLocation).toBe('Left leg');
      // Clean up notes state for next round
      notesState = saved.replace(FIXED_CLEANUP_RE, '').trim();
    }
  });
});

describe('event log notes: in-save cleanup prevents doubling', () => {
  test('cleanNotesForSave strips block when hydration fell through to fallback (no \\n\\n)', () => {
    // Simulate fallback: setNotes(existingIp.notes) where notes = "--- EXTENDED DATA ---\n{...}"
    const dirtyNotes = buildFinalNotes('', { mdroType: 'MRSA' });
    expect(dirtyNotes.startsWith('--- EXTENDED DATA ---')).toBe(true);

    // The in-save cleanup must strip it
    const clean = cleanNotesForSave(dirtyNotes);
    expect(clean).toBe('');

    // Then build finalNotes from the cleaned state → only one block
    const finalNotes = buildFinalNotes(clean, { mdroType: 'MRSA' });
    const blockCount = (finalNotes.match(/--- EXTENDED DATA ---/g) || []).length;
    expect(blockCount).toBe(1);
  });

  test('cleanNotesForSave strips block when hydration fell through to fallback (with \\n\\n)', () => {
    // Simulate fallback: setNotes(existingIp.notes) where notes contains user text + block
    const dirtyNotes = buildFinalNotes('Some clinical notes.', { mdroType: 'VRE' });

    const clean = cleanNotesForSave(dirtyNotes);
    expect(clean).toBe('Some clinical notes.');

    // buildFinalNotes from the cleaned state → one block, user notes preserved
    const finalNotes = buildFinalNotes(clean, { mdroType: 'VRE' });
    const blockCount = (finalNotes.match(/--- EXTENDED DATA ---/g) || []).length;
    expect(blockCount).toBe(1);
    expect(finalNotes.startsWith('Some clinical notes.')).toBe(true);
  });

  test('cleanNotesForSave is a no-op when notes are already clean', () => {
    const clean = cleanNotesForSave('Just a plain note.');
    expect(clean).toBe('Just a plain note.');
  });

  test('in-save cleanup prevents doubling even after broken-regex hydration fallback', () => {
    // Simulate the full old bug scenario but with the new in-save cleanup fix:
    // 1. First save (no user notes) → "--- EXTENDED DATA ---\n{...}"
    const firstSaved = buildFinalNotes('', { mdroType: 'MRSA' });

    // 2. Hydration uses BROKEN regex → doesn't strip → notes state = full dirty string
    const pollutedNotesState = firstSaved.replace(BROKEN_CLEANUP_RE, '');
    expect(pollutedNotesState).toBe(firstSaved); // no strip happened

    // 3. Save: in-save cleanup now strips the block before appending
    const cleanedBeforeSave = cleanNotesForSave(pollutedNotesState);
    const secondSaved = buildFinalNotes(cleanedBeforeSave, { mdroType: 'MRSA' });

    // Only one block — the fix works
    const blockCount = (secondSaved.match(/--- EXTENDED DATA ---/g) || []).length;
    expect(blockCount).toBe(1);

    // Extended data is parseable
    const match = secondSaved.match(/--- EXTENDED DATA ---\n(.*)/s);
    expect(() => JSON.parse(match![1])).not.toThrow();
  });
});

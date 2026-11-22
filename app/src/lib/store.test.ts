import { describe, expect, it } from 'vitest';
import { LIBRARY_LIMIT, mergeRecord, readIndex, type DocumentRecord } from './store';

const rec = (id: string, savedAt = 1000): DocumentRecord => ({
  id,
  fileName: `${id}.pdf`,
  pageCount: 3,
  confidence: 0.8,
  savedAt,
});

describe('mergeRecord', () => {
  it('puts the newest first', () => {
    const merged = mergeRecord([rec('a', 100)], rec('b', 200));
    expect(merged.map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('replaces an existing record rather than duplicating it', () => {
    const merged = mergeRecord([rec('a', 100), rec('b', 200)], rec('a', 300));
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('a');
  });

  it('caps the list so the metadata stays inside Clerk’s limit', () => {
    const many = Array.from({ length: LIBRARY_LIMIT }, (_, i) => rec(`r${i}`, i));
    const merged = mergeRecord(many, rec('newest', 999_999));
    expect(merged).toHaveLength(LIBRARY_LIMIT);
    expect(merged[0].id).toBe('newest');
    // The oldest is the one dropped.
    expect(merged.some((r) => r.id === 'r0')).toBe(false);
  });
});

describe('readIndex', () => {
  it('returns an empty list for missing or malformed metadata', () => {
    expect(readIndex(null)).toEqual([]);
    expect(readIndex(undefined)).toEqual([]);
    expect(readIndex({})).toEqual([]);
    expect(readIndex({ documents: 'nope' })).toEqual([]);
  });

  it('drops records that do not have the expected shape', () => {
    const index = readIndex({
      documents: [rec('good'), { id: 'bad' }, null, 42],
    });
    expect(index.map((r) => r.id)).toEqual(['good']);
  });

  it('sorts newest first', () => {
    const index = readIndex({ documents: [rec('old', 1), rec('new', 9)] });
    expect(index[0].id).toBe('new');
  });
});

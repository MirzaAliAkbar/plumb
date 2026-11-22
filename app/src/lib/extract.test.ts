import { describe, expect, it } from 'vitest';
import { classifyOpenError, PdfOpenError } from './extract';

/**
 * These assertions guard the specific bug that made every failure look alike.
 * Before, a single catch-all produced one sentence for a wrong password, a
 * truncated download, and an HTML file renamed to .pdf. Each of those has a
 * different fix, so each must be distinguishable.
 */
describe('classifyOpenError', () => {
  it('recognises a password prompt that was never answered', () => {
    const err = Object.assign(new Error('No password given'), { name: 'PasswordException' });
    expect(classifyOpenError(err)).toEqual({ kind: 'password', wrong: false });
  });

  it('recognises a wrong password', () => {
    const err = Object.assign(new Error('Incorrect Password'), { name: 'PasswordException' });
    expect(classifyOpenError(err)).toEqual({ kind: 'password', wrong: true });
  });

  it('recognises a file that is not a PDF at all', () => {
    const err = Object.assign(new Error('Invalid PDF structure.'), {
      name: 'InvalidPDFException',
    });
    expect(classifyOpenError(err).kind).toBe('invalid');
  });

  it('recognises a truncated file', () => {
    const err = Object.assign(new Error('Missing PDF.'), { name: 'MissingPDFException' });
    expect(classifyOpenError(err).kind).toBe('corrupt');
  });

  it('recognises a missing pdf.js data file as a deployment fault', () => {
    const err = new Error('Ensure that the `standardFontDataUrl` API parameter is provided.');
    expect(classifyOpenError(err).kind).toBe('unsupported');
  });

  it('keeps the underlying message for anything unclassified', () => {
    const failure = classifyOpenError(new Error('something odd'));
    expect(failure.kind).toBe('unknown');
    expect(failure.kind === 'unknown' && failure.detail).toBe('something odd');
  });

  it('never returns the same category for a wrong password and an invalid file', () => {
    const pw = classifyOpenError(
      Object.assign(new Error('Incorrect Password'), { name: 'PasswordException' }),
    );
    const bad = classifyOpenError(
      Object.assign(new Error('Invalid PDF structure.'), { name: 'InvalidPDFException' }),
    );
    expect(pw.kind).not.toBe(bad.kind);
  });
});

describe('PdfOpenError', () => {
  it('carries the classified failure', () => {
    const err = new PdfOpenError({ kind: 'invalid' });
    expect(err.failure.kind).toBe('invalid');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('PdfOpenError');
  });
});

import { describe, test, expect } from '@jest/globals';
import { matchesFilename, isContentSearchable, getConverterCommand } from '../../src/domain-logic.js';

describe('matchesFilename', () => {
  test('matches a substring case-insensitively', () => {
    expect(matchesFilename('Dugnadsvakter vår 2023', 'dugnad')).toBe(true);
  });

  test('matches regardless of term casing', () => {
    expect(matchesFilename('Dugnadsvakter vår 2023', 'DUGNAD')).toBe(true);
  });

  test('returns false when there is no match', () => {
    expect(matchesFilename('Helgevakter 2024', 'dugnad')).toBe(false);
  });
});

describe('getConverterCommand', () => {
  test('returns pdftotext for PDF media type', () => {
    expect(getConverterCommand('application/pdf')).toBe('pdftotext');
  });

  test('returns docx2txt for DOCX media type', () => {
    expect(getConverterCommand('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx2txt');
  });

  test('returns ssconvert for XLSX media type', () => {
    expect(getConverterCommand('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('ssconvert');
  });

  test('returns ssconvert for legacy XLS media type', () => {
    expect(getConverterCommand('application/vnd.ms-excel')).toBe('ssconvert');
  });

  test('returns null for images', () => {
    expect(getConverterCommand('image/jpeg')).toBeNull();
  });

  test('returns null when media type is missing', () => {
    expect(getConverterCommand(undefined)).toBeNull();
  });
});

describe('isContentSearchable', () => {
  test('returns true for PDF media type', () => {
    expect(isContentSearchable('application/pdf')).toBe(true);
  });

  test('returns true for DOCX media type', () => {
    expect(isContentSearchable('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
  });

  test('returns true for XLSX media type', () => {
    expect(isContentSearchable('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
  });

  test('returns true for legacy XLS media type', () => {
    expect(isContentSearchable('application/vnd.ms-excel')).toBe(true);
  });

  test('returns false for images', () => {
    expect(isContentSearchable('image/jpeg')).toBe(false);
  });

  test('returns false when media type is missing', () => {
    expect(isContentSearchable(undefined)).toBe(false);
  });
});

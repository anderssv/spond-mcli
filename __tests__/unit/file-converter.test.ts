import { describe, test, expect } from '@jest/globals';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { convertFileToText } from '../../src/file-converter.js';

describe('convertFileToText', () => {
  test('converts a spreadsheet to CSV via ssconvert with extensionless input/output paths', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'file-converter-test-'));
    const inputPath = join(dir, 'raw-resource-id');
    const outputPath = join(dir, 'text-resource-id');
    writeFileSync(inputPath, 'a,b\n1,2\n');

    try {
      await convertFileToText('ssconvert', 'XLSX', inputPath, outputPath, 'Make sure ssconvert is installed.', ['--export-type=Gnumeric_stf:stf_csv']);

      expect(readFileSync(outputPath, 'utf-8')).toContain('1,2');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('rejects when the input file does not exist', async () => {
    await expect(
      convertFileToText('ssconvert', 'XLSX', '/tmp/nonexistent-file-xyz', '/tmp/out', 'hint')
    ).rejects.toThrow('Input XLSX file not found');
  });
});

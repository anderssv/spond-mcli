import { describe, test, expect, afterEach } from '@jest/globals';
import { existsSync, rmSync, mkdirSync, utimesSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  hashToken,
  getOrCreateTokenWorkspaceDir,
  createProcessWorkspaceDirSync,
  resolveResourcePath,
  generateResourceId,
  sweepStaleWorkspaces
} from '../../src/workspace-manager.js';

const createdDirs: string[] = [];

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('hashToken', () => {
  test('is deterministic for the same token', () => {
    expect(hashToken('my-token')).toBe(hashToken('my-token'));
  });

  test('differs for different tokens', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });

  test('never contains the raw token value', () => {
    expect(hashToken('super-secret-token')).not.toContain('super-secret-token');
  });
});

describe('getOrCreateTokenWorkspaceDir', () => {
  test('creates a directory keyed by the token hash', async () => {
    const root = mkdtempRoot();
    const dir = await getOrCreateTokenWorkspaceDir('a-token', root);

    expect(existsSync(dir)).toBe(true);
    expect(dir).toContain(hashToken('a-token'));
  });

  test('returns the same directory on repeated calls with the same token', async () => {
    const root = mkdtempRoot();
    const first = await getOrCreateTokenWorkspaceDir('same-token', root);
    const second = await getOrCreateTokenWorkspaceDir('same-token', root);

    expect(second).toBe(first);
  });

  test('returns different directories for different tokens', async () => {
    const root = mkdtempRoot();
    const dirA = await getOrCreateTokenWorkspaceDir('token-a', root);
    const dirB = await getOrCreateTokenWorkspaceDir('token-b', root);

    expect(dirA).not.toBe(dirB);
  });
});

describe('createProcessWorkspaceDirSync', () => {
  test('creates a fresh directory each call', () => {
    const dirA = createProcessWorkspaceDirSync();
    const dirB = createProcessWorkspaceDirSync();
    createdDirs.push(dirA, dirB);

    expect(existsSync(dirA)).toBe(true);
    expect(existsSync(dirB)).toBe(true);
    expect(dirA).not.toBe(dirB);
  });
});

describe('generateResourceId', () => {
  test('produces a resourceId when no hint is given', () => {
    expect(generateResourceId()).toMatch(/^[a-z0-9-]+$/);
  });

  test('incorporates a sanitized version of the hint', () => {
    const id = generateResourceId('https://spond.com/storage/report.pdf');

    expect(id).toContain('report.pdf');
  });

  test('strips path traversal and unsafe characters from the hint', () => {
    const id = generateResourceId('../../etc/passwd');

    expect(id).not.toContain('..');
    expect(id).not.toContain('/');
  });

  test('strips null bytes from the hint', () => {
    const id = generateResourceId('evil\0name');

    expect(id).not.toContain('\0');
  });

  test('produces unique ids for the same hint on repeated calls', () => {
    const idA = generateResourceId('report.pdf');
    const idB = generateResourceId('report.pdf');

    expect(idA).not.toBe(idB);
  });

  test('falls back to a random id when the hint is empty after sanitizing', () => {
    const id = generateResourceId('////....');

    expect(id.length).toBeGreaterThan(0);
  });
});

describe('resolveResourcePath', () => {
  test('joins workspace dir, namespace, and resourceId', () => {
    const path = resolveResourcePath('/workspace', 'raw', 'abc123');

    expect(path).toBe(join('/workspace', 'raw', 'abc123'));
  });

  test('rejects a resourceId containing path traversal', () => {
    expect(() => resolveResourcePath('/workspace', 'raw', '../../etc/passwd')).toThrow();
  });

  test('rejects a resourceId containing a path separator', () => {
    expect(() => resolveResourcePath('/workspace', 'raw', 'sub/dir')).toThrow();
  });

  test('rejects an absolute-path resourceId', () => {
    expect(() => resolveResourcePath('/workspace', 'raw', '/etc/passwd')).toThrow();
  });

  test('the resolved path never escapes the workspace directory', () => {
    const path = resolveResourcePath('/workspace', 'raw', 'abc123');

    expect(path.startsWith('/workspace')).toBe(true);
  });
});

describe('sweepStaleWorkspaces', () => {
  test('removes directories older than maxAgeMs', async () => {
    const root = mkdtempRoot();
    const staleDir = join(root, 'stale-hash');
    mkdirSync(staleDir);
    const longAgo = new Date(Date.now() - 1000 * 60 * 60 * 48);
    utimesSync(staleDir, longAgo, longAgo);

    await sweepStaleWorkspaces(root, 1000 * 60 * 60 * 24);

    expect(existsSync(staleDir)).toBe(false);
  });

  test('keeps directories newer than maxAgeMs', async () => {
    const root = mkdtempRoot();
    const freshDir = join(root, 'fresh-hash');
    mkdirSync(freshDir);

    await sweepStaleWorkspaces(root, 1000 * 60 * 60 * 24);

    expect(existsSync(freshDir)).toBe(true);
  });

  test('does nothing when the root directory does not exist', async () => {
    await expect(sweepStaleWorkspaces(join(tmpdir(), 'does-not-exist-xyz'), 1000)).resolves.not.toThrow();
  });
});

function mkdtempRoot(): string {
  const root = join(tmpdir(), `spond-mcli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  createdDirs.push(root);
  return root;
}

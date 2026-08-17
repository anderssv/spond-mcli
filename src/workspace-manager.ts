import { createHash, randomBytes } from 'crypto';
import { mkdir, readdir, rm, stat } from 'fs/promises';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve, sep } from 'path';
import { sanitizeResourceIdHint } from './domain-logic.js';

export const WORKSPACE_ROOT_ENV = 'SPOND_MCLI_WORKSPACE_ROOT';
export const WORKSPACE_TTL_ENV = 'SPOND_MCLI_WORKSPACE_TTL_MS';

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_RESOURCE_ID_LENGTH = 120;

export function getWorkspaceRoot(): string {
  return process.env[WORKSPACE_ROOT_ENV] || join(tmpdir(), 'spond-mcli-workspaces');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function getOrCreateTokenWorkspaceDir(token: string, rootDir?: string): Promise<string> {
  const dir = join(rootDir ?? getWorkspaceRoot(), hashToken(token));
  await mkdir(dir, { recursive: true });
  return dir;
}

export function createProcessWorkspaceDirSync(): string {
  return mkdtempSync(join(tmpdir(), 'spond-mcli-workspace-'));
}

export function generateResourceId(hint?: string): string {
  const suffix = randomBytes(6).toString('hex');
  const sanitized = hint ? sanitizeResourceIdHint(hint, MAX_RESOURCE_ID_LENGTH) : '';
  return sanitized.length > 0 ? `${suffix}-${sanitized}` : suffix;
}

export function resolveResourcePath(workspaceDir: string, namespace: string, resourceId: string): string {
  if (
    resourceId.length === 0 ||
    resourceId.includes('/') ||
    resourceId.includes('\\') ||
    resourceId.includes('..') ||
    resourceId.includes('\0')
  ) {
    throw new Error(`Invalid resourceId: ${resourceId}`);
  }

  const namespaceDir = resolve(workspaceDir, namespace);
  const resolvedPath = resolve(namespaceDir, resourceId);

  if (resolvedPath !== namespaceDir && !resolvedPath.startsWith(namespaceDir + sep)) {
    throw new Error(`Invalid resourceId: ${resourceId}`);
  }

  return join(workspaceDir, namespace, resourceId);
}

export async function sweepStaleWorkspaces(rootDir: string, maxAgeMs: number = DEFAULT_TTL_MS): Promise<void> {
  let entries;
  try {
    entries = await readdir(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dirPath = join(rootDir, entry.name);
    try {
      const info = await stat(dirPath);
      if (now - info.mtimeMs > maxAgeMs) {
        await rm(dirPath, { recursive: true, force: true });
      }
    } catch {
      // Directory may have been removed concurrently — ignore.
    }
  }
}

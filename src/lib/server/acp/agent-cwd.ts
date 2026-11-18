import { dirname } from 'node:path';
import { codeOriginSchema } from '$lib/canvas/motion-node';
import { folderOf } from '$lib/server/code-import/folder-source';

const FOLDER = 'folder';

function importedFolder(code: unknown): string | null {
  const origin = codeOriginSchema.safeParse(code);
  return origin.success && origin.data.kind === FOLDER ? folderOf(origin.data.repo) : null;
}

export function agentCwd(feegaFile: string, codes: unknown[]): string {
  const folders = new Set(codes.map(importedFolder).filter((f): f is string => f !== null));
  return folders.size === 1 ? [...folders][0] : dirname(feegaFile);
}

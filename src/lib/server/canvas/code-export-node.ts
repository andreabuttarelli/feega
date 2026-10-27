import type { Db } from '$lib/server/db/client';
import { findNode } from '$lib/server/repos/canvas';
import { frameOf } from '$lib/canvas-node-data';
import { exportFiles, npmVersion, type ExportResult } from './code-export';
import { ExportMode } from '$lib/canvas/code-frame';

const NOT_A_CODE_FRAME = 'that node is not a code frame or a view of one';
const FOLDER_FALLBACK = 'code-frame';

export const isExportMode = (x: unknown): x is ExportMode => (Object.values(ExportMode) as unknown[]).includes(x);

const folderOf = (name: string | null | undefined) => (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || FOLDER_FALLBACK;

export type NodeExport = (ExportResult & { ok: true; folder: string; framework: string; mode: ExportMode }) | { ok: false; error: string };

export async function exportCodeNode(db: Db, input: { orgId: string; nodeId: string; mode: ExportMode }): Promise<NodeExport> {
  const row = await findNode(db, input);
  const frame = row ? frameOf(row) : null;
  const sourceRow = frame?.source === 'view' ? await findNode(db, { orgId: input.orgId, nodeId: frame.sourceNodeId }) : row;
  const code = sourceRow ? frameOf(sourceRow) : null;
  if (!code || code.source !== 'code') {
    return { ok: false, error: NOT_A_CODE_FRAME };
  }

  const out = await exportFiles({ framework: code.framework, files: code.files, vars: code.vars }, input.mode, npmVersion);
  return out.ok ? { ...out, folder: folderOf(sourceRow?.displayName), framework: code.framework, mode: input.mode } : out;
}

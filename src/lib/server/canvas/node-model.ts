import { canvasModelCatalogue } from '$lib/server/canvas-catalogue';
import { pickModel, type ModelPick, type OfferedModels } from '$lib/canvas/default-models';
import { isGenMedium, type GenMedium, type GenParams } from '$lib/canvas/gen-node';
import { audioModelFor, audioOperationOf } from '$lib/canvas/audio-operations';
import { canConnect, type CanvasNode } from '$lib/canvas/graph';
import { tileNode } from '$lib/canvas/connect-rules';
import type { Db } from '$lib/server/db/client';
import { findNode } from '$lib/server/repos/canvas';
import { isUncensoredModel } from '$lib/server/uncensored-access';

export const UNCENSORED_NO_INPUTS_ERROR = 'uncensored_no_inputs';

export async function targetTakesNoInputs(db: Db, input: { orgId: string; targetNodeId: string }): Promise<boolean> {
  const target = await findNode(db, { orgId: input.orgId, nodeId: input.targetNodeId }).catch(() => null);
  const model = (target?.data as { model?: unknown } | null)?.model;
  return isUncensoredModel(db, typeof model === 'string' ? model : null);
}

type ConnectableMedium = Exclude<Parameters<typeof tileNode>[0]['medium'], null | undefined>;

const MEDIUM_NODE_TYPES = new Set<string>([
  'text', 'image', 'video', 'audio', 'list', 'select', 'products', 'social_account_feed'
] satisfies ConnectableMedium[]);

/**
 * UNA RIGA DI `nodes` NEL VOCABOLARIO DI `canConnect` — lo stesso `tileNode` che la tela usa
 * (`connect-rules.ts`), letto qui da `type`/`data` invece che da una tile già disegnata: i
 * percorsi chat/MCP non hanno una tile, solo la riga.
 */
export function canvasNodeOf(row: { type: string; data: Record<string, unknown> } | null, id = 'x'): CanvasNode | null {
  if (!row) {
    return null;
  }
  const model = typeof row.data.model === 'string' ? row.data.model : null;
  const operation = row.type === 'audio' ? audioOperationOf((row.data.params ?? {}) as { operation?: unknown }) : undefined;
  return tileNode({
    id,
    medium: MEDIUM_NODE_TYPES.has(row.type) ? (row.type as ConnectableMedium) : null,
    model,
    operation
  });
}

/**
 * IL RIFIUTO DI UN ARCO, LATO SERVER — lo stesso `canConnect` che disegna la tela, non una
 * seconda regola: senza questo un agente collega un video a un nodo audio in `text_to_speech`
 * (che prende solo testo) senza che nessuno lo dica.
 */
export function connectVerdict(source: { type: string; data: Record<string, unknown> } | null, target: { type: string; data: Record<string, unknown> } | null): string | null {
  const from = canvasNodeOf(source, 'source');
  const to = canvasNodeOf(target, 'target');
  if (!from || !to) {
    return null;
  }
  const verdict = canConnect(from, to);
  return verdict.ok ? null : verdict.why;
}

export async function connectRefusal(
  db: Db,
  input: { orgId: string; sourceNodeId: string; targetNodeId: string }
): Promise<string | null> {
  const [source, target] = await Promise.all([
    findNode(db, { orgId: input.orgId, nodeId: input.sourceNodeId }).catch(() => null),
    findNode(db, { orgId: input.orgId, nodeId: input.targetNodeId }).catch(() => null)
  ]);
  return connectVerdict(source, target);
}

const NOTHING_OFFERED: OfferedModels = { choices: [], recommended: [] };

export async function resolveNodeModel(
  medium: GenMedium,
  explicit: string | null | undefined,
  params: GenParams = {}
): Promise<ModelPick> {
  if (medium === 'audio') {
    return { ok: true, model: audioModelFor(audioOperationOf(params), explicit) };
  }

  const catalogue = await canvasModelCatalogue();
  return pickModel(medium, explicit, catalogue[medium] ?? NOTHING_OFFERED);
}

export async function nodeModelError(type: string, data: unknown): Promise<string | null> {
  const model = (data as { model?: unknown } | null)?.model;
  if (!isGenMedium(type) || typeof model !== 'string' || !model) {
    return null;
  }

  const pick = await resolveNodeModel(type, model);
  return pick.ok ? null : pick.error;
}

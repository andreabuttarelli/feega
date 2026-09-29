import { canvasModelCatalogue } from '$lib/server/canvas-catalogue';
import { pickModel, type ModelPick, type OfferedModels } from '$lib/canvas/default-models';
import { isGenMedium, type GenMedium, type GenParams } from '$lib/canvas/gen-node';
import { audioModelFor, audioOperationOf } from '$lib/canvas/audio-operations';
import type { Db } from '$lib/server/db/client';
import { findNode } from '$lib/server/repos/canvas';
import { isUncensoredModel } from '$lib/server/uncensored-access';

export const UNCENSORED_NO_INPUTS_ERROR = 'uncensored_no_inputs';

export async function targetTakesNoInputs(db: Db, input: { orgId: string; targetNodeId: string }): Promise<boolean> {
  const target = await findNode(db, { orgId: input.orgId, nodeId: input.targetNodeId }).catch(() => null);
  const model = (target?.data as { model?: unknown } | null)?.model;
  return isUncensoredModel(db, typeof model === 'string' ? model : null);
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

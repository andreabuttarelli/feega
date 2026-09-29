import { canvasModelCatalogue } from '$lib/server/canvas-catalogue';
import { pickModel, type ModelPick, type OfferedModels } from '$lib/canvas/default-models';
import { isGenMedium, type GenMedium } from '$lib/canvas/gen-node';

const NOTHING_OFFERED: OfferedModels = { choices: [], recommended: [] };

export async function resolveNodeModel(medium: GenMedium, explicit: string | null | undefined): Promise<ModelPick> {
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

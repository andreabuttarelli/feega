import type { Db } from '$lib/server/db/client';
import type { Actor } from '$lib/server/repos/actor';
import type { CanvasNodeRecord, Connection } from '$lib/server/repos/canvas';
import { planTemplate, templateById } from '$lib/canvas/templates';
import { writePlan } from './duplicate';

export async function insertTemplate(
  db: Db,
  input: { orgId: string; projectId: string; canvasId: string; templateId: string; at: { x: number; y: number }; actor?: Actor }
): Promise<{ nodes: CanvasNodeRecord[]; connections: Connection[] } | null> {
  const template = templateById(input.templateId);
  if (!template) {
    return null;
  }

  return writePlan(db, input, planTemplate(template, input.at));
}

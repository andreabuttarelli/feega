import type { FeegaMcp } from './feega-mcp';

export type Throwaway = { projectId: string; canvasId: string };

type Rows = { rows?: { id: string }[]; data?: { id: string }[] } | { id: string }[];

const idsOf = (body: unknown): string[] => {
  const rows = Array.isArray(body) ? body : ((body as { rows?: { id: string }[]; data?: { id: string }[] }).rows ?? (body as { data?: { id: string }[] }).data ?? []);
  return rows.map((r: { id: string }) => r.id);
};

export async function createThrowaway(mcp: FeegaMcp, stamp: number): Promise<Throwaway> {
  const inserted = (await mcp.callJson('insert_row', { table: 'projects', values: { name: `external-agent-eval ${stamp}`, slug: `external-agent-eval-${stamp}` } })) as Record<string, unknown>;
  const projectId = (inserted.row as { id?: string } | undefined)?.id ?? (inserted as { id?: string }).id ?? idsOf(inserted)[0];
  if (!projectId) {
    throw new Error(`project insert returned no id: ${JSON.stringify(inserted).slice(0, 300)}`);
  }

  const existing = idsOf(await mcp.callJson('query', { table: 'canvases', columns: ['id'], where: [{ column: 'project_id', op: 'eq', value: projectId }] }));
  if (existing[0]) {
    return { projectId, canvasId: existing[0] };
  }

  const made = (await mcp.callJson('edit', { op: 'create_canvas', project_id: projectId })) as { canvas?: { id?: string } };
  if (!made.canvas?.id) {
    throw new Error(`canvas creation returned no id: ${JSON.stringify(made).slice(0, 300)}`);
  }
  return { projectId, canvasId: made.canvas.id };
}

export async function deleteThrowaway(mcp: FeegaMcp, projectId: string): Promise<boolean> {
  await mcp.callJson('delete_row', { table: 'projects', where: [{ column: 'id', op: 'eq', value: projectId }] });
  const left = idsOf(await mcp.callJson('query', { table: 'projects', columns: ['id'], where: [{ column: 'id', op: 'eq', value: projectId }] }));
  return left.length === 0;
}

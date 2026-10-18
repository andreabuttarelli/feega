import { loadSession } from '../lib/auth.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { canvasApi } from '../lib/canvas.ts';
import { exportAsk, type ExportFlags } from '../lib/export-ask.ts';

async function token(): Promise<string> {
  const session = await loadSession();
  if (!session) {
    console.error('Session expired or missing. Run: feega login');
    process.exit(1);
  }
  return session.access_token;
}

export async function cmdCanvas(project: string, op: string, opts: { input?: string; org?: string }) {
  const input = opts.input ? (JSON.parse(opts.input) as Record<string, unknown>) : {};
  const result = await canvasApi.run(await token(), { project, op, input }, opts.org);
  console.log(JSON.stringify(result, null, 2));
}

export async function cmdCanvasUpload(project: string, file: string, opts: { canvas?: string; x?: number; y?: number; org?: string }) {
  const bytes = new Uint8Array(await readFile(file));
  const result = await canvasApi.upload(await token(), { project, fileName: basename(file), bytes, canvasId: opts.canvas, x: opts.x, y: opts.y }, opts.org);
  console.log(JSON.stringify(result, null, 2));
}

type ListedRoute = { provider: string; label: string; credits: number | null };

type ListedModel = { id: string; provider: string; credits: number | null; uncensored: boolean; routedVia: string | null; routes?: ListedRoute[] };

export async function cmdCanvasModels(project: string, opts: { medium: string; org?: string }) {
  const result = (await canvasApi.run(await token(), { project, op: 'list_models', input: { medium: opts.medium } }, opts.org)) as { models?: ListedModel[] };
  const rows = (result.models ?? []).flatMap((m) => {
    const routes = m.routes?.length ? m.routes : [{ provider: '', label: m.provider, credits: m.credits }];
    return routes.map((r) => ({
      id: m.id,
      provider: r.label,
      '--provider': r.provider,
      credits: r.credits ?? 'varies',
      uncensored: m.uncensored ? 'yes' : ''
    }));
  });
  console.table(rows);
}

export async function cmdCanvasExport(project: string, frames: string[], opts: ExportFlags & { out?: string; org?: string }) {
  const result = (await canvasApi.run(await token(), { project, op: 'export_selection', input: exportAsk(frames, opts) }, opts.org)) as { url?: string; name?: string };
  if (!result.url || !result.name) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  const out = opts.out ?? result.name;
  await writeFile(out, new Uint8Array(await (await fetch(result.url)).arrayBuffer()));
  console.log(out);
}

import { loadSession } from '../lib/auth.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
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

type CodeExport = { folder?: string; files?: Record<string, string>; message?: string };

export async function cmdCanvasExportCode(project: string, nodeId: string, opts: { config?: boolean; out?: string; org?: string }) {
  const input = { nodeId, mode: opts.config ? 'config' : 'inline' };
  const result = (await canvasApi.run(await token(), { project, op: 'export_code_frame', input }, opts.org)) as CodeExport;
  if (!result.files) {
    console.error(result.message ?? 'Export failed');
    process.exit(1);
  }

  const root = opts.out ?? result.folder ?? 'code-frame';
  for (const [path, text] of Object.entries(result.files)) {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text);
  }
  console.log(`${root}\n  cd ${root} && npm install && npm run dev`);
}

export async function cmdCanvasSave(project: string, canvasId: string, opts: { out?: string; org?: string }) {
  const file = await canvasApi.saveFile(await token(), { project, canvasId }, opts.org);
  const out = opts.out ?? file.name;
  await writeFile(out, file.bytes);
  console.log(out);
}

export async function cmdCanvasImport(project: string, file: string, opts: { org?: string }) {
  const result = await canvasApi.importFile(await token(), { project, bytes: new Uint8Array(await readFile(file)) }, opts.org);
  console.log(JSON.stringify(result, null, 2));
}

export async function cmdCanvasImportUrl(project: string, url: string, opts: { canvas: string; x: number; y: number; sections: boolean; org?: string }) {
  const input = { canvasId: opts.canvas, url, x: opts.x, y: opts.y, sections: opts.sections };
  const result = await canvasApi.run(await token(), { project, op: 'import_url', input }, opts.org);
  console.log(JSON.stringify(result, null, 2));
}

export async function cmdCanvasImportCode(project: string, repo: string, opts: { canvas: string; route: string; x: number; y: number; org?: string }) {
  const input = { canvasId: opts.canvas, repo, route: opts.route, x: opts.x, y: opts.y };
  const result = await canvasApi.run(await token(), { project, op: 'import_code', input }, opts.org);
  console.log(JSON.stringify(result, null, 2));
}

type FrameOpts = { canvas: string; x: number; y: number; w: number; h?: number; format?: string; org?: string };

export async function cmdCanvasFrame(project: string, opts: FrameOpts) {
  const input = { canvasId: opts.canvas, x: opts.x, y: opts.y, w: opts.w, h: opts.h, format: opts.format };
  const result = await canvasApi.run(await token(), { project, op: 'draw_frame', input }, opts.org);
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
  const result = (await canvasApi.run(await token(), { project, op: 'export_selection', input: exportAsk(frames, opts) }, opts.org)) as { url?: string; name?: string; skipped?: string[] };
  if (!result.url || !result.name) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  const out = opts.out ?? result.name;
  await writeFile(out, new Uint8Array(await (await fetch(result.url)).arrayBuffer()));
  console.log(out);
  if (result.skipped?.length) {
    console.error(`Left out of the file: ${result.skipped.join('; ')}`);
  }
}

import { loadSession } from '../lib/auth.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { canvasApi } from '../lib/canvas.ts';
import { exportAsk, type ExportFlags } from '../lib/export-ask.ts';
import { codeSource, routesPlan, RoutesStep } from '../lib/import-routes.ts';

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

export async function cmdCanvasImportUrl(project: string, url: string, opts: { canvas: string; x: number; y: number; sections: boolean; tokens: boolean; breakpoints?: boolean; org?: string }) {
  const input = { canvasId: opts.canvas, url, x: opts.x, y: opts.y, sections: opts.sections, tokens: opts.tokens, breakpoints: opts.breakpoints !== false };
  const result = await canvasApi.run(await token(), { project, op: 'import_url', input }, opts.org);
  console.log(JSON.stringify(result, null, 2));
}

const BASE_SCHEME = 'light';
const BASE_WIDTH = 1280;

export function conditionsOf(schemes: string[] | undefined, widths: string[] | undefined) {
  if (!schemes?.length && !widths?.length) {
    return undefined;
  }
  return (schemes?.length ? schemes : [BASE_SCHEME]).flatMap((scheme) => (widths?.length ? widths.map(Number) : [BASE_WIDTH]).map((width) => ({ scheme, width })));
}

export function routeDelaysOf(pairs: string[]): Record<string, number> {
  return Object.fromEntries(pairs.map((pair) => [pair.slice(0, pair.lastIndexOf('=')), Number(pair.slice(pair.lastIndexOf('=') + 1))]));
}

export async function cmdCanvasImportCode(project: string, repo: string | undefined, opts: { canvas?: string; into?: string; app?: string; route: string[]; routes?: string; scheme?: string[]; width?: string[]; designSystem?: boolean; delay?: number; routeDelay?: string[]; x: number; y: number; org?: string }) {
  const source = codeSource(repo, opts.into);
  if (!source) {
    console.error('Give a repository link or folder, or --into <frame> to add pages to a frame imported before');
    process.exit(1);
  }
  const app = opts.app ? { app: opts.app } : {};
  const plan = routesPlan(opts.routes, opts.route);
  if (plan.step === RoutesStep.Discover) {
    const read = 'into' in source ? { op: 'code_map', input: { nodeId: source.into } } : { op: 'discover_routes', input: { ...source, ...app } };
    console.log(JSON.stringify(await canvasApi.run(await token(), { project, ...read }, opts.org), null, 2));
    return;
  }
  if (!opts.canvas) {
    console.error('--canvas <id> is required to import (the canvas of the frame, with --into)');
    process.exit(1);
  }
  const conditions = conditionsOf(opts.scheme, opts.width);
  const input = { canvasId: opts.canvas, ...source, ...app, routes: plan.routes, ...(conditions ? { conditions } : {}), ...(opts.designSystem === false ? { designSystem: false } : {}), ...(opts.delay ? { captureDelayMs: opts.delay } : {}), ...(opts.routeDelay?.length ? { routeDelayMs: routeDelaysOf(opts.routeDelay) } : {}), x: opts.x, y: opts.y };
  const result = await canvasApi.run(await token(), { project, op: 'import_code', input }, opts.org);
  console.log(JSON.stringify(result, null, 2));
}

export async function cmdCanvasImportStorybook(project: string, storybook: string, opts: { canvas: string; story?: string[]; x: number; y: number; org?: string }) {
  const input = { canvasId: opts.canvas, storybook, stories: opts.story, x: opts.x, y: opts.y };
  const result = await canvasApi.run(await token(), { project, op: 'import_code', input }, opts.org);
  console.log(JSON.stringify(result, null, 2));
}

const GITHUB_OPS: Record<string, string> = { status: 'github_status', connect: 'github_connect', repos: 'github_repos', branches: 'github_branches', disconnect: 'github_disconnect' };

export async function cmdCanvasGithub(project: string, action: string, repo: string | undefined, opts: { org?: string }) {
  const op = GITHUB_OPS[action];
  if (!op) {
    console.error(`Unknown action ${action}: ${Object.keys(GITHUB_OPS).join(', ')}`);
    process.exit(1);
  }
  const result = await canvasApi.run(await token(), { project, op, input: repo ? { repo } : {} }, opts.org);
  console.log(JSON.stringify(result, null, 2));
}

const CODE_SYNC_OPS: Record<string, string> = { changes: 'code_changes', publish: 'code_publish', pull: 'code_pull', map: 'code_map' };

export async function cmdCanvasCodeSync(project: string, action: string, nodeId: string, opts: { branch?: string; org?: string }) {
  const op = CODE_SYNC_OPS[action];
  if (!op) {
    console.error(`Unknown action ${action}: ${Object.keys(CODE_SYNC_OPS).join(', ')}`);
    process.exit(1);
  }
  const result = (await canvasApi.run(await token(), { project, op, input: { nodeId, ...(opts.branch ? { branch: opts.branch } : {}) } }, opts.org)) as { patch?: string };
  console.log(action === 'changes' && result.patch !== undefined ? result.patch : JSON.stringify(result, null, 2));
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

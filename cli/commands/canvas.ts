import { loadSession } from '../lib/auth.ts';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { canvasApi } from '../lib/canvas.ts';

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

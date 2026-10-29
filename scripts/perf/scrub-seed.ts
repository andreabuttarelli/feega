import { mkdirSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { landingDoc } from '../../packages/motion-core/src/motion/codegen/fixtures/landing';

const BASE = process.env.PERF_BASE ?? 'http://localhost:5193';
const OUT_DIR = new URL('./out/', import.meta.url).pathname;

async function token(): Promise<string> {
  const db = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const signed = await db.auth.signInWithPassword({ email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });
  if (signed.error) {
    throw new Error(signed.error.message);
  }
  return signed.data.session!.access_token;
}

async function call(bearer: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { authorization: `Bearer ${bearer}`, ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} ${res.status} ${text.slice(0, 400)}`);
  }
  return JSON.parse(text);
}

const edit = (bearer: string, body: unknown) => call(bearer, '/api/v1/edit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const bearer = await token();
const projects = await call(bearer, '/api/v1/me/projects');
console.log(JSON.stringify(projects).slice(0, 600));
const projectId = process.env.PERF_PROJECT ?? (projects.projects ?? projects)[0].id;
const canvas = process.env.PERF_CANVAS ? { id: process.env.PERF_CANVAS } : await edit(bearer, { op: 'create_canvas', project_id: projectId, input: {} });
console.log(JSON.stringify(canvas).slice(0, 400));
const canvasId = canvas.canvas?.id ?? canvas.id ?? canvas.canvas_id;
const doc = landingDoc();
const frame = await edit(bearer, { op: 'draw_frame', project_id: projectId, input: { canvasId, x: 0, y: 0, w: doc.width, h: doc.height } });
console.log(JSON.stringify(frame).slice(0, 400));
const nodeId = frame.frame_id ?? frame.frameId;
const form = new FormData();
form.set('version', String(Number(process.env.PERF_VERSION ?? 1)));
form.set('doc', JSON.stringify(doc));
form.set('summary', 'Ledgerline fixture');
const saved = await fetch(`${BASE}/api/v1/projects/${projectId}/canvases/${canvasId}/motion/${nodeId}?action=save`, { method: 'POST', headers: { authorization: `Bearer ${bearer}` }, body: form });
console.log('save', saved.status, (await saved.text()).slice(0, 300));
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}scrub-fixture.json`, JSON.stringify({ projectId, canvasId, nodeId }));

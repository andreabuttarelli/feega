import { overBytes, warmCore, type Attached } from './core-web';
import { FromWorker, ToWorker, type Call, type Stats, type WorkerIn, type WorkerOut } from './render-wire';

type Scope = { postMessage: (message: WorkerOut, transfer?: Transferable[]) => void; onmessage: ((event: MessageEvent<WorkerIn>) => void) | null };
type OffscreenCore = { WebCore: { attach_offscreen: (canvas: OffscreenCanvas, width: number, height: number) => Promise<object> } };

const IDLE_POLL_MS = 2;
const scope = self as unknown as Scope;
let canvas: OffscreenCanvas | null = null;
let core: Attached | null = null;
let wasm: WebAssembly.Memory | null = null;

const reply = (message: WorkerOut, transfer: Transferable[] = []) => scope.postMessage(message, transfer);

function closeBitmaps(args: unknown[]) {
  for (const a of args) {
    if (typeof ImageBitmap !== 'undefined' && a instanceof ImageBitmap) {
      a.close();
    }
  }
}

function run(calls: Call[]): string {
  let outcome = '';
  for (const call of calls) {
    const member = (core as unknown as Record<string, (...a: unknown[]) => unknown>)[call.name];
    const result = member?.(...call.args);
    closeBitmaps(call.args);
    if (call.name === 'frame') {
      outcome = result as string;
    }
  }
  return outcome;
}

function stats(outcome: string): Stats {
  const c = core!;
  return { outcome, pending: c.cache_pending(), cacheBytes: c.cache_bytes(), pictureBytes: c.picture_bytes(), scratchBytes: c.scratch_bytes?.() ?? 0, wasmBytes: wasm?.buffer.byteLength ?? 0, lost: c.lost(), busy: c.busy?.() ?? false };
}

const waiting: Extract<WorkerIn, { kind: ToWorker.Calls }>[] = [];

function replay(m: Extract<WorkerIn, { kind: ToWorker.Calls }>) {
  let outcome = '';
  let why: string | undefined;
  try {
    outcome = run(m.calls);
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }
  const now = stats(outcome);
  reply({ kind: FromWorker.Framed, frames: m.frames, stats: now, at: performance.now(), why });
  if (now.busy) {
    untilIdle(outcome);
  }
}

let watching = false;

function untilIdle(outcome: string) {
  if (watching) {
    return;
  }
  watching = true;
  const check = () => {
    if (!core) {
      watching = false;
      return;
    }
    const now = stats(outcome);
    if (now.busy) {
      setTimeout(check, IDLE_POLL_MS);
      return;
    }
    watching = false;
    reply({ kind: FromWorker.Framed, frames: 0, stats: now, at: performance.now() });
  };
  setTimeout(check, IDLE_POLL_MS);
}

async function attach(width: number, height: number) {
  core?.free();
  core = null;
  const module = (await warmCore()) as unknown as OffscreenCore;
  core = overBytes(await module.WebCore.attach_offscreen(canvas!, width, height));
  reply({ kind: FromWorker.Attached });
  waiting.splice(0).forEach(replay);
}

const HANDLERS: { [K in ToWorker]: (m: Extract<WorkerIn, { kind: K }>) => void | Promise<void> } = {
  [ToWorker.Attach]: async (m) => {
    canvas = m.canvas ?? canvas;
    try {
      await attach(m.width, m.height);
    } catch (e) {
      reply({ kind: FromWorker.Failed, why: e instanceof Error ? e.message : String(e) });
    }
  },
  [ToWorker.Calls]: (m) => {
    if (!core) {
      waiting.push(m);
      return;
    }
    replay(m);
  },
  [ToWorker.Poster]: async (m) => {
    const bytes = core?.poster ? await core.poster(m.group, m.width, m.height, m.scale).catch(() => null) : null;
    reply({ kind: FromWorker.Poster, id: m.id, bytes }, bytes ? [bytes.buffer] : []);
  },
  [ToWorker.Free]: () => {
    core?.free();
    core = null;
  }
};

scope.onmessage = (event) => void (HANDLERS[event.data.kind] as (m: WorkerIn) => void | Promise<void>)(event.data);

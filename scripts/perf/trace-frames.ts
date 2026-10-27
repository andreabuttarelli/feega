import { readFileSync } from 'node:fs';

type Ev = { name: string; ph: string; pid: number; tid: number; ts: number; dur?: number; id?: string; args?: Record<string, unknown> };
type CallFrame = { functionName: string; url?: string; lineNumber?: number };
type ProfileNode = { id: number; callFrame: CallFrame; parent?: number };

const LONG_MS = 33;
const TOP = 15;
const GC_NAMES = new Set(['MinorGC', 'MajorGC', 'V8.GC_SCAVENGER', 'V8.GC_MARK_COMPACTOR', 'V8.GCFinalizeMC', 'V8.GCScavenger', 'BlinkGC.AtomicPhase']);

enum Cause {
  Js = 'JS',
  Gc = 'GC',
  Wasm = 'wasm',
  Native = 'native (browser APIs, style, GPU calls)',
  Idle = 'main thread idle (waiting: GPU/vsync)'
}

const file = process.argv[2];
const events = (JSON.parse(readFileSync(file, 'utf8')) as { traceEvents: Ev[] }).traceEvents;

const threadName = new Map<string, string>();
for (const e of events) {
  if (e.ph === 'M' && e.name === 'thread_name') {
    threadName.set(`${e.pid}:${e.tid}`, String((e.args as { name: string }).name));
  }
}

const rafs = events.filter((e) => e.name === 'FireAnimationFrame' && e.ph === 'X');
const mainKey = [...rafs.reduce((m, e) => m.set(`${e.pid}:${e.tid}`, (m.get(`${e.pid}:${e.tid}`) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0]?.[0];
if (!mainKey) {
  throw new Error('no FireAnimationFrame on any thread');
}
const [mainPid, mainTid] = mainKey.split(':').map(Number);
const onMain = (e: Ev) => e.pid === mainPid && e.tid === mainTid;
const frameStarts = [...new Set(rafs.filter(onMain).map((e) => e.ts))].sort((a, b) => a - b);

const nodes = new Map<number, ProfileNode>();
const samples: { ts: number; node: number }[] = [];
const profileStart = new Map<string, number>();
for (const e of events) {
  if (e.name === 'Profile' && e.pid === mainPid) {
    profileStart.set(String(e.id), Number((e.args as { data: { startTime: number } }).data.startTime));
  }
}
const chunks = events.filter((x) => x.name === 'ProfileChunk' && x.pid === mainPid);
const chunkCount = chunks.reduce((m, e) => m.set(String(e.id), (m.get(String(e.id)) ?? 0) + 1), new Map<string, number>());
const mainProfile = [...chunkCount].sort((a, b) => b[1] - a[1])[0]?.[0];
const cursor = new Map<string, number>();
for (const e of chunks.filter((x) => String(x.id) === mainProfile)) {
  const data = (e.args as { data: { cpuProfile?: { nodes?: ProfileNode[]; samples?: number[] }; timeDeltas?: number[] } }).data;
  for (const n of data.cpuProfile?.nodes ?? []) {
    nodes.set(n.id, n);
  }
  let t = cursor.get(String(e.id)) ?? profileStart.get(String(e.id)) ?? 0;
  (data.cpuProfile?.samples ?? []).forEach((node, i) => {
    t += data.timeDeltas?.[i] ?? 0;
    samples.push({ ts: t, node });
  });
  cursor.set(String(e.id), t);
}
samples.sort((a, b) => a.ts - b.ts);

const isWasm = (f: CallFrame) => (f.url ?? '').includes('.wasm') || f.functionName.startsWith('$') || f.functionName.startsWith('wasm-function');

function causeOf(id: number): Cause {
  const f = nodes.get(id)?.callFrame;
  if (!f) {
    return Cause.Idle;
  }
  if (f.functionName === '(idle)') {
    return Cause.Idle;
  }
  if (f.functionName === '(garbage collector)') {
    return Cause.Gc;
  }
  if (isWasm(f)) {
    return Cause.Wasm;
  }
  if (f.functionName === '(program)' || !f.url) {
    return Cause.Native;
  }
  return Cause.Js;
}

const label = (f: CallFrame) => `${f.functionName || '(anonymous)'} ${(f.url ?? '').split('/').slice(-1)[0]}:${f.lineNumber}`;

function jsOwner(id: number): string {
  let n = nodes.get(id);
  while (n) {
    if (n.callFrame.url && !isWasm(n.callFrame)) {
      return label(n.callFrame);
    }
    n = n.parent !== undefined ? nodes.get(n.parent) : undefined;
  }
  return '(no JS frame)';
}

const gcEvents = events.filter((e) => onMain(e) && GC_NAMES.has(e.name) && e.ph === 'X');
const gpuThreads = new Set([...threadName].filter(([, n]) => n === 'CrGpuMain' || n.startsWith('Dawn') || n === 'VizCompositorThread').map(([k]) => k));
const gpuBusy = events.filter((e) => e.ph === 'X' && e.dur && gpuThreads.has(`${e.pid}:${e.tid}`) && (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'RunTask'));

const totals = new Map<Cause, number>();
const owners = new Map<string, number>();
const longFrames: { at: number; ms: number; by: Record<string, number> }[] = [];
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

for (let i = 1; i < frameStarts.length; i++) {
  const [t0, t1] = [frameStarts[i - 1], frameStarts[i]];
  const ms = (t1 - t0) / 1000;
  if (ms <= LONG_MS) {
    continue;
  }
  const by = new Map<Cause, number>();
  const inFrame = samples.filter((s) => s.ts >= t0 && s.ts < t1);
  inFrame.forEach((s, k) => {
    const next = inFrame[k + 1]?.ts ?? t1;
    const dt = (next - s.ts) / 1000;
    const cause = causeOf(s.node);
    by.set(cause, (by.get(cause) ?? 0) + dt);
    if (cause === Cause.Js || cause === Cause.Native) {
      owners.set(`${cause}: ${jsOwner(s.node)}`, (owners.get(`${cause}: ${jsOwner(s.node)}`) ?? 0) + dt);
    }
    if (cause === Cause.Wasm) {
      const f = nodes.get(s.node)!.callFrame;
      owners.set(`wasm: ${f.functionName}`, (owners.get(`wasm: ${f.functionName}`) ?? 0) + dt);
    }
  });
  for (const [c, v] of by) {
    totals.set(c, (totals.get(c) ?? 0) + v);
  }
  const gcMs = gcEvents.reduce((s, e) => s + overlap(t0, t1, e.ts, e.ts + e.dur!) / 1000, 0);
  const gpuMs = gpuBusy.reduce((s, e) => s + overlap(t0, t1, e.ts, e.ts + e.dur!) / 1000, 0);
  longFrames.push({ at: Math.round((t0 - frameStarts[0]) / 1000), ms: Math.round(ms), by: { ...Object.fromEntries([...by].map(([c, v]) => [c, Math.round(v)])), 'gc events': Math.round(gcMs), 'gpu process busy': Math.round(gpuMs) } });
}

const sum = [...totals.values()].reduce((s, v) => s + v, 0);
console.log(`frames: ${frameStarts.length}, over ${LONG_MS} ms: ${longFrames.length}, long-frame time: ${Math.round(longFrames.reduce((s, f) => s + f.ms, 0))} ms`);
console.log('\nattribution of long-frame time (main-thread samples):');
for (const [c, v] of [...totals].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${Math.round(v)} ms  ${Math.round((v / sum) * 100)}%  ${c}`);
}
console.log('\ntop owners inside long frames:');
for (const [k, v] of [...owners].sort((a, b) => b[1] - a[1]).slice(0, TOP)) {
  console.log(`  ${Math.round(v)} ms  ${k}`);
}
console.log('\nlong frames:');
for (const f of longFrames.sort((a, b) => b.ms - a.ms).slice(0, TOP)) {
  console.log(`  +${f.at} ms  ${f.ms} ms  ${JSON.stringify(f.by)}`);
}

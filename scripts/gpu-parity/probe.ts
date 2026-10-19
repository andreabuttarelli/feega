export const PROBE_REQUEST = 'gpu-parity:probe';
export const PROBE_REPLY = 'gpu-parity:probe-reply';

export type Spec = { doc: unknown; assets: Record<string, string>; origin: string; faces?: string };
export type ShotsInput = { html: string; spec: Spec; displayWidth?: number; times: number[]; width: number; height: number; preference: string };
export type ShotsResult = { pngs: string[]; ms: number; backend: string; runs: number; stats: Record<string, number>[]; unsupported?: string[] };
export type ExportInput = { html: string; spec: Spec; times: number[]; width: number; height: number; fps: number; lanes: number; preference: string; keep: boolean };
export type ExportResult = { wallMs: number; frames: number; mp4: string | null; fallback?: boolean };
export type PreviewInput = { html: string; spec: Spec; seconds: number; warmMs: number; preference: string };
export type PreviewResult = { frames: number; p50: number; p95: number; dropped: number; workP50: number; workP95: number };

function probe(request: string, reply: string) {
  const deltas: number[] = [];
  let last = performance.now();
  const tick = (now: number) => {
    deltas.push(now - last);
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === request) {
      (e.source as Window).postMessage({ type: reply, deltas: deltas.splice(0) }, '*');
    }
  });
  addEventListener('load', () => deltas.splice(0));
}

export const PREVIEW_PROBE = `(${probe.toString()})(${JSON.stringify(PROBE_REQUEST)},${JSON.stringify(PROBE_REPLY)});`;

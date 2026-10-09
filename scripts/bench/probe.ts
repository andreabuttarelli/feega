export const STATS_REQUEST = 'bench:stats';
export const STATS_REPLY = 'bench:stats-reply';

export type Stages = { seek: number; serialize: number; paint: number; readback: number; shots: number; svgs: number };
export type BenchInput = { html: string; layering: string; lanes: number; times: number[]; width: number; height: number; fps: number; keep: boolean };
export type ParityInput = { html: string; layering: string; times: number[]; width: number; height: number };
export type ParityFrame = { time: number; mean: number; over: number; svgs: number; png: string };
export type BenchResult = { wallMs: number; frames: number; stages: Stages; encodeMs: number; mp4: string | null };

type Lib = { toSvg: (...args: unknown[]) => Promise<string> };

function probe(request: string, statsRequest: string, statsReply: string) {
  const stages = { seek: 0, serialize: 0, paint: 0, readback: 0, shots: 0, svgs: 0 };
  let asked = 0;
  let svgStart = 0;
  let svgEnd = 0;

  addEventListener('message', (e: MessageEvent) => {
    if (e.data?.type === request) {
      asked = performance.now();
      stages.shots += 1;
      return;
    }
    if (e.data?.type === statsRequest) {
      (e.source as Window).postMessage({ type: statsReply, stages }, '*');
    }
  });

  let lib: Lib | undefined;
  let wrapped: Lib | undefined;
  const timed = (value: Lib): Lib =>
    Object.assign(Object.create(value), {
      toSvg: async (...args: unknown[]) => {
        svgStart = performance.now();
        stages.svgs += 1;
        stages.seek += svgStart - asked;
        const out = await value.toSvg(...args);
        svgEnd = performance.now();
        stages.serialize += svgEnd - svgStart;
        return out;
      }
    });
  Object.defineProperty(window, 'htmlToImage', {
    configurable: true,
    get: () => (lib?.toSvg ? (wrapped ??= timed(lib)) : lib),
    set: (value: Lib) => {
      lib = value;
    }
  });

  const bitmap = window.createImageBitmap.bind(window);
  window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
    const t = performance.now();
    stages.paint += t - svgEnd;
    const out = await bitmap(...args);
    stages.readback += performance.now() - t;
    return out;
  }) as typeof createImageBitmap;
}

export function withProbe(html: string, request: string, statsRequest: string, statsReply: string): string {
  const script = `<script>(${probe.toString()})(${JSON.stringify(request)},${JSON.stringify(statsRequest)},${JSON.stringify(statsReply)});</script>`;
  return html.replace(/<head[^>]*>/, (head) => `${head}${script}`);
}

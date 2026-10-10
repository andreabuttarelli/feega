import { VECTOR_TOKEN } from '$lib/motion/vector-ui/piece';
export const EMPTY_EDGE_DENSITY = 0.02;
export const BEAT_TOLERANCE_S = 0.1;

const EDGE_STEP = 48;

const TEXT_DEFAULT_SIZE: Record<string, number> = { Title: 0.11, Text: 0.04, Kicker: 0.025, Caption: 0.035 };

export type Facts = {
  exists: boolean;
  duration: number | null;
  scenes: number | null;
  meanHold: number | null;
  maxHold: number | null;
  emptyShare: number | null;
  textMinShare: number | null;
  recreatedUi: number | null;
  kitUi: number | null;
  beatAlignment: number | null;
  gateBlockingLeft: number | null;
  toolErrors: number | null;
  pageErrors: number | null;
  costUsd: number | null;
  wallS: number | null;
};

export const TASTE_AXES = ['dynamism', 'hierarchy', 'density', 'premium', 'brandFidelity'] as const;

export type TasteAxis = (typeof TASTE_AXES)[number];

export type Taste = Record<TasteAxis, { score: number; reason: string }>;

export type CaseResult = { name: string; prompt: string; unrun: string | null; facts: Facts | null; taste: Taste | null };

type Clip = { component: string; props?: Record<string, unknown> };
type Doc = { tracks: Array<{ clips: Clip[] }>; components?: Record<string, { source: { js: string } }> };
type ToolCall = { toolName: string; output: unknown; status?: string };
type Message = { tool_calls?: ToolCall[] | null };

export function edgeDensity(gray: Uint8Array, width: number, height: number): number {
  let edges = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const dx = x + 1 < width ? Math.abs(gray[i + 1] - gray[i]) : 0;
      const dy = y + 1 < height ? Math.abs(gray[i + width] - gray[i]) : 0;
      edges += dx + dy > EDGE_STEP ? 1 : 0;
    }
  }
  return edges / (width * height);
}

export function emptyShare(densities: readonly number[], threshold = EMPTY_EDGE_DENSITY): number | null {
  if (!densities.length) {
    return null;
  }
  return densities.filter((d) => d < threshold).length / densities.length;
}

export function holdStats(cuts: readonly number[], duration: number) {
  const inside = cuts.filter((c) => c > 0 && c < duration).sort((a, b) => a - b);
  const bounds = [0, ...inside, duration];
  const holds = bounds.slice(1).map((b, i) => b - bounds[i]);
  return { scenes: holds.length, meanHold: duration / holds.length, maxHold: Math.max(...holds) };
}

export function beatAlignment(cuts: readonly number[], beats: readonly number[], tolerance = BEAT_TOLERANCE_S): number | null {
  if (!cuts.length || !beats.length) {
    return null;
  }
  const near = (c: number) => beats.some((b) => Math.abs(b - c) <= tolerance);
  return cuts.filter(near).length / cuts.length;
}

const clipsOf = (doc: Doc) => doc.tracks.flatMap((t) => t.clips);

type TimedDoc = { fps: number; tracks: Array<{ kind: string; clips: Array<{ from: number; parent?: string | null }> }> };

export function docCuts(doc: TimedDoc): number[] {
  const starts = doc.tracks
    .filter((t) => t.kind === 'visual')
    .flatMap((t) => t.clips)
    .filter((c) => !c.parent && c.from > 0)
    .map((c) => c.from / doc.fps);
  return [...new Set(starts)].sort((a, b) => a - b);
}

export function textMinShare(doc: Doc): number | null {
  const sizes = clipsOf(doc)
    .filter((c) => c.component in TEXT_DEFAULT_SIZE)
    .map((c) => Number(c.props?.size ?? TEXT_DEFAULT_SIZE[c.component]));
  return sizes.length ? Math.min(...sizes) : null;
}

export function uiLayers(doc: Doc, kitNames: ReadonlySet<string>) {
  const ui = clipsOf(doc).filter((c) => c.component === 'Custom' && typeof c.props?.name === 'string');
  const kit = ui.filter((c) => kitNames.has(String(c.props?.name))).length;
  const recreated = ui.filter((c) => VECTOR_TOKEN.test(doc.components?.[String(c.props?.name)]?.source.js ?? '')).length;
  return { recreated, kit };
}

const callsOf = (messages: readonly Message[]) => messages.flatMap((m) => m.tool_calls ?? []);

export function gateBlockingLeft(messages: readonly Message[]): number | null {
  const looks = callsOf(messages).filter((c) => c.toolName === 'view_frames');
  const blocking = (looks.at(-1)?.output as { blocking?: unknown[] } | null | undefined)?.blocking;
  return Array.isArray(blocking) ? blocking.length : null;
}

export function toolErrors(messages: readonly Message[]): number {
  const failed = (c: ToolCall) => c.status === 'error' || (c.output as { ok?: boolean } | null)?.ok === false;
  return callsOf(messages).filter(failed).length;
}

export function spentUsd(calls: ReadonlyArray<{ cost_usd: number | string | null }>): number {
  return calls.reduce((sum, c) => sum + Number(c.cost_usd ?? 0), 0);
}

export function compareRuns(current: readonly CaseResult[], previous: readonly CaseResult[]): Record<string, Partial<Record<keyof Facts, number>>> {
  const before = new Map(previous.map((r) => [r.name, r]));
  return Object.fromEntries(
    current.map((r) => {
      const old = before.get(r.name)?.facts;
      const deltas: Partial<Record<keyof Facts, number>> = {};
      for (const [key, value] of Object.entries(r.facts ?? {}) as Array<[keyof Facts, unknown]>) {
        const was = old?.[key];
        if (typeof value === 'number' && typeof was === 'number') {
          deltas[key] = value - was;
        }
      }
      return [r.name, deltas];
    })
  );
}

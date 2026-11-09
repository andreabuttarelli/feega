import { Step, timeline } from './frame-timeline';

type Mark = { name: string; startTime: number };
type Resource = { name: string; startTime: number; responseEnd: number; transferSize: number; encodedBodySize: number; initiatorType: string };
type Navigation = { responseEnd: number; domContentLoadedEventEnd: number };

export type LoadInput = { marks: readonly Mark[]; resources: readonly Resource[]; images: ReadonlyMap<string, readonly string[]>; navigation: Navigation | null };

const EVERY_FRAME = 'all';
const SOURCES = /\/sources\?ids=([^&]+)/;
const CONTENT_STEPS = [Step.Vectors, Step.Whole];

const bytesOf = (r: Resource) => r.transferSize || r.encodedBodySize;

function firsts(steps: readonly { step: Step; at: number }[]): Partial<Record<Step, number>> {
  const out: Partial<Record<Step, number>> = {};
  for (const s of steps) {
    out[s.step] = Math.min(out[s.step] ?? Infinity, s.at);
  }
  return out;
}

export function loadReport({ marks, resources, images, navigation }: LoadInput) {
  const byUrl = new Map(resources.map((r) => [r.name, r]));
  const rows = timeline(marks);
  const everyFrame = firsts(rows.find((r) => r.id === EVERY_FRAME)?.steps ?? []);

  const frames = rows
    .filter((r) => r.id !== EVERY_FRAME)
    .map((r) => {
      const steps = firsts(r.steps);
      const loaded = (images.get(r.id) ?? []).map((url) => byUrl.get(url)).filter((x): x is Resource => !!x);
      const content = Math.min(...CONTENT_STEPS.map((s) => steps[s] ?? Infinity));
      return { id: r.id, steps, content: Number.isFinite(content) ? content : null, images: { count: images.get(r.id)?.length ?? 0, bytes: loaded.reduce((n, x) => n + bytesOf(x), 0), lastEnd: loaded.length ? Math.round(Math.max(...loaded.map((x) => x.responseEnd))) : null } };
    })
    .sort((a, b) => (a.content ?? Infinity) - (b.content ?? Infinity));

  const sources = resources.flatMap((r) => {
    const ids = SOURCES.exec(r.name)?.[1];
    return ids ? [{ ids: ids.split(',').length, start: Math.round(r.startTime), end: Math.round(r.responseEnd), bytes: bytesOf(r) }] : [];
  });

  const contents = frames.map((f) => f.content).filter((c): c is number => c !== null);
  const totals = {
    frames: frames.length,
    page: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
    sourceBytes: sources.reduce((n, s) => n + s.bytes, 0),
    imageBytes: frames.reduce((n, f) => n + f.images.bytes, 0),
    firstContent: contents.length ? Math.min(...contents) : null,
    lastContent: contents.length ? Math.max(...contents) : null,
    allVectors: everyFrame[Step.AllVectors] ?? null,
    sharp: everyFrame[Step.Sharp] ?? null
  };

  return { frames, sources, totals };
}

export type LoadReport = ReturnType<typeof loadReport>;

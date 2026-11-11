const PREFIX = 'frame|';
const SEPARATOR = '|';
const GROUP_SEPARATOR = ':';
const VIEW = '@bp:';

export enum Step {
  Asked = 'asked',
  Source = 'source',
  Built = 'built',
  Vectors = 'vectors',
  Whole = 'whole',
  Put = 'put',
  Patched = 'patched',
  Pictured = 'pictured',
  Drawn = 'drawn',
  MainAsked = 'main-asked',
  MainBuild = 'main-build',
  MainBuilt = 'main-built',
  Thumb = 'thumb',
  Images = 'images',
  AllVectors = 'all-vectors',
  Sharp = 'sharp'
}

export type FrameSteps = { id: string; steps: { step: Step; at: number; group: string }[] };

const ONCE_PER_GROUP = new Set([Step.Put, Step.Patched, Step.Pictured, Step.Drawn, Step.Thumb]);
const marked = new Set<string>();

export function markFrame(group: string, step: Step) {
  const name = `${PREFIX}${step}${SEPARATOR}${group}`;
  if (!ONCE_PER_GROUP.has(step)) {
    performance.mark(name);
    return;
  }
  if (marked.has(name)) {
    return;
  }
  marked.add(name);
  performance.mark(name);
}

export function timeline(marks: readonly { name: string; startTime: number }[]): FrameSteps[] {
  const rows = new Map<string, FrameSteps>();
  for (const m of marks.filter((m) => m.name.startsWith(PREFIX))) {
    const [step, group] = m.name.slice(PREFIX.length).split(SEPARATOR);
    const id = group.split(GROUP_SEPARATOR).slice(0, group.includes(VIEW) ? 2 : 1).join(GROUP_SEPARATOR);
    const row = rows.get(id) ?? rows.set(id, { id, steps: [] }).get(id)!;
    row.steps.push({ step: step as Step, at: Math.round(m.startTime), group });
  }
  return [...rows.values()];
}

const ONE_FRAME_MS = 1000 / 60;
const THUMB_GROUP = ':thumb';
const PLACEHOLDER_GROUP = ':[';

export type ScreenWatch = FrameSteps & { blankShotAt: number | null };
export type Late = { id: string; drawnAt: number; blankShotAt: number };

const vectorsDrawnAt = (steps: FrameSteps['steps']) => steps.find((s) => s.step === Step.Drawn && !s.group.endsWith(THUMB_GROUP) && !s.group.includes(PLACEHOLDER_GROUP))?.at ?? null;

export function shownLate(frames: readonly ScreenWatch[]): Late[] {
  return frames.flatMap(({ id, steps, blankShotAt }) => {
    const drawnAt = vectorsDrawnAt(steps);
    if (drawnAt === null || blankShotAt === null || blankShotAt <= drawnAt + ONE_FRAME_MS) {
      return [];
    }
    return [{ id, drawnAt, blankShotAt }];
  });
}

type Listed = { kind: string; src?: string; items?: Listed[] };

const noted = new Map<string, string[]>();

const sourcesIn = (items: readonly Listed[]): string[] => items.flatMap((i) => [...(i.kind === 'image' && i.src ? [i.src] : []), ...sourcesIn(i.items ?? [])]);

export function noteImages(id: string, list: { items: readonly Listed[] }) {
  noted.set(id, [...new Set(sourcesIn(list.items).map((src) => new URL(src, location.href).href))]);
  markFrame(id, Step.Images);
}

export const imagesNoted = (): ReadonlyMap<string, readonly string[]> => noted;
